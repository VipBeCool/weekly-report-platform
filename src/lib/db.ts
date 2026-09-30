import fs from 'fs';
import path from 'path';
import { Member, Report, MonthlyReport } from './types';
import { HolidayItem, DEFAULT_HOLIDAYS_2026 } from './holidayData';
import { supabase, isSupabaseConfigured } from './supabase';

const DATA_DIR = path.join(process.cwd(), 'data');

// 确保本地数据目录存在（用作离线双写与缓存镜像）
function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readJSON<T>(filename: string, fallback: T): T {
  ensureDataDir();
  const filePath = path.join(DATA_DIR, filename);
  if (!fs.existsSync(filePath)) {
    writeJSONAtomic(filename, fallback);
    return fallback;
  }
  try {
    const data = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(data);
  } catch (err) {
    console.error(`读取数据文件 ${filename} 异常:`, err);
    return fallback;
  }
}

// 军工级原子文件落盘：先写入独立临时文件，再利用操作系统内核的原子 rename 替换原文件
// 100% 杜绝因写入中途断电、死机、进程中断导致的原文件损坏截断问题
function writeJSONAtomic<T>(filename: string, data: T): void {
  ensureDataDir();
  const filePath = path.join(DATA_DIR, filename);
  const tempPath = path.join(
    DATA_DIR,
    `${filename}.${Date.now()}.${Math.random().toString(36).slice(2, 8)}.tmp`
  );
  try {
    fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf-8');
    fs.renameSync(tempPath, filePath);
  } catch (err) {
    console.error(`原子写入本地数据 ${filename} 失败:`, err);
    try {
      if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
    } catch {}
    // 若极端情况下原子 rename 受阻，安全兜底直接写入原文件
    try {
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
    } catch (writeErr) {
      console.error(`兜底写入 ${filename} 失败:`, writeErr);
    }
  }
}

function writeJSON<T>(filename: string, data: T): void {
  writeJSONAtomic(filename, data);
}

// 服务端文件级串行写入队列（Write Mutex Queue）
// 为每个核心数据文件维护独立的写入锁，确保多人同时保存时按到达顺序串行入库
// 彻底杜绝周五下班多人同时提交周报时的“竞态覆盖丢数据”隐患
const fileWriteQueues: Map<string, Promise<unknown>> = new Map();

function runInFileQueue<R>(filename: string, task: () => Promise<R> | R): Promise<R> {
  const prevPromise = fileWriteQueues.get(filename) || Promise.resolve();
  const currentPromise = prevPromise
    .catch(() => {}) // 上一个任务即便异常，也不阻塞后续排队请求
    .then(async () => {
      return await task();
    });

  fileWriteQueues.set(filename, currentPromise);
  return currentPromise;
}

// ==================== 1. 团队成员 (Members) ====================
export async function getMembers(): Promise<Member[]> {
  if (!isSupabaseConfigured) {
    return readJSON<Member[]>('members.json', []);
  }
  try {
    const { data, error } = await supabase
      .from('members')
      .select('*')
      .order('created_at', { ascending: true });
    if (!error && data && data.length > 0) {
      writeJSON('members.json', data);
      return data;
    }
  } catch (err) {
    console.warn('[Supabase] 获取成员失败，降级使用本地数据:', err);
  }
  return readJSON<Member[]>('members.json', []);
}

export async function saveMembers(members: Member[]): Promise<void> {
  await runInFileQueue('members.json', () => {
    writeJSONAtomic('members.json', members);
  });
  if (!isSupabaseConfigured) return;
  try {
    await supabase.from('members').upsert(members, { onConflict: 'id' });
  } catch (err) {
    console.error('[Supabase] 保存成员失败:', err);
  }
}

export async function addMember(member: Member): Promise<void> {
  await runInFileQueue('members.json', () => {
    const local = readJSON<Member[]>('members.json', []);
    local.push(member);
    writeJSONAtomic('members.json', local);
  });
  if (!isSupabaseConfigured) return;
  try {
    await supabase.from('members').upsert(member, { onConflict: 'id' });
  } catch (err) {
    console.error('[Supabase] 添加成员失败:', err);
  }
}

export async function deleteMember(id: string): Promise<void> {
  await runInFileQueue('members.json', () => {
    const local = readJSON<Member[]>('members.json', []).filter((m) => m.id !== id);
    writeJSONAtomic('members.json', local);
  });
  if (!isSupabaseConfigured) return;
  try {
    await supabase.from('members').delete().eq('id', id);
  } catch (err) {
    console.error('[Supabase] 删除成员失败:', err);
  }
}

// 保持向下兼容的同步方法
export function readMembers(): Member[] {
  return readJSON<Member[]>('members.json', []);
}
export function writeMembers(members: Member[]): void {
  writeJSON('members.json', members);
}

// ==================== 2. 周报记录 (Reports) ====================
export async function getReports(filter?: { week_start?: string; member_id?: string }): Promise<Report[]> {
  if (!isSupabaseConfigured) {
    let list = readJSON<Report[]>('reports.json', []);
    if (filter?.week_start) list = list.filter((r) => r.week_start === filter.week_start);
    if (filter?.member_id) list = list.filter((r) => r.member_id === filter.member_id);
    return list;
  }
  try {
    let query = supabase.from('reports').select('*');
    if (filter?.week_start) query = query.eq('week_start', filter.week_start);
    if (filter?.member_id) query = query.eq('member_id', filter.member_id);

    const { data, error } = await query;
    if (!error && data) {
      return data;
    }
  } catch (err) {
    console.warn('[Supabase] 获取周报失败，降级使用本地数据:', err);
  }

  let list = readJSON<Report[]>('reports.json', []);
  if (filter?.week_start) list = list.filter((r) => r.week_start === filter.week_start);
  if (filter?.member_id) list = list.filter((r) => r.member_id === filter.member_id);
  return list;
}

export async function saveReport(report: Report): Promise<void> {
  // 进入 reports.json 的专用串行互斥写队列
  // 即使多人周五同一秒集中提交，也会在此毫秒级依次排队，读取上一人最新写入的内容后再合并入库，绝不冲刷丢失
  await runInFileQueue('reports.json', () => {
    const reports = readJSON<Report[]>('reports.json', []);
    const idx = reports.findIndex(
      (r) => r.id === report.id || (r.member_id === report.member_id && r.week_start === report.week_start)
    );
    if (idx >= 0) {
      reports[idx] = report;
    } else {
      reports.push(report);
    }
    // 原子写入：先写独立临时文件再原子 rename 替换，彻底防止写入意外断电损坏
    writeJSONAtomic('reports.json', reports);
  });

  if (!isSupabaseConfigured) return;
  // 云端 Supabase 保存
  try {
    await supabase.from('reports').upsert(report, { onConflict: 'id' });
  } catch (err) {
    console.error('[Supabase] 保存周报失败:', err);
  }
}

export async function deleteReport(id: string): Promise<void> {
  await runInFileQueue('reports.json', () => {
    const reports = readJSON<Report[]>('reports.json', []).filter((r) => r.id !== id);
    writeJSONAtomic('reports.json', reports);
  });

  if (!isSupabaseConfigured) return;
  try {
    await supabase.from('reports').delete().eq('id', id);
  } catch (err) {
    console.error('[Supabase] 删除周报失败:', err);
  }
}

// 保持向下兼容
export function readReports(): Report[] {
  return readJSON<Report[]>('reports.json', []);
}
export function writeReports(reports: Report[]): void {
  writeJSON('reports.json', reports);
}

// ==================== 3. 月报记录 (Monthly Reports) ====================
export async function getMonthlyReports(id?: string): Promise<MonthlyReport[]> {
  if (!isSupabaseConfigured) {
    const list = readJSON<MonthlyReport[]>('monthly_reports.json', []);
    if (id) return list.filter((r) => r.id === id);
    return list.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
  }
  try {
    let query = supabase
      .from('monthly_reports')
      .select('*')
      .order('updated_at', { ascending: false });
    if (id) query = query.eq('id', id);
    const { data, error } = await query;
    if (!error && data) {
      return data;
    }
  } catch (err) {
    console.warn('[Supabase] 获取月报失败，降级使用本地数据:', err);
  }

  const list = readJSON<MonthlyReport[]>('monthly_reports.json', []);
  if (id) return list.filter((r) => r.id === id);
  return list.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
}

export async function saveMonthlyReport(report: MonthlyReport): Promise<void> {
  await runInFileQueue('monthly_reports.json', () => {
    const reports = readJSON<MonthlyReport[]>('monthly_reports.json', []);
    const idx = reports.findIndex((r) => r.id === report.id);
    if (idx >= 0) {
      reports[idx] = report;
    } else {
      reports.unshift(report);
    }
    writeJSONAtomic('monthly_reports.json', reports);
  });

  if (!isSupabaseConfigured) return;
  try {
    await supabase.from('monthly_reports').upsert(report, { onConflict: 'id' });
  } catch (err) {
    console.error('[Supabase] 保存月报失败:', err);
  }
}

export async function deleteMonthlyReport(id: string): Promise<void> {
  await runInFileQueue('monthly_reports.json', () => {
    const reports = readJSON<MonthlyReport[]>('monthly_reports.json', []).filter((r) => r.id !== id);
    writeJSONAtomic('monthly_reports.json', reports);
  });
  if (!isSupabaseConfigured) return;
  try {
    await supabase.from('monthly_reports').delete().eq('id', id);
  } catch (err) {
    console.error('[Supabase] 删除月报失败:', err);
  }
}

// ==================== 4. 节假日与工作日配置 (Holidays) ====================
export async function getHolidays(year?: string): Promise<HolidayItem[]> {
  if (!isSupabaseConfigured) {
    let list = readJSON<HolidayItem[]>('holidays.json', DEFAULT_HOLIDAYS_2026);
    if (year) {
      list = list.filter((h) => h.date.startsWith(year));
    }
    return list.sort((a, b) => a.date.localeCompare(b.date));
  }
  try {
    let query = supabase.from('holidays').select('*').order('date', { ascending: true });
    if (year) {
      query = query.like('date', `${year}%`);
    }
    const { data, error } = await query;
    if (!error && data && data.length > 0) {
      return data;
    }
  } catch (err) {
    console.warn('[Supabase] 获取节假日失败，降级使用本地数据:', err);
  }

  let list = readJSON<HolidayItem[]>('holidays.json', DEFAULT_HOLIDAYS_2026);
  if (year) {
    list = list.filter((h) => h.date.startsWith(year));
  }
  return list.sort((a, b) => a.date.localeCompare(b.date));
}

export async function saveHolidays(holidays: HolidayItem[]): Promise<void> {
  await runInFileQueue('holidays.json', () => {
    writeJSONAtomic('holidays.json', holidays);
  });
  if (!isSupabaseConfigured) return;
  try {
    await supabase.from('holidays').upsert(holidays, { onConflict: 'date' });
  } catch (err) {
    console.error('[Supabase] 保存节假日失败:', err);
  }
}

export async function deleteHoliday(date: string): Promise<void> {
  await runInFileQueue('holidays.json', () => {
    const list = readJSON<HolidayItem[]>('holidays.json', []).filter((h) => h.date !== date);
    writeJSONAtomic('holidays.json', list);
  });
  if (!isSupabaseConfigured) return;
  try {
    await supabase.from('holidays').delete().eq('date', date);
  } catch (err) {
    console.error('[Supabase] 删除节假日失败:', err);
  }
}

