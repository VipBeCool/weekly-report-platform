const MEMBER_ID_KEY = 'weekly_report_member_id';
const MEMBER_NAME_KEY = 'weekly_report_member_name';

// 获取当前用户 ID
export function getCurrentMemberId(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(MEMBER_ID_KEY);
}

// 获取当前用户姓名
export function getCurrentMemberName(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(MEMBER_NAME_KEY);
}

// 设置当前用户身份
export function setCurrentIdentity(id: string, name: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(MEMBER_ID_KEY, id);
  localStorage.setItem(MEMBER_NAME_KEY, name);
  window.dispatchEvent(new CustomEvent('identity-updated', { detail: { id, name } }));
}

// 清除当前用户身份
export function clearCurrentIdentity(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(MEMBER_ID_KEY);
  localStorage.removeItem(MEMBER_NAME_KEY);
  window.dispatchEvent(new CustomEvent('identity-updated', { detail: { id: null, name: null } }));
}

