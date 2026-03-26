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
      unsafe_disableDevelopmentModeWarning
    >
      <html lang="ko">
        <body>
          <div id="page-loading-bar" />
          {/* eslint-disable-next-line @next/next/no-sync-scripts */}
          <script
            dangerouslySetInnerHTML={{
              __html: `
                window.addEventListener('load', function() {
                  var bar = document.getElementById('page-loading-bar');
                  if (bar) {
                    bar.classList.add('complete');
                    setTimeout(function() { bar.style.display = 'none'; }, 400);
                  }
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
