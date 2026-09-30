'use client';

import { WorkItemStatus, STATUS_LABELS } from '@/lib/types';

const statusStyles: Record<WorkItemStatus, string> = {
  completed: 'bg-[#defbe6] text-[#24a148]',
  in_progress: 'bg-[#edf5ff] text-[#0f62fe]',
  blocked: 'bg-[#fff1f1] text-[#da1e28]',
};

export function StatusTag({ status }: { status: WorkItemStatus }) {
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded-[24px] text-xs tracking-[0.32px] font-normal ${statusStyles[status]}`}
    >
      {STATUS_LABELS[status]}
    </span>
  );
}
