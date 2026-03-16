import { useEffect, useState } from "react";
import { WeekListView } from "../components/WeekListView";
import { MonthCalendarView } from "../components/MonthCalendarView";
import { LoginModal } from "../components/LoginModal";
import { createDefaultGroups } from "../lib/mockData";
import { applyPenaltyRules } from "../lib/attendanceRules";
import { driver } from "../lib/appData";
import { useAuth } from "../lib/AuthContext";
import type { AttendanceRecord, Group } from "../lib/types";

type ViewMode = "calendar" | "list";

export default function HomePage() {
  const { admin, logout } = useAuth();
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [groups, setGroups] = useState<Group[]>(() => createDefaultGroups());
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [showLogin, setShowLogin] = useState(false);

  useEffect(() => {
    void driver.listAttendanceRecords().then(setRecords).catch(() => setRecords([]));
    void driver
      .getGroups()
      .then((g) => setGroups(g.length > 0 ? g : createDefaultGroups()))
      .catch(() => {});
    if (driver.getScheduleOverrides) {
      void driver.getScheduleOverrides().then(setOverrides).catch(() => {});
    }
  }, []);

  const handleOverride = async (weekStart: string, groupId: string) => {
    if (!driver.upsertScheduleOverride) return;
    await driver.upsertScheduleOverride(weekStart, groupId);
    setOverrides((prev) => ({ ...prev, [weekStart]: groupId }));
  };

  const handleDeleteOverride = async (weekStart: string) => {
    if (!driver.deleteScheduleOverride) return;
    await driver.deleteScheduleOverride(weekStart);
    setOverrides((prev) => {
      const next = { ...prev };
      delete next[weekStart];
      return next;
    });
  };

  const handleGroupAbsent = async (
    dateStr: string,
    memberIds: string[],
    isSet: boolean
  ) => {
    for (const mid of memberIds) {
      await handleSave({
        date: dateStr,
        memberId: mid,
        status: isSet ? "absent" : "pending",
        score: isSet ? 1 : 0,
        penaltyDays: isSet
          ? applyPenaltyRules({
              date: dateStr,
              status: "absent",
              penaltyDays: 1
            })
          : 0,
        isGroupAbsent: isSet,
        isImportantEvent: false
      });
    }
    setRecords(await driver.listAttendanceRecords());
  };

  const handleImportantEvent = async (
    dateStr: string,
    memberIds: string[],
    isSet: boolean
  ) => {
    for (const mid of memberIds) {
      await handleSave({
        date: dateStr,
        memberId: mid,
        status: "pending",
        score: 0,
        penaltyDays: 0,
        isImportantEvent: isSet,
        isGroupAbsent: false
      });
    }
    setRecords(await driver.listAttendanceRecords());
  };

  const handleResetDay = async (dateStr: string, memberIds: string[]) => {
    if (driver.deleteAttendanceRecordsByDateAndMembers) {
      await driver.deleteAttendanceRecordsByDateAndMembers(dateStr, memberIds);
      setRecords((prev) =>
        prev.filter(
          (r) => !(r.date === dateStr && memberIds.includes(r.memberId))
        )
      );
    }
  };

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
            <MonthCalendarView
              groups={groups}
              records={records}
              scheduleOverrides={overrides}
              onSave={handleSave}
              onGroupAbsent={handleGroupAbsent}
              onImportantEvent={handleImportantEvent}
              onResetDay={handleResetDay}
              isAdmin={!!admin}
            />
          ) : (
            <WeekListView
              groups={groups}
              records={records}
              scheduleOverrides={overrides}
              onSave={handleSave}
              onOverrideChange={handleOverride}
              onDeleteOverride={handleDeleteOverride}
              onGroupAbsent={handleGroupAbsent}
              onImportantEvent={handleImportantEvent}
              onResetDay={handleResetDay}
              isAdmin={!!admin}
            />
          )}
        </section>

        <aside className="space-y-4">
          <section className="card p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">管理员</h2>
              {admin ? (
                <span className="text-xs text-gray-600">
                  {admin.username}
                  <button
                    type="button"
                    className="ml-2 text-primary hover:underline"
                    onClick={logout}
                  >
                    退出管理
                  </button>
                </span>
              ) : (
                <button
                  type="button"
                  className="btn-primary text-xs"
                  onClick={() => setShowLogin(true)}
                >
                  管理员登录
                </button>
              )}
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
              <li>· 成员数据来自 Supabase 的 groups / members 表，未配置时使用默认 8 组 24 人。</li>
            </ul>
            <div className="mt-3 text-[11px] text-gray-400">
              已加载考勤记录：{records.length} 条 · 值日组：{groups.length} 组
            </div>
          </section>
        </aside>
      </div>

      {showLogin && <LoginModal onClose={() => setShowLogin(false)} />}
    </div>
  );
}

