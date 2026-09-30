import { NextRequest, NextResponse } from 'next/server';
import { MonthlyReport } from '@/lib/types';
import { formatCycleRange } from '@/lib/week';
import { getMonthlyReports, saveMonthlyReport, deleteMonthlyReport } from '@/lib/db';

// 统一规整单篇月报的 cycle_name
function normalizeReportCycle(report: MonthlyReport): MonthlyReport {
  if (report.selected_weeks && report.selected_weeks.length > 0) {
    return {
      ...report,
      cycle_name: formatCycleRange(report.selected_weeks),
    };
  }
  return report;
}

// GET: 获取月报列表（可按 ID 查找）
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (id) {
    const reports = await getMonthlyReports(id);
    if (!reports || reports.length === 0) {
      return NextResponse.json({ error: '未找到指定月报' }, { status: 404 });
    }
    return NextResponse.json(normalizeReportCycle(reports[0]));
  }

  const reports = await getMonthlyReports();
  return NextResponse.json(reports.map(normalizeReportCycle));
}

// POST: 保存或新建月报
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const reportId = body.id || `monthly-${Date.now()}`;
    const now = new Date().toISOString();

    const existingReports = await getMonthlyReports(reportId);
    const existing = existingReports.length > 0 ? existingReports[0] : null;

    const normalizedCycle =
      body.selected_weeks && body.selected_weeks.length > 0
        ? formatCycleRange(body.selected_weeks)
        : (body.cycle_name || '月度总结');

    const newReport: MonthlyReport = {
      id: reportId,
      title: body.title || '部门月报',
      cycle_name: normalizedCycle,
      selected_weeks: body.selected_weeks || [],
      summary_overview: body.summary_overview || '',
      products_and_features: body.products_and_features || '',
      support_needed: body.support_needed || '无。',
      next_month_plan: body.next_month_plan || '',
      raw_markdown: body.raw_markdown || '',
      created_at: existing ? existing.created_at : now,
      updated_at: now,
      created_by: body.created_by || '朱天胜',
    };

    await saveMonthlyReport(newReport);
    return NextResponse.json(newReport);
  } catch (error) {
    console.error('保存月报失败:', error);
    return NextResponse.json({ error: '保存月报失败' }, { status: 500 });
  }
}

// DELETE: 删除月报
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: '缺少 id 参数' }, { status: 400 });
    }

    const existingReports = await getMonthlyReports(id);
    if (!existingReports || existingReports.length === 0) {
      return NextResponse.json({ error: '未找到指定月报' }, { status: 404 });
    }

    await deleteMonthlyReport(id);
    return NextResponse.json({ success: true, message: '删除成功' });
  } catch (error) {
    console.error('删除月报失败:', error);
    return NextResponse.json({ error: '删除月报失败' }, { status: 500 });
  }
}
