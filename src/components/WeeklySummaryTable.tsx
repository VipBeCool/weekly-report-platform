'use client';

import { Member, Report, MEMBER_ORDER } from '@/lib/types';
import { formatReportToRow, exportWeeklyReportsToXLSX } from '@/lib/exportExcel';
import { FileSpreadsheet, FileText, Calendar, User, ChevronRight } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';

interface WeeklySummaryTableProps {
  members: Member[];
  reports: Report[];
  weekStart: string;
  currentUserId?: string | null;
}

// 企微风格彩色头像
function getAvatarColor(name: string) {
  const colors = [
    'bg-[#0f62fe]',
    'bg-[#0072c3]',
    'bg-[#198038]',
    'bg-[#8a3800]',
    'bg-[#da1e28]',
    'bg-[#6929c4]',
    'bg-[#005d5d]',
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

export function WeeklySummaryTable({
  members,
  reports,
  weekStart,
  currentUserId,
}: WeeklySummaryTableProps) {
  const router = useRouter();

  // 严格完全按照系统配置中保存的成员次序展示，不将当前登录用户置顶
  const orderedMembers = [...members].sort((a, b) => {
    const idxA = members.findIndex((m) => m.id === a.id);
    const idxB = members.findIndex((m) => m.id === b.id);
    return idxA - idxB;
  });

  // 格式化全员数据：所有人均占一行，顺序严格按标准固定顺序
  const rows = orderedMembers.map((member, idx) => {
    const report = reports.find((r) => r.member_id === member.id && r.week_start === weekStart) || null;
    return {
      member,
      report,
      data: formatReportToRow(member, report, idx + 1, currentUserId),
    };
  });

  const submittedCount = rows.filter((r) => r.data.status === 'submitted').length;

  const handleExport = () => {
    exportWeeklyReportsToXLSX(orderedMembers, reports, weekStart);
  };

  const handleRowClick = (member: Member, report: Report | null | undefined) => {
    if (report) {
      router.push(`/report/${member.id}?week=${weekStart}&from=table`);
    } else if (member.id === currentUserId) {
      router.push(`/edit?week=${weekStart}&from=table`);
    } else {
      router.push(`/report/${member.id}?week=${weekStart}&from=table`);
    }
  };

  return (
    <div className="space-y-3">
      {/* 表格顶部工具栏 */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="text-base font-medium text-[#161616]">团队周报汇总表</span>
          <span className="text-xs text-[#525252] bg-[#f4f4f4] px-2.5 py-0.5 rounded-full border border-[#e0e0e0]">
            全员 {members.length} 人 · 已提交 {submittedCount} 人
          </span>
        </div>

        {/* 导出 Excel 按钮 */}
        <button
          type="button"
          onClick={handleExport}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#edf5ff] hover:bg-[#d0e2ff] text-[#0f62fe] active:bg-[#a6c8ff] text-xs font-semibold rounded-sm border border-[#0f62fe]/30 transition-all shadow-2xs"
          title="导出当前周全员周报为 Excel (.xlsx) 表格"
        >
          <FileSpreadsheet size={15} className="text-[#0f62fe]" />
          <span>导出 Excel (.xlsx)</span>
        </button>
      </div>

      {/* 表格容器 */}
      <div className="bg-white border border-[#e0e0e0] rounded-sm overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            {/* 表头：根据本平台表单定制优化，去除复选框、附件及+占位列 */}
            <thead>
              <tr className="bg-[#f8f9fa] border-b border-[#e0e0e0] text-[#525252] select-none font-medium h-9">
                <th className="w-12 px-2.5 py-2 border-r border-[#f0f0f0] text-center font-normal text-[#8d8d8d]">
                  序号
                </th>
                <th className="w-28 px-3 py-2 border-r border-[#f0f0f0]">
                  <div className="flex items-center gap-1.5">
                    <User size={13} className="text-[#8d8d8d]" />
                    <span>成员</span>
                  </div>
                </th>
                <th className="min-w-[280px] max-w-[420px] px-3 py-2 border-r border-[#f0f0f0]">
                  <div className="flex items-center gap-1.5">
                    <FileText size={13} className="text-[#8d8d8d]" />
                    <span>本周工作总结</span>
                  </div>
                </th>
                <th className="min-w-[220px] max-w-[320px] px-3 py-2 border-r border-[#f0f0f0]">
                  <div className="flex items-center gap-1.5">
                    <FileText size={13} className="text-[#8d8d8d]" />
                    <span>下周工作计划</span>
                  </div>
                </th>
                <th className="min-w-[160px] max-w-[240px] px-3 py-2 border-r border-[#f0f0f0]">
                  <div className="flex items-center gap-1.5">
                    <FileText size={13} className="text-[#8d8d8d]" />
                    <span>其他事项</span>
                  </div>
                </th>
                <th className="w-32 px-3 py-2 text-center">
                  <div className="flex items-center justify-center gap-1.5">
                    <Calendar size={13} className="text-[#8d8d8d]" />
                    <span>提交时间</span>
                  </div>
                </th>
              </tr>
            </thead>

            {/* 数据行：每人一行，所有人都有，按顺序排列 */}
            <tbody className="divide-y divide-[#f0f0f0]">
              {rows.map(({ member, report, data }) => {
                const isSubmitted = data.status === 'submitted';
                const isSelf = member.id === currentUserId;

                return (
                  <tr
                    key={member.id}
                    onClick={() => handleRowClick(member, report)}
                    className={cn(
                      'hover:bg-[#f9fbff] transition-colors group align-top cursor-pointer',
                      isSelf && 'bg-[#fcfdff]'
                    )}
                  >
                    {/* 序号 */}
                    <td className="px-2.5 py-2.5 border-r border-[#f0f0f0] text-center text-[#8d8d8d] font-mono text-[11px]">
                      {data.index}
                    </td>

                    {/* 成员（纯文字姓名 + 我） */}
                    <td className="px-3 py-2.5 border-r border-[#f0f0f0] whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <span className={cn('font-medium text-[#161616]', isSelf && 'text-[#0f62fe]')}>
                          {member.name}
                        </span>
                        {isSelf && (
                          <span className="text-[10px] font-normal text-[#0f62fe] bg-[#edf5ff] px-1.5 py-0.2 rounded-full border border-[#0f62fe]/20">
                            我
                          </span>
                        )}
                      </div>
                    </td>

                    {/* 本周工作总结：紧凑分条排版 */}
                    <td className="px-3 py-2.5 border-r border-[#f0f0f0] text-[#161616] leading-relaxed">
                      {isSubmitted && data.itemsList.length > 0 ? (
                        <div className="space-y-1.5">
                          {data.itemsList.map((item, i) => (
                            <div key={i} className="text-xs">
                              <span className="font-semibold text-[#161616]">
                                {i + 1}、{item.title}
                              </span>
                              {item.description && (
                                <p className="text-[#525252] mt-0.5 whitespace-pre-wrap pl-4 leading-normal">
                                  {item.description}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="text-zinc-300 select-none">-</span>
                      )}
                    </td>

                    {/* 下周工作计划 */}
                    <td className="px-3 py-2.5 border-r border-[#f0f0f0] text-[#161616] leading-relaxed">
                      {isSubmitted && data.nextPlan ? (
                        <p className="whitespace-pre-wrap leading-normal text-xs text-[#161616]">
                          {data.nextPlan}
                        </p>
                      ) : (
                        <span className="text-zinc-300 select-none">-</span>
                      )}
                    </td>

                    {/* 其他事项 */}
                    <td className="px-3 py-2.5 border-r border-[#f0f0f0] text-[#525252] leading-relaxed">
                      {isSubmitted && data.otherItems ? (
                        <p className="whitespace-pre-wrap leading-normal text-xs text-[#525252]">
                          {data.otherItems}
                        </p>
                      ) : (
                        <span className="text-zinc-300 select-none">-</span>
                      )}
                    </td>

                    {/* 提交时间 */}
                    <td className="px-3 py-2.5 text-center text-[#525252] whitespace-nowrap">
                      {isSubmitted ? (
                        <span className="text-xs text-[#525252]">{data.submitTime}</span>
                      ) : (
                        <span className="text-zinc-300 select-none">-</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
