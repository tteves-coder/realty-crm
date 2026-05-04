import type { Metadata, Viewport } from "next";
import Script from "next/script";
import { Toaster } from "react-hot-toast";
import "@/styles/globals.css";

export const metadata: Metadata = {
  title: "APA Realty CRM",
  description: "Your real estate pipeline command center",
  manifest: "/manifest.json",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "APA CRM" },
};

export const viewport: Viewport = {
  width: "device-width", initialScale: 1, maximumScale: 1,
  userScalable: false, viewportFit: "cover", themeColor: "#1e1f6b",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      </head>
      <body>
        {children}
        <Toaster position="top-center" toastOptions={{
          style: { fontFamily: "var(--font-body)", borderRadius: "16px", padding: "12px 16px", fontSize: "14px", background: "#1e1f6b", color: "#fff" },
          success: { iconTheme: { primary: "#34d399", secondary: "#fff" } },
          error: { iconTheme: { primary: "#f94021", secondary: "#fff" } },
        }} />

        {/* Mobile debug console — only loads when ?debug=1 is in URL */}
        <Script id="eruda-debug
