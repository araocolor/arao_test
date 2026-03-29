"use client";

import { useEffect } from "react";
import { getCached, setCached } from "./use-prefetch-cache";

export function useReviewsPrefetch() {
  useEffect(() => {
    if (getCached("reviews")) return;

    const timer = setTimeout(() => {
      void prefetchReviews();
    }, 1000);

    return () => clearTimeout(timer);
  }, []);
}

async function prefetchReviews() {
  try {
    if (getCached("reviews")) return;

    const res = await fetch("/api/account/reviews?page=1&limit=10");
    if (!res.ok) return;

    const data = await res.json();
    setCached("reviews", data);
  } catch (error) {
    console.error("[Prefetch Error] Failed to prefetch reviews:", error);
  }
}
