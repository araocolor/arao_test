import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import "./globals.css";
import "./styles/header.css";
import "./styles/landing.css";
import "./styles/gallery.css";
import "./styles/admin.css";
import "./styles/account.css";
import "./styles/consulting.css";
import "./styles/notification.css";
import "./styles/user-review.css";

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
        <body>{children}</body>
      </html>
    </ClerkProvider>
  );
}
