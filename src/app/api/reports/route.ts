import { NextRequest, NextResponse } from 'next/server';
import { getReports, saveReport } from '@/lib/db';

// 获取周报列表，支持 week_start 和 member_id 筛选
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const weekStart = searchParams.get('week_start') || undefined;
  const memberId = searchParams.get('member_id') || undefined;

  const reports = await getReports({
    week_start: weekStart,
    member_id: memberId,
  });

  return NextResponse.json(reports);
}

// 创建或更新周报（同一成员同一周只有一份）
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { member_id, member_name, week_start, items, next_plan, client_updated_at, force } = body;

    if (!member_id || !week_start) {
      return NextResponse.json({ error: '缺少必要字段' }, { status: 400 });
    }

    const now = new Date().toISOString();
    const existingReports = await getReports({ member_id, week_start });
    const existing = existingReports.length > 0 ? existingReports[0] : null;

    // 乐观锁版本防冲刷检测（类似 Confluence 协作冲突提醒）：
    // 若服务器上已有该周报，且客户端提供了打开时的版本时间戳，且与服务端当前最新时间不一致，且未声明强制覆盖
    if (
      existing &&
      !force &&
      client_updated_at &&
      existing.updated_at &&
      existing.updated_at !== client_updated_at
    ) {
      return NextResponse.json(
        {
          error: 'CONFLICT',
          message: '该篇周报刚才已被其他客户端或窗口更新，请先核对最新内容后再做保存，以防盲目覆盖。',
          server_updated_at: existing.updated_at,
          server_report: existing,
        },
        { status: 409 }
      );
    }

    const reportToSave = {
      id: existing ? existing.id : crypto.randomUUID(),
      member_id,
      member_name: member_name || existing?.member_name || '',
      week_start,
      items: items || [],
      next_plan: next_plan || '',
      updated_at: now,
      created_at: existing ? existing.created_at : now,
    };

    await saveReport(reportToSave);
    return NextResponse.json(reportToSave, { status: existing ? 200 : 201 });
  } catch (error) {
    console.error('保存周报失败:', error);
    return NextResponse.json({ error: '保存周报失败' }, { status: 500 });
  }
}
