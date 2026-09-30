'use client';

import { useState, useMemo } from 'react';
import { formatWeekRange, getWeekNumber } from '@/lib/week';
import { getWeekHolidaySummary, WeekHolidaySummary } from '@/lib/holidays';
import { ChevronLeft, ChevronRight, CalendarDays, Sparkles, Zap, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

interface WeekSelectorProps {
  weekStart: string;
  onChange?: (weekStart: string) => void;
  onPrev: () => void;
  onNext: () => void;
  showDetailsPopover?: boolean;
}

export function WeekSelector({
  weekStart,
  onPrev,
  onNext,
}: WeekSelectorProps) {
  const [showCalendar, setShowCalendar] = useState(false);

  const weekNum = useMemo(() => getWeekNumber(weekStart), [weekStart]);
  const holidaySummary: WeekHolidaySummary = useMemo(
    () => getWeekHolidaySummary(weekStart),
    [weekStart]
  );

  return (
    <div className="relative inline-flex flex-col items-center">
      {/* 核心周切换条：展开日历时置于 z-30 高于遮罩层(z-20)，同时严格低于顶栏 header(z-50) */}
      <div
        className={cn(
          "flex items-center gap-2 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-md border border-black/5 dark:border-white/10 shadow-sm hover:shadow transition-all duration-300 p-1 rounded-full",
          showCalendar ? "relative z-30" : "relative"
        )}
      >
        {/* 上一周 */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onPrev();
          }}
          className="w-9 h-9 flex items-center justify-center text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-all duration-200 active:scale-95"
          aria-label="上一周"
        >
          <ChevronLeft size={18} />
        </button>

        {/* 周次与日期信息（点击直接展开/收起法定节假日与排班日历） */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setShowCalendar(!showCalendar);
          }}
          className="flex flex-col items-center min-w-[170px] px-3.5 py-1 rounded-full hover:bg-zinc-100/70 dark:hover:bg-zinc-800/60 transition-all select-none group cursor-pointer outline-none"
          title="点击查看法定节假日与排班明细"
        >
          <div className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 tracking-tight flex items-center justify-center gap-1.5">
            <span>第 {weekNum} 周</span>
            <ChevronDown
              size={13}
              className={cn(
                'text-zinc-400 group-hover:text-zinc-700 dark:group-hover:text-zinc-200 transition-transform duration-200',
                showCalendar && 'rotate-180 text-[#0f62fe]'
              )}
            />
          </div>
          <div className="text-[11px] text-zinc-500 dark:text-zinc-400 font-mono tracking-tight mt-0.5">
            {formatWeekRange(weekStart)}
          </div>
        </button>

        {/* 下一周 */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onNext();
          }}
          className="w-9 h-9 flex items-center justify-center text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-all duration-200 active:scale-95"
          aria-label="下一周"
        >
          <ChevronRight size={18} />
        </button>
      </div>

      {/* 展开的当周 7 天法定节假日与排班明细面板 */}
      <AnimatePresence>
        {showCalendar && (
          <>
            {/* 点击背景关闭遮罩 */}
            <div
              className="fixed inset-0 z-20"
              onClick={() => setShowCalendar(false)}
            />

            <motion.div
              initial={{ opacity: 0, y: 8, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 6, scale: 0.96 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              className="absolute top-full mt-2 z-30 w-[380px] p-3.5 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl border border-zinc-200/80 dark:border-zinc-800 rounded-2xl shadow-xl shadow-zinc-900/10 text-xs"
            >
              {/* 头部摘要：法定节假日与排班 + 工作日：X天 */}
              <div className="flex items-center justify-between pb-2.5 border-b border-zinc-100 dark:border-zinc-800">
                <div className="flex items-center gap-1.5 font-medium text-zinc-800 dark:text-zinc-200">
                  <CalendarDays size={14} className="text-blue-500" />
                  <span>法定节假日与排班</span>
                </div>
                <div className="text-[11px] text-zinc-500">
                  工作日：<span className="font-semibold text-zinc-800 dark:text-zinc-200">{holidaySummary.workdayCount}</span>天
                </div>
              </div>

              {/* 7 天日历网格 */}
              <div className="grid grid-cols-7 gap-1.5 mt-3 pt-1">
                {holidaySummary.days.map((day) => {
                  const isWeekendDay = day.dayOfWeek === 0 || day.dayOfWeek === 6;
                  const isToday = day.isToday;

                  // 样式区分
                  let dayBoxBg = 'bg-zinc-50/80 dark:bg-zinc-800/40 border-zinc-200/60 dark:border-zinc-700/50';
                  let tagBadgeBg = 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400';

                  if (day.type === 'holiday') {
                    dayBoxBg = 'bg-rose-50/70 dark:bg-rose-950/20 border-rose-200/70 dark:border-rose-900/40';
                    tagBadgeBg = 'bg-rose-100 text-rose-700 dark:bg-rose-900 dark:text-rose-300 font-semibold';
                  } else if (day.type === 'in_lieu_workday') {
                    dayBoxBg = 'bg-amber-50/80 dark:bg-amber-950/20 border-amber-200/80 dark:border-amber-900/40';
                    tagBadgeBg = 'bg-amber-500 text-white font-semibold';
                  } else if (day.type === 'weekend') {
                    dayBoxBg = 'bg-zinc-50/50 dark:bg-zinc-800/20 border-zinc-100 dark:border-zinc-800';
                    tagBadgeBg = 'bg-zinc-200 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-400';
                  }

                  return (
                    <div
                      key={day.date}
                      className={cn(
                        'relative flex flex-col items-center justify-between p-1.5 rounded-xl border transition-all text-center min-h-[66px]',
                        dayBoxBg,
                        isToday && 'ring-2 ring-[#0f62fe] border-[#0f62fe] shadow-md shadow-blue-500/20 bg-blue-50/90 dark:bg-blue-950/50 z-10'
                      )}
                    >
                      {/* 今天微型高亮胶囊 */}
                      {isToday && (
                        <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-[#0f62fe] text-white text-[8px] font-bold px-1.5 py-0.2 rounded-full shadow-sm whitespace-nowrap tracking-wide leading-tight">
                          今天
                        </span>
                      )}

                      {/* 星期几 */}
                      <span
                        className={cn(
                          'text-[10px]',
                          isToday
                            ? 'text-[#0f62fe] dark:text-blue-400 font-bold'
                            : isWeekendDay
                            ? 'text-zinc-400 dark:text-zinc-500 font-medium'
                            : 'text-zinc-600 dark:text-zinc-300 font-medium'
                        )}
                      >
                        {day.dayName.replace('周', '')}
                      </span>

                      {/* 日期数字 */}
                      <span
                        className={cn(
                          'text-[12px] font-mono my-0.5',
                          isToday
                            ? 'text-[#0f62fe] dark:text-blue-400 font-bold text-[13px]'
                            : 'font-semibold text-zinc-800 dark:text-zinc-200'
                        )}
                      >
                        {day.dateLabel.split('/')[1]}
                      </span>

                      {/* 班 / 休 / 调班 状态标 */}
                      <span
                        className={cn(
                          'text-[9px] px-1 py-0.2 rounded font-sans scale-90 whitespace-nowrap',
                          tagBadgeBg
                        )}
                      >
                        {day.badgeText}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* 底部备注提示 */}
              <div className="mt-3 pt-2 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between text-[11px] text-zinc-500">
                <span className="truncate max-w-[240px]">
                  {holidaySummary.holidayNames.length > 0 ? (
                    <span className="text-rose-600 dark:text-rose-400 font-medium inline-flex items-center gap-1">
                      <Sparkles size={12} className="shrink-0" />
                      <span>涉及节日：{holidaySummary.holidayNames.join('、')}</span>
                    </span>
                  ) : holidaySummary.inLieuCount > 0 ? (
                    <span className="text-amber-600 dark:text-amber-400 font-medium inline-flex items-center gap-1">
                      <Zap size={12} className="shrink-0" />
                      <span>包含周末调休补班 {holidaySummary.inLieuCount} 天</span>
                    </span>
                  ) : (
                    <span>正常法定工作周（双休）</span>
                  )}
                </span>
                <span className="text-zinc-400 text-[10px]">国办节假日安排同步</span>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
