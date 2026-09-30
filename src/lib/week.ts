// 格式化日期为 YYYY-MM-DD
function formatDateISO(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// 中文格式日期
function formatDateCN(d: Date): string {
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

// 获取某日期所在周的周一日期字符串
export function getWeekStart(date: Date = new Date()): string {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  // 周一为一周起始：周日(0)视为上周第7天
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  return formatDateISO(d);
}

// 获取上一周的周一
export function getPrevWeek(weekStart: string): string {
  const d = new Date(weekStart + 'T00:00:00');
  d.setDate(d.getDate() - 7);
  return formatDateISO(d);
}

// 获取下一周的周一
export function getNextWeek(weekStart: string): string {
  const d = new Date(weekStart + 'T00:00:00');
  d.setDate(d.getDate() + 7);
  return formatDateISO(d);
}

// 格式化周次范围：如 "8月11日 - 8月17日"
export function formatWeekRange(weekStart: string): string {
  const start = new Date(weekStart + 'T00:00:00');
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  return `${formatDateCN(start)} - ${formatDateCN(end)}`;
}

// 获取 ISO 周次编号
export function getWeekNumber(weekStart: string): number {
  const d = new Date(weekStart + 'T00:00:00');
  const startOfYear = new Date(d.getFullYear(), 0, 1);
  const days = Math.floor((d.getTime() - startOfYear.getTime()) / (24 * 60 * 60 * 1000));
  return Math.ceil((days + startOfYear.getDay() + 1) / 7);
}

// 判断是否是当前周
export function isCurrentWeek(weekStart: string): boolean {
  return weekStart === getWeekStart(new Date());
}

// 判断是否是未来的周
export function isFutureWeek(weekStart: string): boolean {
  return weekStart > getWeekStart(new Date());
}

// 获取两个周次之间的所有周（闭区间，按由新到旧排列）
export function getWeeksBetween(weekA: string, weekB: string): string[] {
  const [start, end] = weekA < weekB ? [weekA, weekB] : [weekB, weekA];
  const list: string[] = [];
  let cur = end;
  while (cur >= start) {
    list.push(cur);
    cur = getPrevWeek(cur);
  }
  return list;
}

/**
 * 格式化多周统计周期范围
 * 标准业务规则：最早一周的开始工作日（周一），到最后一周的结束工作日（周五）
 * 示例：
 * - 单周：第32周 (8月3日 至 8月7日)
 * - 多周同月：第32~35周 (8月3日 至 8月28日)
 * - 多周跨月：第35~39周 (8月31日 至 10月2日)
 */
export function formatCycleRange(selectedWeeks: string[]): string {
  if (!selectedWeeks || selectedWeeks.length === 0) return '';
  const sorted = [...selectedWeeks].sort((a, b) => a.localeCompare(b));
  const firstWeekStart = sorted[0];
  const lastWeekStart = sorted[sorted.length - 1];

  const startDate = new Date(firstWeekStart + 'T00:00:00'); // 第一周周一（开始工作日）
  const endDate = new Date(lastWeekStart + 'T00:00:00');
  endDate.setDate(endDate.getDate() + 4); // 最后一周周五（结束工作日）

  const startYear = startDate.getFullYear();
  const endYear = endDate.getFullYear();
  const startWeekNum = getWeekNumber(firstWeekStart);
  const endWeekNum = getWeekNumber(lastWeekStart);

  const weekNumText = startWeekNum === endWeekNum
    ? `第${startWeekNum}周`
    : `第${startWeekNum}~${endWeekNum}周`;

  let dateRangeText = '';
  if (startYear === endYear) {
    dateRangeText = `${startDate.getMonth() + 1}月${startDate.getDate()}日 至 ${endDate.getMonth() + 1}月${endDate.getDate()}日`;
  } else {
    dateRangeText = `${startYear}年${startDate.getMonth() + 1}月${startDate.getDate()}日 至 ${endYear}年${endDate.getMonth() + 1}月${endDate.getDate()}日`;
  }

  return `${weekNumText} (${dateRangeText})`;
}

