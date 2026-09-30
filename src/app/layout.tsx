import type { Metadata } from 'next';
import './globals.css';
import { GlobalHeader } from '@/components/GlobalHeader';

export const metadata: Metadata = {
  title: '产品创新部周报平台',
  description: '产品创新部周报管理平台 - 便捷填写与查阅团队周报、生成部门月报',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body className="min-h-screen bg-white" suppressHydrationWarning>
        <GlobalHeader />

        {/* 主内容区域 */}
        <main className="max-w-[1584px] mx-auto">
          {children}
        </main>
      </body>
    </html>
  );
}
