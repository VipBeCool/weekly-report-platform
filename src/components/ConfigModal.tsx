'use client';

import { useState, useEffect } from 'react';
import {
  X,
  Settings,
  Users,
  CalendarCheck,
  ArrowUp,
  ArrowDown,
  Trash2,
  Plus,
  Save,
  RotateCcw,
  Check,
  AlertCircle,
  Calendar,
  Briefcase,
  Coffee,
  CloudDownload,
  Globe,
  ChevronDown,
  ChevronUp,
  Loader2,
} from 'lucide-react';
import { Member } from '@/lib/types';
import { HolidayItem } from '@/lib/holidayData';

interface ConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  onMembersUpdated?: () => void;
}

export function ConfigModal({ isOpen, onClose, onMembersUpdated }: ConfigModalProps) {
  const [activeTab, setActiveTab] = useState<'members' | 'holidays'>('members');

  // ===== 成员状态 =====
  const [members, setMembers] = useState<Member[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [savingMembers, setSavingMembers] = useState(false);
  const [memberSuccessMsg, setMemberSuccessMsg] = useState('');
  const [newMemberName, setNewMemberName] = useState('');
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  // ===== 节假日状态 =====
  const [holidays, setHolidays] = useState<HolidayItem[]>([]);
  const [loadingHolidays, setLoadingHolidays] = useState(false);
  const [holidayYear, setHolidayYear] = useState('2026');
  const [holidaySuccessMsg, setHolidaySuccessMsg] = useState('');

  // 接口拉取与自动同步状态
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncYear, setSyncYear] = useState('2026');
  const [showCustomUrl, setShowCustomUrl] = useState(false);
  const [customSyncUrl, setCustomSyncUrl] = useState('');
  const [syncErrorMsg, setSyncErrorMsg] = useState('');

  // 新增节假日表单
  const [newHolidayDate, setNewHolidayDate] = useState('');
  const [newHolidayName, setNewHolidayName] = useState('');
  const [newHolidayType, setNewHolidayType] = useState<'holiday' | 'workday'>('holiday');
  const [newHolidayDesc, setNewHolidayDesc] = useState('');

  // 加载成员列表
  const fetchMembers = async () => {
    try {
      setLoadingMembers(true);
      const res = await fetch('/api/members');
      if (res.ok) {
        const data = await res.json();
        setMembers(data);
      }
    } catch (err) {
      console.error('获取成员失败:', err);
    } finally {
      setLoadingMembers(false);
    }
  };

  // 加载节假日列表
  const fetchHolidays = async () => {
    try {
      setLoadingHolidays(true);
      const res = await fetch('/api/holidays');
      if (res.ok) {
        const data = await res.json();
        setHolidays(data);
      }
    } catch (err) {
      console.error('获取节假日失败:', err);
    } finally {
      setLoadingHolidays(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchMembers();
      fetchHolidays();
    }
  }, [isOpen]);

  // ===== 成员操作 =====
  const moveMember = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= members.length) return;
    const nextList = [...members];
    const [moved] = nextList.splice(index, 1);
    nextList.splice(targetIndex, 0, moved);
    setMembers(nextList);
  };

  const handleSaveMembers = async (overrideList?: Member[]) => {
    const listToSave = overrideList || members;
    setSavingMembers(true);
    try {
      const res = await fetch('/api/members', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ members: listToSave }),
      });
      if (res.ok) {
        setMemberSuccessMsg('成员顺序及修改已保存成功');
        setTimeout(() => setMemberSuccessMsg(''), 2500);
        if (onMembersUpdated) onMembersUpdated();
        window.dispatchEvent(new Event('members-updated'));
      }
    } catch (err) {
      console.error('保存成员排序失败:', err);
    } finally {
      setSavingMembers(false);
    }
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMemberName.trim()) return;
    const name = newMemberName.trim();
    if (members.some((m) => m.name === name)) {
      alert(`成员“${name}”已存在`);
      return;
    }

    try {
      const res = await fetch('/api/members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });
      if (res.ok) {
        const newM = await res.json();
        const nextList = [...members, newM];
        setMembers(nextList);
        setNewMemberName('');
        setMemberSuccessMsg(`已添加成员“${name}”`);
        setTimeout(() => setMemberSuccessMsg(''), 2500);
        if (onMembersUpdated) onMembersUpdated();
        window.dispatchEvent(new Event('members-updated'));
      }
    } catch (err) {
      console.error('添加成员失败:', err);
    }
  };

  const handleDeleteMember = async (id: string, name: string) => {
    if (!confirm(`确定要移除成员“${name}”吗？`)) return;
    try {
      const res = await fetch(`/api/members?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        const nextList = members.filter((m) => m.id !== id);
        setMembers(nextList);
        setMemberSuccessMsg(`已移除成员“${name}”`);
        setTimeout(() => setMemberSuccessMsg(''), 2500);
        if (onMembersUpdated) onMembersUpdated();
        window.dispatchEvent(new Event('members-updated'));
      }
    } catch (err) {
      console.error('删除成员失败:', err);
    }
  };

  const handleStartEdit = (m: Member) => {
    setEditingMemberId(m.id);
    setEditingName(m.name);
  };

  const handleConfirmEdit = () => {
    if (!editingMemberId || !editingName.trim()) {
      setEditingMemberId(null);
      return;
    }
    const nextList = members.map((m) =>
      m.id === editingMemberId ? { ...m, name: editingName.trim() } : m
    );
    setMembers(nextList);
    setEditingMemberId(null);
    handleSaveMembers(nextList);
  };

  // ===== 节假日操作 =====
  const filteredHolidays = holidays.filter((h) =>
    holidayYear === 'all' ? true : h.date.startsWith(holidayYear)
  );

  const holidayCounts = filteredHolidays.filter((h) => h.type === 'holiday').length;
  const workdayCounts = filteredHolidays.filter((h) => h.type === 'workday').length;

  const handleAddHoliday = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newHolidayDate || !newHolidayName.trim()) {
      alert('请完整填写日期和节日名称');
      return;
    }

    try {
      const res = await fetch('/api/holidays', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date: newHolidayDate,
          name: newHolidayName.trim(),
          type: newHolidayType,
          description: newHolidayDesc.trim(),
        }),
      });

      if (res.ok) {
        const saved = await res.json();
        const next = [...holidays.filter((h) => h.date !== saved.date), saved].sort((a, b) =>
          a.date.localeCompare(b.date)
        );
        setHolidays(next);
        setNewHolidayName('');
        setNewHolidayDesc('');
        setHolidaySuccessMsg(`已成功配置 ${saved.date} 为 ${saved.name}`);
        setTimeout(() => setHolidaySuccessMsg(''), 2500);
      }
    } catch (err) {
      console.error('添加节假日失败:', err);
    }
  };

  const handleDeleteHoliday = async (date: string, name: string) => {
    if (!confirm(`确定删除 ${date} (${name}) 的配置吗？`)) return;
    try {
      const res = await fetch(`/api/holidays?date=${date}`, { method: 'DELETE' });
      if (res.ok) {
        setHolidays(holidays.filter((h) => h.date !== date));
        setHolidaySuccessMsg(`已删除 ${date} 配置`);
        setTimeout(() => setHolidaySuccessMsg(''), 2000);
      }
    } catch (err) {
      console.error('删除节假日失败:', err);
    }
  };

  const handleSyncRemoteHolidays = async (targetYear?: string, customUrl?: string) => {
    setIsSyncing(true);
    setSyncErrorMsg('');
    try {
      const res = await fetch('/api/holidays', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'sync_remote',
          year: targetYear || syncYear,
          customUrl: customUrl || (showCustomUrl ? customSyncUrl.trim() : ''),
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setHolidays(data.list);
        setHolidaySuccessMsg(data.message || '节假日数据同步成功！');
        setTimeout(() => setHolidaySuccessMsg(''), 3500);
        if (showCustomUrl) setShowCustomUrl(false);
      } else {
        setSyncErrorMsg(data.error || '同步失败，请检查接口或网络');
      }
    } catch (err: any) {
      console.error('同步远程节假日出错:', err);
      setSyncErrorMsg('请求异常，请检查网络连接');
    } finally {
      setIsSyncing(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-md border border-zinc-200 shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* 顶部标题栏 */}
        <div className="bg-[#161616] px-6 py-4 flex items-center justify-between text-white border-b border-zinc-800">
          <div className="flex items-center gap-2.5">
            <span className="w-1.5 h-4.5 bg-[#0f62fe] rounded-[1px]" />
            <Settings size={18} className="text-[#4589ff]" />
            <h2 className="text-base font-semibold tracking-wide">系统管理与全局配置</h2>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-white p-1 rounded hover:bg-zinc-800 transition-colors cursor-pointer"
            title="关闭窗口"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab 导航切换 */}
        <div className="bg-zinc-100/90 px-6 pt-3 border-b border-zinc-200 flex items-center gap-3">
          <button
            onClick={() => setActiveTab('members')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-medium border-b-2 transition-all cursor-pointer ${
              activeTab === 'members'
                ? 'border-[#0f62fe] text-[#0f62fe] bg-white rounded-t-sm shadow-2xs font-semibold'
                : 'border-transparent text-zinc-600 hover:text-zinc-900 hover:bg-zinc-200/50 rounded-t-sm'
            }`}
          >
            <Users size={16} />
            <span>团队成员及顺序 ({members.length} 人)</span>
          </button>

          <button
            onClick={() => setActiveTab('holidays')}
            className={`flex items-center gap-2 px-4 py-2.5 text-xs sm:text-sm font-medium border-b-2 transition-all cursor-pointer ${
              activeTab === 'holidays'
                ? 'border-[#0f62fe] text-[#0f62fe] bg-white rounded-t-sm shadow-2xs font-semibold'
                : 'border-transparent text-zinc-600 hover:text-zinc-900 hover:bg-zinc-200/50 rounded-t-sm'
            }`}
          >
            <CalendarCheck size={16} />
            <span>法定节假日与工作日配置 ({filteredHolidays.length} 条)</span>
          </button>
        </div>

        {/* 弹窗内容主体区域 */}
        <div className="p-6 overflow-y-auto flex-1 bg-zinc-50/50 space-y-6">
          {/* ===================== TAB 1: 团队成员及顺序 ===================== */}
          {activeTab === 'members' && (
            <div className="space-y-6">
              {/* 顶部操作与快速新增 */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-4 rounded-sm border border-zinc-200 shadow-2xs">
                <form onSubmit={handleAddMember} className="flex items-center gap-2 flex-1 max-w-md">
                  <input
                    type="text"
                    placeholder="输入新成员姓名..."
                    value={newMemberName}
                    onChange={(e) => setNewMemberName(e.target.value)}
                    className="flex-1 px-3 py-1.5 text-xs sm:text-sm border border-zinc-300 rounded focus:border-[#0f62fe] focus:ring-1 focus:ring-[#0f62fe] outline-none"
                  />
                  <button
                    type="submit"
                    className="inline-flex items-center gap-1 px-3.5 py-1.5 text-xs font-medium bg-[#0f62fe] text-white hover:bg-[#0353e9] rounded transition-all cursor-pointer shadow-xs shrink-0"
                  >
                    <Plus size={14} />
                    <span>添加成员</span>
                  </button>
                </form>

                <div className="flex items-center gap-3 shrink-0">
                  {memberSuccessMsg && (
                    <span className="text-xs text-emerald-600 flex items-center gap-1 font-medium bg-emerald-50 px-2 py-1 rounded border border-emerald-200">
                      <Check size={13} /> {memberSuccessMsg}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => handleSaveMembers()}
                    disabled={savingMembers}
                    className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium bg-[#161616] text-white hover:bg-zinc-800 rounded transition-all cursor-pointer shadow-xs disabled:opacity-50"
                  >
                    <Save size={14} />
                    <span>{savingMembers ? '保存中...' : '保存排序'}</span>
                  </button>
                </div>
              </div>

              {/* 提示信息 */}
              <div className="flex items-start gap-2 p-3 bg-blue-50/70 border border-blue-200/80 rounded text-xs text-blue-900 leading-relaxed">
                <AlertCircle size={15} className="text-[#0f62fe] shrink-0 mt-0.5" />
                <span>
                  通过点击右侧【上移 / 下移】按钮可直接调整成员次序。首页的<b>“团队周报看板”</b>与<b>“月报成员汇总”</b>将严格按照此处的顺序自上而下呈现。
                </span>
              </div>

              {/* 成员排序表格 */}
              <div className="bg-white border border-zinc-200 rounded-sm shadow-2xs overflow-hidden">
                <div className="grid grid-cols-12 bg-zinc-100/80 px-4 py-2.5 text-xs font-semibold text-zinc-600 border-b border-zinc-200">
                  <div className="col-span-2 sm:col-span-1 text-center">次序</div>
                  <div className="col-span-6 sm:col-span-7">成员姓名</div>
                  <div className="col-span-4 sm:col-span-4 text-right pr-2">调整顺序 / 操作</div>
                </div>

                {loadingMembers ? (
                  <div className="p-8 text-center text-xs text-zinc-400">正在载入成员列表...</div>
                ) : members.length === 0 ? (
                  <div className="p-8 text-center text-xs text-zinc-400">暂无成员数据</div>
                ) : (
                  <div className="divide-y divide-zinc-100">
                    {members.map((member, index) => {
                      const isEditing = editingMemberId === member.id;
                      return (
                        <div
                          key={member.id}
                          className="grid grid-cols-12 items-center px-4 py-3 hover:bg-zinc-50/80 transition-colors"
                        >
                          {/* 序号 */}
                          <div className="col-span-2 sm:col-span-1 text-center">
                            <span className="inline-block w-6 h-6 leading-6 text-center text-[11px] font-bold text-zinc-600 bg-zinc-100 rounded-full border border-zinc-200">
                              {index + 1}
                            </span>
                          </div>

                          {/* 姓名展示与编辑 */}
                          <div className="col-span-6 sm:col-span-7 flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-blue-50 text-[#0f62fe] flex items-center justify-center font-bold text-xs border border-blue-100 shrink-0">
                              {member.name.slice(0, 1)}
                            </div>
                            {isEditing ? (
                              <div className="flex items-center gap-2">
                                <input
                                  type="text"
                                  value={editingName}
                                  onChange={(e) => setEditingName(e.target.value)}
                                  className="px-2 py-1 text-xs border border-[#0f62fe] rounded outline-none bg-white"
                                  autoFocus
                                />
                                <button
                                  type="button"
                                  onClick={handleConfirmEdit}
                                  className="text-xs text-emerald-600 hover:text-emerald-700 font-medium px-2 py-1 bg-emerald-50 rounded"
                                >
                                  确认
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditingMemberId(null)}
                                  className="text-xs text-zinc-500 hover:text-zinc-700 px-1 py-1"
                                >
                                  取消
                                </button>
                              </div>
                            ) : (
                              <div>
                                <span className="text-sm font-medium text-zinc-800">{member.name}</span>
                                <button
                                  onClick={() => handleStartEdit(member)}
                                  className="ml-2 text-[11px] text-zinc-400 hover:text-[#0f62fe] transition-colors"
                                >
                                  编辑
                                </button>
                              </div>
                            )}
                          </div>

                          {/* 操作按键：上移、下移、删除 */}
                          <div className="col-span-4 sm:col-span-4 flex items-center justify-end gap-1.5 pr-2">
                            <button
                              type="button"
                              onClick={() => moveMember(index, 'up')}
                              disabled={index === 0}
                              className="p-1.5 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-200/80 rounded transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                              title="上移"
                            >
                              <ArrowUp size={15} />
                            </button>

                            <button
                              type="button"
                              onClick={() => moveMember(index, 'down')}
                              disabled={index === members.length - 1}
                              className="p-1.5 text-zinc-500 hover:text-zinc-900 hover:bg-zinc-200/80 rounded transition-all disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                              title="下移"
                            >
                              <ArrowDown size={15} />
                            </button>

                            <div className="w-[1px] h-3.5 bg-zinc-200 mx-1" />

                            <button
                              type="button"
                              onClick={() => handleDeleteMember(member.id, member.name)}
                              className="p-1.5 text-zinc-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-all cursor-pointer"
                              title="移除成员"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ===================== TAB 2: 节假日与工作日配置 ===================== */}
          {activeTab === 'holidays' && (
            <div className="space-y-6">
              {/* 统计指标与全局操作 */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white p-4 rounded-sm border border-zinc-200 shadow-2xs flex items-center justify-between">
                  <div>
                    <p className="text-xs text-zinc-500 font-medium">法定放假天数</p>
                    <p className="text-2xl font-bold text-amber-600 mt-1">{holidayCounts} 天</p>
                  </div>
                  <div className="w-10 h-10 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center">
                    <Coffee size={20} />
                  </div>
                </div>

                <div className="bg-white p-4 rounded-sm border border-zinc-200 shadow-2xs flex items-center justify-between">
                  <div>
                    <p className="text-xs text-zinc-500 font-medium">调休补班天数</p>
                    <p className="text-2xl font-bold text-[#0f62fe] mt-1">{workdayCounts} 天</p>
                  </div>
                  <div className="w-10 h-10 rounded-full bg-blue-50 text-[#0f62fe] flex items-center justify-center">
                    <Briefcase size={20} />
                  </div>
                </div>

                <div className="bg-white p-4 rounded-sm border border-zinc-200 shadow-2xs flex items-center justify-between">
                  <div>
                    <p className="text-xs text-zinc-500 font-medium">当前查看年份</p>
                    <div className="mt-1">
                      <select
                        value={holidayYear}
                        onChange={(e) => setHolidayYear(e.target.value)}
                        className="text-xs border border-zinc-300 rounded px-2.5 py-1 outline-none bg-zinc-50 font-medium cursor-pointer"
                      >
                        <option value="2026">2026 年</option>
                        <option value="2025">2025 年</option>
                        <option value="all">全部年份</option>
                      </select>
                    </div>
                  </div>
                  <div className="w-10 h-10 rounded-full bg-zinc-100 text-zinc-600 flex items-center justify-center">
                    <CalendarCheck size={20} />
                  </div>
                </div>
              </div>

              {/* 权威数据源自动同步与自定义接口拉取模块 */}
              <div className="bg-gradient-to-r from-blue-50/70 via-indigo-50/40 to-white p-4 rounded-sm border border-blue-200/80 shadow-2xs space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded bg-[#0f62fe] text-white flex items-center justify-center shrink-0 shadow-2xs">
                      <CloudDownload size={16} />
                    </div>
                    <div>
                      <h3 className="text-xs font-bold text-zinc-900 flex items-center gap-2">
                        <span>节假日自动同步（权威开源源 / 自定义接口）</span>
                        <span className="text-[10px] font-normal px-1.5 py-0.2 rounded bg-blue-100 text-[#0f62fe]">
                          免手动添加
                        </span>
                      </h3>
                      <p className="text-[11px] text-zinc-500 mt-0.5">
                        按国务院办公厅放假通知自动同步法定休假与调休补班，无需逐条录入。
                      </p>
                    </div>
                  </div>

                  {/* 快捷同步操作按钮组 */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <select
                      value={syncYear}
                      onChange={(e) => setSyncYear(e.target.value)}
                      className="text-xs border border-zinc-300 rounded px-2.5 py-1.5 outline-none bg-white font-medium cursor-pointer"
                    >
                      <option value="2026">2026 年 (已发布)</option>
                      <option value="2025">2025 年 (已发布)</option>
                      <option value="2027">2027 年 (待国务院发布)</option>
                    </select>

                    <button
                      type="button"
                      disabled={isSyncing}
                      onClick={() => handleSyncRemoteHolidays(syncYear)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-[#0f62fe] hover:bg-[#0353e9] rounded shadow-xs transition-all cursor-pointer disabled:opacity-70"
                    >
                      {isSyncing ? (
                        <>
                          <Loader2 size={13} className="animate-spin" />
                          <span>正在同步...</span>
                        </>
                      ) : (
                        <>
                          <CloudDownload size={13} />
                          <span>一键同步 {syncYear} 全年数据</span>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => setShowCustomUrl(!showCustomUrl)}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-zinc-600 hover:text-zinc-900 bg-white hover:bg-zinc-50 border border-zinc-200 rounded transition-all cursor-pointer"
                    >
                      <Globe size={13} className="text-[#0f62fe]" />
                      <span>自定义接口</span>
                      {showCustomUrl ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                    </button>
                  </div>
                </div>

                {/* 展开自定义接口 URL 输入 */}
                {showCustomUrl && (
                  <div className="pt-2 border-t border-blue-200/60 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                    <input
                      type="url"
                      placeholder="填入自定义节假日 API 地址 (如企业 OA 接口、https://...)"
                      value={customSyncUrl}
                      onChange={(e) => setCustomSyncUrl(e.target.value)}
                      className="flex-1 px-2.5 py-1.5 text-xs border border-zinc-300 rounded focus:border-[#0f62fe] outline-none bg-white font-mono"
                    />
                    <button
                      type="button"
                      disabled={isSyncing || !customSyncUrl.trim()}
                      onClick={() => handleSyncRemoteHolidays(syncYear, customSyncUrl)}
                      className="px-3.5 py-1.5 text-xs font-medium bg-[#161616] text-white hover:bg-zinc-800 rounded transition-all cursor-pointer disabled:opacity-50 whitespace-nowrap"
                    >
                      {isSyncing ? '拉取中...' : '从接口拉取'}
                    </button>
                  </div>
                )}

                {/* 错误提示 */}
                {syncErrorMsg && (
                  <div className="text-xs text-rose-600 flex items-center gap-1.5 pt-1">
                    <AlertCircle size={13} />
                    <span>{syncErrorMsg}</span>
                  </div>
                )}
              </div>

              {/* 快速新增节假日表单 */}
              <div className="bg-white p-4 rounded-sm border border-zinc-200 shadow-2xs space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-semibold text-zinc-800 flex items-center gap-1.5">
                    <Calendar size={14} className="text-[#0f62fe]" />
                    <span>录入/修改节假日或调休补班日</span>
                  </h3>
                  {holidaySuccessMsg && (
                    <span className="text-xs text-emerald-600 flex items-center gap-1 font-medium bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                      <Check size={12} /> {holidaySuccessMsg}
                    </span>
                  )}
                </div>

                <form onSubmit={handleAddHoliday} className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                  <div className="sm:col-span-3">
                    <label className="block text-[11px] text-zinc-500 mb-1">选择日期 (YYYY-MM-DD)</label>
                    <input
                      type="date"
                      value={newHolidayDate}
                      onChange={(e) => setNewHolidayDate(e.target.value)}
                      required
                      className="w-full px-2.5 py-1.5 text-xs border border-zinc-300 rounded focus:border-[#0f62fe] outline-none"
                    />
                  </div>

                  <div className="sm:col-span-3">
                    <label className="block text-[11px] text-zinc-500 mb-1">节日/调休名称</label>
                    <input
                      type="text"
                      placeholder="如：国庆节、中秋节补班"
                      value={newHolidayName}
                      onChange={(e) => setNewHolidayName(e.target.value)}
                      required
                      className="w-full px-2.5 py-1.5 text-xs border border-zinc-300 rounded focus:border-[#0f62fe] outline-none"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-[11px] text-zinc-500 mb-1">日期性质</label>
                    <select
                      value={newHolidayType}
                      onChange={(e) => setNewHolidayType(e.target.value as any)}
                      className="w-full px-2.5 py-1.5 text-xs border border-zinc-300 rounded focus:border-[#0f62fe] outline-none bg-white font-medium"
                    >
                      <option value="holiday">休假 (放假)</option>
                      <option value="workday">补班 (工作日)</option>
                    </select>
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-[11px] text-zinc-500 mb-1">备注说明 (选填)</label>
                    <input
                      type="text"
                      placeholder="如：法定休假"
                      value={newHolidayDesc}
                      onChange={(e) => setNewHolidayDesc(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs border border-zinc-300 rounded focus:border-[#0f62fe] outline-none"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <button
                      type="submit"
                      className="w-full py-1.5 text-xs font-medium bg-[#0f62fe] text-white hover:bg-[#0353e9] rounded transition-all cursor-pointer shadow-xs flex items-center justify-center gap-1"
                    >
                      <Plus size={14} />
                      <span>保存该日配置</span>
                    </button>
                  </div>
                </form>
              </div>

              {/* 节假日列表 */}
              <div className="bg-white border border-zinc-200 rounded-sm shadow-2xs overflow-hidden">
                <div className="grid grid-cols-12 bg-zinc-100/80 px-4 py-2.5 text-xs font-semibold text-zinc-600 border-b border-zinc-200">
                  <div className="col-span-3">日期</div>
                  <div className="col-span-3">节日 / 事件名称</div>
                  <div className="col-span-2 text-center">性质属性</div>
                  <div className="col-span-3">备注说明</div>
                  <div className="col-span-1 text-right pr-2">操作</div>
                </div>

                {loadingHolidays ? (
                  <div className="p-8 text-center text-xs text-zinc-400">正在载入节假日配置...</div>
                ) : filteredHolidays.length === 0 ? (
                  <div className="p-8 text-center text-xs text-zinc-400">当前筛选暂无节假日数据</div>
                ) : (
                  <div className="divide-y divide-zinc-100 max-h-96 overflow-y-auto">
                    {filteredHolidays.map((item) => {
                      const isHol = item.type === 'holiday';
                      const dateObj = new Date(item.date + 'T00:00:00');
                      const dayName = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][
                        dateObj.getDay()
                      ];

                      return (
                        <div
                          key={`${item.date}-${item.type}`}
                          className="grid grid-cols-12 items-center px-4 py-2.5 text-xs hover:bg-zinc-50/80 transition-colors"
                        >
                          <div className="col-span-3 font-mono font-medium text-zinc-800 flex items-center gap-2">
                            <span>{item.date}</span>
                            <span className="text-[11px] text-zinc-400 font-sans">({dayName})</span>
                          </div>

                          <div className="col-span-3 font-medium text-zinc-900">{item.name}</div>

                          <div className="col-span-2 text-center">
                            {isHol ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-amber-50 text-amber-700 border border-amber-200/80">
                                🌴 放假休假
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-blue-50 text-[#0f62fe] border border-blue-200/80">
                                💼 调休补班
                              </span>
                            )}
                          </div>

                          <div className="col-span-3 text-zinc-500 text-[11px]">
                            {item.description || (isHol ? '法定节假日' : '周末调休工作日')}
                          </div>

                          <div className="col-span-1 text-right pr-2">
                            <button
                              type="button"
                              onClick={() => handleDeleteHoliday(item.date, item.name)}
                              className="text-zinc-400 hover:text-rose-600 transition-colors p-1"
                              title="删除此配置"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* 底部按钮栏 */}
        <div className="bg-white px-6 py-3.5 border-t border-zinc-200 flex items-center justify-between">
          <p className="text-xs text-zinc-500">
            {activeTab === 'members'
              ? '修改成员顺序后请点击「保存排序」，前台卡片看板与下拉选单将立即生效。'
              : '节假日配置将自动联动用于智能校准周报与月报统计周期的实际开始工作日与结束工作日。'}
          </p>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-medium bg-zinc-100 hover:bg-zinc-200 text-zinc-800 rounded transition-all cursor-pointer"
          >
            关闭窗口
          </button>
        </div>
      </div>
    </div>
  );
}
