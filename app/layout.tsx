import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";
import { PageLoadingBar } from "@/components/page-loading-bar";

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
        <body>
          <PageLoadingBar />
          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
