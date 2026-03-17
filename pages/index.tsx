import { format } from "date-fns";
import { useEffect, useMemo, useState } from "react";
import { WeekListView } from "../components/WeekListView";
import { MonthCalendarView } from "../components/MonthCalendarView";
import { LoginModal } from "../components/LoginModal";
import { createDefaultGroups } from "../lib/mockData";
import { applyPenaltyRules } from "../lib/attendanceRules";
import { driver } from "../lib/appData";
import { useAuth } from "../lib/AuthContext";
import { computeMemberStats, getLowScoreWarnings } from "../lib/statistics";
import type { AttendanceRecord, ExtraDuty, Group } from "../lib/types";

type ViewMode = "calendar" | "list";

export default function HomePage() {
  const { admin, logout } = useAuth();
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [groups, setGroups] = useState<Group[]>(() => createDefaultGroups());
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [extraDuties, setExtraDuties] = useState<ExtraDuty[]>([]);
  const [extraDate, setExtraDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [extraMemberId, setExtraMemberId] = useState("");
  const [extraReason, setExtraReason] = useState("");
  const [extraMsg, setExtraMsg] = useState<string | null>(null);
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
    if (driver.listExtraDuties) {
      void driver.listExtraDuties().then(setExtraDuties).catch(() => {});
    }
  }, []);
  const allMembers = useMemo(() => groups.flatMap((g) => g.members), [groups]);
  const memberNameMap = useMemo(
    () => new Map(allMembers.map((m) => [m.id, m.name])),
    [allMembers]
  );
  const lowWarnings = useMemo(
    () => getLowScoreWarnings(computeMemberStats(records, groups)).slice(0, 6),
    [records, groups]
  );

  const handleOverride = async (weekStart: string, groupId: string) => {
    if (!driver.upsertScheduleOverride) return;
    await driver.upsertScheduleOverride(weekStart, groupId);
    if (admin) {
      await driver.logAdminOperation?.({
        operatorUsername: admin.username,
        action: "set_schedule_override",
        target: weekStart,
        detail: { groupId }
      });
    }
    setOverrides((prev) => ({ ...prev, [weekStart]: groupId }));
  };

  const handleDeleteOverride = async (weekStart: string) => {
    if (!driver.deleteScheduleOverride) return;
    await driver.deleteScheduleOverride(weekStart);
    if (admin) {
      await driver.logAdminOperation?.({
        operatorUsername: admin.username,
        action: "delete_schedule_override",
        target: weekStart
      });
    }
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
    if (admin) {
      await driver.logAdminOperation?.({
        operatorUsername: admin.username,
        action: isSet ? "set_group_absent" : "unset_group_absent",
        target: dateStr,
        detail: { memberCount: memberIds.length }
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
    if (admin) {
      await driver.logAdminOperation?.({
        operatorUsername: admin.username,
        action: isSet ? "set_important_event" : "unset_important_event",
        target: dateStr,
        detail: { memberCount: memberIds.length }
      });
    }
    setRecords(await driver.listAttendanceRecords());
  };

  const handleResetDay = async (dateStr: string, memberIds: string[]) => {
    if (driver.deleteAttendanceRecordsByDateAndMembers) {
      await driver.deleteAttendanceRecordsByDateAndMembers(dateStr, memberIds);
      if (admin) {
        await driver.logAdminOperation?.({
          operatorUsername: admin.username,
          action: "reset_day_records",
          target: dateStr,
          detail: { memberCount: memberIds.length }
        });
      }
      setRecords((prev) =>
        prev.filter(
          (r) => !(r.date === dateStr && memberIds.includes(r.memberId))
        )
      );
    }
  };

  const handleSave = async (rec: Omit<AttendanceRecord, "id"> & { id?: string }) => {
    const saved = await driver.upsertAttendanceRecord(rec);
    if (driver.upsertSubstitutionRecord) {
      if (saved.isSubstituted && saved.substitutedBy) {
        await driver.upsertSubstitutionRecord({
          date: saved.date,
          originalMemberId: saved.memberId,
          substituteMemberId: saved.substitutedBy,
          isReturn: false
        });
      }
      if (saved.isExchanged && saved.exchangedWith) {
        await driver.upsertSubstitutionRecord({
          date: saved.date,
          originalMemberId: saved.memberId,
          substituteMemberId: saved.exchangedWith,
          isReturn: true
        });
      }
    }
    if (admin) {
      await driver.logAdminOperation?.({
        operatorUsername: admin.username,
        action: "upsert_attendance_record",
        target: `${saved.memberId}@${saved.date}`,
        detail: {
          status: saved.status,
          score: saved.score,
          penaltyDays: saved.penaltyDays
        }
      });
    }
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

  const handleAddExtraDuty = async () => {
    if (!driver.upsertExtraDuty || !extraDate || !extraMemberId) return;
    setExtraMsg(null);
    try {
      const saved = await driver.upsertExtraDuty({
        date: extraDate,
        memberId: extraMemberId,
        reason: extraReason || null
      });
      if (admin) {
        await driver.logAdminOperation?.({
          operatorUsername: admin.username,
          action: "add_extra_duty",
          target: `${saved.memberId}@${saved.date}`,
          detail: { reason: saved.reason ?? null }
        });
      }
      setExtraDuties((prev) => [saved, ...prev].sort((a, b) => (a.date < b.date ? 1 : -1)));
      setExtraReason("");
      setExtraMsg("额外值日已添加");
    } catch (e) {
      setExtraMsg(`添加失败：${String(e)}`);
    }
  };

  const handleDeleteExtraDuty = async (id: string) => {
    if (!driver.deleteExtraDuty) return;
    setExtraMsg(null);
    try {
      const target = extraDuties.find((d) => d.id === id);
      await driver.deleteExtraDuty(id);
      if (admin) {
        await driver.logAdminOperation?.({
          operatorUsername: admin.username,
          action: "delete_extra_duty",
          target: target ? `${target.memberId}@${target.date}` : id
        });
      }
      setExtraDuties((prev) => prev.filter((d) => d.id !== id));
      setExtraMsg("额外值日已删除");
    } catch (e) {
      setExtraMsg(`删除失败：${String(e)}`);
    }
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
              extraDuties={extraDuties}
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
            <h2 className="text-sm font-semibold">低分预警</h2>
            {lowWarnings.length === 0 ? (
              <p className="mt-2 text-xs text-gray-500">当前无预警成员。</p>
            ) : (
              <ul className="mt-2 space-y-1 text-xs">
                {lowWarnings.map((w) => (
                  <li key={w.member.id} className="flex justify-between text-gray-600">
                    <span>
                      {w.groupName} · {w.member.name}
                    </span>
                    <span className="text-red-600">
                      均分 {w.avgScore === null ? "-" : w.avgScore.toFixed(1)} / 缺席 {w.absent} / 不合格 {w.fail}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="card p-4">
            <h2 className="text-sm font-semibold">额外值日人员</h2>
            {admin ? (
              <div className="mt-2 space-y-2 text-xs">
                <div className="grid grid-cols-1 gap-2">
                  <input
                    type="date"
                    className="rounded border border-gray-300 px-2 py-1"
                    value={extraDate}
                    onChange={(e) => setExtraDate(e.target.value)}
                  />
                  <select
                    className="rounded border border-gray-300 px-2 py-1"
                    value={extraMemberId}
                    onChange={(e) => setExtraMemberId(e.target.value)}
                  >
                    <option value="">选择成员</option>
                    {allMembers.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                  <input
                    className="rounded border border-gray-300 px-2 py-1"
                    placeholder="原因（可选）"
                    value={extraReason}
                    onChange={(e) => setExtraReason(e.target.value)}
                  />
                </div>
                <div className="flex justify-end">
                  <button
                    type="button"
                    className="btn-primary text-xs"
                    onClick={() => void handleAddExtraDuty()}
                  >
                    添加额外值日
                  </button>
                </div>
                {extraMsg && (
                  <p className={`text-[11px] ${extraMsg.includes("失败") ? "text-red-600" : "text-green-600"}`}>
                    {extraMsg}
                  </p>
                )}
              </div>
            ) : (
              <p className="mt-2 text-xs text-gray-500">登录后可维护额外值日。</p>
            )}

            <div className="mt-3 max-h-44 overflow-auto space-y-1 text-xs">
              {extraDuties.length === 0 ? (
                <p className="text-gray-400">暂无额外值日记录</p>
              ) : (
                extraDuties.slice(0, 12).map((d) => (
                  <div key={d.id} className="flex items-center justify-between rounded border border-gray-100 px-2 py-1">
                    <span className="text-gray-600">
                      {d.date} · {memberNameMap.get(d.memberId) ?? d.memberId}
                      {d.reason ? ` · ${d.reason}` : ""}
                    </span>
                    {admin && (
                      <button
                        type="button"
                        className="text-[11px] text-red-600 hover:underline"
                        onClick={() => void handleDeleteExtraDuty(d.id)}
                      >
                        删除
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
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

