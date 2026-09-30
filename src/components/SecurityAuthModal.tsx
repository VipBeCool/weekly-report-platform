'use client';

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldCheck, Lock, Unlock, Eye, EyeOff, AlertCircle, X, KeyRound, ArrowRight } from 'lucide-react';

interface SecurityAuthModalProps {
  isOpen: boolean;
  onSuccess: () => void;
  onClose: () => void;
}

const CORRECT_PASSWORD = process.env.NEXT_PUBLIC_ADMIN_PASSWORD || 'helloworld';

export function SecurityAuthModal({ isOpen, onSuccess, onClose }: SecurityAuthModalProps) {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [shakeCount, setShakeCount] = useState(0);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // 弹窗打开时重置状态并聚焦
  useEffect(() => {
    if (isOpen) {
      setPassword('');
      setErrorMsg('');
      setIsVerifying(false);
      setIsSuccess(false);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  // 提交校验
  const handleVerify = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isVerifying || isSuccess) return;

    const trimmed = password.trim();
    if (!trimmed) {
      setErrorMsg('请输入管理员口令');
      setShakeCount((prev) => prev + 1);
      inputRef.current?.focus();
      return;
    }

    setIsVerifying(true);
    setErrorMsg('');

    // 短暂模拟安全验证微延时，增强安全感与仪式感
    setTimeout(() => {
      if (trimmed === CORRECT_PASSWORD) {
        setIsSuccess(true);
        setIsVerifying(false);
        // 成功状态维持 400ms 后切换到系统配置
        setTimeout(() => {
          onSuccess();
          onClose();
        }, 400);
      } else {
        setIsVerifying(false);
        setErrorMsg('口令校验失败，请重新输入');
        setShakeCount((prev) => prev + 1);
        setPassword('');
        inputRef.current?.focus();
      }
    }, 280);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 sm:p-6">
          {/* 细腻深色毛玻璃背景 */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-[#0c0d0e]/70 backdrop-blur-md transition-opacity"
          />

          {/* 模态卡片主体 */}
          <motion.div
            initial={{ opacity: 0, scale: 0.94, y: 14 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 14 }}
            transition={{ type: 'spring', damping: 26, stiffness: 320 }}
            className="relative w-full max-w-[420px] bg-[#161616] border border-zinc-800 rounded-xl shadow-2xl overflow-hidden z-10 text-white"
          >
            {/* 顶部微光渐变装饰条 */}
            <div className="h-1 w-full bg-linear-to-r from-blue-600 via-indigo-500 to-cyan-400" />

            {/* 关闭按钮 */}
            <button
              type="button"
              onClick={onClose}
              className="absolute top-4 right-4 p-1.5 text-zinc-400 hover:text-white hover:bg-zinc-800/80 rounded-md transition-colors cursor-pointer"
              title="关闭"
            >
              <X size={16} />
            </button>

            <div className="p-6 sm:p-7">
              {/* 安全盾牌与锁形徽章 */}
              <div className="flex justify-center mb-5">
                <motion.div
                  animate={
                    isSuccess
                      ? { scale: [1, 1.15, 1], backgroundColor: 'rgba(16, 185, 129, 0.15)', borderColor: 'rgba(16, 185, 129, 0.3)' }
                      : { scale: 1 }
                  }
                  className="relative w-14 h-14 rounded-2xl bg-blue-500/10 border border-blue-500/25 flex items-center justify-center shadow-inner"
                >
                  {isSuccess ? (
                    <Unlock size={26} className="text-emerald-400" />
                  ) : (
                    <ShieldCheck size={26} className="text-[#4589ff]" />
                  )}
                  {/* 微弱呼吸光晕 */}
                  <div className="absolute inset-0 rounded-2xl bg-blue-400/10 blur-sm pointer-events-none" />
                </motion.div>
              </div>

              {/* 标题与描述 */}
              <div className="text-center mb-6">
                <h3 className="text-lg font-semibold text-white tracking-wide">
                  管理员口令验证
                </h3>
                <p className="text-xs text-zinc-400 mt-1.5 leading-relaxed">
                  系统管理涉及全局成员次序及法定节假日排期，请输入访问口令继续
                </p>
              </div>

              {/* 表单区域（附带错误震颤动画） */}
              <form onSubmit={handleVerify}>
                <motion.div
                  key={shakeCount}
                  animate={
                    shakeCount > 0
                      ? { x: [-10, 10, -7, 7, -4, 4, -1, 1, 0] }
                      : {}
                  }
                  transition={{ duration: 0.4 }}
                  className="space-y-4"
                >
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-zinc-400">
                      <KeyRound size={16} />
                    </div>
                    <input
                      ref={inputRef}
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        if (errorMsg) setErrorMsg('');
                      }}
                      placeholder="请输入口令..."
                      disabled={isVerifying || isSuccess}
                      className={`w-full pl-10 pr-10 py-2.5 bg-zinc-900 text-sm text-white placeholder-zinc-500 rounded-lg border transition-all outline-none ${
                        errorMsg
                          ? 'border-rose-500/80 focus:border-rose-500 focus:ring-2 focus:ring-rose-500/20 shadow-xs'
                          : 'border-zinc-700/80 focus:border-[#0f62fe] focus:ring-2 focus:ring-[#0f62fe]/25'
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      tabIndex={-1}
                      className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>

                  {/* 错误提示 */}
                  {errorMsg && (
                    <motion.div
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex items-center gap-1.5 text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 px-3 py-1.5 rounded-md"
                    >
                      <AlertCircle size={14} className="shrink-0" />
                      <span>{errorMsg}</span>
                    </motion.div>
                  )}

                  {/* 成功提示 */}
                  {isSuccess && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="flex items-center justify-center gap-1.5 text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-md font-medium"
                    >
                      <span>口令验证通过，正在进入系统配置...</span>
                    </motion.div>
                  )}

                  {/* 操作按钮组 */}
                  <div className="flex items-center gap-3 pt-2">
                    <button
                      type="button"
                      onClick={onClose}
                      disabled={isVerifying || isSuccess}
                      className="flex-1 py-2.5 text-xs font-medium text-zinc-300 hover:text-white bg-zinc-800/80 hover:bg-zinc-700/80 border border-zinc-700/60 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                    >
                      取消
                    </button>
                    <button
                      type="submit"
                      disabled={isVerifying || isSuccess}
                      className="flex-1 py-2.5 text-xs font-medium text-white bg-[#0f62fe] hover:bg-[#0353e9] active:bg-[#002d9c] rounded-lg transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 group"
                    >
                      {isVerifying ? (
                        <>
                          <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          <span>校验中...</span>
                        </>
                      ) : isSuccess ? (
                        <span>已验证</span>
                      ) : (
                        <>
                          <span>验证并进入</span>
                          <ArrowRight size={13} className="group-hover:translate-x-0.5 transition-transform" />
                        </>
                      )}
                    </button>
                  </div>
                </motion.div>
              </form>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
