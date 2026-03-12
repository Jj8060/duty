import type { AppProps } from "next/app";
import Link from "next/link";
import "../styles.css";

export default function App({ Component, pageProps }: AppProps) {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="h-8 w-8 rounded-lg bg-primary text-white flex items-center justify-center text-sm font-bold">
              值
            </span>
            <div>
              <div className="text-base font-semibold">
                值日排班管理系统
              </div>
              <div className="text-xs text-gray-500">
                排班 · 考勤 · 统计 · 管理员后台
              </div>
            </div>
          </div>
          <nav className="flex items-center gap-2 text-xs">
            <Link className="btn-outline" href="/">
              首页
            </Link>
            <Link className="btn-outline" href="/statistics">
              考核统计
            </Link>
            <Link className="btn-outline" href="/admin-management">
              管理员管理
            </Link>
          </nav>
        </div>
      </header>
      <main className="flex-1">
        <Component {...pageProps} />
      </main>
      <footer className="border-t bg-white py-3 text-center text-xs text-gray-500">
        基于 Next.js 14 + Supabase 的值日排班管理系统
      </footer>
    </div>
  );
}

