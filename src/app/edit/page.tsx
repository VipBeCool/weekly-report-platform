'use client';

import { Suspense, useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Report, WorkItem, WORK_CATEGORIES } from '@/lib/types';
import { getWeekStart, formatWeekRange, getWeekNumber } from '@/lib/week';
import { useIdentity } from '@/hooks/useIdentity';
import { IdentityModal } from '@/components/IdentityModal';
import { WorkItemForm } from '@/components/WorkItemForm';
import { OutlineNavigator, OutlineItem } from '@/components/OutlineNavigator';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Plus, CheckCircle2, AlertTriangle, Copy, Check, RefreshCw } from 'lucide-react';

// 安全生成唯一 ID（兼顾 localhost、https 及内网 HTTP 非安全上下文浏览器环境）
function generateItemId(): string {
  if (typeof window !== 'undefined' && window.crypto && typeof window.crypto.randomUUID === 'function') {
    return window.crypto.randomUUID();
  }
  return 'item-' + Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 9);
}

// 创建空的工作事项
function createEmptyItem(category?: string): WorkItem {
  return {
    id: generateItemId(),
    category: category || WORK_CATEGORIES[0].key,
    title: '',
    description: '',
    status: 'in_progress',
  };
}

function EditPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { memberId, memberName, showModal, isLoading, login, setShowModal } = useIdentity();

  const weekStart = searchParams.get('week') || getWeekStart();
  const fromView = searchParams.get('from') || searchParams.get('view');
  const weekNum = getWeekNumber(weekStart);

  const [items, setItems] = useState<WorkItem[]>([createEmptyItem()]);
  const [nextPlan, setNextPlan] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loadingReport, setLoadingReport] = useState(true);

  // 乐观锁协作版本记录（Confluence 风格防覆盖机制）
  const [loadedUpdatedAt, setLoadedUpdatedAt] = useState<string | null>(null);
  const [conflictInfo, setConflictInfo] = useState<{
    serverUpdatedAt: string;
    serverReport?: Report;
  } | null>(null);
  const [copySuccess, setCopySuccess] = useState(false);

  // 下周计划自适应撑大高度（默认 2~3 行，随内容增多自动撑大）
  const nextPlanRef = useRef<HTMLTextAreaElement>(null);
  const autoResizeNextPlan = () => {
    const el = nextPlanRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.max(el.scrollHeight, 76)}px`;
  };

  useEffect(() => {
    autoResizeNextPlan();
  }, [nextPlan, loadingReport]);

  // 加载已有周报数据
  const loadReport = useCallback(async () => {
    if (!memberId) return;
    setLoadingReport(true);
    try {
      const res = await fetch(
        `/api/reports?member_id=${memberId}&week_start=${weekStart}`
      );
      const data: Report[] = await res.json();
      if (data.length > 0) {
        const report = data[0];
        setItems(report.items.length > 0 ? report.items : [createEmptyItem()]);
        setNextPlan(report.next_plan || '');
        setLoadedUpdatedAt(report.updated_at || null);
      } else {
        setItems([createEmptyItem()]);
        setNextPlan('');
        setLoadedUpdatedAt(null);
      }
    } catch (err) {
      console.error('加载周报失败:', err);
    } finally {
      setLoadingReport(false);
    }
  }, [memberId, weekStart]);

  useEffect(() => {
    if (!isLoading && memberId) {
      loadReport();
    }
  }, [isLoading, memberId, loadReport]);

  // 添加常规事项
  const handleAddItem = (category?: string) => {
    setItems((prev) => [...prev, createEmptyItem(category)]);
    setSaved(false);
  };

  // 更新事项
  const handleUpdateItem = (index: number, updated: WorkItem) => {
    const newItems = [...items];
    newItems[index] = updated;
    setItems(newItems);
    setSaved(false);
  };

  // 删除事项
  const handleRemoveItem = (index: number) => {
    if (items.length <= 1) {
      // 保持至少一项空数据
      setItems([createEmptyItem()]);
      setSaved(false);
      return;
    }
    const newItems = items.filter((_, i) => i !== index);
    setItems(newItems);
    setSaved(false);
  };

  // 上移事项
  const handleMoveUpItem = (index: number) => {
    if (index <= 0) return;
    setItems((prev) => {
      const next = [...prev];
      const temp = next[index];
      next[index] = next[index - 1];
      next[index - 1] = temp;
      return next;
    });
    setSaved(false);
  };

  // 下移事项
  const handleMoveDownItem = (index: number) => {
    if (index >= items.length - 1) return;
    setItems((prev) => {
      const next = [...prev];
      const temp = next[index];
      next[index] = next[index + 1];
      next[index + 1] = temp;
      return next;
    });
    setSaved(false);
  };

  // 保存周报（支持乐观锁冲突校验和强制保存）
  const handleSave = async (force = false) => {
    if (!memberId) return;

    // 过滤掉完全空白的事项
    const validItems = items.filter(
      (item) => item.title.trim() || item.description.trim()
    );

    if (validItems.length === 0) {
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          member_id: memberId,
          week_start: weekStart,
          items: validItems,
          next_plan: nextPlan.trim(),
          client_updated_at: loadedUpdatedAt,
          force,
        }),
      });

      if (res.status === 409) {
        const errData = await res.json();
        setConflictInfo({
          serverUpdatedAt: errData.server_updated_at,
          serverReport: errData.server_report,
        });
        setSaving(false);
        return;
      }

      if (!res.ok) {
        throw new Error('保存失败');
      }

      const savedReport: Report = await res.json();
      setLoadedUpdatedAt(savedReport.updated_at);
      setConflictInfo(null);
      setSaved(true);
      // 保存成功后跳转至周报详情页查看
      setTimeout(() => {
        const fromParam = fromView ? `&from=${fromView}` : '';
        router.push(`/report/${memberId}?week=${weekStart}${fromParam}`);
      }, 600);
    } catch (err) {
      console.error('保存失败:', err);
    } finally {
      setSaving(false);
    }
  };

  // 复制当前草稿文本（防覆盖保护：即使刷新，写过的心血也绝不丢失）
  const handleCopyCurrentDraft = () => {
    const textParts = [
      `【本周工作事项】`,
      ...items.map((it, idx) => `${idx + 1}. [${it.category}] ${it.title}\n${it.description}`),
      `\n【下周工作计划】\n${nextPlan}`
    ].join('\n');
    navigator.clipboard.writeText(textParts);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  // 放弃本地草稿，拉取服务器端最新内容
  const handlePullLatest = () => {
    if (conflictInfo?.serverReport) {
      const report = conflictInfo.serverReport;
      setItems(report.items.length > 0 ? report.items : [createEmptyItem()]);
      setNextPlan(report.next_plan || '');
      setLoadedUpdatedAt(report.updated_at || null);
    } else {
      loadReport();
    }
    setConflictInfo(null);
  };

  // 返回上一级
  const handleBack = () => {
    if (fromView === 'table') {
      router.push(`/?week=${weekStart}&view=table`);
    } else {
      router.push(`/?week=${weekStart}&view=card`);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-6 h-6 border-2 border-[#0f62fe] border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <>
      <IdentityModal
        isOpen={showModal}
        currentMemberId={memberId}
        onSelect={login}
        onClose={() => setShowModal(false)}
      />

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="px-4 md:px-8 py-8 max-w-3xl mx-auto"
      >
        {/* 返回按钮 */}
        <button
          onClick={handleBack}
          className="flex items-center gap-1.5 text-sm text-[#0f62fe] hover:text-[#0043ce] hover:underline transition-colors mb-6"
        >
          <ArrowLeft size={16} />
          {fromView === 'table' ? '返回汇总表格' : '返回团队周报总览'}
        </button>

        {/* 页面标题与提交人信息 */}
        <div className="mb-8">
          <div className="flex items-center justify-between gap-4">
            <h1 className="text-3xl font-light text-[#161616] leading-[1.25]">
              工作周报
            </h1>
            <div className="flex items-center gap-1.5 text-xs text-[#525252] bg-[#f4f4f4] border border-[#e0e0e0] px-3.5 py-1.5 rounded-full whitespace-nowrap shadow-2xs">
              <span className="text-[#8d8d8d]">提交人:</span>
              <span className="font-semibold text-[#161616]">{memberName}</span>
            </div>
          </div>

          <div className="text-sm text-[#525252] tracking-[0.16px] mt-2.5">
            第{weekNum}周 ({formatWeekRange(weekStart)})
          </div>
        </div>

        {loadingReport ? (
          <div className="flex items-center justify-center h-32">
            <div className="w-5 h-5 border-2 border-[#0f62fe] border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : (
          <>
            {/* 工作事项列表 */}
            <div className="mb-8">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                <h2 className="text-base font-semibold text-[#161616]">
                  本周工作内容
                </h2>
                <span className="text-xs text-[#525252] tracking-[0.32px]">
                  共 {items.length} 项
                </span>
              </div>

              {/* 事项卡片列表 */}
              <div className="space-y-3.5">
                <AnimatePresence initial={false}>
                  {items.map((item, index) => (
                    <motion.div
                      layout
                      key={item.id}
                      id={`edit-item-${item.id}`}
                      initial={{ opacity: 0, height: 0, scale: 0.96 }}
                      animate={{ opacity: 1, height: 'auto', scale: 1 }}
                      exit={{ opacity: 0, height: 0, scale: 0.96, overflow: 'hidden' }}
                      transition={{ type: 'spring', damping: 25, stiffness: 220 }}
                      className="scroll-mt-24 transition-shadow rounded-sm"
                    >
                      <WorkItemForm
                        item={item}
                        index={index}
                        totalItems={items.length}
                        onChange={(updated) => handleUpdateItem(index, updated)}
                        onRemove={() => handleRemoveItem(index)}
                        onMoveUp={() => handleMoveUpItem(index)}
                        onMoveDown={() => handleMoveDownItem(index)}
                        onAddNewItemWithCategory={(newCat) => handleAddItem(newCat)}
                      />
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>

              {/* 底部的添加事项按钮 */}
              <motion.button
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                onClick={() => handleAddItem()}
                type="button"
                className="w-full h-12 mt-4 flex items-center justify-center gap-2 text-sm font-medium text-[#0f62fe] bg-[#edf5ff] hover:bg-[#d0e2ff] transition-colors rounded-sm border border-[#0f62fe]/20"
              >
                <Plus size={18} />
                添加工作项
              </motion.button>
            </div>

            {/* 下周工作计划（去掉可选） */}
            <div id="edit-section-next-plan" className="mb-8 scroll-mt-24 transition-shadow rounded-sm">
              <h2 className="text-base font-semibold text-[#161616] mb-3">
                下周工作计划
              </h2>
              <textarea
                ref={nextPlanRef}
                rows={3}
                value={nextPlan}
                onChange={(e) => {
                  setNextPlan(e.target.value);
                  setSaved(false);
                  autoResizeNextPlan();
                }}
                placeholder="填写下周重点推进事项与计划交付目标..."
                className="w-full px-4 py-2.5 bg-[#f4f4f4] text-sm text-[#161616] placeholder-[#8d8d8d] border border-transparent focus:border-[#0f62fe] focus:bg-white focus:outline-none focus:shadow-md transition-all resize-none leading-relaxed rounded-sm overflow-hidden min-h-[76px]"
                style={{ fieldSizing: 'content' } as React.CSSProperties}
              />
            </div>

            {/* 保存按钮与状态 */}
            <div className="flex items-center gap-4 pb-28">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => handleSave(false)}
                disabled={saving}
                className="h-12 px-8 bg-[#0f62fe] text-white text-sm font-medium hover:bg-[#0353e9] active:bg-[#002d9c] disabled:opacity-50 transition-colors shadow-sm rounded-sm"
              >
                {saving ? '保存中...' : '保存周报'}
              </motion.button>
              {saved && (
                <motion.div
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex items-center gap-1.5 text-xs text-emerald-600 font-medium"
                >
                  <CheckCircle2 size={16} />
                  <span>周报保存成功！正在跳转详情页...</span>
                </motion.div>
              )}
            </div>

            {/* 侧边大纲导航（仿 SkillHub） */}
            <OutlineNavigator
              items={[
                ...items.map((item, idx): OutlineItem => ({
                  id: `edit-item-${item.id}`,
                  title: item.title.trim()
                    ? `工作项 ${idx + 1}: ${item.title.trim()}`
                    : `工作项 ${idx + 1}`,
                  badge: item.category,
                  badgeType: 'primary',
                  level: 0,
                })),
                {
                  id: 'edit-section-next-plan',
                  title: '下周工作计划',
                  badge: nextPlan.trim() ? '已填' : undefined,
                  badgeType: 'success',
                  level: 0,
                },
              ]}
              title="大纲导航"
              countLabel={`${items.length + 1} 节`}
            />
          </>
        )}
      </motion.div>

      {/* 协作冲突拦截弹窗 (类似 Confluence 体验) */}
      <AnimatePresence>
        {conflictInfo && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/45 backdrop-blur-xs">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 12 }}
              className="bg-white rounded-lg shadow-2xl border border-amber-200 max-w-lg w-full overflow-hidden"
            >
              <div className="px-6 py-5 bg-amber-50/70 border-b border-amber-100 flex items-start gap-3.5">
                <div className="p-2.5 bg-amber-100 text-amber-700 rounded-full shrink-0">
                  <AlertTriangle size={22} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900">检测到协作编辑冲突</h3>
                  <p className="text-xs text-amber-800 mt-0.5">
                    该篇周报刚才已被其他客户端或窗口更新
                  </p>
                </div>
              </div>

              <div className="p-6 space-y-3.5 text-sm text-gray-600 leading-relaxed">
                <p>
                  此篇周报已于 <span className="font-semibold text-gray-900">{new Date(conflictInfo.serverUpdatedAt).toLocaleString('zh-CN')}</span> 由其他设备或窗口保存过。
                </p>
                <div className="text-xs text-gray-500 bg-gray-50 p-3.5 rounded border border-gray-100 space-y-1">
                  <div className="font-medium text-gray-700">💡 为防止盲目冲刷他人已写内容：</div>
                  <div>1. 您可先点击下方<b>【复制当前草稿】</b>暂存您手头的内容；</div>
                  <div>2. 点击<b>【放弃并拉取最新】</b>刷新查看对方提交的内容；</div>
                  <div>3. 若确认当前内容为最新权威版本，可点击<b>【仍要覆盖保存】</b>。</div>
                </div>
              </div>

              <div className="px-6 py-4 bg-gray-50/80 border-t border-gray-100 flex flex-wrap items-center justify-between gap-2.5">
                <button
                  type="button"
                  onClick={handleCopyCurrentDraft}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-100 transition-colors shadow-2xs"
                >
                  {copySuccess ? <Check size={14} className="text-emerald-600" /> : <Copy size={14} />}
                  <span>{copySuccess ? '已复制到剪贴板！' : '复制当前草稿'}</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handlePullLatest}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-100 transition-colors"
                  >
                    <RefreshCw size={13} />
                    <span>放弃并拉取最新</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSave(true)}
                    className="px-4 py-2 text-xs font-medium text-white bg-amber-600 rounded hover:bg-amber-700 active:bg-amber-800 transition-colors shadow-xs"
                  >
                    仍要覆盖保存
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}

export default function EditPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-64">
          <div className="w-6 h-6 border-2 border-[#0f62fe] border-t-transparent rounded-full animate-spin"></div>
        </div>
      }
    >
      <EditPageContent />
    </Suspense>
  );
}
