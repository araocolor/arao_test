import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";

export const metadata: Metadata = {
  title: "Expansion Architecture",
  description: "Next.js + Supabase + Clerk + PortOne + Stripe scaffold",
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
        <head>
          <style dangerouslySetInnerHTML={{ __html: `
            #page-loading-bar {
              position: fixed;
              top: 50%;
              left: 50%;
              transform: translate(-50%, -50%);
              width: 260px;
              height: 6px;
              background: rgba(37, 99, 235, 0.15);
              border-radius: 999px;
              z-index: 9999;
              overflow: hidden;
            }
            #page-loading-bar::after {
              content: "";
              position: absolute;
              top: 0;
              left: 0;
              height: 100%;
              width: 0%;
              background: #2563eb;
              border-radius: 999px;
              animation: page-loading-fill 2.4s cubic-bezier(0.1, 0.6, 0.4, 1) forwards;
            }
            @keyframes page-loading-fill {
              0%   { width: 0%; }
              40%  { width: 60%; }
              70%  { width: 78%; }
              90%  { width: 88%; }
              100% { width: 92%; }
            }
          `}} />
        </head>
        <body>
          <div id="page-loading-bar" />
          <script
            dangerouslySetInnerHTML={{
              __html: `
                window.addEventListener('load', function() {
                  var bar = document.getElementById('page-loading-bar');
                  if (bar) { bar.style.display = 'none'; }
                });
              `,
            }}
          />
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
