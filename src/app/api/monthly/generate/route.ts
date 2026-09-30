import { NextRequest, NextResponse } from 'next/server';
import { Report, Member, MonthlyReport } from '@/lib/types';
import { formatCycleRange } from '@/lib/week';
import { getReports, getMembers } from '@/lib/db';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

function sanitizePlaceholders(text: string): string {
  if (!text) return '';
  return text
    .replace(/客户XX家/g, '多家合作客户')
    .replace(/正式交付XX批次/g, '正式交付多批次')
    .replace(/交付XX家/g, '交付多家机构')
    .replace(/POC测试XX家/g, '多家机构POC测试')
    .replace(/售前方案支持XX家/g, '多家机构售前方案支持')
    .replace(/XX批次/g, '多批次')
    .replace(/XX家/g, '多家')
    .replace(/XX项/g, '多项')
    .replace(/XX个/g, '多个')
    .replace(/XX/g, '');
}

function parseMarkdownSections(markdown: string) {
  let summary_overview = '';
  let products_and_features = '';
  let support_needed = '无。';
  let next_month_plan = '';

  const clean = sanitizePlaceholders(
    markdown.replace(/^#\s+[^\n]+\n+/, '').replace(/\*\*统计周期\*\*:[^\n]+\n+/, '')
  );

  const sec1Match = clean.match(/(?:^|\n)(?:##\s*)?[一1]、[^\n]*\n([\s\S]*?)(?=(?:^|\n)(?:##\s*)?[二2]、|$)/);
  const sec2Match = clean.match(/(?:^|\n)(?:##\s*)?[二2]、[^\n]*\n([\s\S]*?)(?=(?:^|\n)(?:##\s*)?[三3]、|$)/);
  const sec3Match = clean.match(/(?:^|\n)(?:##\s*)?[三3]、[^\n]*\n([\s\S]*?)(?=(?:^|\n)(?:##\s*)?[四4]、|$)/);
  const sec4Match = clean.match(/(?:^|\n)(?:##\s*)?[四4]、[^\n]*\n([\s\S]*?)$/);

  if (sec1Match) summary_overview = sec1Match[1].trim();
  if (sec2Match) products_and_features = sec2Match[1].trim();
  if (sec3Match) support_needed = sec3Match[1].trim();
  if (sec4Match) next_month_plan = sec4Match[1].trim();

  return {
    summary_overview: summary_overview || clean,
    products_and_features,
    support_needed,
    next_month_plan,
  };
}

// 100% 无损保真周报整理算法：
// 彻底去除正则黑名单与任何截断限制，一条不删、一个字不漏！
// 仅按照周报已有的业务分类清晰排版，既大幅降低大模型检索梳理的心智负担，又 100% 确保输入零失真、零遗漏。
interface LosslessProcessedData {
  weeklyDataText: string;
  totalItems: number;
  categoryStats: Record<string, number>;
  groups: Record<string, string[]>;
  rawItems: { memberName: string; category: string; title: string; description: string }[];
  nextPlans: { memberName: string; plan: string }[];
}

function formatLosslessWeeklyData(matchedReports: Report[], members: Member[]): LosslessProcessedData {
  const groups: Record<string, string[]> = {
    '产品研发与平台迭代': [],
    '重点合同交付': [],
    '金融机构POC测试': [],
    '售前技术支持与方案': [],
    '数据安全与日常综合': [],
    '下月及后续工作规划': [],
  };

  const categoryStats: Record<string, number> = {};
  const rawItems: { memberName: string; category: string; title: string; description: string }[] = [];
  const nextPlans: { memberName: string; plan: string }[] = [];
  let totalItems = 0;

  matchedReports.forEach((rep) => {
    const member = members.find((m) => m.id === rep.member_id);
    const mName = member ? member.name : ((rep as any).member_name || '成员');

    if (Array.isArray(rep.items)) {
      rep.items.forEach((it) => {
        const cat = (it.category || '').trim();
        const rawTitle = (it.title || '').trim();
        const rawDesc = (it.description || '').trim();
        if (!rawTitle && !rawDesc) return;

        totalItems++;
        categoryStats[cat || '未分类'] = (categoryStats[cat || '未分类'] || 0) + 1;
        rawItems.push({ memberName: mName, category: cat, title: rawTitle, description: rawDesc });

        // 完整保留成员名、事项标题与详细描述，绝不截断任何字句
        const line = `· [${mName}] ${rawTitle ? `【${rawTitle}】` : ''}${rawDesc ? rawDesc : ''}`;

        if (cat === '产品研发') {
          groups['产品研发与平台迭代'].push(line);
        } else if (cat === '合同交付') {
          groups['重点合同交付'].push(line);
        } else if (cat === 'POC') {
          groups['金融机构POC测试'].push(line);
        } else if (cat === '售前支持') {
          groups['售前技术支持与方案'].push(line);
        } else {
          groups['数据安全与日常综合'].push(line);
        }
      });
    }

    if (rep.next_plan?.trim()) {
      nextPlans.push({ memberName: mName, plan: rep.next_plan.trim() });
      groups['下月及后续工作规划'].push(`· [${mName}] ${rep.next_plan.trim()}`);
    }
  });

  const out: string[] = [];
  for (const [sec, list] of Object.entries(groups)) {
    if (list.length > 0) {
      out.push(`=== ${sec} (全量保留共 ${list.length} 条真实事项，一条未删) ===`);
      out.push(list.join('\n'));
      out.push('');
    }
  }

  return {
    weeklyDataText: out.join('\n').trim(),
    totalItems,
    categoryStats,
    groups,
    rawItems,
    nextPlans,
  };
}

// 本地公文智能月报引擎（仅在 Dify 彻底断网、服务宕机或超过 280 秒时启动兜底保护）
function generateLocalMonthlyDraft(
  month: number,
  title: string,
  cycleName: string,
  processed: LosslessProcessedData
): string {
  const nextMonth = (month % 12) + 1;
  const { rawItems, nextPlans, groups } = processed;

  // 提取产品研发项目列表（去重）
  const rdProjects = Array.from(
    new Set(rawItems.filter((i) => i.category === '产品研发').map((i) => i.title).filter(Boolean))
  );

  // 提取交付机构列表（去重）
  const deliveryClients = Array.from(
    new Set(rawItems.filter((i) => i.category === '合同交付').map((i) => i.title).filter(Boolean))
  );

  // 提取 POC 金融机构列表（去重）
  const pocClients = Array.from(
    new Set(rawItems.filter((i) => i.category === 'POC').map((i) => i.title).filter(Boolean))
  );

  // 提取售前客户或支持场景（去重）
  const preSaleClients = Array.from(
    new Set(rawItems.filter((i) => i.category === '售前支持').map((i) => i.title).filter(Boolean))
  );

  // 1. 概述提炼
  const rdSummary = rdProjects.slice(0, 4).join('、') || '核心业务平台与底层服务';
  const overviewText = `${month}月，产品与技术团队围绕核心产品研发迭代与业务交付落地主线，稳步推进${rdSummary}等系统功能上线与架构优化；累计服务重点合作机构${deliveryClients.length > 0 ? deliveryClients.length : '多'}家，完成多批次数据验证与批量查询交付；扎实推进${pocClients.slice(0, 4).join('、') || '多家金融机构'}POC测试与场景验证；全月业务推进有序，各项关键交付与研发任务按期闭环。`;

  // 2. 研发创新与优化（按项目聚合真实描述）
  const rdMap = new Map<string, string[]>();
  rawItems.filter((i) => i.category === '产品研发').forEach((i) => {
    const key = i.title || '核心业务平台研发';
    if (!rdMap.has(key)) rdMap.set(key, []);
    if (i.description) rdMap.get(key)!.push(i.description);
  });

  const rdEntries = Array.from(rdMap.entries());
  const rdHalf = Math.ceil(rdEntries.length / 2);
  const rdPart1 = rdEntries.slice(0, rdHalf);
  const rdPart2 = rdEntries.slice(rdHalf);

  let sec2Sub1 = '';
  if (rdPart1.length > 0) {
    rdPart1.forEach(([prj, descs], idx) => {
      const summary = descs[0] || '按既定计划完成版本研发与上线测试';
      sec2Sub1 += `${idx + 1}.【${prj}研发与应用】。${summary}。\n`;
    });
  } else {
    sec2Sub1 = '1.【核心创新产品稳步研发】。按计划推进重点系统功能研发与测试闭环。\n';
  }

  let sec2Sub2 = '';
  if (rdPart2.length > 0) {
    rdPart2.forEach(([prj, descs], idx) => {
      const summary = descs[0] || '完成功能优化、架构完善与接口性能调优';
      sec2Sub2 += `${idx + 1}.【${prj}功能优化】。${summary}。\n`;
    });
  } else {
    sec2Sub2 = '1.【系统架构与接口功能持续调优】。完成配套接口性能优化与业务场景适配。\n';
  }

  // 3. 交付服务质效
  let deliverySectionText = '';
  if (deliveryClients.length > 0) {
    const clientsStr = deliveryClients.slice(0, 12).join('、');
    deliverySectionText += `1.重点客户交付。推进并完成${clientsStr}等多家合作机构的数据核对、批量查询与正式交付工作。\n`;
  }
  if (pocClients.length > 0) {
    const pocStr = pocClients.slice(0, 10).join('、');
    deliverySectionText += `2.POC测试。积极推进${pocStr}等多家金融机构的POC数据撞库、指标回溯与场景测试。\n`;
  }
  if (preSaleClients.length > 0) {
    const preStr = preSaleClients.slice(0, 8).join('、');
    deliverySectionText += `3.售前方案支撑。紧密配合市场部门，开展${preStr}等相关业务前期的技术方案交流、需求评估与环境开通。\n`;
  }
  if (!deliverySectionText.trim()) {
    deliverySectionText = '常态化推进各项机构客户数据交付与测试支持保障。\n';
  }

  // 4. 综合工作
  let generalText = '常态化推进网络与数据合规自查、数据合规审计及日常综合事务保障。';
  const genItems = rawItems.filter((i) => i.category !== '产品研发' && i.category !== '合同交付' && i.category !== 'POC' && i.category !== '售前支持');
  if (genItems.length > 0) {
    const summary = genItems.slice(0, 3).map((g) => g.description || g.title).join('；');
    generalText = `1.【数据安全与合规管理】。常态化推进数据合规自查，${summary}。`;
  }

  // 5. 需支持事项
  let supportText = '无。';
  const blockedItems = rawItems.filter((i) => /阻塞|受阻|依赖|协调|卡点|未到位/.test(i.title + i.description));
  if (blockedItems.length > 0) {
    supportText = blockedItems.slice(0, 3).map((b) => `【${b.title}】：${b.description}`).join('\n');
  }

  // 6. 下月规划
  const rdNext = nextPlans.filter((p) => /研发|开发|模型|功能|优化|设计/.test(p.plan));
  const delNext = nextPlans.filter((p) => /交付|对接|上线|测试|验证|客户|银行/.test(p.plan));

  const rdPlans = rdNext.length > 0
    ? rdNext.slice(0, 3).map((p, i) => `${i + 1}.推进${p.plan}。`).join('\n')
    : '1.持续推进重点业务系统与平台功能版本迭代及模型算法优化。';

  const delPlans = delNext.length > 0
    ? delNext.slice(0, 3).map((p, i) => `${i + 1}.做好${p.plan}。`).join('\n')
    : '1.持续保障重点金融机构与合作客户的交付对接与POC测试落地。';

  const genPlans = '1.常态化开展合规审查、网络数据安全防护与日常综合事务管理。';

  return `# ${title}
**统计周期**：${cycleName}

一、${month}月工作总结
${overviewText}

二、核心产品开发及优化情况

（一）产品创新稳步推进
${sec2Sub1.trim()}

（二）产品优化全面落地
${sec2Sub2.trim()}

（三）交付服务质效稳步提升
${deliverySectionText.trim()}

（四）综合工作有序开展
${generalText.trim()}

三、需支持事项
${supportText.trim()}

四、${nextMonth}月工作计划

（一）产品研发与平台迭代
${rdPlans}

（二）重点项目交付与推进
${delPlans}

（三）合规安全管理
${genPlans}`;
}

// 核心流式保活调用 Dify
async function callDifyWorkflowStreaming(
  inputs: Record<string, any>,
  difyBaseUrl: string,
  difyApiKey: string,
  timeoutMs: number = 240000
): Promise<{ result: string; error?: string }> {
  const startTime = Date.now();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    console.log(`[Dify 连接] 正在发起流式请求: ${difyBaseUrl}/workflows/run ...`);
    const difyRes = await fetch(`${difyBaseUrl}/workflows/run`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${difyApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inputs,
        response_mode: 'streaming',
        user: 'weekly-report-system',
      }),
      signal: controller.signal,
    });

    if (!difyRes.ok) {
      const errText = await difyRes.text();
      console.error(`[Dify 错误] HTTP 响应异常 (状态码: ${difyRes.status}):`, errText);
      return { result: '', error: `HTTP ${difyRes.status}: ${errText}` };
    }

    if (!difyRes.body) {
      console.error('[Dify 错误] Dify 响应体为空流');
      return { result: '', error: 'Dify响应体为空' };
    }

    console.log('[Dify 连接] 流式长连接已建立，开启实时心跳保活监听...');

    const reader = difyRes.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let finalResult = '';
    let difyError = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith(':')) continue;

        if (trimmed.startsWith('event: ping')) {
          const sec = Math.round((Date.now() - startTime) / 1000);
          console.log(`[Dify 推理中] 持续收到保活心跳 (已耗时 ${sec}s，网络连接正常)...`);
          continue;
        }

        if (trimmed.startsWith('data:')) {
          try {
            const dataJson = JSON.parse(trimmed.slice(5).trim());
            const event = dataJson.event;

            if (event === 'node_started') {
              const nodeTitle = dataJson.data?.title || dataJson.data?.node_type || '未知节点';
              console.log(`[Dify 节点] 启动执行: ${nodeTitle}`);
            } else if (event === 'node_finished') {
              const nodeTitle = dataJson.data?.title || dataJson.data?.node_type || '未知节点';
              const cost = dataJson.data?.elapsed_time ? `${dataJson.data.elapsed_time.toFixed(2)}s` : '完成';
              console.log(`[Dify 节点] 执行完成: ${nodeTitle} (耗时 ${cost})`);
            } else if (event === 'workflow_finished') {
              const totalSec = ((Date.now() - startTime) / 1000).toFixed(1);
              if (dataJson.data?.status === 'succeeded') {
                finalResult = dataJson.data?.outputs?.result || '';
                console.log(`[Dify 成功] 工作流执行成功！总耗时: ${totalSec}s，产出正文字符: ${finalResult.length}`);
              } else {
                difyError = dataJson.data?.error || '工作流执行状态未成功';
                console.error(`[Dify 异常] 工作流未能成功产出，耗时: ${totalSec}s，原因: ${difyError}`);
              }
            } else if (event === 'error') {
              difyError = dataJson.message || '工作流发生内部错误';
              console.error(`[Dify 内部错误] 事件消息: ${difyError}`);
            }
          } catch (e) {
            // 忽略非完整 JSON 解析异常
          }
        }
      }
    }

    return { result: finalResult, error: difyError };
  } catch (err: any) {
    const totalSec = ((Date.now() - startTime) / 1000).toFixed(1);
    if (err.name === 'AbortError') {
      const msg = `调用 Dify 工作流超时（已等待超过 ${Math.round(timeoutMs / 1000)} 秒）`;
      console.error(`[Dify 超时] ${msg}`);
      return { result: '', error: msg };
    }
    console.error(`[Dify 网络异常] 连接中断或出错 (耗时 ${totalSec}s):`, err?.message);
    return { result: '', error: err?.message || '网络连接异常' };
  } finally {
    clearTimeout(timeoutId);
  }
}

// 全局生成互斥锁（保障私有大模型单任务推理稳定性，防止局域网多人并发冲击）
interface GeneratingLock {
  isGenerating: boolean;
  startedAt: number;
  user: string;
  month: number;
  reportTitle: string;
}

let activeLock: GeneratingLock | null = null;

// 查询当前系统是否有正在进行的提炼任务
export async function GET() {
  const now = Date.now();
  if (activeLock && activeLock.isGenerating && (now - activeLock.startedAt) < 280000) {
    const elapsed = Math.round((now - activeLock.startedAt) / 1000);
    return NextResponse.json({
      is_busy: true,
      busy_user: activeLock.user,
      month: activeLock.month,
      report_title: activeLock.reportTitle,
      elapsed_seconds: elapsed,
    });
  }
  return NextResponse.json({ is_busy: false });
}

export async function POST(request: NextRequest) {
  const now = Date.now();

  try {
    const body = await request.json();
    const {
      month,
      title,
      cycle_name,
      selected_weeks = [],
      extra_prompt = '',
      created_by = '朱天胜',
    } = body;

    const monthNum = Number(month) || 9;
    const reportTitle = title || `产品创新部${monthNum}月月报`;

    // 1. 全局互斥锁校验：若当前已有任务在执行（未超过 280 秒），直接拦截
    if (activeLock && activeLock.isGenerating && (now - activeLock.startedAt) < 280000) {
      const elapsedSec = Math.round((now - activeLock.startedAt) / 1000);
      const userStr = activeLock.user || '其他成员';
      console.warn(`[并发拦截] 拒绝重复提交：当前已有【${userStr}】发起的提炼任务正在执行中 (已耗时 ${elapsedSec}s)`);
      return NextResponse.json(
        {
          error: `当前已有月报正在由【${userStr}】智能提炼中（已进行 ${elapsedSec} 秒）。为保障私有大模型性能稳定，暂不支持多人同时并发提交，请等待当前生成完毕（约 1~2 分钟）后再提交。`,
          is_busy: true,
          busy_user: userStr,
          elapsed_seconds: elapsedSec,
        },
        { status: 429 }
      );
    }

    // 2. 加锁
    activeLock = {
      isGenerating: true,
      startedAt: now,
      user: created_by || '团队成员',
      month: monthNum,
      reportTitle,
    };

    console.log(`\n======================================================`);
    console.log(`[月报服务] 收到生成请求：目标月份 ${monthNum}月，标题: ${reportTitle}，发起人: ${activeLock.user}`);

    // 格式化标准业务统计周期
    const normalizedCycleName = selected_weeks.length > 0
      ? formatCycleRange(selected_weeks)
      : (cycle_name || `${monthNum}月统计周期`);

    // 1. 读取基础周报与成员数据
    const [reports, members] = await Promise.all([getReports(), getMembers()]);

    // 2. 筛选所选周次
    const matchedReports = reports.filter((r) =>
      selected_weeks.includes(r.week_start)
    );

    if (matchedReports.length === 0) {
      console.warn(`[月报服务] 所选周期无周报数据: ${selected_weeks.join(', ')}`);
      return NextResponse.json(
        { error: '所选统计周期内未查询到任何周报记录，无法提炼月报。请在页面上选择包含真实周报的周次。' },
        { status: 400 }
      );
    }

    // 3. 结构化预处理：100% 无损保真整理，一条不删、一个字不漏，仅按业务分类清晰排版
    const processed = formatLosslessWeeklyData(matchedReports, members);

    if (processed.totalItems === 0) {
      console.warn('[月报服务] 所选周报中无任何有效工作明细');
      return NextResponse.json(
        { error: '所选周期内的周报未包含任何有效工作明细，请确认周报已填报完成。' },
        { status: 400 }
      );
    }

    console.log(
      `[无损整理] 已聚合 ${matchedReports.length} 篇周报（共 ${processed.totalItems} 条真实事项，100% 保真零删除），全量文本: ${processed.weeklyDataText.length} 字符`
    );

    // 4. 调用 Dify 流式工作流（带 SSE 心跳保活与 280 秒充裕超时保护）
    const difyApiKey = process.env.DIFY_API_KEY;
    const difyBaseUrl = process.env.DIFY_API_BASE_URL || 'http://localhost/v1';

    let rawResult = '';
    let isFallback = false;
    let fallbackReason = '';

    if (difyApiKey) {
      console.log(`[Dify] 正在以流式保活方式调用 Dify 工作流 (${difyBaseUrl})...`);
      const extraGuidance = `${extra_prompt ? extra_prompt + '\n' : ''}请严格依据上述全部各板块真实周报明细进行深度提炼，全面覆盖核心成果，严禁遗漏重点客户与交付事实。`;

      const difyRes = await callDifyWorkflowStreaming(
        {
          month: monthNum,
          title: reportTitle,
          cycle_name: normalizedCycleName,
          weekly_data: processed.weeklyDataText,
          extra_prompt: extraGuidance,
        },
        difyBaseUrl,
        difyApiKey,
        280000 // 给予大模型 280 秒超充裕时间，结合持续流式心跳永不超时中断
      );

      if (difyRes.result && difyRes.result.trim()) {
        rawResult = difyRes.result.trim();
        console.log(`[Dify 提炼完成] 成功采用大模型深度提炼成果！`);
      } else {
        console.warn(`\n------------------------------------------------------`);
        console.warn(`[系统容灾告警] Dify 提炼未能正常产出: ${difyRes.error || '无返回结果'}`);
        console.warn(`[系统容灾启动] 正在无缝调用【本地智能公文引擎】秒级兜底生成月报...`);
        console.warn(`------------------------------------------------------\n`);
        isFallback = true;
        fallbackReason = difyRes.error || 'Dify推理超时或未返回有效内容';
      }
    } else {
      console.warn('[Dify] 未配置 DIFY_API_KEY，直接启用本地公文引擎智能生成...');
      isFallback = true;
      fallbackReason = '未配置Dify API密钥';
    }

    // 5. 若 Dify 异常或超时，自动无缝启动本地智能公文引擎兜底
    if (!rawResult) {
      rawResult = generateLocalMonthlyDraft(monthNum, reportTitle, normalizedCycleName, processed);
      console.log(`[本地引擎完成] 已经基于 ${processed.totalItems} 条全量周报数据瞬间组装生成规范公文月报 (${rawResult.length} 字符)！`);
    }

    console.log(`[月报完成] 月报生成全部就绪，正在向客户端分发返回。\n======================================================\n`);

    // 6. 解析并格式化报告章节
    const sections = parseMarkdownSections(rawResult.trim());
    const finishedTime = new Date().toISOString();

    // 纠偏概述开头的月份：确保与实际选定月份 100% 对齐
    let summaryOverview = sections.summary_overview;
    summaryOverview = summaryOverview.replace(/^(\d{1,2})月[，,]/, `${monthNum}月，`);

    const fullReport: MonthlyReport & { is_fallback?: boolean; fallback_reason?: string } = {
      id: `monthly-${Date.now()}`,
      title: reportTitle,
      cycle_name: normalizedCycleName,
      selected_weeks,
      month_number: monthNum,
      next_month_number: (monthNum % 12) + 1,
      summary_overview: summaryOverview,
      products_and_features: sections.products_and_features,
      support_needed: sections.support_needed,
      next_month_plan: sections.next_month_plan,
      raw_markdown: rawResult.trim(),
      created_at: finishedTime,
      updated_at: finishedTime,
      created_by: created_by || '朱天胜',
      is_fallback: isFallback,
      fallback_reason: fallbackReason,
    };

    return NextResponse.json(fullReport);
  } catch (error: any) {
    console.error('月报生成服务严重异常:', error);
    return NextResponse.json(
      { error: error?.message || '月报生成服务异常' },
      { status: 500 }
    );
  } finally {
    // 无论成功、失败或异常，必须立刻释放全局生成互斥锁
    activeLock = null;
    console.log('[全局锁] 月报生成任务结束，已释放全局并发互斥锁。');
  }
}


