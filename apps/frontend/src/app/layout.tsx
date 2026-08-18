import type { Metadata } from "next";
import AxiosConfig from "@/components/AxiosConfig";
import "./globals.css";

export const metadata: Metadata = {
  title: "GitHub Codebase AI Assistant — Understand Any Public GitHub Codebase with AI",
  description: "AI-powered developer platform to chat, query, document, and analyze public GitHub codebases with source-linked verification.",
  icons: {
    icon: "/icon.svg",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="light" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Elms+Sans:ital,wght@0,100..900;1,100..900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body
        className="min-h-screen bg-[#F8FAFC] text-[#0F172A] font-sans antialiased selection:bg-[#E8F7F2] selection:text-[#007A65]"
        suppressHydrationWarning
      >
        <AxiosConfig />
        {children}
      </body>
    </html>
  );
}
