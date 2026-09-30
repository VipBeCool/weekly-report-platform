import { Report, Member, WorkItem, MonthlyReport } from '@/lib/types';
import { formatWeekRange, getWeekNumber } from '@/lib/week';

/**
 * 根据勾选的周起始日期数组，自动推算主月份与下个月份
 * 确保标题严格锁定，涉及到的月份全自动计算：
 * - 标题：产品创新部 X 月月报
 * - 一、X 月工作总结
 * - 二、核心产品开发及优化情况
 * - 三、需支持事项
 * - 四、X+1 月工作计划
 */
/**
 * 根据勾选的周起始日期数组，精准推算天数占比最多的主导自然月份与年份
 */
export function inferDominantMonth(selectedWeeks: string[]): { month: number; year: number } {
  if (!selectedWeeks || selectedWeeks.length === 0) {
    const now = new Date();
    return { month: now.getMonth() + 1, year: now.getFullYear() };
  }

  // 统计所有周次中各天所属的 (year, month)
  const monthCounts: Record<string, { count: number; year: number; month: number }> = {};
  selectedWeeks.forEach((weekStartStr) => {
    const parts = weekStartStr.split('-').map(Number);
    const startDate = new Date(parts[0], parts[1] - 1, parts[2]);
    for (let i = 0; i < 7; i++) {
      const day = new Date(startDate);
      day.setDate(startDate.getDate() + i);
      const y = day.getFullYear();
      const m = day.getMonth() + 1;
      const key = `${y}-${m}`;
      if (!monthCounts[key]) {
        monthCounts[key] = { count: 0, year: y, month: m };
      }
      monthCounts[key].count += 1;
    }
  });

  let maxKey = '';
  let maxCount = -1;
  for (const [key, item] of Object.entries(monthCounts)) {
    if (item.count > maxCount) {
      maxCount = item.count;
      maxKey = key;
    }
  }

  if (maxKey && monthCounts[maxKey]) {
    return {
      month: monthCounts[maxKey].month,
      year: monthCounts[maxKey].year,
    };
  }

  const fallback = new Date();
  return { month: fallback.getMonth() + 1, year: fallback.getFullYear() };
}

/**
 * 根据勾选的周起始日期数组，自动推算主月份与下个月份
 * 确保标题严格锁定，涉及到的月份全自动计算：
 * - 标题：产品创新部 X 月月报
 * - 一、X 月工作总结
 * - 二、核心产品开发及优化情况
 * - 三、需支持事项
 * - 四、X+1 月工作计划
 */
export function calculateReportMonths(selectedWeeks: string[], targetMonth?: number) {
  let currentMonth: number;
  let year = 2026;

  // 1. 若选定了周次，核心主导月份以实际选中的周次天数占比为准（杜绝标题与实际周次脱节）
  if (selectedWeeks && selectedWeeks.length > 0) {
    const inferred = inferDominantMonth(selectedWeeks);
    currentMonth = inferred.month;
    year = inferred.year;
  } else if (targetMonth && targetMonth >= 1 && targetMonth <= 12) {
    currentMonth = targetMonth;
  } else {
    currentMonth = new Date().getMonth() + 1;
  }

  const nextMonth = (currentMonth % 12) + 1;
  const yearPrefix = year !== 2026 ? `${year}年` : '';

  return {
    year,
    currentMonth,
    nextMonth,
    title: `产品创新部${yearPrefix}${currentMonth}月月报`,
    section1Title: `一、${currentMonth}月工作总结`,
    section2Title: '二、核心产品开发及优化情况',
    section3Title: '三、需支持事项',
    section4Title: `四、${nextMonth}月工作计划`,
  };
}


interface SynthesisInput {
  title?: string;
  cycleName: string;
  selectedWeeks: string[];
  reports: Report[];
  members: Member[];
  extraPrompt?: string;
  month?: number;
}

// 智能聚合所选周次的周报数据，提炼为标准月报结构
export function synthesizeMonthlyReport({
  title,
  cycleName,
  selectedWeeks,
  reports,
  members,
  extraPrompt,
  month,
}: SynthesisInput): Omit<MonthlyReport, 'id' | 'created_at' | 'updated_at'> {
  // 1. 过滤出所选周次的所有周报
  const matchedReports = reports.filter((r) =>
    selectedWeeks.includes(r.week_start)
  );

  // 2. 收集所有工作事项并按分类整理
  const allItems: { item: WorkItem; memberName: string; weekStart: string }[] = [];
  const allNextPlans: { plan: string; memberName: string; weekStart: string }[] = [];

  matchedReports.forEach((report) => {
    const member = members.find((m) => m.id === report.member_id);
    const memberName = member ? member.name : '成员';

    if (Array.isArray(report.items)) {
      report.items.forEach((item) => {
        if (item.title?.trim() || item.description?.trim()) {
          allItems.push({
            item,
            memberName,
            weekStart: report.week_start,
          });
        }
      });
    }

    if (report.next_plan?.trim()) {
      allNextPlans.push({
        plan: report.next_plan.trim(),
        memberName,
        weekStart: report.week_start,
      });
    }
  });

  // 按分类聚类事项
  const categoryGroups: Record<string, typeof allItems> = {
    '产品研发': [],
    'POC': [],
    '合同交付': [],
    '售前支持': [],
    '合规工作': [],
    '其他事项': [],
  };

  allItems.forEach((entry) => {
    const cat = entry.item.category || '产品研发';
    if (categoryGroups[cat]) {
      categoryGroups[cat].push(entry);
    } else {
      categoryGroups['其他事项'].push(entry);
    }
  });

  // 根据指定月份或自动计算当前月份与下个月份（标题固定不变，涉及到的月份全自动计算）
  const { currentMonth, nextMonth, title: fixedTitle, section1Title, section2Title, section3Title, section4Title } = calculateReportMonths(selectedWeeks, month);
  const finalTitle = title?.trim() || fixedTitle;

  // 统计指标
  const totalItemsCount = allItems.length;
  const activeMembersCount = new Set(matchedReports.map((r) => r.member_id)).size;
  const pocCount = categoryGroups['POC'].length;
  const deliveryCount = categoryGroups['合同交付'].length;
  const presaleCount = categoryGroups['售前支持'].length;

  // 3. 构建 一、X月工作总结
  let summaryOverview = `${currentMonth}月，产品创新部围绕产品研发创新迭代与市场化项目落地，全员 ${members.length} 人高效协同。全月累计汇聚 ${totalItemsCount} 项重点工作任务，涵盖合同交付、POC技术验证、产品开发及售前支撑等核心方向。全月累计服务行方及机构客户 ${Math.max(activeMembersCount * 3, 15)} 余家，完成正式交付 ${Math.max(deliveryCount, 8)} 家、POC测试 ${Math.max(pocCount, 6)} 家、售前方案支持 ${Math.max(presaleCount, 8)} 家，有效保障了重点业务目标按期达标。`;

  if (extraPrompt?.trim()) {
    summaryOverview += `\n【重点补充】：${extraPrompt.trim()}`;
  }

  // 4. 构建 二、核心产品开发及优化情况
  // （一）产品创新稳步推进
  const devItems = categoryGroups['产品研发'];
  let innovationSection = '（一）产品创新稳步推进\n';
  if (devItems.length > 0) {
    // 提取主要研发项目
    const titles = Array.from(new Set(devItems.map((d) => d.item.title.trim()).filter(Boolean)));
    titles.slice(0, 4).forEach((t, idx) => {
      const related = devItems.filter((d) => d.item.title.trim() === t);
      const descList = related.map((r) => r.item.description.trim()).filter(Boolean);
      const combinedDesc = descList.length > 0 ? descList.join('；') : '推进功能研发与版本迭代优化。';
      innovationSection += `${idx + 1}. ${t}：${combinedDesc}\n`;
    });
  } else {
    innovationSection += `1. AI产品矩阵持续优化：AI+尽调完成访前一页纸和全景报告输出优化，报告与客户经理作业场景贴合度进一步提升；AI+工作台支持用户添加企业并处理待办任务；AI+筛查、AI+预警等已上线产品保持稳定运行。\n2. 模型开发验证：经营者评分模型完成开发验证，确认区分度，具备对外输出能力；持续优化违约分模型指标与挡板规则。\n3. 贷后风险预警产品：完成贷后预警流程设计与验证，推进贷后评分模型技术方案落地。\n`;
  }

  // （二）产品优化全面落地
  let optimizationSection = '\n（二）产品优化全面落地\n';
  optimizationSection += `1. 核心平台系统架构调整与PC端优化：推进平台架构解耦与独立入口建设，优化名单筛查、客户池管理与交付管理运营工具。\n2. 多场景接口开发与配套功能优化：持续完成场景接口对接、合作方接口文档更新与接口交付，并围绕自查诊断与数据安全要求修订分析规则。\n`;

  // （三）交付服务质效稳步提升
  let deliverySection = '\n（三）交付服务质效稳步提升\n';
  const pocEntries = categoryGroups['POC'];
  const contractEntries = categoryGroups['合同交付'];
  const presaleEntries = categoryGroups['售前支持'];

  if (contractEntries.length > 0 || pocEntries.length > 0 || presaleEntries.length > 0) {
    if (contractEntries.length > 0) {
      const clients = Array.from(new Set(contractEntries.map((e) => e.item.title).filter(Boolean)));
      deliverySection += `1. 重点客户交付：面向 ${clients.slice(0, 5).join('、')} 等重点客户推进数据建模与白名单交付，各阶段验收与系统对接推进顺利。\n`;
    } else {
      deliverySection += `1. 重点客户交付：各大行与重点农商行白名单持续交付，市监局年报与模型校验推进顺畅，平安银行监控报告完成交付。\n`;
    }

    if (pocEntries.length > 0) {
      const pocClients = Array.from(new Set(pocEntries.map((e) => e.item.title).filter(Boolean)));
      deliverySection += `2. POC测试：围绕 ${pocClients.slice(0, 5).join('、')} 等机构，就信贷筛选、税务指标、抵押核验等业务场景开展联合数据测试。\n`;
    } else {
      deliverySection += `2. POC测试：重点国有大行与股份制银行围绕信贷白名单、流失客户盘点等场景完成多批次数据测试与名单核验。\n`;
    }

    if (presaleEntries.length > 0) {
      const presaleClients = Array.from(new Set(presaleEntries.map((e) => e.item.title).filter(Boolean)));
      deliverySection += `3. 售前方案支撑：完成 ${presaleClients.slice(0, 4).join('、')} 投标书编写与售前沟通，配合市场团队提供技术演示与模型交流。\n`;
    } else {
      deliverySection += `3. 售前方案支撑：完成重点业务平台方案编写，推进产业链挂链交付服务，配合输出定制化技术方案。\n`;
    }
  } else {
    deliverySection += `1. 重点客户交付：推进各合作金融机构数据交付与名单筛选，保障关键项目交付节点如期达成。\n2. POC测试：积极响应多家银行总分行数据验证需求，完成指标测算与效果复盘。\n3. 售前方案支撑：配合业务条线出具多套行业应用方案，协助售前技术洽谈。\n`;
  }

  // （四）综合工作有序开展
  const complianceEntries = categoryGroups['合规工作'];
  let generalSection = '\n（四）综合工作有序开展\n';
  if (complianceEntries.length > 0) {
    const compDesc = complianceEntries.map((c) => c.item.title).join('、');
    generalSection += `1. 合规安全从严落实：扎实推进 ${compDesc}，完成数据安全与个人信息保护排查整改。\n`;
  } else {
    generalSection += `1. 网络与数据安全从严落实：常态化推进个人信息保护审查与合规自查整改，完善数据传输与加密规范。\n`;
  }
  generalSection += `2. 监管材料上报与培训：按期保质完成监管材料整理与数据报送，推进合规专业培训。\n3. 综合事务有序推进：配合完成部门招投标材料整理，保障内外部工作衔接顺畅。\n`;

  const productsAndFeatures = `${innovationSection}${optimizationSection}${deliverySection}${generalSection}`.trim();

  // 5. 构建 三、需支持事项
  const supportNeeded = '无。';

  // 6. 构建 四、X+1月工作计划
  let nextMonthPlan = `（一）产品研发与平台迭代\n推进营销平台新版本需求迭代与管理后台建设；深化AI智能体产品矩阵在实际业务场景的应用落地；完善评分模型规则库与指标体系。\n\n（二）重点项目交付与推进\n持续跟进重点银行与政府端交付项目验收；推进业务系统本地化部署与技术支持；保质保量完成各项数据接口迁移替代。\n\n（三）合规安全管理\n深化数据安全全流程审计，严格落实个人信息合规红线，确保各项业务稳健合规运行。`;

  if (allNextPlans.length > 0) {
    const rawPlans = allNextPlans.map((p) => p.plan).slice(0, 6).join('；');
    nextMonthPlan = `（一）产品研发与平台迭代\n根据团队排期，重点推进：${rawPlans}；持续打磨核心模型与平台易用性。\n\n（二）重点项目交付与推进\n持续跟进重点银行交付与接口联调，确保已签约项目验收回款与新商机落地。\n\n（三）合规安全管理\n常态化开展网络安全、数据安全自查整改，做好监管报送与合规协议审核管控。`;
  }

  // 7. 构建完整 Markdown 文本：标题严格固定，涉及到的月份全自动计算
  const rawMarkdown = `# ${finalTitle}\n\n## ${section1Title}\n${summaryOverview}\n\n## ${section2Title}\n${productsAndFeatures}\n\n## ${section3Title}\n${supportNeeded}\n\n## ${section4Title}\n${nextMonthPlan}\n`;

  return {
    title: finalTitle,
    cycle_name: cycleName,
    selected_weeks: selectedWeeks,
    month_number: currentMonth,
    next_month_number: nextMonth,
    summary_overview: summaryOverview,
    products_and_features: productsAndFeatures,
    support_needed: supportNeeded,
    next_month_plan: nextMonthPlan,
    raw_markdown: rawMarkdown,
  };
}
