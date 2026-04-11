import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import Script from "next/script";
import { AppQueryProvider } from "@/components/query-provider";
import "./globals.css";
import "./styles/header.css";
import "./styles/layout.css";
import "./styles/gallery.css";
import "./styles/admin-common.css";
import "./styles/admin-gallery.css";
import "./styles/admin-worklog.css";
import "./styles/admin-nav.css";
import "./styles/admin-commit.css";
import "./styles/account.css";
import "./styles/consulting.css";
import "./styles/notification.css";
import "./styles/user-review.css";

export const metadata: Metadata = {
  title: "제주의 느낌 알아요 ARAO",
  description: "Next.js + Supabase + Clerk + PortOne + Stripe scaffold",
  icons: {
    apple: "/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    title: "ARAO",
    statusBarStyle: "default",
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider
      telemetry={false}
      unsafe_disableDevelopmentModeConsoleWarning
    >
      <html lang="ko">
        <body>
          <AppQueryProvider>{children}</AppQueryProvider>
          <Script id="perf-probe" strategy="afterInteractive">
            {`
              (() => {
                const shouldEnable = (() => {
                  try {
                    const url = new URL(window.location.href);
                    if (url.searchParams.get("perf") === "1") {
                      localStorage.setItem("__perf_mode", "1");
                      return true;
                    }
                    return localStorage.getItem("__perf_mode") === "1";
                  } catch {
                    return false;
                  }
                })();
                if (!shouldEnable) return;

                const state = {
                  ttfb: 0,
                  fcp: 0,
                  lcp: 0,
                  cls: 0,
                  inp: 0,
                  images: [],
                };

                const fmt = (n, unit = "ms") => (Number.isFinite(n) && n > 0 ? Math.round(n) + unit : "-");
                const imageRows = new Map();

                const panel = document.createElement("div");
                panel.setAttribute("id", "perf-probe-panel");
                panel.style.position = "fixed";
                panel.style.right = "12px";
                panel.style.bottom = "12px";
                panel.style.zIndex = "99999";
                panel.style.background = "rgba(0, 0, 0, 0.8)";
                panel.style.color = "#fff";
                panel.style.padding = "10px 12px";
                panel.style.borderRadius = "10px";
                panel.style.font = "12px/1.5 -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif";
                panel.style.backdropFilter = "blur(4px)";
                panel.style.maxWidth = "280px";
                panel.style.boxShadow = "0 4px 20px rgba(0,0,0,0.22)";
                panel.style.cursor = "pointer";
                panel.title = "클릭하면 perf 모드가 꺼집니다";
                panel.onclick = () => {
                  try {
                    localStorage.removeItem("__perf_mode");
                  } catch {}
                  panel.remove();
                };
                document.body.appendChild(panel);

                const render = () => {
                  panel.innerHTML =
                    "<div style='font-weight:600; margin-bottom:4px;'>Perf Probe</div>" +
                    "<div>TTFB: " + fmt(state.ttfb) + "</div>" +
                    "<div>FCP: " + fmt(state.fcp) + "</div>" +
                    "<div>LCP: " + fmt(state.lcp) + "</div>" +
                    "<div>INP: " + fmt(state.inp) + "</div>" +
                    "<div>CLS: " + (state.cls ? state.cls.toFixed(3) : "-") + "</div>" +
                    "<div style='margin-top:6px; opacity:0.8;'>Images: " + state.images.length + "</div>";
                };
                render();

                const nav = performance.getEntriesByType("navigation")[0];
                if (nav && typeof nav.responseStart === "number") {
                  state.ttfb = nav.responseStart;
                }
                const paint = performance.getEntriesByType("paint").find((entry) => entry.name === "first-contentful-paint");
                if (paint) state.fcp = paint.startTime;
                render();

                try {
                  const lcpObserver = new PerformanceObserver((list) => {
                    const entries = list.getEntries();
                    const last = entries[entries.length - 1];
                    if (last) state.lcp = last.startTime || last.renderTime || last.loadTime || 0;
                    render();
                  });
                  lcpObserver.observe({ type: "largest-contentful-paint", buffered: true });
                } catch {}

                try {
                  const clsObserver = new PerformanceObserver((list) => {
                    for (const entry of list.getEntries()) {
                      if (!entry.hadRecentInput) state.cls += entry.value || 0;
                    }
                    render();
                  });
                  clsObserver.observe({ type: "layout-shift", buffered: true });
                } catch {}

                try {
                  const inpObserver = new PerformanceObserver((list) => {
                    for (const entry of list.getEntries()) {
                      if (entry.duration > state.inp) state.inp = entry.duration;
                    }
                    render();
                  });
                  inpObserver.observe({ type: "event", buffered: true, durationThreshold: 40 });
                } catch {}

                try {
                  const resourceObserver = new PerformanceObserver((list) => {
                    for (const entry of list.getEntries()) {
                      if (entry.initiatorType !== "img") continue;
                      const row = {
                        url: entry.name,
                        dur: entry.duration,
                        size: entry.decodedBodySize || 0,
                        transfer: entry.transferSize || 0,
                      };
                      imageRows.set(entry.name, row);
                    }
                    state.images = Array.from(imageRows.values()).sort((a, b) => b.dur - a.dur);
                    render();
                  });
                  resourceObserver.observe({ type: "resource", buffered: true });
                } catch {}

                const printSummary = () => {
                  const summary = {
                    page: window.location.pathname + window.location.search,
                    ttfb_ms: Math.round(state.ttfb || 0),
                    fcp_ms: Math.round(state.fcp || 0),
                    lcp_ms: Math.round(state.lcp || 0),
                    inp_ms: Math.round(state.inp || 0),
                    cls: Number((state.cls || 0).toFixed(3)),
                    image_count: state.images.length,
                    slowest_image_ms: Math.round(state.images[0]?.dur || 0),
                  };
                  console.log("[PERF_PROBE]", summary);
                  if (state.images.length > 0) {
                    console.table(
                      state.images.slice(0, 10).map((img) => ({
                        ms: Math.round(img.dur || 0),
                        kb: Math.round((img.size || 0) / 1024),
                        transfer_kb: Math.round((img.transfer || 0) / 1024),
                        url: img.url,
                      }))
                    );
                  }
                };

                window.addEventListener("load", () => {
                  setTimeout(printSummary, 3000);
                });
              })();
            `}
          </Script>
        </body>
      </html>
    </ClerkProvider>
  );
}
