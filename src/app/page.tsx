'use client';

import { Suspense, useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Member, Report, MEMBER_ORDER } from '@/lib/types';
import { getWeekStart, getPrevWeek, getNextWeek } from '@/lib/week';
import { getWeekHolidaySummary } from '@/lib/holidays';
import { useIdentity } from '@/hooks/useIdentity';
import { WeekSelector } from '@/components/WeekSelector';
import { ReportCard } from '@/components/ReportCard';
import { WeeklySummaryTable } from '@/components/WeeklySummaryTable';

import { motion, AnimatePresence } from 'framer-motion';
import { LayoutGrid, Table2 } from 'lucide-react';

function HomePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { memberId, memberName, showModal, isLoading, login, switchIdentity, setShowModal } = useIdentity();

  // 从 URL 读取 weekStart，否则使用当前周
  const weekStart = searchParams.get('week') || getWeekStart();
  const [members, setMembers] = useState<Member[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  // 加载数据
  const loadData = useCallback(async (week: string) => {
    setDataLoading(true);
    try {
      const [membersRes, reportsRes] = await Promise.all([
        fetch('/api/members'),
        fetch(`/api/reports?week_start=${week}`),
      ]);
      const membersData = await membersRes.json();
      const reportsData = await reportsRes.json();
      setMembers(membersData);
      setReports(reportsData);
    } catch (err) {
      console.error('加载数据失败:', err);
    } finally {
      setDataLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isLoading) {
      loadData(weekStart);
    }
  }, [weekStart, isLoading, loadData]);

  // 监听全局系统配置修改成员后的即时刷新
  useEffect(() => {
    const handleMembersUpdated = () => {
      loadData(weekStart);
    };
    window.addEventListener('members-updated', handleMembersUpdated);
    return () => window.removeEventListener('members-updated', handleMembersUpdated);
  }, [loadData, weekStart]);

  // URL 中的视图模式参数（view 或 from）
  const urlView = searchParams.get('view') || searchParams.get('from');
  // 视图模式：卡片看板 vs 汇总表格，若 URL 指定了 table 则优先切到 table
  const [viewMode, setViewMode] = useState<'card' | 'table'>(
    urlView === 'table' ? 'table' : 'card'
  );

  // 当路由中的 view/from 参数变化时同步 viewMode
  useEffect(() => {
    if (urlView === 'table') {
      setViewMode('table');
    } else if (urlView === 'card') {
      setViewMode('card');
    }
  }, [urlView]);

  // 切换视图模式：同步更新浏览器 URL 参数
  const handleViewModeChange = (mode: 'card' | 'table') => {
    setViewMode(mode);
    const params = new URLSearchParams(searchParams.toString());
    params.set('view', mode);
    router.replace(`/?${params.toString()}`);
  };

  // 翻周操作：更新 URL，并保持当前的 viewMode
  const handlePrevWeek = () => {
    router.push(`/?week=${getPrevWeek(weekStart)}&view=${viewMode}`);
  };
  const handleNextWeek = () => {
    router.push(`/?week=${getNextWeek(weekStart)}&view=${viewMode}`);
  };

  // 点击卡片：已提交周报的（包括本人）统一进入详情页；未提交时本人去填写，他人查看空状态
  const handleCardClick = (member: Member) => {
    const report = getMemberReport(member.id);
    if (report) {
      router.push(`/report/${member.id}?week=${weekStart}&from=${viewMode}`);
    } else if (member.id === memberId) {
      router.push(`/edit?week=${weekStart}&from=${viewMode}`);
    } else {
      router.push(`/report/${member.id}?week=${weekStart}&from=${viewMode}`);
    }
  };

  // 获取某成员的周报
  const getMemberReport = (mId: string): Report | null => {
    return reports.find((r) => r.member_id === mId) || null;
  };

  // 统计
  const submittedCount = members.filter((m) =>
    reports.some((r) => r.member_id === m.id)
  ).length;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-[#0f62fe] border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const sortedMembers = [...members].sort((a, b) => {
    // 1. 当前登录用户强制置顶
    if (memberId) {
      if (a.id === memberId) return -1;
      if (b.id === memberId) return 1;
    }
    // 2. 其余成员严格遵照系统配置中保存的次序
    const idxA = members.findIndex((m) => m.id === a.id);
    const idxB = members.findIndex((m) => m.id === b.id);
    return idxA - idxB;
  });

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="px-4 md:px-8 py-8"
    >
      {/* 页面头部 */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-light text-[#161616] leading-[1.25]">
            团队周报
          </h1>
        </div>

        {/* 周次选择器 */}
        <WeekSelector
          weekStart={weekStart}
          onPrev={handlePrevWeek}
          onNext={handleNextWeek}
        />
      </div>


        {/* 操作栏：视图切换控制器 + 填写周报（置于最左侧） */}
        <div className="flex items-center justify-between gap-3 mb-6 pb-4 border-b border-[#e0e0e0]">
          <div className="flex items-center gap-3">
            {/* 视图切换分段控制器 */}
            <div className="inline-flex p-0.5 bg-[#f4f4f4] rounded border border-[#e0e0e0] text-xs">
              <button
                type="button"
                onClick={() => handleViewModeChange('card')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded transition-all font-medium ${
                  viewMode === 'card'
                    ? 'bg-white text-[#161616] shadow-xs'
                    : 'text-[#525252] hover:text-[#161616]'
                }`}
              >
                <LayoutGrid size={14} />
                <span>卡片看板</span>
              </button>
              <button
                type="button"
                onClick={() => handleViewModeChange('table')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded transition-all font-medium ${
                  viewMode === 'table'
                    ? 'bg-white text-[#0f62fe] shadow-xs'
                    : 'text-[#525252] hover:text-[#161616]'
                }`}
              >
                <Table2 size={14} />
                <span>汇总表格</span>
              </button>
            </div>

            {/* 填写周报按钮（不限制填写的周次，任意选中的周均可填写或补填） */}
            {memberId && !getMemberReport(memberId) && (
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => router.push(`/edit?week=${weekStart}&from=${viewMode}`)}
                className="h-8 px-4 bg-[#0f62fe] text-white text-xs font-medium hover:bg-[#0353e9] transition-all shadow-xs rounded"
              >
                填写周报
              </motion.button>
            )}
          </div>
        </div>

        {/* 内容展示区：卡片视图 OR 汇总表格 */}
        {dataLoading ? (
          <div className="flex items-center justify-center h-32">
            <div className="w-5 h-5 border-2 border-[#0f62fe] border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : members.length === 0 ? (
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} 
            className="text-center py-16"
          >
            <p className="text-sm text-[#525252] tracking-[0.16px]">
              暂无成员，请先选择身份加入团队
            </p>
          </motion.div>
        ) : viewMode === 'card' ? (
          <div className="space-y-6">
            <motion.div 
              layout
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
            >
              <AnimatePresence mode="popLayout">
                {sortedMembers.map((member) => (
                  <motion.div
                    layout
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.2 }}
                    key={member.id}
                    id={`member-${member.id}`}
                    className="h-full scroll-mt-24 transition-shadow rounded-sm"
                  >
                    <ReportCard
                      member={member}
                      report={getMemberReport(member.id)}
                      isCurrentUser={member.id === memberId}
                      onClick={() => handleCardClick(member)}
                    />
                  </motion.div>
                ))}
              </AnimatePresence>
            </motion.div>
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
          >
            <WeeklySummaryTable
              members={members}
              reports={reports}
              weekStart={weekStart}
              currentUserId={memberId}
            />
          </motion.div>
        )}
      </motion.div>
  );
}

export default function HomePage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="w-6 h-6 border-2 border-[#0f62fe] border-t-transparent rounded-full animate-spin"></div>
        </div>
      }
    >
      <HomePageContent />
    </Suspense>
  );
}
