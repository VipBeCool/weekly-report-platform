'use client';

import { Member, Report } from '@/lib/types';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ReportCardProps {
  member: Member;
  report: Report | null;
  isCurrentUser: boolean;
  onClick: () => void;
}

export function ReportCard({ member, report, isCurrentUser, onClick }: ReportCardProps) {
  const itemCount = report?.items.length || 0;

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full h-full text-left p-5 transition-all duration-300 group rounded-sm border outline-none",
        isCurrentUser
          ? "bg-[#edf5ff] border-transparent hover:border-[#0f62fe] hover:shadow-md hover:-translate-y-1"
          : "bg-white border-[#e0e0e0] hover:border-[#c6c6c6] hover:shadow-md hover:-translate-y-1"
      )}
    >
      {/* 头部：姓名 + 箭头 */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-semibold text-[#161616] tracking-[0.16px]">
          {member.name}
          {isCurrentUser && (
            <span className="ml-2 text-xs font-normal text-[#0f62fe] bg-white px-2 py-0.5 rounded-[24px]">我</span>
          )}
        </h3>
        <ChevronRight 
          size={18} 
          className="text-[#0f62fe] opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300"
        />
      </div>

      {/* 周报提交状态与简要信息（不堆叠具体事项内容） */}
      <div className="flex flex-col justify-between pt-1">
        {report ? (
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200/60 px-2 py-0.5 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                已提交 · 共{itemCount}项
              </span>
              <span className="text-xs text-[#8d8d8d]">
                {new Date(report.updated_at).toLocaleDateString('zh-CN', {
                  month: 'numeric',
                  day: 'numeric',
                  hour: 'numeric',
                  minute: 'numeric',
                })}
              </span>
            </div>
            <div className="text-xs text-[#525252] group-hover:text-[#0f62fe] transition-colors flex items-center gap-1">
              <span>查看周报详情</span>
              <ChevronRight size={13} className="inline group-hover:translate-x-0.5 transition-transform" />
            </div>
          </div>
        ) : (
          <div>
            <div className="flex items-center justify-between mb-3">
              <span className="inline-flex items-center gap-1.5 text-xs text-zinc-500 bg-zinc-100 border border-zinc-200/60 px-2 py-0.5 rounded-full">
                <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 shrink-0" />
                尚未提交
              </span>
            </div>
            <div className="text-xs text-[#8d8d8d] group-hover:text-[#0f62fe] transition-colors flex items-center gap-1">
              {isCurrentUser ? (
                <>
                  <span className="text-[#0f62fe] font-medium">填写周报</span>
                  <ChevronRight size={13} className="text-[#0f62fe]" />
                </>
              ) : (
                <span>尚未提交</span>
              )}
            </div>
          </div>
        )}
      </div>
    </button>
  );
}
