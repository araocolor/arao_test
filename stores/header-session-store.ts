"use client";

import { create } from "zustand";

type HeaderSessionStore = {
  activeUserId: string | null;
  badgeCount: number;
  avatar: string | null;
  username: string | null;
  usernameReady: boolean;
  email: string | null;
  role: string | null;
  tier: string | null;
  hydrateForUser: (userId: string | null | undefined) => void;
  setBadgeCount: (count: number) => void;
  setAvatar: (avatar: string | null) => void;
  setUsername: (username: string | null) => void;
  setUsernameReady: (ready: boolean) => void;
  setEmail: (email: string | null) => void;
  setRole: (role: string | null) => void;
  setTier: (tier: string | null) => void;
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

function getUsernameKey(userId: string): string {
  return `header-username:${userId}`;
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

function readUsernameFromStorage(userId: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(getUsernameKey(userId));
    return raw && raw.trim().length > 0 ? raw : null;
  } catch {
    return null;
  }
}

export const useHeaderSessionStore = create<HeaderSessionStore>((set, get) => ({
  activeUserId: null,
  badgeCount: 0,
  avatar: null,
  username: null,
  usernameReady: false,
  email: null,
  role: null,
  tier: null,

  hydrateForUser: (userId) => {
    const normalized = normalizeUserId(userId);
    if (!normalized) {
      set({ activeUserId: null, badgeCount: 0, avatar: null, username: null, usernameReady: false, email: null, role: null, tier: null });
      return;
    }
    const badgeCount = readBadgeFromStorage(normalized);
    const avatar = readAvatarFromStorage(normalized);
    const username = readUsernameFromStorage(normalized);
    set({ activeUserId: normalized, badgeCount, avatar, username, usernameReady: username !== null });
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

  setUsername: (username) => {
    const activeUserId = get().activeUserId;
    const normalizedUsername = username && username.trim().length > 0 ? username : null;
    set({ username: normalizedUsername, usernameReady: true });
    if (!activeUserId || typeof window === "undefined") return;
    try {
      if (normalizedUsername) localStorage.setItem(getUsernameKey(activeUserId), normalizedUsername);
      else localStorage.removeItem(getUsernameKey(activeUserId));
    } catch {}
  },

  setUsernameReady: (ready) => {
    set({ usernameReady: ready });
  },

  setEmail: (email) => {
    set({ email: email && email.trim().length > 0 ? email : null });
  },

  setRole: (role) => {
    set({ role: role && role.trim().length > 0 ? role : null });
  },

  setTier: (tier) => {
    set({ tier: tier && tier.trim().length > 0 ? tier : null });
  },

  clearActiveUserCache: () => {
    const activeUserId = get().activeUserId;
    if (activeUserId && typeof window !== "undefined") {
      try {
        localStorage.removeItem(getBadgeKey(activeUserId));
        localStorage.removeItem(getAvatarKey(activeUserId));
        localStorage.removeItem(getUsernameKey(activeUserId));
      } catch {}
    }
    set({ activeUserId: null, badgeCount: 0, avatar: null, username: null, usernameReady: false, email: null, role: null, tier: null });
  },
}));
