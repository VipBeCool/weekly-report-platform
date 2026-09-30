'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  getCurrentMemberId,
  getCurrentMemberName,
  setCurrentIdentity,
  clearCurrentIdentity,
} from '@/lib/identity';

export function useIdentity() {
  const [memberId, setMemberId] = useState<string | null>(null);
  const [memberName, setMemberName] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const syncIdentity = useCallback(() => {
    const id = getCurrentMemberId();
    const name = getCurrentMemberName();

    if (id && name) {
      setMemberId(id);
      setMemberName(name);
      setShowModal(false);
    } else {
      setMemberId(null);
      setMemberName(null);
      setShowModal(true);
    }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    syncIdentity();

    const handleUpdate = () => {
      syncIdentity();
    };

    window.addEventListener('identity-updated', handleUpdate);
    window.addEventListener('storage', handleUpdate);
    return () => {
      window.removeEventListener('identity-updated', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, [syncIdentity]);

  // 登录（选择或创建身份）
  const login = useCallback((id: string, name: string) => {
    setCurrentIdentity(id, name);
    setMemberId(id);
    setMemberName(name);
    setShowModal(false);
  }, []);

  // 登出
  const logout = useCallback(() => {
    clearCurrentIdentity();
    setMemberId(null);
    setMemberName(null);
    setShowModal(true);
  }, []);

  // 切换身份
  const switchIdentity = useCallback(() => {
    setShowModal(true);
  }, []);

  return {
    memberId,
    memberName,
    showModal,
    isLoading,
    login,
    logout,
    switchIdentity,
    setShowModal,
  };
}

