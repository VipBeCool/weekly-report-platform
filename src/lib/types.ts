// 成员
export interface Member {
  id: string;
  name: string;
  created_at: string;
}

// 工作事项分类配置
export interface CategoryPreset {
  key: string;
  label: string;
  // 1 处：主体对象/归属项目/客户名称
  subjectLabel: string;
  subjectPlaceholder: string;
  // 2 处：具体推进事项清单（1对多）
  itemsLabel: string;
  itemsPlaceholder: string;
  // 格式说明与指引
  hint: string;
  badgeClass: string;
}

// 预定义工作分类（一对多体系标准模板）
export const WORK_CATEGORIES: CategoryPreset[] = [
  {
    key: '产品研发',
    label: '产品研发',
    subjectLabel: '产品 / 系统名称',
    subjectPlaceholder: '输入产品或系统名称，如：AI工作台',
    itemsLabel: '本周具体推进事项',
    itemsPlaceholder: '分条列出具体事项，如：\n1、xx功能需求设计与原型输出；\n2、准备测试数据并协助外部系统对接...',
    hint: '1处填产品或系统名称，2处分条列出具体推进事项（1对多）',
    badgeClass: 'bg-blue-50 text-blue-700 border-blue-200/80',
  },
  {
    key: 'POC',
    label: 'POC',
    subjectLabel: '客户 / 行方名称',
    subjectPlaceholder: '输入客户或行方名称，如：工行省分',
    itemsLabel: 'POC验证具体事项',
    itemsPlaceholder: '分条列出具体事项，如：\n1、交付获客白名单数据建模结果；\n2、行方现场答疑与业务指标效果复核...',
    hint: '1处填客户或行方名称，2处分条列出POC验证与交付事项（1对多）',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200/80',
  },
  {
    key: '合同交付',
    label: '合同交付',
    subjectLabel: '合同项目 / 客户名称',
    subjectPlaceholder: '输入合同项目或客户名称，如：招行南分-小微企业筛选',
    itemsLabel: '合同履约推进事项',
    itemsPlaceholder: '分条列出具体事项，如：\n1、小微企业筛选模型上线与阶段验收；\n2、整理并提交交付物文档与测试报告...',
    hint: '1处填合同项目或客户，2处分条列出交付进度与里程碑事项（1对多）',
    badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-200/80',
  },
  {
    key: '售前支持',
    label: '售前支持',
    subjectLabel: '商机客户 / 机构名称',
    subjectPlaceholder: '输入商机客户名称，如：中行省分',
    itemsLabel: '售前支持具体事项',
    itemsPlaceholder: '分条列出具体事项，如：\n1、参加现场接待沟通产业链需求；\n2、根据业务场景编写定制化技术方案初稿...',
    hint: '1处填商机客户名称，2处分条列出售前沟通、方案编写、技术交流等事项（1对多）',
    badgeClass: 'bg-amber-50 text-amber-700 border-amber-200/80',
  },
  {
    key: '合规工作',
    label: '合规工作',
    subjectLabel: '合规专项 / 审计主题',
    subjectPlaceholder: '输入合规专项或审计主题，如：数据安全合规自查',
    itemsLabel: '合规推进具体事项',
    itemsPlaceholder: '分条列出具体事项，如：\n1、梳理涉及客户隐私字段与脱敏加密规范；\n2、复核安全部门第一轮整改清单落实情况...',
    hint: '1处填合规专项或审计主题，2处分条列出合规检查、自查整改等具体事项（1对多）',
    badgeClass: 'bg-teal-50 text-teal-700 border-teal-200/80',
  },
  {
    key: '其他事项',
    label: '其他事项',
    subjectLabel: '事项主题 / 专项名称',
    subjectPlaceholder: '输入事项主题或任务名称，如：部门月度技术分享',
    itemsLabel: '具体工作推进事项',
    itemsPlaceholder: '分条列出具体事项，如：\n1、确定分享主题与讲师排期日程；\n2、编撰部门标准接入文档与开发规范...',
    hint: '1处填事项或任务主题，2处分条列出日常工作推进细节（1对多）',
    badgeClass: 'bg-zinc-100 text-zinc-700 border-zinc-200/80',
  },
];

// 工作事项
export interface WorkItem {
  id: string;
  category?: string; // 分类：'产品研发' | 'POC' | '合同交付' | '售前支持' | '合规工作' | '其他事项' 或自定义
  title: string;
  description: string;
  status: WorkItemStatus;
}

// 工作事项状态
export type WorkItemStatus = 'completed' | 'in_progress' | 'blocked';

// 周报
export interface Report {
  id: string;
  member_id: string;
  member_name?: string;
  week_start: string; // YYYY-MM-DD 格式，周一日期
  items: WorkItem[];
  next_plan: string;
  updated_at: string;
  created_at: string;
}

// 状态标签映射
export const STATUS_LABELS: Record<WorkItemStatus, string> = {
  completed: '已完成',
  in_progress: '进行中',
  blocked: '受阻',
};

// 预定义成员标准顺序
export const MEMBER_ORDER = [
  '梁振科',
  '邓海涛',
  '王艳耘',
  '朱巍',
  '张杰',
  '丁干',
  '李栩樾',
  '陈奕霖',
  '朱天胜',
] as const;

// 默认用户身份
export const DEFAULT_USER = {
  id: '346082f8-2741-4647-9627-95bf614d1b57',
  name: '朱天胜',
};

// 部门月报结构
export interface MonthlyReport {
  id: string;
  title: string; // 标题，严格固定为：产品创新部 X 月月报
  cycle_name: string; // 统计周期，如：2026年9月 (第36~39周)
  selected_weeks: string[]; // 涵盖的周起始日期数组 (YYYY-MM-DD)
  month_number?: number; // 核心月份，如 9
  next_month_number?: number; // 下月月份，如 10
  summary_overview: string; // 一、X 月工作总结正文
  products_and_features: string; // 二、核心产品开发及优化情况正文
  support_needed: string; // 三、需支持事项正文
  next_month_plan: string; // 四、X+1 月工作计划正文
  raw_markdown: string; // 完整 Markdown 文本
  created_at: string;
  updated_at: string;
  created_by?: string;
}


