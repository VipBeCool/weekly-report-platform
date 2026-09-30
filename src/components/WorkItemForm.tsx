'use client';

import { useState, useRef, useEffect } from 'react';
import { WorkItem, WORK_CATEGORIES } from '@/lib/types';
import { Trash2, Tag, AlertCircle, Plus, ChevronUp, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

interface WorkItemFormProps {
  item: WorkItem;
  index: number;
  totalItems?: number;
  onChange: (updated: WorkItem) => void;
  onRemove: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onAddNewItemWithCategory?: (category: string) => void;
}

export function WorkItemForm({
  item,
  index,
  totalItems = 1,
  onChange,
  onRemove,
  onMoveUp,
  onMoveDown,
  onAddNewItemWithCategory,
}: WorkItemFormProps) {
  // 删除确认气泡状态
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const deleteConfirmRef = useRef<HTMLDivElement>(null);

  // 分类切换确认气泡状态（当已有内容时触发）
  const [pendingCategory, setPendingCategory] = useState<string | null>(null);
  const categoryConfirmRef = useRef<HTMLDivElement>(null);

  // 多行事项输入框自适应高度 ref
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 自动撑大 textarea 高度（默认 2~3 行高）
  const autoResize = () => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.max(el.scrollHeight, 76)}px`;
  };

  // 检查事项是否填写了内容
  const hasContent = Boolean(item.title.trim() || item.description.trim());

  // 监听内容与分类变化，自适应撑大高度
  useEffect(() => {
    autoResize();
  }, [item.description, item.category]);

  // 监听点击外部或按 ESC 键关闭气泡
  useEffect(() => {
    if (!showDeleteConfirm && !pendingCategory) return;

    const handlePointerDown = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node;
      if (
        showDeleteConfirm &&
        deleteConfirmRef.current &&
        !deleteConfirmRef.current.contains(target)
      ) {
        setShowDeleteConfirm(false);
      }
      if (
        pendingCategory &&
        categoryConfirmRef.current &&
        !categoryConfirmRef.current.contains(target)
      ) {
        setPendingCategory(null);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowDeleteConfirm(false);
        setPendingCategory(null);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [showDeleteConfirm, pendingCategory]);

  // 点击删除按钮触发
  const handleDeleteClick = () => {
    if (hasContent) {
      setShowDeleteConfirm(true);
    } else {
      onRemove();
    }
  };

  // 点击分类胶囊触发
  const handleCategoryClick = (catKey: string) => {
    if (item.category === catKey) return;

    // 若当前事项已填写了内容，弹出防呆确认气泡；若未填内容，直接无感切换
    if (hasContent) {
      setPendingCategory(catKey);
    } else {
      onChange({
        ...item,
        category: catKey,
      });
    }
  };

  // 确认操作1：保留当前内容，并直接新建一个新分类的工作项
  const handleCreateNewWithCategory = () => {
    if (!pendingCategory) return;
    const cat = pendingCategory;
    setPendingCategory(null);
    if (onAddNewItemWithCategory) {
      onAddNewItemWithCategory(cat);
    }
  };

  // 确认操作2：清空当前卡片内容并切换分类
  const handleClearAndSwitchCategory = () => {
    if (!pendingCategory) return;
    onChange({
      ...item,
      category: pendingCategory,
      title: '',
      description: '',
    });
    setPendingCategory(null);
  };

  // 确认操作3：保留已填内容，直接更改当前卡片分类
  const handleOnlyChangeCategory = () => {
    if (!pendingCategory) return;
    onChange({
      ...item,
      category: pendingCategory,
    });
    setPendingCategory(null);
  };

  // 匹配当前分类配置
  const matchedPreset = WORK_CATEGORIES.find((c) => c.key === item.category);

  // 计算首尾位置，控制上下移动按钮禁用状态
  const isFirst = index === 0;
  const isLast = index === totalItems - 1;

  return (
    <div className="bg-white p-5 border border-[#e0e0e0] hover:border-[#c6c6c6] focus-within:border-[#0f62fe] focus-within:shadow-sm rounded-sm group transition-all duration-200">
      {/* 顶部：序号、分类选择胶囊条与操作按钮组（上移、下移、删除） */}
      <div className="relative pb-3 mb-3 border-b border-[#f4f4f4] flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5" ref={categoryConfirmRef}>
          {/* 序号徽章 */}
          <span className="px-1.5 py-0.5 text-[11px] font-mono font-semibold text-[#0f62fe] bg-[#edf5ff] border border-[#d0e2ff] rounded-xs shrink-0 select-none mr-1">
            #{index + 1}
          </span>

          <span className="text-xs text-[#525252] flex items-center gap-1 mr-1">
            <Tag size={12} className="text-[#8d8d8d]" />
            分类:
          </span>

          {WORK_CATEGORIES.map((cat) => {
            const isSelected = item.category === cat.key;
            return (
              <button
                key={cat.key}
                type="button"
                onClick={() => handleCategoryClick(cat.key)}
                className={cn(
                  'px-2.5 py-1 text-xs rounded-full border transition-all duration-150',
                  isSelected
                    ? 'bg-[#0f62fe] text-white border-[#0f62fe] font-medium shadow-xs'
                    : 'bg-[#f4f4f4] text-[#525252] border-transparent hover:bg-[#e8e8e8] hover:text-[#161616]'
                )}
              >
                {cat.label}
              </button>
            );
          })}

          {/* 分类切换气泡二次确认层 */}
          <AnimatePresence>
            {pendingCategory && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: -4 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -4 }}
                transition={{ duration: 0.15 }}
                className="absolute left-0 top-full mt-2 w-80 p-3.5 bg-white rounded-lg shadow-xl border border-zinc-200 z-30 text-left"
              >
                <div className="flex items-start gap-2 mb-2.5">
                  <AlertCircle size={16} className="text-[#0f62fe] shrink-0 mt-0.5" />
                  <div>
                    <div className="text-xs font-semibold text-[#161616]">
                      切换分类至【{pendingCategory}】
                    </div>
                    <div className="text-[11px] text-[#525252] mt-0.5 leading-snug">
                      当前工作项已填写内容，您想保留当前内容新建工作项，还是清空切换？
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-1.5 pt-1">
                  {onAddNewItemWithCategory && (
                    <button
                      type="button"
                      onClick={handleCreateNewWithCategory}
                      className="w-full flex items-center justify-between px-3 py-1.5 text-xs bg-[#edf5ff] hover:bg-[#d0e2ff] text-[#0f62fe] font-medium rounded-sm transition-colors text-left"
                    >
                      <span className="flex items-center gap-1.5">
                        <Plus size={13} />
                        保留当前，新建【{pendingCategory}】工作项
                      </span>
                      <span className="text-[10px] text-[#0f62fe]/80 bg-white px-1.5 py-0.5 rounded">推荐</span>
                    </button>
                  )}

                  <div className="flex items-center justify-end gap-1.5 mt-1 pt-1.5 border-t border-[#f4f4f4]">
                    <button
                      type="button"
                      onClick={() => setPendingCategory(null)}
                      className="px-2.5 py-1 text-xs text-[#525252] hover:bg-[#f4f4f4] rounded-sm transition-colors"
                    >
                      取消
                    </button>
                    <button
                      type="button"
                      onClick={handleClearAndSwitchCategory}
                      className="px-2.5 py-1 text-xs text-[#da1e28] hover:bg-[#ffeef0] rounded-sm transition-colors"
                    >
                      清空并切换
                    </button>
                    <button
                      type="button"
                      onClick={handleOnlyChangeCategory}
                      className="px-2.5 py-1 text-xs bg-[#f4f4f4] hover:bg-[#e0e0e0] text-[#161616] font-medium rounded-sm transition-colors"
                    >
                      仅改分类
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* 右侧操作按钮组：上移、下移与删除操作 */}
        <div className="flex items-center gap-1 shrink-0 ml-auto">
          {/* 上移按钮 */}
          {onMoveUp && (
            <button
              type="button"
              onClick={onMoveUp}
              disabled={isFirst}
              className={cn(
                'w-7 h-7 flex items-center justify-center rounded-sm transition-all',
                isFirst
                  ? 'text-[#c6c6c6] cursor-not-allowed opacity-25'
                  : 'text-[#525252] hover:text-[#0f62fe] hover:bg-[#edf5ff] active:bg-[#d0e2ff] cursor-pointer'
              )}
              title={isFirst ? '已在最顶端' : '向上移动一项'}
            >
              <ChevronUp size={16} />
            </button>
          )}

          {/* 下移按钮 */}
          {onMoveDown && (
            <button
              type="button"
              onClick={onMoveDown}
              disabled={isLast}
              className={cn(
                'w-7 h-7 flex items-center justify-center rounded-sm transition-all',
                isLast
                  ? 'text-[#c6c6c6] cursor-not-allowed opacity-25'
                  : 'text-[#525252] hover:text-[#0f62fe] hover:bg-[#edf5ff] active:bg-[#d0e2ff] cursor-pointer'
              )}
              title={isLast ? '已在最底端' : '向下移动一项'}
            >
              <ChevronDown size={16} />
            </button>
          )}

          <div className="w-[1px] h-3.5 bg-[#e0e0e0] mx-0.5" />

          {/* 删除操作及气泡二次确认容器 */}
          <div className="relative" ref={deleteConfirmRef}>
            <button
              onClick={handleDeleteClick}
              className={cn(
                'w-7 h-7 flex items-center justify-center text-[#8d8d8d] hover:bg-[#ffeef0] hover:text-[#da1e28] transition-colors rounded-sm opacity-60 group-hover:opacity-100 focus:opacity-100 cursor-pointer',
                showDeleteConfirm && 'bg-[#ffeef0] text-[#da1e28] opacity-100 ring-2 ring-[#da1e28]/20'
              )}
              title="删除此工作项"
              type="button"
            >
              <Trash2 size={15} />
            </button>

          {/* 删除二次确认气泡 */}
          <AnimatePresence>
            {showDeleteConfirm && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: -4 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: -4 }}
                transition={{ duration: 0.15 }}
                className="absolute right-0 top-full mt-2 w-60 p-3 bg-white rounded-lg shadow-xl border border-zinc-200 z-30 text-left"
              >
                {/* 气泡顶部指示小三角 */}
                <div className="absolute -top-1.5 right-2.5 w-3 h-3 bg-white border-l border-t border-zinc-200 rotate-45" />

                <div className="flex items-start gap-2 relative z-10 mb-3">
                  <AlertCircle size={16} className="text-[#da1e28] shrink-0 mt-0.5" />
                  <div>
                    <div className="text-xs font-semibold text-[#161616]">
                      确定删除此工作项？
                    </div>
                    <div className="text-[11px] text-[#525252] mt-0.5 leading-snug">
                      该工作项已填写内容，删除后将丢失。
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-1.5 relative z-10">
                  <button
                    type="button"
                    onClick={() => setShowDeleteConfirm(false)}
                    className="px-2.5 py-1 text-xs text-[#525252] hover:bg-[#f4f4f4] rounded-sm transition-colors"
                  >
                    取消
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowDeleteConfirm(false);
                      onRemove();
                    }}
                    className="px-2.5 py-1 text-xs bg-[#da1e28] hover:bg-[#ba1b23] text-white font-medium rounded-sm shadow-xs transition-colors"
                  >
                    确认删除
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>

      {/* 事项内容输入区：极简直接，去除冗余标签与提示条，由 placeholder 自然引导 */}
      <div className="space-y-3">
        {/* 1处：产品/系统/客户/专项主体名称 */}
        <input
          type="text"
          value={item.title}
          onChange={(e) => onChange({ ...item, title: e.target.value })}
          placeholder={matchedPreset?.subjectPlaceholder || '输入产品或系统名称，如：AI工作台'}
          className="w-full h-10 px-0 bg-transparent text-base font-semibold text-[#161616] placeholder-[#8d8d8d] border-0 border-b border-[#e0e0e0] focus:border-[#0f62fe] focus:outline-none focus:ring-0 transition-colors"
        />

        {/* 2处：具体推进事项（一对多清单，自适应撑大高度，消除滚动条） */}
        <textarea
          ref={textareaRef}
          rows={3}
          value={item.description}
          onChange={(e) => {
            onChange({ ...item, description: e.target.value });
            autoResize();
          }}
          placeholder={matchedPreset?.itemsPlaceholder || '分条列出具体事项，如：\n1、xx功能需求设计，原型设计；\n2、准备测试数据；\n3、协调外部系统及对接...'}
          className="w-full px-3 py-2 bg-[#f4f4f4] text-sm text-[#161616] placeholder-[#8d8d8d] border border-transparent focus:border-[#0f62fe] focus:bg-white focus:outline-none transition-colors resize-none rounded-sm leading-relaxed overflow-hidden min-h-[76px]"
          style={{ fieldSizing: 'content' } as React.CSSProperties}
        />
      </div>
    </div>
  );
}
