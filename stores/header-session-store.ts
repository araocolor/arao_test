"use client";

import { create } from "zustand";

type HeaderSessionStore = {
  activeUserId: string | null;
  badgeCount: number;
  avatar: string | null;
  email: string | null;
  role: string | null;
  hydrateForUser: (userId: string | null | undefined) => void;
  setBadgeCount: (count: number) => void;
  setAvatar: (avatar: string | null) => void;
  setEmail: (email: string | null) => void;
  setRole: (role: string | null) => void;
  clearActiveUserCache: () => void;
};

function normalizeUserId(userId: string | null | undefined): string | null {
  if (typeof userId !== "string") return null;
  const trimmed = userId.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function getBadgeKey(userId: string): string {
  return `header-badge-count:${userId}`;
}

function getAvatarKey(userId: string): string {
  return `header-avatar:${userId}`;
}

function readBadgeFromStorage(userId: string): number {
  if (typeof window === "undefined") return 0;
  try {
    const raw = localStorage.getItem(getBadgeKey(userId));
    const parsed = Number(raw ?? 0);
    if (!Number.isFinite(parsed)) return 0;
    return Math.max(Math.trunc(parsed), 0);
  } catch {
    return 0;
  }
}

function readAvatarFromStorage(userId: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(getAvatarKey(userId));
    return raw && raw.trim().length > 0 ? raw : null;
  } catch {
    return null;
  }
}

export const useHeaderSessionStore = create<HeaderSessionStore>((set, get) => ({
  activeUserId: null,
  badgeCount: 0,
  avatar: null,
  email: null,
  role: null,

  hydrateForUser: (userId) => {
    const normalized = normalizeUserId(userId);
    if (!normalized) {
      set({ activeUserId: null, badgeCount: 0, avatar: null, email: null });
      return;
    }
    const badgeCount = readBadgeFromStorage(normalized);
    const avatar = readAvatarFromStorage(normalized);
    set({ activeUserId: normalized, badgeCount, avatar });
  },

  setBadgeCount: (count) => {
    const normalizedCount = Math.max(Math.trunc(Number(count) || 0), 0);
    const activeUserId = get().activeUserId;
    set({ badgeCount: normalizedCount });
    if (!activeUserId || typeof window === "undefined") return;
    try {
      localStorage.setItem(getBadgeKey(activeUserId), String(normalizedCount));
    } catch {}
  },

  setAvatar: (avatar) => {
    const activeUserId = get().activeUserId;
    const normalizedAvatar = avatar && avatar.trim().length > 0 ? avatar : null;
    set({ avatar: normalizedAvatar });
    if (!activeUserId || typeof window === "undefined") return;
    try {
      if (normalizedAvatar) localStorage.setItem(getAvatarKey(activeUserId), normalizedAvatar);
      else localStorage.removeItem(getAvatarKey(activeUserId));
    } catch {}
  },

  setEmail: (email) => {
    set({ email: email && email.trim().length > 0 ? email : null });
  },

  setRole: (role) => {
    set({ role: role && role.trim().length > 0 ? role : null });
  },

  clearActiveUserCache: () => {
    const activeUserId = get().activeUserId;
    if (activeUserId && typeof window !== "undefined") {
      try {
        localStorage.removeItem(getBadgeKey(activeUserId));
        localStorage.removeItem(getAvatarKey(activeUserId));
      } catch {}
    }
    set({ activeUserId: null, badgeCount: 0, avatar: null, email: null, role: null });
  },
}));
