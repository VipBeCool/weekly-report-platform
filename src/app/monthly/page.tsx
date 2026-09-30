'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Member, Report, MonthlyReport } from '@/lib/types';
import {
  getWeekStart,
  getPrevWeek,
  getNextWeek,
  formatWeekRange,
  getWeekNumber,
  getWeeksBetween,
  formatCycleRange,
} from '@/lib/week';
import { calculateReportMonths, inferDominantMonth } from '@/lib/monthlySynthesizer';
import {
  exportMonthlyReportToMarkdown,
  exportMonthlyReportToWord,
  copyMonthlyReportToClipboard,
  resolveCycleText,
} from '@/lib/exportMonthly';
import {
  Sparkles,
  Calendar,
  CheckCircle2,
  FileText,
  FileCode,
  Copy,
  Download,
  Save,
  RotateCcw,
  RotateCw,
  X,
  Archive,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  Layers,
  Clock,
  Trash2,
  Check,
  Edit2,
  Eye,
  SlidersHorizontal,
  BookmarkCheck,
  Loader2,
  Activity,
  AlertCircle,
  AlertTriangle,
  Info,
  Minimize2,
  Maximize2,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

export default function MonthlyReportPage() {
  // 当前处于的面板模式：'generator' (生成工作台) vs 'archive' (往期月报归档)
  const [activeTab, setActiveTab] = useState<'generator' | 'archive'>('generator');

  // 基础数据
  const [members, setMembers] = useState<Member[]>([]);
  const [reports, setReports] = useState<Report[]>([]);
  const [archives, setArchives] = useState<MonthlyReport[]>([]);
  const [loadingInitial, setLoadingInitial] = useState(true);

  // 真实基准周（系统当前时间所在周）
  const realCurrentWeek = useMemo(() => getWeekStart(new Date()), []);

  // 默认周窗口顶部锚点周（以当前周往后 2 周开始，让当前周及稍后的周都能在默认首屏直接看到）
  const defaultTopWeek = useMemo(() => {
    return getNextWeek(getNextWeek(realCurrentWeek));
  }, [realCurrentWeek]);

  // 当前周列表窗口的最高周（最新的一周）
  const [topWeek, setTopWeek] = useState<string>(() => {
    return getNextWeek(getNextWeek(getWeekStart(new Date())));
  });

  // 当前窗口展示的周次：严格按时间自然正序（由早到晚，从左往右，由旧到新）
  const visibleWeeks = useMemo(() => {
    const list: string[] = [];
    let cur = topWeek;
    for (let i = 0; i < 12; i++) {
      list.push(cur);
      cur = getPrevWeek(cur);
    }
    // 反转为时间正序：左上角最早，右下角最新
    return list.reverse();
  }, [topWeek]);

  // 计算某个周所属的主导年份（周四所在年份）
  const getWeekYear = useCallback((weekStartStr: string) => {
    const d = new Date(weekStartStr + 'T00:00:00');
    const mid = new Date(d);
    mid.setDate(d.getDate() + 3);
    return mid.getFullYear();
  }, []);

  // 计算某个周次主要归属的自然月（7天中出现次数最多的月份）
  const getWeekDominantMonth = useCallback((weekStartStr: string) => {
    const parts = weekStartStr.split('-').map(Number);
    const startDate = new Date(parts[0], parts[1] - 1, parts[2]);
    const monthCounts: Record<number, number> = {};
    for (let i = 0; i < 7; i++) {
      const day = new Date(startDate);
      day.setDate(startDate.getDate() + i);
      const m = day.getMonth() + 1;
      monthCounts[m] = (monthCounts[m] || 0) + 1;
    }
    let max = -1;
    let dom = parts[1];
    for (const [mStr, c] of Object.entries(monthCounts)) {
      if (c > max) {
        max = c;
        dom = Number(mStr);
      }
    }
    return dom;
  }, []);

  // 根据任意自然月获取归属于该月份的所有周次（以当年 2026 为准，按由新到旧排列）
  const getMonthWeeks = useCallback((month: number, year: number = 2026) => {
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 0); // 该月末
    const startWeek = getWeekStart(start);
    const endWeek = getWeekStart(end);
    const candidates = getWeeksBetween(startWeek, endWeek);
    return candidates.filter((w) => getWeekDominantMonth(w) === month);
  }, [getWeekDominantMonth]);

  // 目标月份推荐选项：前后两个月去掉括号内容，仅中间本月保留
  const monthOptions = useMemo(() => {
    return [
      { month: 8, label: '8 月' },
      { month: 9, label: '9 月 (本月)' },
      { month: 10, label: '10 月' },
    ];
  }, []);

  // 当前选定的月报目标月份（主控维度）
  const [targetMonth, setTargetMonth] = useState<number>(9);

  // 记录标题是否由用户手动定制修改过（若为系统格式则允许跟随选周自动更新）
  const [isTitleCustomized, setIsTitleCustomized] = useState<boolean>(false);

  // 月报标题（选择月份或选周后默认自动推导生成，允许用户自由修改）
  const [reportTitle, setReportTitle] = useState<string>(() => '产品创新部9月月报');

  // 用户当前勾选的周（初始化为 9 月份所包含的全部自然周）
  const [selectedWeeks, setSelectedWeeks] = useState<string[]>(() => {
    return [
      '2026-09-28',
      '2026-09-21',
      '2026-09-14',
      '2026-09-07',
      '2026-08-31',
    ];
  });

  // 连选交互锚点：记录首尾连选的起点
  const [rangeAnchor, setRangeAnchor] = useState<string | null>(null);

  // 核心：监听用户自主勾选的周次集合，智能推算主导月份并自适应更新标题与目标月份
  useEffect(() => {
    if (selectedWeeks.length === 0) return;
    const { month: domMonth, year: domYear } = inferDominantMonth(selectedWeeks);

    // 1. 同步目标月份为实际周次推断的主导月份
    setTargetMonth(domMonth);

    // 2. 若用户尚未手动定制特殊标题（或当前标题为标准“产品创新部X月月报”命名模式），智能推导并填入合适月份
    if (!isTitleCustomized || /^产品创新部(\d{4}年)?\d{1,2}月月报$/.test(reportTitle.trim())) {
      const yearPrefix = domYear !== 2026 ? `${domYear}年` : '';
      setReportTitle(`产品创新部${yearPrefix}${domMonth}月月报`);
    }
  }, [selectedWeeks, isTitleCustomized]);

  // 切换目标月份（选月份定标题结构，并自动匹配推荐周期与周窗口视野）
  const handleSelectMonth = (m: number) => {
    setTargetMonth(m);
    setReportTitle(`产品创新部${m}月月报`);
    setIsTitleCustomized(false);
    setRangeAnchor(null);

    const mWeeks = getMonthWeeks(m);
    if (mWeeks.length > 0) {
      setSelectedWeeks(mWeeks);
      // 视野自动平移：将最新周往后推 1 周，使该月份的所有周处于视野最前排
      setTopWeek(getNextWeek(mWeeks[0]));
    }
  };


  // 前后翻动控制（每次平移 6 周，刚好 1 行，平滑且保持上下文）
  const handleShiftEarlier = () => {
    let cur = topWeek;
    for (let i = 0; i < 6; i++) {
      cur = getPrevWeek(cur);
    }
    setTopWeek(cur);
  };

  const handleShiftLater = () => {
    let cur = topWeek;
    for (let i = 0; i < 6; i++) {
      cur = getNextWeek(cur);
    }
    setTopWeek(cur);
  };

  const handleResetToCurrent = () => {
    setTopWeek(defaultTopWeek);
  };

  // 当前可见周次范围文本提示（按时间正序展示，跨年时明确标注年份）
  const visibleRangeText = useMemo(() => {
    if (visibleWeeks.length === 0) return '';
    const firstWeek = visibleWeeks[0];
    const lastWeek = visibleWeeks[visibleWeeks.length - 1];
    const startYear = getWeekYear(firstWeek);
    const endYear = getWeekYear(lastWeek);
    const startNum = getWeekNumber(firstWeek);
    const endNum = getWeekNumber(lastWeek);

    if (startYear === endYear) {
      return `第 ${startNum} 周 ～ 第 ${endNum} 周`;
    }
    return `${startYear}年第 ${startNum} 周 ～ ${endYear}年第 ${endNum} 周`;
  }, [visibleWeeks, getWeekYear]);

  // 根据当前选择的月份与周次，全自动推导固定的标题与大纲规范
  const calculatedMonths = useMemo(() => {
    return calculateReportMonths(selectedWeeks, targetMonth);
  }, [selectedWeeks, targetMonth]);

  // 月报生成配置（补充偏好）
  const [extraPrompt, setExtraPrompt] = useState('');
  const extraPromptRef = useRef<HTMLTextAreaElement>(null);

  // 监听补充要求内容变化，自动向下自适应扩展高度
  useEffect(() => {
    const el = extraPromptRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.max(el.scrollHeight, 76)}px`;
  }, [extraPrompt]);

  const [isGenerating, setIsGenerating] = useState(false);
  // 月报生成弹窗是否收起为右下角悬浮胶囊窗
  const [isGeneratingMinimized, setIsGeneratingMinimized] = useState<boolean>(false);
  const [generatingProgress, setGeneratingProgress] = useState<number>(0);
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const abortControllerRef = useRef<AbortController | null>(null);

  // 全局生成互斥锁状态（感知是否有其他成员正在生成月报）
  const [systemBusy, setSystemBusy] = useState<{
    isBusy: boolean;
    user?: string;
    elapsedSeconds?: number;
    month?: number;
    title?: string;
  }>({ isBusy: false });

  // 轮询检查系统当前是否有正在提炼月报的任务
  const checkSystemBusy = useCallback(async () => {
    try {
      const res = await fetch('/api/monthly/generate');
      if (res.ok) {
        const data = await res.json();
        if (data.is_busy) {
          setSystemBusy({
            isBusy: true,
            user: data.busy_user,
            elapsedSeconds: data.elapsed_seconds,
            month: data.month,
            title: data.report_title,
          });
        } else {
          setSystemBusy({ isBusy: false });
        }
      }
    } catch {
      // 忽略后台轻量状态感知异常
    }
  }, []);

  // 页面激活或每隔 10 秒刷新一次全局锁状态（仅当本地未在生成时检查）
  useEffect(() => {
    if (isGenerating) return;
    checkSystemBusy();
    const timer = setInterval(checkSystemBusy, 10000);
    return () => clearInterval(timer);
  }, [isGenerating, checkSystemBusy]);

  // 动态阶段推导 (0: 检索清洗, 1: 业务特征聚类, 2: 大模型深度推理, 3: 公文大纲规范化, 4: 完成)
  const currentStep = useMemo(() => {
    if (generatingProgress >= 100) return 4;
    if (generatingProgress >= 65) return 3;
    if (generatingProgress >= 30) return 2;
    if (generatingProgress >= 10) return 1;
    return 0;
  }, [generatingProgress]);

  const [generatedReport, setGeneratedReport] = useState<MonthlyReport | null>(null);

  // 归档详情查看/编辑
  const [selectedArchive, setSelectedArchive] = useState<MonthlyReport | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // 下拉导出菜单状态与引用
  const [isExportMenuOpen, setIsExportMenuOpen] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  // 沉浸式月报编辑与导出弹窗状态
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);

  // 自定义提示/告警模态弹窗状态（彻底替代浏览器原生 alert 系统弹窗）
  const [noticeModal, setNoticeModal] = useState<{
    isOpen: boolean;
    type?: 'warning' | 'error' | 'info';
    title: string;
    message: string;
  } | null>(null);

  // 自定义删除确认模态弹窗状态（彻底替代浏览器原生 confirm 系统弹窗）
  const [deleteConfirmModal, setDeleteConfirmModal] = useState<{
    isOpen: boolean;
    id: string;
    title: string;
  } | null>(null);

  // 监听 ESC 键关闭弹窗
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (deleteConfirmModal?.isOpen) {
          setDeleteConfirmModal(null);
          return;
        }
        if (noticeModal?.isOpen) {
          setNoticeModal(null);
          return;
        }
        if (isPreviewModalOpen) {
          setIsPreviewModalOpen(false);
          setGeneratedReport(null);
          setIsExportMenuOpen(false);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPreviewModalOpen, noticeModal, deleteConfirmModal]);

  // 点击外部自动收起下拉导出菜单
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (exportMenuRef.current && !exportMenuRef.current.contains(event.target as Node)) {
        setIsExportMenuOpen(false);
      }
    }
    if (isExportMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isExportMenuOpen]);

  // 加载系统现有数据
  const loadData = useCallback(async () => {
    setLoadingInitial(true);
    try {
      const [membersRes, reportsRes, monthlyRes] = await Promise.all([
        fetch('/api/members'),
        fetch('/api/reports'),
        fetch('/api/monthly'),
      ]);
      const membersData: Member[] = await membersRes.json();
      const reportsData: Report[] = await reportsRes.json();
      const monthlyData: MonthlyReport[] = await monthlyRes.json();

      setMembers(membersData);
      setReports(reportsData);
      setArchives(monthlyData);
    } catch (err) {
      console.error('加载月报系统数据失败:', err);
    } finally {
      setLoadingInitial(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // 计算所选周次覆盖的数据情况
  const selectedStats = useMemo(() => {
    const matched = reports.filter((r) => selectedWeeks.includes(r.week_start));
    let itemCount = 0;
    matched.forEach((r) => {
      if (Array.isArray(r.items)) {
        itemCount += r.items.length;
      }
    });
    return {
      reportCount: matched.length,
      itemCount,
      weekCount: selectedWeeks.length,
    };
  }, [reports, selectedWeeks]);

  // 首尾点击连选交互逻辑：兼顾起点设置、收尾连选闭区间、同周双击单选、再次点击取消
  const handleWeekClick = (week: string) => {
    // 1. 如果当前处于等待收尾点击的状态
    if (rangeAnchor) {
      if (rangeAnchor === week) {
        // 再次点击同一周：明确表示用户仅想单选这单独 1 周
        setSelectedWeeks([week]);
        setRangeAnchor(null);
      } else {
        // 点击另一周：跨越任意周次与翻页，闭区间内所有周全部连选！
        setSelectedWeeks(getWeeksBetween(rangeAnchor, week));
        setRangeAnchor(null);
      }
      return;
    }

    // 2. 当前没有等待中的起点
    // 如果当前选中的刚好只有这 1 周，再次点击表示“取消选中”
    if (selectedWeeks.length === 1 && selectedWeeks[0] === week) {
      setSelectedWeeks([]);
      setRangeAnchor(null);
      return;
    }

    // 否则开启新的连选起点
    setSelectedWeeks([week]);
    setRangeAnchor(week);
  };

  // 触发生成月报（调用后端接入真实 Dify 工作流，并驱动平滑进度状态机）
  const handleGenerate = async () => {
    // 0. 前置并发拦截：若当前系统正有其他成员在提炼月报，直接弹窗友好拦截
    if (systemBusy.isBusy && !isGenerating) {
      setNoticeModal({
        isOpen: true,
        type: 'warning',
        title: '当前系统正在生成月报',
        message: `当前已有月报正在由【${systemBusy.user || '团队其他成员'}】智能提炼中（已进行约 ${systemBusy.elapsedSeconds || 0} 秒）。\n\n为保障私有大模型性能稳定与提炼质量，系统限制同时只能处理 1 份月报提炼任务。请等待其提炼完成（约 1~2 分钟）后再发起提交。`,
      });
      return;
    }

    // 1. 前置拦截：未勾选任何周次
    if (selectedWeeks.length === 0) {
      setNoticeModal({
        isOpen: true,
        type: 'warning',
        title: '未选择统计周次',
        message: '请至少选择一个自然周后再开始提炼月报。',
      });
      return;
    }

    // 2. 前置拦截：所选周次无任何周报数据（0 篇周报 / 0 项明细）
    if (selectedStats.itemCount === 0 || selectedStats.reportCount === 0) {
      setNoticeModal({
        isOpen: true,
        type: 'warning',
        title: '所选周期暂无周报数据',
        message: `当前勾选的 ${selectedStats.weekCount} 个周次内暂无周报记录，请选择包含已提交周报的周次后再试。`,
      });
      return;
    }

    setIsGenerating(true);
    setIsGeneratingMinimized(false);
    setGeneratingProgress(5);
    setElapsedSeconds(0);
    setSaveSuccess(false);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    // 格式化周期名称（最早一周的开始工作日周一 至 最后一周的结束工作日周五）
    const cycleName = selectedWeeks.length > 0
      ? formatCycleRange(selectedWeeks)
      : `${targetMonth}月统计周期`;

    // 动态进度步进定时器（前快后慢，贴合大模型提炼规律，最高渐近至 95%）
    const timer = setInterval(() => {
      setElapsedSeconds((sec) => sec + 1);
      setGeneratingProgress((prev) => {
        if (prev < 20) return prev + 3.5;
        if (prev < 50) return prev + 1.8;
        if (prev < 80) return prev + 0.9;
        if (prev < 95) return prev + 0.3;
        return prev;
      });
    }, 1000);

    try {
      const res = await fetch('/api/monthly/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          month: targetMonth,
          title: reportTitle.trim() || `产品创新部${targetMonth}月月报`,
          cycle_name: cycleName,
          selected_weeks: selectedWeeks,
          extra_prompt: extraPrompt,
          created_by: '朱天胜',
        }),
        signal: controller.signal,
      });

      clearInterval(timer);

      if (res.ok) {
        const fullReport: MonthlyReport & { is_fallback?: boolean; fallback_reason?: string } = await res.json();
        // 瞬间满格 100% 并短暂停留，形成丝滑完成反馈
        setGeneratingProgress(100);
        setTimeout(() => {
          setGeneratedReport(fullReport);
          setIsGenerating(false);
          setIsGeneratingMinimized(false);
          setGeneratingProgress(0);
          setIsPreviewModalOpen(true);
          checkSystemBusy();

          if (fullReport.is_fallback) {
            setNoticeModal({
              isOpen: true,
              type: 'info',
              title: '已启用智能公文引擎快速生成',
              message: `因私有大模型服务耗时较长（${fullReport.fallback_reason || '已达到等待阈值'}），系统已自动基于真实周报数据瞬间提炼生成规范月报，所列成果与数据 100% 严谨可靠。您可在当前预览窗口中根据需要微调。`,
            });
          }
        }, 600);
      } else {
        const errData = await res.json().catch(() => null);

        // 处理 429 并发拦截
        if (res.status === 429) {
          const busyUser = errData?.busy_user || '其他成员';
          const busyElapsed = errData?.elapsed_seconds || 0;
          setNoticeModal({
            isOpen: true,
            type: 'warning',
            title: '当前系统正在生成月报',
            message: errData?.error || `当前已有月报正在由【${busyUser}】智能提炼中（已进行约 ${busyElapsed} 秒）。为保障私有大模型性能稳定，暂不支持多人并发生成，请等待当前生成完毕（约 1~2 分钟）后再提交。`,
          });
          setIsGenerating(false);
          setIsGeneratingMinimized(false);
          setGeneratingProgress(0);
          checkSystemBusy();
          return;
        }

        const errMsg = errData?.error || '月报生成失败，请稍后重试';
        const isNoData = errMsg.includes('未查询到任何周报记录') || errMsg.includes('0');

        setNoticeModal({
          isOpen: true,
          type: 'warning',
          title: isNoData ? '所选周期暂无周报数据' : '月报生成失败',
          message: isNoData
            ? '所选周期内未查询到任何周报记录，请选择包含已提交周报的周次后再试。'
            : errMsg,
        });
        setIsGenerating(false);
        setIsGeneratingMinimized(false);
        setGeneratingProgress(0);
        checkSystemBusy();
      }
    } catch (err: any) {
      clearInterval(timer);
      if (err.name !== 'AbortError') {
        console.error('调用月报生成服务出错:', err);
        setNoticeModal({
          isOpen: true,
          type: 'error',
          title: '生成服务请求异常',
          message: '网络连接超时或后端服务未响应，请稍后重试。',
        });
      }
      setIsGenerating(false);
      setIsGeneratingMinimized(false);
      setGeneratingProgress(0);
      checkSystemBusy();
    }
  };

  // 取消当前正在进行的生成请求
  const handleCancelGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setIsGenerating(false);
    setIsGeneratingMinimized(false);
    setGeneratingProgress(0);
    checkSystemBusy();
  };

  // 保存生成的月报到归档库
  const handleSaveToArchive = async (reportToSave: MonthlyReport) => {
    try {
      const res = await fetch('/api/monthly', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...reportToSave,
          created_by: reportToSave.created_by || '朱天胜',
        }),
      });
      if (res.ok) {
        setSaveSuccess(true);
        loadData();
        setTimeout(() => setSaveSuccess(false), 2500);
      }
    } catch (err) {
      console.error('保存月报失败:', err);
    }
  };

  // 打开删除某篇归档月报的自定义确认弹窗（彻底替代浏览器原生 confirm）
  const handleRequestDeleteArchive = (id: string, title?: string) => {
    const reportItem = archives.find((a) => a.id === id);
    const repTitle = title || reportItem?.title || '月报归档';
    setDeleteConfirmModal({
      isOpen: true,
      id,
      title: repTitle,
    });
  };

  // 确认执行删除归档
  const handleConfirmDeleteArchive = async () => {
    if (!deleteConfirmModal) return;
    const { id } = deleteConfirmModal;
    try {
      const res = await fetch(`/api/monthly?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        setArchives((prev) => prev.filter((a) => a.id !== id));
        if (selectedArchive?.id === id) {
          setSelectedArchive(null);
        }
      }
    } catch (err) {
      console.error('删除月报失败:', err);
    } finally {
      setDeleteConfirmModal(null);
    }
  };

  // 复制全文
  const handleCopy = async (rep: MonthlyReport) => {
    const ok = await copyMonthlyReportToClipboard(rep);
    if (ok) {
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2000);
    }
  };

  // 取消当前生成的月报结果
  const handleCancelGenerated = () => {
    setIsPreviewModalOpen(false);
    setGeneratedReport(null);
    setSaveSuccess(false);
    setIsExportMenuOpen(false);
  };

  // 保存并导出
  const handleSaveAndExport = async (format: 'word' | 'markdown') => {
    if (!generatedReport) return;
    setIsExportMenuOpen(false);
    // 1. 先保存归档入库
    await handleSaveToArchive(generatedReport);
    // 2. 导出对应格式文件
    if (format === 'word') {
      exportMonthlyReportToWord(generatedReport);
    } else {
      exportMonthlyReportToMarkdown(generatedReport);
    }
  };

  return (
    <div className="px-4 md:px-8 py-8 min-h-[calc(100vh-3.5rem)] bg-[#f8f9fa]">
      {/* 头部标题与视图切换 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-light text-[#161616] leading-tight">
            部门月报
          </h1>
        </div>

        {/* Tab 切换控制器 */}
        <div className="inline-flex p-0.5 bg-white rounded border border-[#e0e0e0] text-xs shadow-2xs">
          <button
            type="button"
            onClick={() => setActiveTab('generator')}
            className={cn(
              'flex items-center gap-1.5 px-3.5 py-1.5 rounded transition-all font-medium',
              activeTab === 'generator'
                ? 'bg-[#0f62fe] text-white shadow-xs'
                : 'text-[#525252] hover:text-[#161616]'
            )}
          >
            <Sparkles size={14} />
            <span>月报生成</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('archive')}
            className={cn(
              'flex items-center gap-1.5 px-3.5 py-1.5 rounded transition-all font-medium',
              activeTab === 'archive'
                ? 'bg-[#0f62fe] text-white shadow-xs'
                : 'text-[#525252] hover:text-[#161616]'
            )}
          >
            <Archive size={14} />
            <span>往期月报归档</span>
            <span className={cn(
              'px-1.5 py-0.2 rounded-full text-[10px]',
              activeTab === 'archive' ? 'bg-white/20 text-white' : 'bg-zinc-100 text-zinc-600'
            )}>
              {archives.length}
            </span>
          </button>
        </div>
      </div>

      {/* 视图一：月报生成工作台 */}
      {activeTab === 'generator' && (
        <div className="space-y-6">
          {/* 步骤一：选定月报月份与统计周期 */}
          <div className="bg-white border border-[#e0e0e0] rounded-sm p-5 shadow-2xs space-y-4">
            {/* 1.1 核心主导：选择月报月份与标题大纲自动锁定 */}
            <div className="pb-3 border-b border-[#f0f0f0] space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Calendar size={16} className="text-[#0f62fe]" />
                  <span className="text-sm font-semibold text-[#161616]">
                    1. 选定月报月份与统计周期
                  </span>
                </div>

                {/* 选个月份：药丸切换按钮组（动态匹配所选周次主导月份，支持快捷跳转） */}
                <div className="flex items-center gap-1.5 bg-[#f5f5f5] p-1 rounded border border-[#e0e0e0] flex-wrap">
                  <span className="text-xs text-[#525252] px-2 font-medium">目标月份:</span>
                  
                  {/* 若当前选中的周次推算出的月份不在预设上月/本月中，动态展现该月份标签并高亮 */}
                  {![8, 9, 10].includes(targetMonth) && (
                    <button
                      type="button"
                      onClick={() => handleSelectMonth(targetMonth)}
                      className="px-3 py-1 text-xs rounded transition-all font-semibold bg-[#0f62fe] text-white shadow-xs cursor-pointer"
                      title={`当前选中的周次集合主要属于 ${targetMonth} 月`}
                    >
                      {targetMonth} 月 (所选周)
                    </button>
                  )}

                  {monthOptions.map(({ month: m, label }) => {
                    const isActive = targetMonth === m;
                    return (
                      <button
                        key={m}
                        type="button"
                        onClick={() => handleSelectMonth(m)}
                        className={cn(
                          'px-3 py-1 text-xs rounded transition-all font-medium cursor-pointer',
                          isActive
                            ? 'bg-[#0f62fe] text-white shadow-xs font-semibold'
                            : 'text-[#525252] hover:bg-white hover:text-[#161616]'
                        )}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 选定月份或周次后，标题默认自适应生成并允许自由修改 */}
              <div className="p-3 bg-[#f8f9fa] border border-[#e0e0e0] rounded flex flex-col sm:flex-row sm:items-center justify-start gap-3 flex-wrap">
                <div className="flex items-center gap-2.5 flex-initial w-full sm:w-[360px]">
                  <span className="text-xs text-[#525252] whitespace-nowrap font-medium">月报标题:</span>
                  <input
                    type="text"
                    value={reportTitle}
                    onChange={(e) => {
                      setReportTitle(e.target.value);
                      setIsTitleCustomized(true);
                    }}
                    placeholder={`产品创新部${targetMonth}月月报`}
                    className="w-full px-3 py-1.5 text-sm font-semibold text-[#161616] bg-white border border-[#d0e2ff] focus:border-[#0f62fe] focus:ring-1 focus:ring-[#0f62fe] rounded shadow-2xs outline-none transition-all placeholder:text-[#a8a8a8]"
                  />
                </div>

                {/* 智能匹配提示与重置操作 */}
                <div className="flex items-center gap-2 text-xs text-[#525252] shrink-0">
                  <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-blue-50 text-[#0f62fe] border border-blue-200/80 font-medium">
                    <Sparkles size={11} />
                    <span>已根据所选周次智能匹配为 {targetMonth} 月</span>
                  </span>
                  {isTitleCustomized && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsTitleCustomized(false);
                        const { month: domMonth, year: domYear } = inferDominantMonth(selectedWeeks);
                        const yearPrefix = domYear !== 2026 ? `${domYear}年` : '';
                        setReportTitle(`产品创新部${yearPrefix}${domMonth}月月报`);
                      }}
                      className="text-xs text-[#0f62fe] hover:underline cursor-pointer ml-1"
                      title="点击恢复为根据所选周次智能推导的标题"
                    >
                      恢复自适应
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* 1.2 统计周期微调（支持首尾点击连选，把中间都选中） */}
            <div className="space-y-2.5 pt-1">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-semibold text-[#161616]">
                    统计周次范围（支持首尾点击连选）:
                  </span>

                  {/* 周次窗口平移控制器：更早周次(过去)、回到本周、更新周次(未来) */}
                  <div className="inline-flex items-center rounded border border-[#d0d0d0] bg-[#f4f4f4] p-0.5 text-xs shadow-2xs">
                    <button
                      type="button"
                      onClick={handleShiftEarlier}
                      className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[#525252] hover:text-[#161616] hover:bg-white transition-all font-medium"
                      title="查看更早的过去周次 (向早推移 6 周)"
                    >
                      <ChevronLeft size={13} />
                      <span>更早周次</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleResetToCurrent}
                      className="px-2.5 py-0.5 rounded text-[#525252] hover:text-[#161616] hover:bg-white transition-all font-medium border-x border-[#d0d0d0]/60"
                      title="重置回到当前包含本周的标准视野"
                    >
                      本周
                    </button>
                    <button
                      type="button"
                      onClick={handleShiftLater}
                      className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[#525252] hover:text-[#161616] hover:bg-white transition-all font-medium"
                      title="查看更新的未来周次 (向晚推移 6 周)"
                    >
                      <span>更新周次</span>
                      <ChevronRight size={13} />
                    </button>
                  </div>
                </div>

                {/* 右侧：当前选中区间与清空操作 */}
                <div className="flex items-center gap-3 text-xs">
                  {rangeAnchor ? (
                    <div className="flex items-center gap-2 bg-blue-50 text-[#0f62fe] px-2.5 py-1 rounded border border-[#0f62fe]/30 shadow-2xs">
                      <span className="font-medium">
                        已选起点：第 {getWeekNumber(rangeAnchor)} 周（可翻页点击任意周完成跨页连选）
                      </span>
                      <button
                        type="button"
                        onClick={() => setRangeAnchor(null)}
                        className="text-[#0f62fe] hover:text-red-600 font-semibold underline cursor-pointer text-xs"
                        title="取消当前起点"
                      >
                        取消
                      </button>
                    </div>
                  ) : (
                    <span className="text-xs text-[#6f6f6f]">
                      {selectedWeeks.length === 0 ? (
                        '未选择周次'
                      ) : (() => {
                        const sorted = [...selectedWeeks].sort((a, b) => a.localeCompare(b));
                        const startYear = getWeekYear(sorted[0]);
                        const endYear = getWeekYear(sorted[sorted.length - 1]);
                        const startNum = getWeekNumber(sorted[0]);
                        const endNum = getWeekNumber(sorted[sorted.length - 1]);
                        const text = startYear === endYear
                          ? (startNum === endNum ? `第 ${startNum} 周` : `第 ${startNum} 周 ～ 第 ${endNum} 周`)
                          : `${startYear}年第 ${startNum} 周 ～ ${endYear}年第 ${endNum} 周`;
                        return (
                          <span>
                            当前选中：
                            <span className="text-[#161616] font-medium">
                              {text}
                            </span>
                            <span className="text-[#8d8d8d] ml-1">({selectedWeeks.length} 周)</span>
                          </span>
                        );
                      })()}
                    </span>
                  )}

                  {selectedWeeks.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedWeeks([]);
                        setRangeAnchor(null);
                      }}
                      className="inline-flex items-center gap-1 px-2.5 py-0.5 text-xs text-[#525252] bg-white border border-[#c6c6c6] hover:border-red-300 hover:text-red-600 hover:bg-red-50/60 rounded shadow-2xs transition-all font-medium"
                    >
                      <RotateCcw size={11} />
                      <span>清空已选</span>
                    </button>
                  )}
                </div>
              </div>

              {/* 周次连选卡片列表 */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
                {visibleWeeks.map((week, index) => {
                  const isSelected = selectedWeeks.includes(week);
                  const isAnchor = rangeAnchor === week;
                  const isCurrent = week === realCurrentWeek;
                  const weekNum = getWeekNumber(week);
                  const curYear = getWeekYear(week);
                  const prevYear = index > 0 ? getWeekYear(visibleWeeks[index - 1]) : curYear;
                  // 跨年时仅在进入新一年的第一个卡片标记年份
                  const isNewYearFirst = index > 0 && curYear !== prevYear;
                  const subCount = reports.filter((r) => r.week_start === week).length;
                  const usedInArchives = archives.filter(
                    (a) => Array.isArray(a.selected_weeks) && a.selected_weeks.includes(week)
                  );

                  return (
                    <button
                      key={week}
                      type="button"
                      onClick={() => handleWeekClick(week)}
                      className={cn(
                        'flex flex-col items-start p-2.5 rounded border text-left transition-all relative select-none cursor-pointer',
                        isAnchor
                          ? 'border-[#0f62fe] bg-[#edf5ff] shadow-sm ring-2 ring-[#0f62fe]/40'
                          : isSelected
                          ? 'border-[#0f62fe] bg-[#edf5ff]/60 shadow-xs ring-1 ring-[#0f62fe]/20'
                          : isCurrent
                          ? 'border-emerald-400 bg-emerald-50/20 hover:border-emerald-500 ring-1 ring-emerald-300/50'
                          : isNewYearFirst
                          ? 'border-indigo-300 bg-indigo-50/20 hover:border-indigo-400'
                          : 'border-[#e0e0e0] bg-white hover:border-zinc-400 hover:bg-zinc-50/50'
                      )}
                    >
                      <div className="flex items-center justify-between w-full mb-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className={cn('text-xs font-semibold', isSelected || isAnchor ? 'text-[#0f62fe]' : isCurrent ? 'text-emerald-900' : 'text-[#161616]')}>
                            第 {weekNum} 周
                          </span>
                          {isCurrent && (
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-700 border border-emerald-300 font-semibold shadow-2xs">
                              本周
                            </span>
                          )}
                          {isNewYearFirst && (
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-[#0f62fe] text-white font-medium shadow-2xs">
                              {curYear}年
                            </span>
                          )}
                          {usedInArchives.length > 0 && (
                            <span
                              className="text-[9px] px-1 py-0.2 rounded bg-amber-50 text-amber-700 border border-amber-200 font-medium"
                              title={`该周已在往期《${usedInArchives[0].title}》中使用（不限制，可再次勾选）`}
                            >
                              已生成
                            </span>
                          )}
                        </div>
                        <div className={cn(
                          'w-4 h-4 rounded-full flex items-center justify-center text-[10px]',
                          isAnchor
                            ? 'bg-[#0f62fe] text-white ring-2 ring-[#0f62fe]/30'
                            : isSelected
                            ? 'bg-[#0f62fe] text-white'
                            : 'border border-zinc-300'
                        )}>
                          {isAnchor ? (
                            <span className="text-[9px] font-bold">起</span>
                          ) : (
                            isSelected && <Check size={11} strokeWidth={3} />
                          )}
                        </div>
                      </div>
                      <span className="text-[11px] text-zinc-500 font-mono">
                        {formatWeekRange(week)}
                      </span>
                      <div className="w-full flex items-center justify-between text-[10px] text-zinc-400 mt-1 pt-1 border-t border-zinc-100">
                        <span>收录周报: <strong className="text-zinc-600">{subCount}</strong>篇</span>
                        {isAnchor && <span className="text-[#0f62fe] font-semibold">起点</span>}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* 步骤二：特定要求 */}
          <div className="bg-white border border-[#e0e0e0] rounded-sm p-5 shadow-2xs space-y-3">
            <div className="flex flex-wrap items-center gap-2 pb-3 border-b border-[#f0f0f0]">
              <SlidersHorizontal size={16} className="text-[#0f62fe]" />
              <span className="text-sm font-semibold text-[#161616]">
                2. 特定要求
              </span>
              <span className="text-xs text-[#8d8d8d] font-normal">
                （选填，追加prompt喂给AI的）
              </span>
            </div>

            <div className="w-full space-y-2">
              <textarea
                ref={extraPromptRef}
                rows={3}
                value={extraPrompt}
                onChange={(e) => setExtraPrompt(e.target.value)}
                placeholder={`示例：
1. 重点突出工商银行、建设银行等重点项目的交付突破；
2. 强调核心算法与数据模型验证已具备对外交付能力；`}
                className="w-full text-xs px-3.5 py-2.5 border border-[#e0e0e0] rounded focus:outline-none focus:border-[#0f62fe] focus:bg-white bg-[#fafafa] transition-[height] duration-150 resize-y leading-relaxed font-sans placeholder:text-zinc-400 placeholder:leading-relaxed min-h-[76px] overflow-hidden"
              />

              {/* 常用通用示例快捷点选 */}
              <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                <span className="text-[11px] text-[#8d8d8d]">快捷填入示例:</span>
                {[
                  '突出重点项目交付进展',
                  '强调业务量化成果与核心指标',
                  '注明跨部门协同与资源支持需求',
                  '文字风格更精炼，突出关键里程碑',
                ].map((eg) => (
                  <button
                    key={eg}
                    type="button"
                    onClick={() => {
                      setExtraPrompt((prev) => {
                        const trimmed = prev.trim();
                        if (!trimmed) return eg;
                        if (trimmed.includes(eg)) return trimmed;
                        return `${trimmed}\n${eg}`;
                      });
                    }}
                    className="text-[11px] px-2 py-0.5 rounded bg-[#f4f4f4] hover:bg-[#edf5ff] text-[#525252] hover:text-[#0f62fe] border border-[#e0e0e0] hover:border-[#0f62fe]/30 transition-all cursor-pointer font-medium"
                  >
                    + {eg}
                  </button>
                ))}
              </div>
            </div>

            {/* 操作栏 */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pt-1">
              {systemBusy.isBusy && !isGenerating ? (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-amber-50 border border-amber-200/80 text-xs text-amber-800 animate-pulse">
                  <AlertCircle size={14} className="text-amber-600 shrink-0" />
                  <span>
                    当前【{systemBusy.user || '其他成员'}】正在提炼月报（已耗时约 {systemBusy.elapsedSeconds || 0}s），为保障性能暂不可并发提交
                  </span>
                </div>
              ) : (
                <div />
              )}

              <div className="flex items-center justify-end">
                <button
                  type="button"
                  disabled={isGenerating || selectedWeeks.length === 0}
                  onClick={handleGenerate}
                  className={cn(
                    'inline-flex items-center gap-2 px-6 py-2.5 text-xs font-medium rounded text-white transition-all shadow-xs cursor-pointer',
                    isGenerating || selectedWeeks.length === 0
                      ? 'bg-[#0f62fe]/80 cursor-not-allowed'
                      : systemBusy.isBusy
                      ? 'bg-amber-600 hover:bg-amber-700 active:scale-98'
                      : 'bg-[#0f62fe] hover:bg-[#0353e9] active:scale-98'
                  )}
                >
                  {isGenerating ? (
                    <>
                      <Loader2 size={14} className="animate-spin text-white" />
                      <span>AI 深度提炼中 ({Math.round(generatingProgress)}%)...</span>
                    </>
                  ) : systemBusy.isBusy ? (
                    <>
                      <AlertTriangle size={14} />
                      <span>系统正提炼中（点击查看）</span>
                    </>
                  ) : (
                    <>
                      <Sparkles size={14} />
                      <span>{selectedWeeks.length === 0 ? '请先选择统计周次' : '开始生成'}</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* AI 智能提炼交互组件：全屏大弹窗与右下角悬浮胶囊自由切换 */}
          <AnimatePresence>
            {/* 1. 全景大弹窗（未最小化时展示，详细展示 4 阶段状态） */}
            {isGenerating && !isGeneratingMinimized && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-hidden">
                {/* 磨砂遮罩 */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="fixed inset-0 bg-black/50 backdrop-blur-xs transition-opacity"
                />

                {/* 进度弹窗主体卡片 */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 12 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 12 }}
                  transition={{ duration: 0.2, ease: 'easeOut' }}
                  className="relative w-full max-w-lg bg-white rounded-xl shadow-2xl border border-[#e0e0e0] overflow-hidden z-10"
                >
                  {/* 顶部彩色装饰条 */}
                  <div className="h-1.5 w-full bg-gradient-to-r from-[#0f62fe] via-[#8a3ffc] to-[#0043ce]" />

                  <div className="p-6">
                    {/* 头部标题、计时与收起最小化按钮 */}
                    <div className="flex items-start justify-between gap-3 mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-[#edf5ff] text-[#0f62fe] flex items-center justify-center border border-[#d0e2ff] shadow-2xs">
                          <Sparkles size={20} className="animate-spin" style={{ animationDuration: '6s' }} />
                        </div>
                        <div>
                          <h3 className="text-base font-semibold text-[#161616] flex items-center gap-2">
                            <span>AI 智能工作流正在提炼月报</span>
                          </h3>
                          <p className="text-xs text-[#525252] mt-0.5">
                            已聚合所选 {selectedStats.weekCount} 个周次 · 包含 {selectedStats.itemCount} 项工作明细
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#f4f4f4] border border-[#e0e0e0] text-xs font-mono text-[#525252] shadow-2xs">
                          <Clock size={13} className="text-[#0f62fe]" />
                          <span>{elapsedSeconds}s</span>
                        </div>
                        {/* 最小化按钮 */}
                        <button
                          type="button"
                          onClick={() => setIsGeneratingMinimized(true)}
                          className="p-1.5 text-[#525252] hover:text-[#0f62fe] hover:bg-[#edf5ff] border border-transparent hover:border-[#d0e2ff] rounded transition-all cursor-pointer"
                          title="收起为右下角悬浮窗，可继续在页面浏览往期月报"
                        >
                          <Minimize2 size={16} />
                        </button>
                      </div>
                    </div>

                    {/* 进度条与实时状态 */}
                    <div className="mb-5">
                      <div className="flex items-center justify-between text-xs mb-1.5 font-medium">
                        <span className="text-[#161616] flex items-center gap-2">
                          <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#0f62fe] opacity-75" />
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-[#0f62fe]" />
                          </span>
                          {generatingProgress >= 100
                            ? '月报生成完毕，正在打开报告预览...'
                            : currentStep === 0
                            ? '正在提取周报并清洗数据...'
                            : currentStep === 1
                            ? '正在调用 Dify 工作流归类业务内容...'
                            : currentStep === 2
                            ? '大模型正在深度提炼重点成果...'
                            : '正在组织内容并生成月报报告...'}
                        </span>
                        <span className="font-mono text-[#0f62fe] font-bold text-sm">
                          {Math.round(generatingProgress)}%
                        </span>
                      </div>

                      <div className="w-full h-2.5 bg-[#f4f4f4] rounded-full overflow-hidden border border-[#e0e0e0]">
                        <motion.div
                          className="h-full bg-gradient-to-r from-[#0f62fe] to-[#4589ff] rounded-full"
                          animate={{ width: `${generatingProgress}%` }}
                          transition={{ ease: 'easeOut', duration: 0.3 }}
                        />
                      </div>
                    </div>

                    {/* 阶段步进指示器 */}
                    <div className="space-y-2.5 bg-[#f8f9fa] rounded-lg p-3.5 border border-[#e8e8e8] mb-5 text-xs">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-[#161616]">
                          {currentStep > 0 ? (
                            <CheckCircle2 size={15} className="text-[#24a148]" />
                          ) : (
                            <Loader2 size={15} className="animate-spin text-[#0f62fe]" />
                          )}
                          <span className={cn(currentStep >= 0 ? 'font-medium' : 'text-[#8d8d8d]')}>
                            1. 提取所选周次周报并清洗数据 ({selectedStats.itemCount}项)
                          </span>
                        </div>
                        <span className="text-[11px] text-[#8d8d8d]">
                          {currentStep > 0 ? '已完成' : '清洗中'}
                        </span>
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-[#161616]">
                          {currentStep > 1 ? (
                            <CheckCircle2 size={15} className="text-[#24a148]" />
                          ) : currentStep === 1 ? (
                            <Loader2 size={15} className="animate-spin text-[#0f62fe]" />
                          ) : (
                            <div className="w-3.5 h-3.5 rounded-full border border-[#c6c6c6]" />
                          )}
                          <span className={cn(currentStep >= 1 ? 'font-medium' : 'text-[#8d8d8d]')}>
                            2. 调用 Dify 工作流并按业务板块归类
                          </span>
                        </div>
                        <span className="text-[11px] text-[#8d8d8d]">
                          {currentStep > 1 ? '已完成' : currentStep === 1 ? '归类中' : '等待'}
                        </span>
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-[#161616]">
                          {currentStep > 2 ? (
                            <CheckCircle2 size={15} className="text-[#24a148]" />
                          ) : currentStep === 2 ? (
                            <Loader2 size={15} className="animate-spin text-[#0f62fe]" />
                          ) : (
                            <div className="w-3.5 h-3.5 rounded-full border border-[#c6c6c6]" />
                          )}
                          <span className={cn(currentStep >= 2 ? 'font-medium' : 'text-[#8d8d8d]')}>
                            3. 提炼研发交付与重点机构推进成果
                          </span>
                        </div>
                        <span className="text-[11px] text-[#8d8d8d]">
                          {currentStep > 2 ? '已完成' : currentStep === 2 ? '提炼中' : '等待'}
                        </span>
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-[#161616]">
                          {currentStep >= 4 ? (
                            <CheckCircle2 size={15} className="text-[#24a148]" />
                          ) : currentStep === 3 ? (
                            <Loader2 size={15} className="animate-spin text-[#0f62fe]" />
                          ) : (
                            <div className="w-3.5 h-3.5 rounded-full border border-[#c6c6c6]" />
                          )}
                          <span className={cn(currentStep >= 3 ? 'font-medium' : 'text-[#8d8d8d]')}>
                            4. 组织月报内容并生成完整报告
                          </span>
                        </div>
                        <span className="text-[11px] text-[#8d8d8d]">
                          {currentStep >= 4 ? '已就绪' : currentStep === 3 ? '生成中' : '等待'}
                        </span>
                      </div>
                    </div>

                    {/* 底部信息与操作按钮 */}
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[11px] text-[#8d8d8d]">
                        大模型深度推理中 · 可收起窗口继续浏览
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setIsGeneratingMinimized(true)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-[#0f62fe] hover:bg-[#edf5ff] border border-[#0f62fe]/30 hover:border-[#0f62fe] rounded transition-all font-medium cursor-pointer"
                        >
                          <Minimize2 size={13} />
                          <span>收起窗口</span>
                        </button>
                        <button
                          type="button"
                          onClick={handleCancelGeneration}
                          className="px-3 py-1.5 text-xs text-[#da1e28] hover:bg-[#fff1f1] border border-transparent hover:border-[#ffd7d9] rounded transition-all font-medium cursor-pointer"
                        >
                          取消提炼
                        </button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              </div>
            )}

            {/* 2. 悬浮胶囊状态：当最小化收起时，浮动在右下角，完全不遮挡页面交互与浏览 */}
            {isGenerating && isGeneratingMinimized && (
              <motion.div
                initial={{ opacity: 0, y: 30, scale: 0.85 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 30, scale: 0.85 }}
                transition={{ duration: 0.25, ease: 'easeOut' }}
                onClick={() => setIsGeneratingMinimized(false)}
                className="fixed bottom-6 right-6 z-50 flex items-center gap-3.5 bg-white/95 backdrop-blur-md px-4 py-3 rounded-2xl shadow-2xl border border-[#0f62fe]/30 hover:border-[#0f62fe] transition-all cursor-pointer group select-none ring-4 ring-[#0f62fe]/10"
                title="点击展开完整生成大纲与实时进度"
              >
                {/* 科技流动图标 */}
                <div className="relative flex items-center justify-center w-9 h-9 rounded-xl bg-gradient-to-tr from-[#0f62fe] to-[#8a3ffc] text-white shadow-sm shrink-0">
                  <Sparkles size={18} className="animate-spin" style={{ animationDuration: '4s' }} />
                  <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-sky-500" />
                  </span>
                </div>

                {/* 状态与进度信息 */}
                <div className="flex flex-col min-w-[155px]">
                  <div className="flex items-center justify-between gap-3 text-xs font-semibold text-[#161616]">
                    <span className="flex items-center gap-1.5">
                      <span>AI 月报提炼中</span>
                      <span className="text-[11px] font-normal text-[#525252] font-mono">({elapsedSeconds}s)</span>
                    </span>
                    <span className="font-mono text-[#0f62fe] font-bold text-xs">
                      {Math.round(generatingProgress)}%
                    </span>
                  </div>

                  {/* 微型进度条 */}
                  <div className="w-full h-1.5 bg-[#f4f4f4] rounded-full overflow-hidden mt-1.5 mb-1 border border-[#e0e0e0]">
                    <div
                      className="h-full bg-gradient-to-r from-[#0f62fe] to-[#4589ff] rounded-full transition-all duration-300"
                      style={{ width: `${generatingProgress}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-[#525252]">
                    <span className="truncate max-w-[125px]">
                      {generatingProgress >= 100
                        ? '即将就绪...'
                        : currentStep === 0
                        ? '清洗周报数据...'
                        : currentStep === 1
                        ? '板块智能聚类...'
                        : currentStep === 2
                        ? '提炼重点成果...'
                        : '组织完整报告...'}
                    </span>
                    <span className="text-[#0f62fe] group-hover:underline text-[11px] ml-1 flex items-center font-medium">
                      展开
                      <Maximize2 size={11} className="ml-0.5" />
                    </span>
                  </div>
                </div>

                {/* 取消操作 */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCancelGeneration();
                  }}
                  className="p-1.5 text-[#8d8d8d] hover:text-[#da1e28] hover:bg-[#fff1f1] rounded-full transition-all cursor-pointer ml-1"
                  title="取消提炼"
                >
                  <X size={14} />
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* 沉浸式月报编辑与导出模态弹窗 */}
          <AnimatePresence>
            {generatedReport && isPreviewModalOpen && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 overflow-hidden">
                {/* 半透明毛玻璃遮罩 */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={handleCancelGenerated}
                  className="fixed inset-0 bg-black/60 backdrop-blur-xs transition-opacity"
                />

                {/* 弹窗主体大卡片 */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.96, y: 16 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.96, y: 16 }}
                  transition={{ duration: 0.2, ease: 'easeOut' }}
                  className="relative bg-white shadow-2xl border border-zinc-200 flex flex-col z-10 overflow-hidden w-full max-w-5xl h-[92vh] rounded-lg"
                >
                  {/* 顶部固定吸顶 Header */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-6 py-3.5 bg-white border-b border-[#e0e0e0] select-none shrink-0">
                    <div className="flex-1 max-w-md">
                      <input
                        type="text"
                        value={generatedReport.title}
                        onChange={(e) =>
                          setGeneratedReport({ ...generatedReport, title: e.target.value })
                        }
                        title="点击可直接修改月报主标题"
                        className="text-base sm:text-lg font-semibold text-[#161616] bg-transparent hover:bg-zinc-50 focus:bg-white border border-transparent hover:border-zinc-300 focus:border-[#0f62fe] focus:ring-1 focus:ring-[#0f62fe] rounded px-1.5 py-0.5 outline-none transition-all w-full"
                      />
                      <p className="text-[11px] text-[#8d8d8d] mt-0.5 px-1.5">
                        统计周期：{resolveCycleText(generatedReport) || generatedReport.cycle_name}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {/* 取消 (红色风格) */}
                      <button
                        type="button"
                        onClick={handleCancelGenerated}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-rose-600 hover:text-rose-700 bg-rose-50/70 hover:bg-rose-100/80 border border-rose-200 rounded transition-all cursor-pointer shadow-2xs"
                        title="取消并收起当前月报"
                      >
                        <X size={13} className="text-rose-600" />
                        <span>取消</span>
                      </button>

                      {/* 重新生成 */}
                      <button
                        type="button"
                        disabled={isGenerating}
                        onClick={handleGenerate}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-[#0f62fe] hover:bg-[#edf5ff] bg-white border border-[#0f62fe]/40 rounded transition-all cursor-pointer shadow-2xs"
                        title="按当前周次与特定要求重新生成"
                      >
                        <RotateCw size={13} className={cn(isGenerating && 'animate-spin')} />
                        <span>重新生成</span>
                      </button>

                      {/* 复制全文 */}
                      <button
                        type="button"
                        onClick={() => handleCopy(generatedReport)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white hover:bg-zinc-50 text-[#161616] border border-[#e0e0e0] rounded transition-all cursor-pointer shadow-2xs"
                      >
                        {copySuccess ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
                        <span>{copySuccess ? '已复制' : '复制全文'}</span>
                      </button>

                      {/* 归档 */}
                      <button
                        type="button"
                        onClick={() => handleSaveToArchive(generatedReport)}
                        className={cn(
                          'inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded border transition-all cursor-pointer shadow-2xs',
                          saveSuccess
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                            : 'bg-white hover:bg-zinc-50 text-[#161616] border-[#e0e0e0]'
                        )}
                      >
                        {saveSuccess ? (
                          <Check size={13} className="text-emerald-600" />
                        ) : (
                          <Archive size={13} className="text-[#0f62fe]" />
                        )}
                        <span>{saveSuccess ? '已归档' : '归档'}</span>
                      </button>

                      {/* 归档并导出 下拉选择格式 */}
                      <div className="relative inline-block text-left" ref={exportMenuRef}>
                        <button
                          type="button"
                          onClick={() => setIsExportMenuOpen((prev) => !prev)}
                          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium bg-[#0f62fe] hover:bg-[#0353e9] text-white rounded transition-all shadow-xs cursor-pointer"
                        >
                          <Download size={13} />
                          <span>归档并导出</span>
                          <ChevronDown
                            size={13}
                            className={cn('transition-transform duration-200', isExportMenuOpen && 'rotate-180')}
                          />
                        </button>

                        {isExportMenuOpen && (
                          <div className="absolute right-0 mt-1.5 w-48 bg-white border border-[#e0e0e0] rounded shadow-lg py-1 z-50 animate-in fade-in zoom-in-95 duration-100">
                            <div className="px-3 py-1.5 text-[10px] text-[#8d8d8d] border-b border-zinc-100">
                              选择导出格式并自动归档:
                            </div>
                            <button
                              type="button"
                              onClick={() => handleSaveAndExport('word')}
                              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-left text-[#161616] hover:bg-[#edf5ff] hover:text-[#0f62fe] transition-colors cursor-pointer"
                            >
                              <FileText size={14} className="text-[#0f62fe]" />
                              <div className="flex flex-col">
                                <span className="font-medium">Word 文档 (.docx)</span>
                                <span className="text-[10px] text-zinc-400">标准公文排版，适于正式汇报</span>
                              </div>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSaveAndExport('markdown')}
                              className="w-full flex items-center gap-2 px-3 py-2 text-xs text-left text-[#161616] hover:bg-[#edf5ff] hover:text-[#0f62fe] transition-colors cursor-pointer"
                            >
                              <FileCode size={14} className="text-zinc-600" />
                              <div className="flex flex-col">
                                <span className="font-medium">Markdown (.md)</span>
                                <span className="text-[10px] text-zinc-400">规范大纲层级，适于知识库</span>
                              </div>
                            </button>
                          </div>
                        )}
                      </div>

                      {/* 右上角标准关闭 X 按钮 */}
                      <button
                        type="button"
                        onClick={handleCancelGenerated}
                        className="p-1.5 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 rounded transition-colors cursor-pointer ml-1"
                        title="关闭弹窗 (ESC)"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  </div>

                  {/* 中间主体可滚动编辑区 */}
                  <div className="flex-1 overflow-y-auto p-6 sm:p-8 space-y-6 bg-[#fafafa]">
                    {/* 一、X月工作总结 */}
                    <div className="space-y-2 bg-white p-4 rounded border border-[#e8e8e8] shadow-2xs">
                      <div className="flex items-center gap-2">
                        <span className="w-1.5 h-4 bg-[#0f62fe] rounded-sm" />
                        <h3 className="text-sm sm:text-base font-semibold text-[#161616]">
                          一、{generatedReport.month_number || calculatedMonths.currentMonth} 月工作总结
                        </h3>
                      </div>
                      <textarea
                        rows={4}
                        value={generatedReport.summary_overview}
                        onChange={(e) =>
                          setGeneratedReport({ ...generatedReport, summary_overview: e.target.value })
                        }
                        className="w-full text-xs sm:text-sm text-zinc-800 leading-relaxed font-sans p-3 bg-[#fcfcfc] border border-[#e0e0e0] rounded focus:bg-white focus:outline-none focus:border-[#0f62fe] transition-colors resize-y"
                      />
                    </div>

                    {/* 二、核心产品开发及优化情况 */}
                    <div className="space-y-2 bg-white p-4 rounded border border-[#e8e8e8] shadow-2xs">
                      <div className="flex items-center gap-2">
                        <span className="w-1.5 h-4 bg-[#0f62fe] rounded-sm" />
                        <h3 className="text-sm sm:text-base font-semibold text-[#161616]">
                          二、核心产品开发及优化情况
                        </h3>
                      </div>
                      <textarea
                        rows={12}
                        value={generatedReport.products_and_features}
                        onChange={(e) =>
                          setGeneratedReport({ ...generatedReport, products_and_features: e.target.value })
                        }
                        className="w-full text-xs sm:text-sm text-zinc-800 leading-relaxed font-sans p-3 bg-[#fcfcfc] border border-[#e0e0e0] rounded focus:bg-white focus:outline-none focus:border-[#0f62fe] transition-colors resize-y"
                      />
                    </div>

                    {/* 三、需支持事项 */}
                    <div className="space-y-2 bg-white p-4 rounded border border-[#e8e8e8] shadow-2xs">
                      <div className="flex items-center gap-2">
                        <span className="w-1.5 h-4 bg-[#0f62fe] rounded-sm" />
                        <h3 className="text-sm sm:text-base font-semibold text-[#161616]">
                          三、需支持事项
                        </h3>
                      </div>
                      <textarea
                        rows={3}
                        value={generatedReport.support_needed}
                        onChange={(e) =>
                          setGeneratedReport({ ...generatedReport, support_needed: e.target.value })
                        }
                        className="w-full text-xs sm:text-sm text-zinc-800 leading-relaxed font-sans p-3 bg-[#fcfcfc] border border-[#e0e0e0] rounded focus:bg-white focus:outline-none focus:border-[#0f62fe] transition-colors resize-y"
                      />
                    </div>

                    {/* 四、X+1月工作计划 */}
                    <div className="space-y-2 bg-white p-4 rounded border border-[#e8e8e8] shadow-2xs">
                      <div className="flex items-center gap-2">
                        <span className="w-1.5 h-4 bg-[#0f62fe] rounded-sm" />
                        <h3 className="text-sm sm:text-base font-semibold text-[#161616]">
                          四、{generatedReport.next_month_number || calculatedMonths.nextMonth} 月工作计划
                        </h3>
                      </div>
                      <textarea
                        rows={8}
                        value={generatedReport.next_month_plan}
                        onChange={(e) =>
                          setGeneratedReport({ ...generatedReport, next_month_plan: e.target.value })
                        }
                        className="w-full text-xs sm:text-sm text-zinc-800 leading-relaxed font-sans p-3 bg-[#fcfcfc] border border-[#e0e0e0] rounded focus:bg-white focus:outline-none focus:border-[#0f62fe] transition-colors resize-y"
                      />
                    </div>
                  </div>

                  {/* 底部轻量状态条 */}
                  <div className="px-6 py-2.5 bg-white border-t border-[#e0e0e0] flex items-center justify-between text-xs text-[#8d8d8d] shrink-0">
                    <span>按 ESC 键或点击右上角「取消」可关闭弹窗</span>
                    <span>在输入框内编辑后，点击「归档」或「归档并导出」即可同步生效</span>
                  </div>
                </motion.div>
              </div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* 视图二：往期月报归档列表与详情 */}
      {activeTab === 'archive' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* 左侧：往期列表（独立滚动条，类似导航栏常驻吸顶） */}
          <div className="lg:col-span-4 lg:sticky lg:top-20 flex flex-col max-h-[calc(100vh-7rem)] bg-transparent">
            {/* 固顶操作栏 */}
            <div className="flex items-center justify-between pb-3 border-b border-[#e0e0e0] shrink-0 mb-3 bg-[#f8f9fa]">
              <span className="text-xs font-semibold text-[#161616] tracking-wide">
                历史归档月报 ({archives.length}篇)
              </span>
              <button
                type="button"
                onClick={() => {
                  setSelectedArchive(null);
                  setActiveTab('generator');
                }}
                className="text-xs text-[#0f62fe] hover:underline cursor-pointer font-medium"
              >
                + 生成新月报
              </button>
            </div>

            {/* 独立可滚动卡片列表区域 */}
            <div className="flex-1 overflow-y-auto space-y-3 pr-1.5 scroll-smooth overscroll-contain">
              {archives.length === 0 ? (
                <div className="p-8 text-center text-xs text-zinc-400 bg-white border border-[#e0e0e0] rounded">
                  暂无归档月报，快去生成第一篇吧
                </div>
              ) : (
                archives.map((item) => {
                  const isCurrent = selectedArchive?.id === item.id;
                  return (
                    <div
                      key={item.id}
                      onClick={() => setSelectedArchive(item)}
                      className={cn(
                        'p-4 bg-white border rounded-sm transition-all cursor-pointer select-none relative group',
                        isCurrent
                          ? 'border-[#0f62fe] ring-1 ring-[#0f62fe] shadow-xs'
                          : 'border-[#e0e0e0] hover:border-zinc-400'
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="text-sm font-semibold text-[#161616] group-hover:text-[#0f62fe] transition-colors line-clamp-1">
                          {item.title}
                        </h3>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRequestDeleteArchive(item.id, item.title);
                          }}
                          className="opacity-0 group-hover:opacity-100 text-zinc-400 hover:text-rose-600 transition-opacity p-1 cursor-pointer"
                          title="删除该篇归档"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>

                      <p className="text-[11px] text-zinc-500 mt-1">
                        {resolveCycleText(item) || item.cycle_name}
                      </p>

                      <p className="text-xs text-zinc-600 mt-2 line-clamp-2 leading-relaxed">
                        {item.summary_overview}
                      </p>

                      <div className="mt-3 pt-2 border-t border-zinc-100 flex items-center justify-between text-[10px] text-zinc-400">
                        <span>{new Date(item.updated_at).toLocaleDateString('zh-CN')} 归档</span>
                        <span className="text-[#0f62fe] flex items-center gap-0.5">
                          查看完整内容 <ChevronRight size={11} />
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* 右侧：归档月报详情查阅与导出看板 */}
          <div className="lg:col-span-8">
            {selectedArchive ? (
              <div className="bg-white border border-[#e0e0e0] rounded-sm p-6 shadow-sm space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#e0e0e0]">
                  <div>
                    <h2 className="text-xl font-medium text-[#161616]">
                      {selectedArchive.title}
                    </h2>
                    <p className="text-xs text-[#8d8d8d] mt-1">
                      周期：{resolveCycleText(selectedArchive) || selectedArchive.cycle_name} · 归档时间：{new Date(selectedArchive.updated_at).toLocaleString('zh-CN')}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleCopy(selectedArchive)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white hover:bg-zinc-50 text-[#161616] border border-[#e0e0e0] rounded transition-all"
                    >
                      {copySuccess ? <Check size={13} className="text-emerald-600" /> : <Copy size={13} />}
                      <span>{copySuccess ? '已复制' : '复制全文'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => exportMonthlyReportToWord(selectedArchive)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-[#edf5ff] hover:bg-[#d0e2ff] text-[#0f62fe] border border-[#0f62fe]/30 rounded transition-all"
                      title="导出标准公文排版 Word (.docx) 文档"
                    >
                      <Download size={13} />
                      <span>导出 Word (.docx)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => exportMonthlyReportToMarkdown(selectedArchive)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white hover:bg-zinc-50 text-zinc-700 border border-[#e0e0e0] rounded transition-all cursor-pointer shadow-2xs"
                    >
                      <FileText size={13} />
                      <span>导出 MD</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleRequestDeleteArchive(selectedArchive.id, selectedArchive.title)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-rose-600 hover:text-rose-700 bg-rose-50/70 hover:bg-rose-100/80 border border-rose-200 rounded transition-all cursor-pointer shadow-2xs"
                      title="永久删除此篇归档月报"
                    >
                      <Trash2 size={13} />
                      <span>删除归档</span>
                    </button>
                  </div>
                </div>

                {/* 内容渲染展示 */}
                {(() => {
                  const archMonth = selectedArchive.month_number || (() => {
                    const m = selectedArchive.title.match(/(\d+)\s*月/);
                    return m ? parseInt(m[1], 10) : 9;
                  })();
                  const archNextMonth = selectedArchive.next_month_number || ((archMonth % 12) + 1);

                  return (
                    <div className="space-y-6 text-xs text-zinc-800 leading-relaxed">
                      <div>
                        <h3 className="text-sm font-bold text-[#161616] mb-2 flex items-center gap-2">
                          <span className="w-1.5 h-3.5 bg-[#0f62fe] rounded-sm" />
                          一、{archMonth} 月工作总结
                        </h3>
                        <div className="p-4 bg-[#fbfbfb] border border-[#f0f0f0] rounded text-zinc-700 leading-relaxed whitespace-pre-wrap">
                          {selectedArchive.summary_overview}
                        </div>
                      </div>

                      <div>
                        <h3 className="text-sm font-bold text-[#161616] mb-2 flex items-center gap-2">
                          <span className="w-1.5 h-3.5 bg-[#0f62fe] rounded-sm" />
                          二、核心产品开发及优化情况
                        </h3>
                        <div className="p-4 bg-[#fbfbfb] border border-[#f0f0f0] rounded text-zinc-700 leading-relaxed whitespace-pre-wrap font-sans">
                          {selectedArchive.products_and_features}
                        </div>
                      </div>

                      <div>
                        <h3 className="text-sm font-bold text-[#161616] mb-2 flex items-center gap-2">
                          <span className="w-1.5 h-3.5 bg-[#0f62fe] rounded-sm" />
                          三、需支持事项
                        </h3>
                        <div className="p-4 bg-[#fbfbfb] border border-[#f0f0f0] rounded text-zinc-700 leading-relaxed whitespace-pre-wrap">
                          {selectedArchive.support_needed}
                        </div>
                      </div>

                      <div>
                        <h3 className="text-sm font-bold text-[#161616] mb-2 flex items-center gap-2">
                          <span className="w-1.5 h-3.5 bg-[#0f62fe] rounded-sm" />
                          四、{archNextMonth} 月工作计划
                        </h3>
                        <div className="p-4 bg-[#fbfbfb] border border-[#f0f0f0] rounded text-zinc-700 leading-relaxed whitespace-pre-wrap">
                          {selectedArchive.next_month_plan}
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
            ) : (
              <div className="h-64 flex flex-col items-center justify-center bg-white border border-[#e0e0e0] rounded-sm text-center p-6 text-zinc-400">
                <FileText size={32} className="mb-2 text-zinc-300" />
                <p className="text-xs">请在左侧列表中点击选择一篇往期月报进行查阅与导出</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 自定义高质感提示/告警模态弹窗（替代原生系统 alert） */}
      <AnimatePresence>
        {noticeModal?.isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-hidden">
            {/* 磨砂半透明背景遮罩 */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setNoticeModal(null)}
              className="fixed inset-0 bg-black/50 backdrop-blur-xs transition-opacity"
            />

            {/* 弹窗主体卡片 */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 12 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              className="relative w-full max-w-sm bg-white rounded-xl shadow-2xl border border-[#e0e0e0] overflow-hidden z-10"
            >
              {/* 顶部彩色装饰条 */}
              <div
                className={cn(
                  'h-1.5 w-full',
                  noticeModal.type === 'error'
                    ? 'bg-gradient-to-r from-[#da1e28] to-[#fa4d56]'
                    : noticeModal.type === 'info'
                    ? 'bg-gradient-to-r from-[#0f62fe] to-[#4589ff]'
                    : 'bg-gradient-to-r from-amber-400 via-orange-400 to-amber-500'
                )}
              />

              <div className="p-5 sm:p-6">
                {/* 标题与图标 */}
                <div className="flex items-start gap-3.5 mb-5">
                  <div
                    className={cn(
                      'w-10 h-10 rounded-lg flex items-center justify-center shrink-0 border shadow-2xs',
                      noticeModal.type === 'error'
                        ? 'bg-[#fff1f1] text-[#da1e28] border-[#ffd7d9]'
                        : noticeModal.type === 'info'
                        ? 'bg-[#edf5ff] text-[#0f62fe] border-[#d0e2ff]'
                        : 'bg-amber-50 text-amber-600 border-amber-200'
                    )}
                  >
                    {noticeModal.type === 'error' ? (
                      <AlertCircle size={22} />
                    ) : noticeModal.type === 'info' ? (
                      <Info size={22} />
                    ) : (
                      <AlertTriangle size={22} />
                    )}
                  </div>
                  <div className="flex-1 min-w-0 pt-0.5">
                    <h3 className="text-base font-semibold text-[#161616]">
                      {noticeModal.title}
                    </h3>
                    <p className="text-xs text-[#525252] leading-relaxed mt-1.5">
                      {noticeModal.message}
                    </p>
                  </div>
                </div>

                {/* 底部按钮栏：单个简洁利落的确认按钮 */}
                <div className="flex items-center justify-end pt-1">
                  <button
                    type="button"
                    onClick={() => setNoticeModal(null)}
                    className="px-5 py-2 text-xs font-medium text-white bg-[#0f62fe] hover:bg-[#0353e9] rounded transition-all shadow-xs cursor-pointer"
                  >
                    我知道了
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 自定义高质感删除确认模态弹窗（彻底替代原生系统 confirm） */}
      <AnimatePresence>
        {deleteConfirmModal?.isOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-hidden">
            {/* 磨砂半透明背景遮罩 */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDeleteConfirmModal(null)}
              className="fixed inset-0 bg-black/50 backdrop-blur-xs transition-opacity"
            />

            {/* 弹窗主体卡片 */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 12 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              className="relative w-full max-w-sm bg-white rounded-xl shadow-2xl border border-[#e0e0e0] overflow-hidden z-10"
            >
              {/* 顶部红色危险装饰条 */}
              <div className="h-1.5 w-full bg-gradient-to-r from-[#da1e28] to-[#fa4d56]" />

              <div className="p-5 sm:p-6">
                {/* 标题与危险告警图标 */}
                <div className="flex items-start gap-3.5 mb-5">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 border shadow-2xs bg-[#fff1f1] text-[#da1e28] border-[#ffd7d9]">
                    <Trash2 size={20} />
                  </div>
                  <div className="flex-1 min-w-0 pt-0.5">
                    <h3 className="text-base font-semibold text-[#161616]">
                      删除月报归档确认
                    </h3>
                    <p className="text-xs text-[#525252] leading-relaxed mt-1.5">
                      您确定要删除《<span className="font-medium text-[#161616]">{deleteConfirmModal.title}</span>》吗？
                    </p>
                    <p className="text-[11px] text-[#da1e28] mt-1">
                      此操作不可撤销，删除后该篇月报及其所有历史记录将无法恢复。
                    </p>
                  </div>
                </div>

                {/* 底部按钮栏：取消 + 危险删除 */}
                <div className="flex items-center justify-end gap-2.5 pt-1">
                  <button
                    type="button"
                    onClick={() => setDeleteConfirmModal(null)}
                    className="px-4 py-2 text-xs font-medium text-[#525252] hover:text-[#161616] bg-white hover:bg-zinc-100 border border-[#e0e0e0] rounded transition-all cursor-pointer shadow-2xs"
                  >
                    取消
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmDeleteArchive}
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-[#da1e28] hover:bg-[#ba1b23] active:scale-98 rounded transition-all shadow-xs cursor-pointer"
                  >
                    <Trash2 size={13} />
                    <span>确认删除</span>
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
