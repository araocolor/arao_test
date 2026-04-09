"use client";

import { useEffect } from "react";
import { useClerk, useUser } from "@clerk/nextjs";
import { clearAllCachesOnLogout } from "@/hooks/use-prefetch-cache";

const TIMEOUT = 60 * 60 * 1000; // 1시간
const CHECK_INTERVAL = 60 * 1000; // 1분마다 체크

export function useInactivityLogout() {
  const { isSignedIn } = useUser();
  const { signOut } = useClerk();

  useEffect(() => {
    if (!isSignedIn) return;

    let lastActivity = Date.now();

    const updateActivity = () => {
      lastActivity = Date.now();
    };

    const events = ["mousemove", "keydown", "click", "scroll", "touchstart"];
    events.forEach((e) => window.addEventListener(e, updateActivity, { passive: true }));

    const timer = setInterval(() => {
      if (document.hidden) return;
      if (Date.now() - lastActivity > TIMEOUT) {
        clearAllCachesOnLogout();
        void signOut().then(() => { window.location.href = "/"; });
      }
    }, CHECK_INTERVAL);

    return () => {
      events.forEach((e) => window.removeEventListener(e, updateActivity));
      clearInterval(timer);
    };
  }, [isSignedIn, signOut]);
}
