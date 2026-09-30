'use client';

import { useState, useEffect } from 'react';
import { Member, MEMBER_ORDER } from '@/lib/types';
import { motion, AnimatePresence } from 'framer-motion';
import { User, CheckCircle2, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface IdentityModalProps {
  isOpen: boolean;
  currentMemberId?: string | null;
  onSelect: (id: string, name: string) => void;
  onClose?: () => void;
}

export function IdentityModal({
  isOpen,
  currentMemberId,
  onSelect,
  onClose,
}: IdentityModalProps) {
  const [members, setMembers] = useState<Member[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(currentMemberId || null);
  const [isLoading, setIsLoading] = useState(true);

  // 弹窗打开时加载成员并同步当前身份高亮
  useEffect(() => {
    if (isOpen) {
      setSelectedId(currentMemberId || null);
      setIsLoading(true);
      fetch('/api/members')
        .then((res) => res.json())
        .then((data: Member[]) => {
          // 保持系统配置中心中设定的成员次序
          setMembers(data);
        })
        .catch(() => {})
        .finally(() => setIsLoading(false));
    }
  }, [isOpen, currentMemberId]);

  // 点击成员立即切换身份并关闭弹窗，无需再点击二次确认
  const handleSelectMember = (member: Member) => {
    setSelectedId(member.id);
    onSelect(member.id, member.name);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-0">
          {/* 毛玻璃背景，若已有身份则允许点击背景关闭 */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => {
              if (currentMemberId && onClose) {
                onClose();
              }
            }}
            className="absolute inset-0 bg-[#161616]/40 backdrop-blur-sm"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="relative bg-white w-full max-w-[540px] shadow-2xl flex flex-col max-h-[85vh] rounded-sm overflow-hidden"
          >
            {/* 标题区域 */}
            <div className="px-6 py-5 border-b border-[#e0e0e0] bg-[#f4f4f4]/60 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-normal text-[#161616]">欢迎回到周报平台</h2>
                <p className="text-xs text-[#525252] tracking-[0.16px] mt-1">
                  点击对应成员即可直接切换身份
                </p>
              </div>
              {/* 若已有身份，允许点击右上角叉号关闭 */}
              {currentMemberId && onClose && (
                <button
                  type="button"
                  onClick={onClose}
                  className="p-1.5 text-[#525252] hover:text-[#161616] hover:bg-zinc-200/60 rounded transition-colors"
                  title="关闭"
                >
                  <X size={18} />
                </button>
              )}
            </div>

            {/* 成员列表 */}
            <div className="flex-1 overflow-y-auto p-6 bg-white min-h-[300px]">
              {isLoading ? (
                <div className="flex justify-center py-16">
                  <div className="w-6 h-6 border-2 border-[#0f62fe] border-t-transparent rounded-full animate-spin"></div>
                </div>
              ) : members.length === 0 ? (
                <div className="text-center py-16 text-sm text-[#525252]">
                  暂无成员数据，请联系管理员添加。
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {members.map((member) => {
                    const isSelected = selectedId === member.id;
                    const isCurrent = currentMemberId === member.id;

                    return (
                      <button
                        key={member.id}
                        type="button"
                        onClick={() => handleSelectMember(member)}
                        className={cn(
                          "relative flex items-center gap-3 p-4 text-left transition-all duration-150 group border outline-none rounded-sm",
                          isSelected
                            ? "bg-[#edf5ff] border-[#0f62fe] shadow-xs"
                            : "bg-[#f4f4f4] border-transparent hover:bg-[#e8e8e8] hover:border-[#c6c6c6]"
                        )}
                      >
                        <div
                          className={cn(
                            "w-8 h-8 flex items-center justify-center rounded-full shrink-0 transition-colors",
                            isSelected
                              ? "bg-[#0f62fe] text-white"
                              : "bg-[#e0e0e0] text-[#525252] group-hover:bg-[#d0e2ff] group-hover:text-[#0f62fe]"
                          )}
                        >
                          <User size={16} />
                        </div>

                        <div className="flex-1 min-w-0 z-10">
                          <div className="flex items-center gap-1.5">
                            <span
                              className={cn(
                                "text-sm font-semibold tracking-[0.16px] truncate transition-colors",
                                isSelected ? "text-[#0f62fe]" : "text-[#161616]"
                              )}
                            >
                              {member.name}
                            </span>
                            {isCurrent && (
                              <span className="text-[10px] text-[#0f62fe] bg-white border border-[#0f62fe]/30 px-1.5 py-0.5 rounded-full whitespace-nowrap">
                                当前
                              </span>
                            )}
                          </div>
                        </div>

                        {isSelected && (
                          <div className="absolute right-4 text-[#0f62fe] z-10">
                            <CheckCircle2 size={18} className="fill-[#edf5ff]" />
                          </div>
                        )}

                        {/* 选中高亮边框 */}
                        {isSelected && (
                          <div className="absolute inset-0 border-[2px] border-[#0f62fe] rounded-sm pointer-events-none" />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
