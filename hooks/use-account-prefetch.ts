"use client";

import { useEffect } from "react";
import { getCached, setCached } from "./use-prefetch-cache";

/**
 * Account 페이지 진입 1초 후 백그라운드에서
 * 다음 페이지 API 데이터를 prefetch하여 sessionStorage에 캐시
 *
 * prefetch 데이터:
 * - orders: GET /api/account/orders
 * - general: GET /api/account/general
 * - consulting: GET /api/account/consulting?type=consulting
 * - general_inquiries: GET /api/account/consulting?type=general
 */
export function useAccountPrefetch() {
  useEffect(() => {
    // 모든 캐시가 이미 있으면 prefetch 스킵 (효율성)
    if (
      getCached("orders") &&
      getCached("consulting") &&
      getCached("general_inquiries")
    ) {
      return;
    }

    // 1초 후 백그라운드 prefetch 시작
    const timer = setTimeout(() => {
      prefetchAccountData();
    }, 1000);

    return () => clearTimeout(timer);
  }, []);
}

async function prefetchAccountData() {
  try {
    // 병렬로 모든 API 호출
    await Promise.allSettled([
      prefetchOrders(),
      prefetchGeneral(),
      prefetchConsulting("consulting"),
      prefetchConsulting("general"),
    ]);
  } catch (error) {
    console.error("[Prefetch Error] Failed to prefetch account data:", error);
  }
}

/**
 * Orders API prefetch
 */
async function prefetchOrders() {
  try {
    // 캐시된 데이터가 있으면 스킵
    if (getCached("orders")) return;

    const res = await fetch("/api/account/orders?limit=20");
    if (!res.ok) return;

    const data = await res.json();
    setCached("orders", data);
  } catch (error) {
    console.error("[Prefetch Error] Failed to prefetch orders:", error);
  }
}

/**
 * General settings API prefetch
 */
async function prefetchGeneral() {
  try {
    const res = await fetch("/api/account/general");
    if (!res.ok) return;

    const data = await res.json();
    const email = typeof data?.email === "string" ? data.email.toLowerCase() : null;
    const cacheKey = email ? `general_${email}` : "general";
    if (getCached(cacheKey)) return;
    setCached(cacheKey, data);
  } catch (error) {
    console.error("[Prefetch Error] Failed to prefetch general:", error);
  }
}

/**
 * Consulting API prefetch (type: 'consulting' | 'general')
 */
async function prefetchConsulting(type: "consulting" | "general") {
  try {
    const cacheKey = type === "consulting" ? "consulting" : "general_inquiries";

    // 캐시된 데이터가 있으면 스킵
    if (getCached(cacheKey)) return;

    const res = await fetch(`/api/account/consulting?type=${type}&limit=20`);
    if (!res.ok) return;

    const data = await res.json();
    setCached(cacheKey, data);
  } catch (error) {
    console.error(
      `[Prefetch Error] Failed to prefetch ${type} consulting:`,
      error
    );
  }
}
