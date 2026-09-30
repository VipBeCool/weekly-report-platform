import {
  Document,
  Paragraph,
  TextRun,
  Packer,
  AlignmentType,
  LineRuleType,
  Footer,
  PageNumber,
} from 'docx';
import { MonthlyReport } from './types';
import { calculateReportMonths } from './monthlySynthesizer';
import { formatCycleRange } from './week';

// 字体定义（与范例文档严格像素级对齐）
const FONT_HEITI = {
  name: '黑体',
  ascii: '黑体',
  eastAsia: '黑体',
  hAnsi: '黑体',
  cs: 'Times New Roman',
};

const FONT_KAITI = {
  name: '楷体',
  ascii: '楷体',
  eastAsia: '楷体',
  hAnsi: '楷体',
  cs: 'Times New Roman',
};

const FONT_FANGSONG = {
  name: '仿宋',
  ascii: '仿宋',
  eastAsia: '仿宋',
  hAnsi: '仿宋',
  cs: 'Times New Roman',
};

// 页面边距（与国标公文及范例文件完全一致，单位 twip）
const PAGE_MARGINS = {
  top: 2098,    // 约 37mm
  bottom: 1984, // 约 35mm
  left: 1588,   // 约 28mm
  right: 1474,  // 约 26mm
  header: 851,
  footer: 992,
};

// 固定行距 28.9 磅 (578 twips)
const LINE_SPACING_EXACT = {
  line: 578,
  lineRule: LineRuleType.EXACT,
  before: 0,
  after: 0,
};

// 首行缩进 2 字符 (三号字 16pt * 20 twips/pt * 2 字符 = 640 twips)
const INDENT_FIRST_LINE = {
  firstLine: 640,
};

// 规范化统计周期展示文本（最早周一 至 最晚周五）
export function resolveCycleText(report: MonthlyReport): string {
  if (report.selected_weeks && report.selected_weeks.length > 0) {
    return formatCycleRange(report.selected_weeks);
  }
  if (report.cycle_name) {
    const match = report.cycle_name.match(/第\s*(\d+)(?:~(\d+))?\s*周.*?(\d+月\d+日).*?至.*?(\d+月\d+日)/);
    if (match) {
      const wStr = match[2] ? `第${match[1]}~${match[2]}周` : `第${match[1]}周`;
      return `${wStr} (${match[3]} 至 ${match[4]})`;
    }
    return report.cycle_name;
  }
  return '';
}

// 提取月报中的核心月份与下月月份
export function resolveReportMonths(report: MonthlyReport) {
  if (report.month_number && report.next_month_number) {
    return {
      month: report.month_number,
      nextMonth: report.next_month_number,
    };
  }

  // 尝试从标题中提取（如 "产品创新部9月月报"）
  const match = report.title?.match(/(\d+)\s*月/);
  if (match) {
    const cur = parseInt(match[1], 10);
    return {
      month: cur,
      nextMonth: (cur % 12) + 1,
    };
  }

  // 从周次反推
  const calc = calculateReportMonths(report.selected_weeks || []);
  return {
    month: calc.currentMonth,
    nextMonth: calc.nextMonth,
  };
}

// 导出为 Markdown 文件
export function exportMonthlyReportToMarkdown(report: MonthlyReport) {
  const { month, nextMonth } = resolveReportMonths(report);
  const cycleText = resolveCycleText(report);
  const metaText = cycleText ? `**统计周期**：${cycleText}\n\n` : '';
  const content = `# ${report.title}\n\n${metaText}## 一、${month}月工作总结\n${report.summary_overview}\n\n## 二、核心产品开发及优化情况\n${report.products_and_features}\n\n## 三、需支持事项\n${report.support_needed}\n\n## 四、${nextMonth}月工作计划\n${report.next_month_plan}\n`;

  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${report.title.replace(/\s+/g, '_')}.md`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// 构建标准排版的 docx Document 对象
export function buildMonthlyDocx(report: MonthlyReport): Document {
  const paragraphs: Paragraph[] = [];

  // 1. 文档主标题 (黑体, 二号 22pt = 44, 居中, 无首行缩进)
  paragraphs.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: LINE_SPACING_EXACT,
      children: [
        new TextRun({
          text: report.title || '产品创新部月报',
          font: FONT_HEITI,
          size: 44, // 二号
        }),
      ],
    })
  );

  // 添加一级标题 (黑体, 三号 16pt = 32, 两端对齐, 首行缩进 2 字符)
  function addHeading1(text: string) {
    paragraphs.push(
      new Paragraph({
        alignment: AlignmentType.BOTH,
        indent: INDENT_FIRST_LINE,
        spacing: LINE_SPACING_EXACT,
        children: [
          new TextRun({
            text,
            font: FONT_HEITI,
            size: 32, // 三号 16pt
          }),
        ],
      })
    );
  }

  // 添加二级标题 (楷体, 三号 16pt = 32, 两端对齐, 首行缩进 2 字符)
  function addHeading2(text: string) {
    paragraphs.push(
      new Paragraph({
        alignment: AlignmentType.BOTH,
        indent: INDENT_FIRST_LINE,
        spacing: LINE_SPACING_EXACT,
        children: [
          new TextRun({
            text,
            font: FONT_KAITI,
            size: 32, // 三号 16pt
          }),
        ],
      })
    );
  }

  // 解析并保留 Markdown 粗体 **xxx** 标记
  function parseFormattedRuns(text: string, defaultFont = FONT_FANGSONG, size = 32): TextRun[] {
    const parts = text.split(/(\*\*.*?\*\*)/g);
    const runs: TextRun[] = [];
    parts.forEach((part) => {
      if (!part) return;
      if (part.startsWith('**') && part.endsWith('**') && part.length >= 4) {
        runs.push(
          new TextRun({
            text: part.slice(2, -2),
            font: defaultFont,
            size,
            bold: true,
          })
        );
      } else {
        runs.push(
          new TextRun({
            text: part,
            font: defaultFont,
            size,
          })
        );
      }
    });
    return runs;
  }

  // 添加正文段落或三级序号段落
  function addBodyParagraph(line: string) {
    const trimmed = line.trim();
    if (!trimmed) return;

    // 二级公文标题识别: （一）xxx 或 (一) xxx
    if (/^[（(][一二三四五六七八九十]+[）)]/.test(trimmed)) {
      addHeading2(trimmed);
      return;
    }

    // 1. 带黑括号的业务小标题加粗: 如 1.【AI智能体研发】 或 【AI智能体研发】
    const bracketMatch = trimmed.match(/^(\d+[\.、]\s*【[^】]+】[。]?|【[^】]+】[。]?)/);
    if (bracketMatch) {
      const prefix = bracketMatch[0];
      const rest = trimmed.slice(prefix.length).trim();
      const runs: TextRun[] = [
        new TextRun({
          text: prefix,
          font: FONT_FANGSONG,
          size: 32,
          bold: true,
        }),
        ...parseFormattedRuns(rest, FONT_FANGSONG, 32),
      ];

      paragraphs.push(
        new Paragraph({
          alignment: AlignmentType.BOTH,
          indent: INDENT_FIRST_LINE,
          spacing: LINE_SPACING_EXACT,
          children: runs,
        })
      );
      return;
    }

    // 2. 短词标题加粗 (仅当标题长度在 2~12 字符，不含逗号，且后面紧跟非空正文描述时，才加粗该前缀)
    // 例如: "1.重点客户交付。江苏建行完成最后一批白名单交付..."
    const shortTitleMatch = trimmed.match(/^(\d+[\.、]\s*[^，,。！？\n]{2,12}[。：:])\s*(.+)$/);
    if (shortTitleMatch && shortTitleMatch[2].trim().length > 0) {
      const prefix = shortTitleMatch[1];
      const rest = shortTitleMatch[2].trim();
      const runs: TextRun[] = [
        new TextRun({
          text: prefix,
          font: FONT_FANGSONG,
          size: 32,
          bold: true,
        }),
        ...parseFormattedRuns(rest, FONT_FANGSONG, 32),
      ];

      paragraphs.push(
        new Paragraph({
          alignment: AlignmentType.BOTH,
          indent: INDENT_FIRST_LINE,
          spacing: LINE_SPACING_EXACT,
          children: runs,
        })
      );
      return;
    }

    // 3. 普通正文段落及完整清单整句 (仿宋, 三号 16pt = 32, 两端对齐, 首行缩进 2 字符, 不加粗)
    paragraphs.push(
      new Paragraph({
        alignment: AlignmentType.BOTH,
        indent: INDENT_FIRST_LINE,
        spacing: LINE_SPACING_EXACT,
        children: parseFormattedRuns(trimmed, FONT_FANGSONG, 32),
      })
    );
  }

  function parseSectionContent(text: string) {
    if (!text) return;
    const lines = text.split('\n');
    lines.forEach((line) => {
      addBodyParagraph(line);
    });
  }

  const { month, nextMonth } = resolveReportMonths(report);

  // 一、X月工作总结
  addHeading1(`一、${month}月工作总结`);
  parseSectionContent(report.summary_overview);

  // 二、核心产品开发及优化情况
  addHeading1(`二、核心产品开发及优化情况`);
  parseSectionContent(report.products_and_features);

  // 三、需支持事项
  addHeading1(`三、需支持事项`);
  parseSectionContent(report.support_needed || '无。');

  // 四、X+1月工作计划
  addHeading1(`四、${nextMonth}月工作计划`);
  parseSectionContent(report.next_month_plan);

  return new Document({
    sections: [
      {
        properties: {
          page: {
            size: {
              width: 11906,  // A4 宽 210mm
              height: 16838, // A4 高 297mm
            },
            margin: PAGE_MARGINS,
          },
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    children: [PageNumber.CURRENT],
                    font: { name: 'Times New Roman' },
                    size: 20, // 10pt
                  }),
                ],
              }),
            ],
          }),
        },
        children: paragraphs,
      },
    ],
  });
}

// 导出为真正的标准排版 Word (.docx) 文档
export async function exportMonthlyReportToWord(report: MonthlyReport): Promise<void> {
  try {
    const doc = buildMonthlyDocx(report);
    const blob = await Packer.toBlob(doc);
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${(report.title || '产品创新部月报').replace(/\s+/g, '_')}.docx`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch (err) {
    console.error('导出 Word (.docx) 失败:', err);
    alert('导出 Word 文件时发生错误，请稍后重试');
  }
}

// 复制纯文本到剪贴板（兼容内网非安全上下文）
export async function copyMonthlyReportToClipboard(report: MonthlyReport): Promise<boolean> {
  const { month, nextMonth } = resolveReportMonths(report);
  const text = `${report.title}\n\n一、${month}月工作总结\n${report.summary_overview}\n\n二、核心产品开发及优化情况\n${report.products_and_features}\n\n三、需支持事项\n${report.support_needed}\n\n四、${nextMonth}月工作计划\n${report.next_month_plan}`;

  try {
    if (navigator?.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // 降级使用传统 textarea 方案
  }

  try {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);
    return successful;
  } catch (err) {
    console.error('复制失败:', err);
    return false;
  }
}
