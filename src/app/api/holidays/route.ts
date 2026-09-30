import { NextRequest, NextResponse } from 'next/server';
import { HolidayItem, DEFAULT_HOLIDAYS_2026 } from '@/lib/holidayData';
import { getHolidays, saveHolidays, deleteHoliday } from '@/lib/db';

// GET: 获取节假日列表（支持可选 year 查询）
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const year = searchParams.get('year') || undefined;
  const list = await getHolidays(year);
  return NextResponse.json(list);
}

function parseHolidayPayload(data: any): HolidayItem[] {
  const result: HolidayItem[] = [];
  if (!data) return result;

  // 1. holiday-cn 规范格式: { days: [ { name, date, isOffDay } ] }
  if (Array.isArray(data.days)) {
    data.days.forEach((d: any) => {
      if (d && d.date && d.name) {
        result.push({
          date: String(d.date).trim(),
          name: String(d.name).trim(),
          type: d.isOffDay ? 'holiday' : 'workday',
          description: d.isOffDay ? '法定休假' : '调休补班工作日',
        });
      }
    });
    return result;
  }

  // 2. timor.tech 规范格式: { holiday: { "01-01": { holiday: bool, name: str, date: str } } }
  if (data.holiday && typeof data.holiday === 'object') {
    Object.values(data.holiday).forEach((d: any) => {
      if (d && d.date && d.name) {
        result.push({
          date: String(d.date).trim(),
          name: String(d.name).trim(),
          type: d.holiday ? 'holiday' : 'workday',
          description: d.holiday ? '法定休假' : '调休补班工作日',
        });
      }
    });
    return result;
  }

  // 3. 标准数组格式: [ { date, name, type } ] 或包含 isOffDay / holiday
  if (Array.isArray(data)) {
    data.forEach((d: any) => {
      if (d && d.date && d.name) {
        const isHol = d.type === 'holiday' || d.isOffDay === true || d.holiday === true;
        result.push({
          date: String(d.date).trim(),
          name: String(d.name).trim(),
          type: isHol ? 'holiday' : 'workday',
          description: d.description ? String(d.description).trim() : (isHol ? '法定休假' : '调休补班工作日'),
        });
      }
    });
    return result;
  }

  return result;
}

// POST: 添加/修改单条节假日，或从远程接口自动同步拉取 (action: 'sync_remote')
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // 模式 A: 远程接口自动同步 / 拉取
    if (body.action === 'sync_remote') {
      const { year, customUrl } = body;
      const targetYear = String(year || '2026').trim();
      let fetchUrl = customUrl ? String(customUrl).trim() : '';

      if (!fetchUrl) {
        // 默认优先使用权威开源国内镜像 jsdelivr/holiday-cn
        fetchUrl = `https://cdn.jsdelivr.net/gh/NateScarlet/holiday-cn@master/${targetYear}.json`;
      }

      let fetchedData: any = null;
      let usedSource = fetchUrl;

      try {
        const resp = await fetch(fetchUrl, {
          headers: { 'User-Agent': 'WeeklyReport-HolidaySync/1.0' },
          signal: AbortSignal.timeout(8000),
        });
        if (!resp.ok) {
          throw new Error(`HTTP ${resp.status}`);
        }
        fetchedData = await resp.json();
      } catch (firstErr) {
        // 如果自定义 URL 失败直接报错；如果未指定 customUrl，尝试 timor.tech 备用数据源
        if (customUrl) {
          return NextResponse.json(
            { error: `从指定接口拉取失败: ${(firstErr as Error).message}` },
            { status: 400 }
          );
        }
        try {
          const fallbackUrl = `https://timor.tech/api/holiday/year/${targetYear}`;
          usedSource = fallbackUrl;
          const resp2 = await fetch(fallbackUrl, {
            headers: { 'User-Agent': 'WeeklyReport-HolidaySync/1.0' },
            signal: AbortSignal.timeout(8000),
          });
          if (!resp2.ok) throw new Error(`HTTP ${resp2.status}`);
          fetchedData = await resp2.json();
        } catch (secondErr) {
          return NextResponse.json(
            {
              error: `国务院办公厅尚未发布 ${targetYear} 年官方放假通知（通常于前一年 11~12 月发布），官方开源数据源暂未收录。`,
            },
            { status: 404 }
          );
        }
      }

      const parsedItems = parseHolidayPayload(fetchedData);
      if (parsedItems.length === 0) {
        if (!customUrl) {
          return NextResponse.json(
            {
              error: `国务院办公厅尚未发布 ${targetYear} 年官方放假通知（通常于前一年 11~12 月发布），官方开源数据源暂未收录。`,
            },
            { status: 404 }
          );
        }
        return NextResponse.json(
          { error: `未从指定接口解析到有效的节假日或调休数据，请确认接口返回格式` },
          { status: 400 }
        );
      }

      // 合并到现有节假日库（按 date 去重合并，新拉取的数据覆盖旧数据）
      const existing = await getHolidays();
      const map = new Map<string, HolidayItem>();
      existing.forEach((it) => map.set(it.date, it));
      parsedItems.forEach((it) => map.set(it.date, it));

      const mergedList = Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
      await saveHolidays(mergedList);

      return NextResponse.json({
        success: true,
        message: `成功同步 ${targetYear} 年节假日与调休安排（共计 ${parsedItems.length} 天）`,
        count: parsedItems.length,
        source: usedSource,
        list: mergedList,
      });
    }

    // 模式 B: 单条手动录入或修改
    const { date, name, type, description = '' } = body;

    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json({ error: '日期格式不正确，必须为 YYYY-MM-DD' }, { status: 400 });
    }
    if (!name?.trim()) {
      return NextResponse.json({ error: '名称不能为空' }, { status: 400 });
    }
    if (type !== 'holiday' && type !== 'workday') {
      return NextResponse.json({ error: '类型必须为 holiday 或 workday' }, { status: 400 });
    }

    const list = await getHolidays();
    const existingIndex = list.findIndex((it) => it.date === date);
    const item: HolidayItem = {
      date,
      name: name.trim(),
      type,
      description: description.trim(),
    };

    if (existingIndex >= 0) {
      list[existingIndex] = item;
    } else {
      list.push(item);
    }

    list.sort((a, b) => a.date.localeCompare(b.date));
    await saveHolidays(list);

    return NextResponse.json(item, { status: existingIndex >= 0 ? 200 : 201 });
  } catch (error) {
    console.error('保存节假日配置失败:', error);
    return NextResponse.json({ error: '保存节假日配置失败' }, { status: 500 });
  }
}

// PUT: 批量保存节假日数据
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { holidays } = body;
    if (!Array.isArray(holidays)) {
      return NextResponse.json({ error: '参数必须为节假日数组' }, { status: 400 });
    }

    const validList: HolidayItem[] = holidays
      .filter((h) => h && h.date && h.name && (h.type === 'holiday' || h.type === 'workday'))
      .map((h) => ({
        date: h.date,
        name: h.name.trim(),
        type: h.type,
        description: h.description ? h.description.trim() : '',
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    await saveHolidays(validList);
    return NextResponse.json({ success: true, list: validList });
  } catch (error) {
    console.error('批量更新节假日失败:', error);
    return NextResponse.json({ error: '批量更新节假日失败' }, { status: 500 });
  }
}

// DELETE: 删除指定日期的节假日配置
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date');

    if (!date) {
      return NextResponse.json({ error: '缺少 date 参数' }, { status: 400 });
    }

    const list = await getHolidays();
    const exists = list.some((it) => it.date === date);

    if (!exists) {
      return NextResponse.json({ error: '未找到指定日期的节假日配置' }, { status: 404 });
    }

    await deleteHoliday(date);
    return NextResponse.json({ success: true, message: '删除成功' });
  } catch (error) {
    console.error('删除节假日失败:', error);
    return NextResponse.json({ error: '删除节假日失败' }, { status: 500 });
  }
}
