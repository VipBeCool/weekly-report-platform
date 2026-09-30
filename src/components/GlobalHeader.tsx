'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { CalendarRange, Sparkles, Settings, Users, ChevronDown, Check } from 'lucide-react';
import { ConfigModal } from './ConfigModal';
import { IdentityModal } from './IdentityModal';
import { SecurityAuthModal } from './SecurityAuthModal';
import { useIdentity } from '@/hooks/useIdentity';

export function GlobalHeader() {
  const pathname = usePathname();
  const [configOpen, setConfigOpen] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);


  const {
    memberId,
    memberName,
    showModal: identityModalOpen,
    login,
    switchIdentity,
    setShowModal: setIdentityModalOpen,
  } = useIdentity();

  const isWeekly = pathname === '/' || pathname.startsWith('/report') || pathname === '/edit';
  const isMonthly = pathname.startsWith('/monthly');

  // 点击下拉菜单外部或按 ESC 键时自动收起
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // 生成头像展示文字（取后两个字或单字）
  const avatarText = memberName ? (memberName.length > 2 ? memberName.slice(-2) : memberName) : '我';

  return (
    <>
      <header className="bg-[#161616] h-14 flex items-center px-4 md:px-8 sticky top-0 z-50 border-b border-zinc-800 shadow-xs">
        <nav className="flex items-center justify-between w-full max-w-[1584px] mx-auto">
          {/* 左侧 Logo 与频道入口 */}
          <div className="flex items-center gap-4 sm:gap-7">
            <Link
              href="/"
              className="flex items-center gap-2.5 group transition-opacity hover:opacity-90 select-none py-1"
              title="产品创新部周报平台"
            >
              <span className="w-1.5 h-4.5 bg-[#0f62fe] rounded-[1px] shrink-0 group-hover:bg-[#4589ff] transition-colors" />
              <span className="text-base sm:text-lg font-bold text-white tracking-[0.3px] font-sans">
                产品创新部周报平台
              </span>
            </Link>

            {/* 优雅分隔竖线 */}
            <div className="h-4 w-[1px] bg-zinc-700/70 hidden sm:block shrink-0" />

            {/* 核心双频道切换（胶囊选项卡容器） */}
            <div className="hidden sm:flex items-center p-1 bg-zinc-900/90 rounded-md border border-zinc-800 shadow-inner gap-1">
              <Link
                href="/"
                className={cn(
                  'px-3.5 py-1.5 rounded text-xs font-medium transition-all flex items-center gap-1.5 select-none',
                  isWeekly
                    ? 'bg-[#0f62fe] text-white font-semibold shadow-xs'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5'
                )}
              >
                <CalendarRange size={13} className={isWeekly ? 'text-white' : 'text-zinc-400'} />
                <span>团队周报</span>
              </Link>
              <Link
                href="/monthly"
                className={cn(
                  'px-3.5 py-1.5 rounded text-xs font-medium transition-all flex items-center gap-1.5 select-none',
                  isMonthly
                    ? 'bg-[#0f62fe] text-white font-semibold shadow-xs'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-white/5'
                )}
              >
                <Sparkles size={13} className={isMonthly ? 'text-white' : 'text-blue-400'} />
                <span>部门月报</span>
              </Link>
            </div>
          </div>

          {/* 右侧：移动端切换 + 成熟网站风格的“账号与设置”下拉控制中心 */}
          <div className="flex items-center gap-3">
            {/* 移动端简易切换 */}
            <div className="flex sm:hidden items-center p-0.5 bg-zinc-900 rounded-md border border-zinc-800 gap-1">
              <Link
                href="/"
                className={cn(
                  'px-2.5 py-1 rounded text-xs font-medium transition-all flex items-center gap-1',
                  isWeekly ? 'bg-[#0f62fe] text-white' : 'text-zinc-400'
                )}
              >
                <CalendarRange size={11} />
                <span>周报</span>
              </Link>
              <Link
                href="/monthly"
                className={cn(
                  'px-2.5 py-1 rounded text-xs font-medium transition-all flex items-center gap-1',
                  isMonthly ? 'bg-[#0f62fe] text-white' : 'text-zinc-400'
                )}
              >
                <Sparkles size={11} />
                <span>月报</span>
              </Link>
            </div>

            {/* 右上角账号胶囊与下拉菜单 */}
            <div className="relative" ref={menuRef}>
              {memberName ? (
                <button
                  type="button"
                  onClick={() => setMenuOpen(!menuOpen)}
                  className={cn(
                    "flex items-center gap-2 pl-1.5 pr-2.5 py-1 rounded-full text-xs font-medium transition-all select-none border cursor-pointer group",
                    menuOpen
                      ? "bg-zinc-800 border-zinc-600 text-white shadow-sm"
                      : "bg-zinc-900/90 hover:bg-zinc-800 border-zinc-700/80 text-zinc-200 hover:text-white hover:border-zinc-600"
                  )}
                  title={`当前账号：${memberName} (点击管理与设置)`}
                >
                  {/* 精致小头像 */}
                  <div className="w-6 h-6 rounded-full bg-linear-to-tr from-[#0f62fe] to-[#4589ff] text-white text-[11px] font-semibold flex items-center justify-center shrink-0 shadow-xs">
                    {avatarText}
                  </div>
                  <span className="font-medium tracking-wide max-w-[80px] sm:max-w-[120px] truncate">
                    {memberName}
                  </span>
                  <ChevronDown
                    size={13}
                    className={cn(
                      "text-zinc-400 group-hover:text-zinc-200 transition-transform duration-200",
                      menuOpen && "rotate-180 text-white"
                    )}
                  />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={switchIdentity}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-[#0f62fe] hover:bg-[#0353e9] rounded transition-all cursor-pointer shadow-xs select-none"
                >
                  <Users size={13} />
                  <span>选择身份</span>
                </button>
              )}

              {/* 成熟网站风格的下拉菜单 */}
              {menuOpen && (
                <div className="absolute right-0 top-full mt-2 w-64 bg-[#1f1f1f] border border-zinc-700/90 rounded-lg shadow-2xl py-1.5 z-50 animate-in fade-in slide-in-from-top-1 duration-150 backdrop-blur-md">
                  {/* 用户基本信息区 */}
                  <div className="px-4 py-3 border-b border-zinc-800 flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-linear-to-tr from-[#0f62fe] to-[#4589ff] text-white text-xs font-semibold flex items-center justify-center shrink-0 shadow-inner">
                      {avatarText}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-semibold text-white truncate">
                          {memberName}
                        </span>
                        <span className="text-[10px] text-blue-400 bg-blue-500/10 border border-blue-500/20 px-1.5 py-0.2 rounded shrink-0">
                          当前
                        </span>
                      </div>
                      <p className="text-[11px] text-zinc-400 truncate mt-0.5">
                        产品创新部
                      </p>
                    </div>
                  </div>

                  {/* 菜单操作列表 */}
                  <div className="py-1">
                    {/* 切换身份 */}
                    <button
                      type="button"
                      onClick={() => {
                        setMenuOpen(false);
                        switchIdentity();
                      }}
                      className="w-full flex items-center justify-between px-4 py-2.5 text-xs text-zinc-200 hover:text-white hover:bg-zinc-800/80 transition-colors text-left cursor-pointer group"
                    >
                      <div className="flex items-center gap-2.5">
                        <Users size={15} className="text-blue-400 group-hover:scale-105 transition-transform" />
                        <div>
                          <div className="font-medium">切换身份</div>
                          <div className="text-[10px] text-zinc-400">切换为团队中其他成员</div>
                        </div>
                      </div>
                      <span className="text-[11px] text-zinc-400 group-hover:text-zinc-300">更换 ›</span>
                    </button>

                    {/* 系统配置（需口令验证） */}
                    <button
                      type="button"
                      onClick={() => {
                        setMenuOpen(false);
                        setAuthModalOpen(true);
                      }}
                      className="w-full flex items-center justify-between px-4 py-2.5 text-xs text-zinc-200 hover:text-white hover:bg-zinc-800/80 transition-colors text-left cursor-pointer group border-t border-zinc-800/60"
                    >
                      <div className="flex items-center gap-2.5">
                        <Settings size={15} className="text-zinc-400 group-hover:text-white group-hover:rotate-45 transition-all" />
                        <div>
                          <div className="font-medium">系统配置</div>
                          <div className="text-[10px] text-zinc-400">成员排序 · 法定节假日排期</div>
                        </div>
                      </div>
                      <span className="text-[11px] text-zinc-400 group-hover:text-zinc-300">配置 ›</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </nav>
      </header>

      {/* 全局身份切换弹窗 */}
      <IdentityModal
        isOpen={identityModalOpen}
        currentMemberId={memberId}
        onSelect={login}
        onClose={() => setIdentityModalOpen(false)}
      />

      {/* 系统配置安全口令验证弹窗 */}
      <SecurityAuthModal
        isOpen={authModalOpen}
        onSuccess={() => setConfigOpen(true)}
        onClose={() => setAuthModalOpen(false)}
      />

      {/* 系统配置弹窗 */}
      <ConfigModal isOpen={configOpen} onClose={() => setConfigOpen(false)} />
    </>
  );
}

