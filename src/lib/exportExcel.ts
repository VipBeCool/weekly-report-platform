import * as XLSX from 'xlsx';
import { Member, Report, MEMBER_ORDER } from '@/lib/types';
import { getWeekNumber, formatWeekRange } from '@/lib/week';

export interface FormattedMemberRow {
  index: number;
  memberId: string;
  name: string;
  isCurrentUser: boolean;
  status: 'submitted' | 'unsubmitted';
  workSummary: string;
  nextPlan: string;
  otherItems: string;
  submitTime: string;
  itemsList: Array<{
    title: string;
    description: string;
    category: string;
  }>;
}

// 格式化成员周报数据为单行结构
export function formatReportToRow(
  member: Member,
  report: Report | null | undefined,
  index: number,
  currentUserId?: string | null
): FormattedMemberRow {
  if (!report) {
    return {
      index,
      memberId: member.id,
      name: member.name,
      isCurrentUser: Boolean(currentUserId && member.id === currentUserId),
      status: 'unsubmitted',
      workSummary: '',
      nextPlan: '',
      otherItems: '',
      submitTime: '-',
      itemsList: [],
    };
  }

  // 1. 本周工作总结：非“其他事项”分类
  const regularItems = report.items.filter((item) => item.category !== '其他事项');
  const otherCategoryItems = report.items.filter((item) => item.category === '其他事项');

  const workSummary = regularItems
    .map((item, idx) => {
      const numPrefix = regularItems.length > 1 ? `${idx + 1}、` : '';
      const title = item.title.trim();
      const desc = item.description.trim();

      if (title && desc) {
        return `${numPrefix}${title}：\n${desc}`;
      } else if (title) {
        return `${numPrefix}${title}`;
      } else if (desc) {
        return `${numPrefix}${desc}`;
      }
      return '';
    })
    .filter(Boolean)
    .join('\n\n');

  // 2. 下周工作计划
  const nextPlan = report.next_plan?.trim() || '';

  // 3. 其他事项
  const otherItems = otherCategoryItems
    .map((item, idx) => {
      const numPrefix = otherCategoryItems.length > 1 ? `${idx + 1}、` : '';
      const title = item.title.trim();
      const desc = item.description.trim();
      if (title && desc) return `${numPrefix}${title}：\n${desc}`;
      return `${numPrefix}${title || desc}`;
    })
    .filter(Boolean)
    .join('\n\n');

  // 4. 提交时间
  const submitDate = new Date(report.updated_at || report.created_at);
  const submitTime = `${submitDate.getFullYear()}年${submitDate.getMonth() + 1}月${submitDate.getDate()}日`;

  return {
    index,
    memberId: member.id,
    name: member.name,
    isCurrentUser: Boolean(currentUserId && member.id === currentUserId),
    status: 'submitted',
    workSummary,
    nextPlan,
    otherItems,
    submitTime,
    itemsList: regularItems.map((it) => ({
      title: it.title.trim(),
      description: it.description.trim(),
      category: it.category || '',
    })),
  };
}

// 导出全员周报为 Excel (.xlsx)（所有人均有一行，未填写留空，完全按给定人员顺序）
export function exportWeeklyReportsToXLSX(
  members: Member[],
  reports: Report[],
  weekStart: string
) {
  const weekNum = getWeekNumber(weekStart);
  const weekRange = formatWeekRange(weekStart);

  // 严格完全按照前面给定的标准人员顺序 MEMBER_ORDER 排序
  const orderedMembers = [...members].sort((a, b) => {
    const idxA = (MEMBER_ORDER as readonly string[]).indexOf(a.name);
    const idxB = (MEMBER_ORDER as readonly string[]).indexOf(b.name);
    if (idxA !== -1 && idxB !== -1) return idxA - idxB;
    if (idxA !== -1) return -1;
    if (idxB !== -1) return 1;
    return 0;
  });

  // 全员按给定标准顺序输出，未填写的保留行并留空
  const tableRows = orderedMembers.map((member, idx) => {
    const report = reports.find((r) => r.member_id === member.id && r.week_start === weekStart);
    const row = formatReportToRow(member, report, idx + 1);

    return [
      idx + 1,
      member.name,
      row.status === 'submitted' ? '已提交' : '尚未提交',
      row.workSummary,
      row.nextPlan,
      row.otherItems,
      row.status === 'submitted' ? row.submitTime : '-',
    ];
  });

  const sheetData = [
    // 标题行
    ['序号', '成员', '状态', '本周工作总结', '下周工作计划', '其他事项', '提交时间'],
    ...tableRows,
  ];

  // 创建工作表
  const ws = XLSX.utils.aoa_to_sheet(sheetData);

  // 设置列宽
  ws['!cols'] = [
    { wch: 6 },  // 序号
    { wch: 12 }, // 成员
    { wch: 12 }, // 状态
    { wch: 45 }, // 本周工作总结
    { wch: 35 }, // 下周工作计划
    { wch: 25 }, // 其他事项
    { wch: 16 }, // 提交时间
  ];

  // 创建工作簿并下载
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, `第${weekNum}周周报汇总`);

  const fileName = `产品创新部工作周报_第${weekNum}周(${weekRange}).xlsx`;
  XLSX.writeFile(wb, fileName);
}
