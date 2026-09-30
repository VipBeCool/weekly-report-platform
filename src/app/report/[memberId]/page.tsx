'use client';

import { Suspense, useState, useEffect, useCallback, use } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Member, Report } from '@/lib/types';
import { getWeekStart, getPrevWeek, getNextWeek, formatWeekRange, getWeekNumber } from '@/lib/week';
import { WeekSelector } from '@/components/WeekSelector';
import { OutlineNavigator, OutlineItem } from '@/components/OutlineNavigator';
import { useIdentity } from '@/hooks/useIdentity';
import { ArrowLeft, Edit3 } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

function ReportDetailPageContent({ params }: { params: Promise<{ memberId: string }> }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { memberId: currentUserId } = useIdentity();
  
  // `use` 钩子用于解包 Promise 的 params（Next.js 15+ 模式）
  const resolvedParams = use(params);
  const targetMemberId = resolvedParams.memberId;
  const isOwner = Boolean(currentUserId && currentUserId === targetMemberId);
  
  const weekStart = searchParams.get('week') || getWeekStart();
  const fromView = searchParams.get('from') || searchParams.get('view');
  const weekNum = getWeekNumber(weekStart);

  const [member, setMember] = useState<Member | null>(null);
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);

  // 返回上一级：若从汇总表格进入，则准确返回汇总表格
  const handleBack = () => {
    if (fromView === 'table') {
      router.push(`/?week=${weekStart}&view=table`);
    } else {
      router.push(`/?week=${weekStart}&view=card`);
    }
  };

  // 加载数据
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [memberRes, reportRes] = await Promise.all([
        fetch('/api/members'),
        fetch(`/api/reports?member_id=${targetMemberId}&week_start=${weekStart}`),
      ]);
      const members: Member[] = await memberRes.json();
      const reports: Report[] = await reportRes.json();

      setMember(members.find((m) => m.id === targetMemberId) || null);
      setReport(reports.length > 0 ? reports[0] : null);
    } catch (err) {
      console.error('加载周报详情失败:', err);
    } finally {
      setLoading(false);
    }
  }, [targetMemberId, weekStart]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // 翻周操作：保留来源参数
  const handlePrevWeek = () => {
    const fromParam = fromView ? `&from=${fromView}` : '';
    router.push(`/report/${targetMemberId}?week=${getPrevWeek(weekStart)}${fromParam}`);
  };
  const handleNextWeek = () => {
    const fromParam = fromView ? `&from=${fromView}` : '';
    router.push(`/report/${targetMemberId}?week=${getNextWeek(weekStart)}${fromParam}`);
  };

  if (!member && !loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh]">
        <h2 className="text-xl font-semibold mb-4 text-[#161616]">找不到该成员</h2>
        <button
          onClick={handleBack}
          className="text-[#0f62fe] hover:underline"
        >
          {fromView === 'table' ? '返回汇总表格' : '返回总览'}
        </button>
      </div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="px-4 md:px-8 py-8 max-w-3xl mx-auto"
    >
      {/* 返回按钮 */}
      <button
        onClick={handleBack}
        className="flex items-center gap-1 text-sm text-[#0f62fe] hover:text-[#0043ce] hover:underline transition-colors mb-6"
      >
        <ArrowLeft size={16} />
        {fromView === 'table' ? '返回汇总表格' : '返回总览'}
      </button>

      {/* 页面头部 */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-light text-[#161616] leading-[1.25]">
              {member?.name} 的周报
            </h1>
            {isOwner && (
              <button
                onClick={() => router.push(`/edit?week=${weekStart}${fromView ? `&from=${fromView}` : ''}`)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#0f62fe] bg-[#edf5ff] hover:bg-[#d0e2ff] border border-[#0f62fe]/30 rounded transition-colors shadow-2xs"
                title="修改周报内容"
              >
                <Edit3 size={13} />
                <span>编辑周报</span>
              </button>
            )}
          </div>
          <p className="text-sm text-[#525252] tracking-[0.16px] mt-2">
            第{weekNum}周 ({formatWeekRange(weekStart)})
          </p>
        </div>

        {/* 周次选择器 */}
        <WeekSelector
          weekStart={weekStart}
          onPrev={handlePrevWeek}
          onNext={handleNextWeek}
        />
      </div>

      {/* 周报内容 */}
      <div className="bg-white border border-[#e0e0e0] min-h-[400px] shadow-sm rounded-sm">
        {loading ? (
          <div className="flex items-center justify-center h-[400px]">
            <div className="w-6 h-6 border-2 border-[#0f62fe] border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : !report ? (
          <div className="flex flex-col items-center justify-center h-[400px] text-center p-6">
            <p className="text-base text-[#525252] tracking-[0.16px] mb-2">
              {isOwner ? '你尚未提交该周周报' : '该成员尚未提交周报'}
            </p>
            {isOwner ? (
              <button
                onClick={() => router.push(`/edit?week=${weekStart}`)}
                className="mt-3 px-4 py-2 bg-[#0f62fe] text-white text-xs font-medium hover:bg-[#0353e9] transition-all rounded shadow-2xs"
              >
                立即填写周报
              </button>
            ) : (
              <p className="text-sm text-[#8d8d8d] tracking-[0.16px]">
                可以提醒 Ta 尽快填写哦
              </p>
            )}
          </div>
        ) : (
          <div className="p-6 md:p-8">
            {/* 本周工作（核心结构，始终展示） */}
            <div id="section-work-items" className="mb-10 scroll-mt-24">
              <h2 className="text-lg font-semibold text-[#161616] mb-6 flex items-center gap-2">
                <span className="w-1 h-5 bg-[#0f62fe] rounded-full inline-block"></span>
                本周工作 ({report.items.length}项)
              </h2>
              {report.items.length > 0 ? (
                <div className="space-y-6">
                  {report.items.map((item, index) => (
                    <div key={item.id} id={`item-${item.id}`} className="group scroll-mt-24 p-2 rounded-sm transition-shadow">
                      <div>
                        <div className="flex items-center justify-between gap-3 mb-2">
                          <h3 className="text-base font-semibold text-[#161616] leading-tight">
                            {index + 1}. {item.title}
                          </h3>
                          <div className="flex items-center gap-2 shrink-0">
                            {item.category && (
                              <span className="text-xs text-[#525252] bg-[#f4f4f4] border border-[#e0e0e0] px-2.5 py-0.5 rounded-sm font-normal">
                                {item.category}
                              </span>
                            )}
                          </div>
                        </div>
                        {item.description ? (
                          <div className="text-sm text-[#525252] leading-relaxed whitespace-pre-wrap bg-[#f4f4f4] p-4 rounded-sm">
                            {item.description}
                          </div>
                        ) : (
                          <div className="text-sm text-[#8d8d8d] italic bg-[#f4f4f4] p-4 rounded-sm">
                            暂无详细描述
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-[#8d8d8d] italic bg-[#f4f4f4] p-4 rounded-sm">
                  暂无本周工作推进事项
                </div>
              )}
            </div>

            {/* 下周工作计划（核心结构，始终展示，空时保持结构留空/占位，不隐藏） */}
            <div id="section-next-plan" className="mb-8 scroll-mt-24 p-2 rounded-sm transition-shadow">
              <h2 className="text-lg font-semibold text-[#161616] mb-4 flex items-center gap-2">
                <span className="w-1 h-5 bg-[#0f62fe] rounded-full inline-block"></span>
                下周工作计划
              </h2>
              {report.next_plan?.trim() ? (
                <div className="text-sm text-[#525252] leading-relaxed whitespace-pre-wrap bg-[#f4f4f4] p-4 rounded-sm">
                  {report.next_plan}
                </div>
              ) : (
                <div className="text-sm text-[#8d8d8d] italic bg-[#f4f4f4] p-4 rounded-sm">
                  暂无下周工作计划
                </div>
              )}
            </div>

            {/* 更新时间与操作 */}
            <div className="pt-4 border-t border-[#e0e0e0] flex items-center justify-between">
              <span className="text-xs text-[#8d8d8d] tracking-[0.32px]">
                最后更新于：
                {new Date(report.updated_at).toLocaleString('zh-CN', {
                  year: 'numeric',
                  month: 'numeric',
                  day: 'numeric',
                  hour: 'numeric',
                  minute: 'numeric',
                })}
              </span>
              {isOwner && (
                <button
                  onClick={() => router.push(`/edit?week=${weekStart}`)}
                  className="inline-flex items-center gap-1.5 text-xs text-[#0f62fe] hover:underline font-medium"
                >
                  <Edit3 size={13} />
                  <span>编辑周报</span>
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 侧边大纲导航（支持子级缩进与章节定位，结构始终完整） */}
      {report && (
        <OutlineNavigator
          items={[
            {
              id: 'section-work-items',
              title: `本周工作 (${report.items.length}项)`,
              level: 0,
            },
            ...report.items.map((item, idx): OutlineItem => ({
              id: `item-${item.id}`,
              title: item.title || `事项 ${idx + 1}`,
              badge: item.category,
              badgeType: 'muted',
              level: 1,
            })),
            {
              id: 'section-next-plan',
              title: '下周工作计划',
              badge: report.next_plan?.trim() ? undefined : '暂无',
              badgeType: 'muted',
              level: 0,
            },
          ]}
          title="大纲导航"
          countLabel={`${report.items.length + 1} 节`}
        />
      )}
    </motion.div>
  );
}

export default function ReportDetailPage({
  params,
}: {
  params: Promise<{ memberId: string }>;
}) {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="w-6 h-6 border-2 border-[#0f62fe] border-t-transparent rounded-full animate-spin"></div>
        </div>
      }
    >
      <ReportDetailPageContent params={params} />
    </Suspense>
  );
}
