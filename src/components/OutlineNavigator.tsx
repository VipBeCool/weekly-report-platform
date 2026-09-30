'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { ChevronRight } from 'lucide-react';

export interface OutlineItem {
  id: string;
  title: string;
  subtitle?: string;
  badge?: string;
  badgeType?: 'success' | 'muted' | 'primary';
  level?: number; // 0 为一级，1 为二级缩进
}

interface OutlineNavigatorProps {
  items: OutlineItem[];
  title?: string;
  countLabel?: string;
  className?: string;
}

export function OutlineNavigator({
  items,
  title = '大纲导航',
  countLabel,
  className,
}: OutlineNavigatorProps) {
  const [activeId, setActiveId] = useState<string>(items[0]?.id || '');
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // 监听页面滚动，计算当前视口中的高亮项
  useEffect(() => {
    if (items.length === 0) return;

    const handleScroll = () => {
      const scrollY = window.scrollY;
      const windowHeight = window.innerHeight;
      const docHeight = document.documentElement.scrollHeight;

      // 如果已经滚动到页面最底部（或接近底部），直接高亮最后一项
      if (windowHeight + scrollY >= docHeight - 60) {
        setActiveId(items[items.length - 1].id);
        return;
      }

      // 否则以视口上部 40% 的位置作为高亮触发线
      const triggerLine = scrollY + windowHeight * 0.4;
      let currentId = items[0].id;
      for (const item of items) {
        const el = document.getElementById(item.id);
        if (el) {
          const top = el.offsetTop;
          if (top <= triggerLine) {
            currentId = item.id;
          }
        }
      }
      setActiveId(currentId);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, [items]);

  // 点击外部收起
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  // 平滑滚动至目标项
  const scrollToItem = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      const offset = 80; // 顶部导航栏高度留白
      const bodyRect = document.body.getBoundingClientRect().top;
      const elementRect = el.getBoundingClientRect().top;
      const elementPosition = elementRect - bodyRect;
      const offsetPosition = elementPosition - offset;

      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth',
      });

      // 给目标元素添加短暂的聚焦高亮微动效
      el.classList.add('outline-highlight-target');
      setTimeout(() => {
        el.classList.remove('outline-highlight-target');
      }, 1600);

      setActiveId(id);
    }
  };

  if (items.length === 0) return null;

  return (
    <div
      ref={containerRef}
      className={cn('fixed right-4 top-[240px] z-40 select-none hidden md:block', className)}
    >
      {/* 刻度条常驻手柄（未展开时）- 增大上下间隔与条形尺寸 */}
      <div
        className="group relative flex flex-col items-end gap-4 py-4 px-2.5 cursor-pointer"
        onMouseEnter={() => setIsOpen(true)}
        onClick={() => setIsOpen(!isOpen)}
        title="点击或悬停展开完整大纲"
      >
        {items.map((item) => {
          const isActive = activeId === item.id;
          return (
            <div
              key={item.id}
              onClick={(e) => {
                e.stopPropagation();
                scrollToItem(item.id);
              }}
              className="relative flex items-center justify-end group/item py-0.5"
            >
              {/* 悬停微型标题指示 */}
              <span className="absolute right-10 px-2.5 py-1 text-xs text-white bg-[#161616]/90 backdrop-blur-md rounded shadow-lg pointer-events-none opacity-0 group-hover/item:opacity-100 -translate-x-1 group-hover/item:translate-x-0 transition-all duration-150 whitespace-nowrap z-50">
                {item.title}
              </span>

              {/* 刻度横线 */}
              <div
                className={cn(
                  'transition-all duration-200 rounded-full',
                  isActive
                    ? 'w-8 h-[3.5px] bg-[#0f62fe] shadow-xs'
                    : 'w-4 h-[3px] bg-zinc-300 dark:bg-zinc-700 hover:bg-zinc-400 hover:w-6'
                )}
              />
            </div>
          );
        })}
      </div>

      {/* 展开的「大纲导航」面板（从红框位置自然向下展开） */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, x: 12, scale: 0.96 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 10, scale: 0.96 }}
            transition={{ duration: 0.16, ease: 'easeOut' }}
            onMouseLeave={() => setIsOpen(false)}
            className="absolute right-0 top-0 w-64 max-h-[calc(100vh-260px)] flex flex-col bg-white/95 dark:bg-zinc-900/95 backdrop-blur-xl border border-zinc-200/90 dark:border-zinc-800 rounded-2xl shadow-2xl shadow-zinc-900/15 overflow-hidden"
          >
            {/* 顶部标题栏 */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100 dark:border-zinc-800">
              <span className="text-xs font-semibold text-zinc-900 dark:text-zinc-100">
                {title}
              </span>
              <span className="text-[11px] font-mono text-zinc-400">
                {countLabel || `${items.length} 节`}
              </span>
            </div>

            {/* 导航列表项 */}
            <div className="flex-1 overflow-y-auto p-2 space-y-1 scrollbar-thin">
              {items.map((item) => {
                const isActive = activeId === item.id;
                const isIndented = item.level && item.level > 0;

                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      scrollToItem(item.id);
                    }}
                    type="button"
                    className={cn(
                      'w-full flex items-center justify-between text-left px-3 py-2 rounded-xl text-xs transition-all duration-150 group',
                      isIndented && 'pl-6 text-[11px]',
                      isActive
                        ? 'bg-[#edf5ff] dark:bg-blue-950/60 text-[#0f62fe] dark:text-blue-400 font-medium'
                        : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/60 hover:text-zinc-900 dark:hover:text-zinc-200'
                    )}
                  >
                    <div className="flex items-center gap-1.5 truncate pr-2">
                      <span className="truncate">{item.title}</span>
                    </div>

                    {/* 徽标状态（如已交/未交/我） */}
                    {item.badge && (
                      <span
                        className={cn(
                          'text-[10px] px-1.5 py-0.2 rounded-full shrink-0 scale-90 whitespace-nowrap',
                          item.badgeType === 'success' && 'bg-emerald-50 text-emerald-600 border border-emerald-200/60',
                          item.badgeType === 'primary' && 'bg-blue-100 text-[#0f62fe] border border-blue-200/80',
                          item.badgeType === 'muted' && 'bg-zinc-100 text-zinc-400 dark:bg-zinc-800 dark:text-zinc-500'
                        )}
                      >
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
