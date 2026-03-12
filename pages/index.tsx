import { useEffect, useState } from "react";
import { WeekListView } from "../components/WeekListView";
import { driver, groups } from "../lib/appData";
import type { AttendanceRecord } from "../lib/types";

type ViewMode = "calendar" | "list";

export default function HomePage() {
  const [viewMode, setViewMode] = useState<ViewMode>("calendar");
  const [records, setRecords] = useState<AttendanceRecord[]>([]);

  useEffect(() => {
    // 初始化拉取（若配置了 Supabase，则从云端读取；否则从内存驱动读取）
    void driver.listAttendanceRecords().then(setRecords).catch(() => {
      setRecords([]);
    });
  }, []);

  const handleSave = async (rec: Omit<AttendanceRecord, "id"> & { id?: string }) => {
    const saved = await driver.upsertAttendanceRecord(rec);
    setRecords((prev) => {
      const idx = prev.findIndex((r) => r.id === saved.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = saved;
        return next;
      }
      return [...prev, saved];
    });
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">首页 · 值日排班与考勤</h1>
          <p className="mt-1 text-sm text-gray-500">
            按周查看排班与考勤记录，可在日历视图与列表视图之间切换。
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            className={`btn-outline text-xs ${
              viewMode === "calendar" ? "border-primary text-primary" : ""
            }`}
            onClick={() => setViewMode("calendar")}
          >
            月历视图
          </button>
          <button
            className={`btn-outline text-xs ${
              viewMode === "list" ? "border-primary text-primary" : ""
            }`}
            onClick={() => setViewMode("list")}
          >
            周列表视图
          </button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-[3fr,2fr]">
        <section className="card p-4">
          {viewMode === "calendar" ? (
            <div className="h-80 flex items-center justify-center text-sm text-gray-400">
              月历视图（后续实现具体日历与状态渲染）
            </div>
          ) : (
            <WeekListView groups={groups} onSave={handleSave} />
          )}
        </section>

        <aside className="space-y-4">
          <section className="card p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">管理员登录</h2>
              <button className="btn-primary text-xs">打开登录弹窗</button>
            </div>
            <p className="mt-2 text-xs text-gray-500">
              普通用户仅可查看数据，管理员登录后可进行考勤评价、排班调整、统计查看等操作。
            </p>
          </section>

          <section className="card p-4">
            <h2 className="text-sm font-semibold">使用说明</h2>
            <ul className="mt-2 space-y-1 text-xs text-gray-500">
              <li>· 通过上方按钮在“月历视图”和“周列表视图”之间切换。</li>
              <li>
                · 当前运行模式：{driver.isReady() ? "Supabase" : "本地内存"}（配置
                `.env.local` 后将自动切换到 Supabase）。
              </li>
              <li>· 管理员相关功能将在单独的后台页面中提供完整入口。</li>
            </ul>
            <div className="mt-3 text-[11px] text-gray-400">
              已加载考勤记录：{records.length} 条
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

