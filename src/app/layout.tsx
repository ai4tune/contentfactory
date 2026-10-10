import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { KnowledgeTasksProvider } from "@/modules/knowledge/tasks/provider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "内容工厂控制台",
  description: "AI Growth OS content workflow technical spike",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="zh-CN"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {process.env.CONTENT_FACTORY_PREVIEW_MODE ? <p className="border-b border-amber-200 bg-amber-50 px-5 py-2 text-center text-sm text-amber-950">{process.env.CONTENT_FACTORY_PREVIEW_MODE === "real_ai" ? "本地试用 · 调用真实 AI · 资料只存于本次测试实例" : "自动测试 · 使用模拟 AI · 输出不能用于评估文案质量"}</p> : null}
        <KnowledgeTasksProvider>{children}</KnowledgeTasksProvider>
      </body>
    </html>
  );
}
