import type { Metadata } from "next";
import { Inter } from "next/font/google";
import AxiosConfig from "@/components/AxiosConfig";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "GitHub Codebase AI Assistant — Understand Any Public GitHub Codebase with AI",
  description: "AI-powered developer platform to chat, query, document, and analyze public GitHub codebases with source-linked verification.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`light ${inter.variable}`} suppressHydrationWarning>
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
