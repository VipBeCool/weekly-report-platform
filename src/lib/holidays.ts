import {
  isWorkday,
  isHoliday,
  isAdditionalWorkday,
  isWeekend,
  getFestival,
} from 'chinese-workday';
import { DEFAULT_HOLIDAYS_2026, HolidayItem } from '@/lib/holidayData';

// 内存中缓存权威节假日映射表
let customHolidaysMap: Record<string, HolidayItem> | null = null;

function getHolidaysMap(): Record<string, HolidayItem> {
  if (!customHolidaysMap) {
    customHolidaysMap = {};
    DEFAULT_HOLIDAYS_2026.forEach((item) => {
      customHolidaysMap![item.date] = item;
    });
  }
  return customHolidaysMap;
}

export interface DayHolidayInfo {
  date: string; // YYYY-MM-DD
  dayOfWeek: number; // 0 (周日) - 6 (周六)
  dayName: string; // '周一' | '周二' ... '周日'
  dateLabel: string; // '9/29'
  isWork: boolean; // 是否是工作日（含周末调休补班）
  isToday: boolean; // 是否是今天
  type: 'workday' | 'in_lieu_workday' | 'holiday' | 'weekend';
  holidayName?: string; // 节假日中文名称，如 '国庆节', '中秋节', '春节'
  badgeText: string; // '班' | '休' | '调班'
}

export interface WeekHolidaySummary {
  weekStart: string;
  weekEnd: string;
  days: DayHolidayInfo[];
  workdayCount: number; // 当周实际工作日天数
  holidayCount: number; // 当周法定放假天数
  inLieuCount: number; // 当周周末调休上班天数
  holidayNames: string[]; // 当周涉及的法定节日列表
  summaryTag: string; // 简明状态标签，例如 "国庆节 · 工作3天" 或 "标准工作周 5天"
  type: 'holiday_week' | 'in_lieu_week' | 'normal_week';
}

// 格式化日期为 YYYY-MM-DD
function formatDateISO(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

const DAY_NAMES = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

/**
 * 获取指定日期的法定节假日与工作日状态（优先遵照系统配置表中的设定）
 */
export function getDayHolidayInfo(dateStr: string, todayStr?: string): DayHolidayInfo {
  const d = new Date(dateStr + 'T00:00:00');
  const dayOfWeek = d.getDay();
  const isWeekendDay = isWeekend(dateStr);
  const today = todayStr || formatDateISO(new Date());
  const isToday = dateStr === today;

  // 优先查询系统节假日配置表
  const custom = getHolidaysMap()[dateStr];

  let work = isWorkday(dateStr);
  let holiday = isHoliday(dateStr);
  let additional = isAdditionalWorkday(dateStr);
  let rawFestival = getFestival(dateStr);
  let holidayName: string | undefined = undefined;

  if (custom) {
    if (custom.type === 'holiday') {
      holiday = true;
      work = false;
      additional = false;
      holidayName = custom.name;
    } else if (custom.type === 'workday') {
      holiday = false;
      work = true;
      additional = true;
      holidayName = custom.name;
    }
  } else if (holiday || additional) {
    if (rawFestival && rawFestival !== '工作日' && rawFestival !== '周末') {
      holidayName = rawFestival.replace(/^补/, '');
    }
  }

  let type: DayHolidayInfo['type'] = 'workday';
  let badgeText = '班';

  if (work) {
    if (additional || isWeekendDay) {
      type = 'in_lieu_workday';
      badgeText = '调班';
    } else {
      type = 'workday';
      badgeText = '班';
    }
  } else {
    if (holiday) {
      type = 'holiday';
      badgeText = '休';
    } else {
      type = 'weekend';
      badgeText = '休';
    }
  }

  return {
    date: dateStr,
    dayOfWeek,
    dayName: DAY_NAMES[dayOfWeek],
    dateLabel: `${d.getMonth() + 1}/${d.getDate()}`,
    isWork: work,
    isToday,
    type,
    holidayName,
    badgeText,
  };
}

/**
 * 获取指定周（周一至周日）的工作日与法定节假日完整统计
 */
export function getWeekHolidaySummary(weekStart: string, todayStr?: string): WeekHolidaySummary {
  const start = new Date(weekStart + 'T00:00:00');
  const days: DayHolidayInfo[] = [];

  for (let i = 0; i < 7; i++) {
    const cur = new Date(start);
    cur.setDate(start.getDate() + i);
    const dateStr = formatDateISO(cur);
    days.push(getDayHolidayInfo(dateStr, todayStr));
  }

  const endDay = new Date(start);
  endDay.setDate(start.getDate() + 6);
  const weekEnd = formatDateISO(endDay);

  let workdayCount = 0;
  let holidayCount = 0;
  let inLieuCount = 0;
  const holidayNameSet = new Set<string>();

  for (const day of days) {
    if (day.isWork) {
      workdayCount++;
    }
    if (day.type === 'holiday') {
      holidayCount++;
      if (day.holidayName) {
        holidayNameSet.add(day.holidayName);
      }
    }
    if (day.type === 'in_lieu_workday') {
      inLieuCount++;
    }
  }

  const holidayNames = Array.from(holidayNameSet);

  let summaryTag = `${workdayCount}个工作日`;
  let weekType: WeekHolidaySummary['type'] = 'normal_week';

  if (holidayNames.length > 0) {
    weekType = 'holiday_week';
    summaryTag = `${holidayNames.join('/')} · 工作${workdayCount}天`;
  } else if (inLieuCount > 0) {
    weekType = 'in_lieu_week';
    summaryTag = `调休补班 · 工作${workdayCount}天`;
  } else if (workdayCount === 5) {
    summaryTag = `标准工作周 · 5天`;
  } else {
    summaryTag = `工作${workdayCount}天`;
  }

  return {
    weekStart,
    weekEnd,
    days,
    workdayCount,
    holidayCount,
    inLieuCount,
    holidayNames,
    summaryTag,
    type: weekType,
  };
}
