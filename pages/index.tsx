import { useEffect, useMemo, useState } from "react";
import { WeekListView } from "../components/WeekListView";
import { MonthCalendarView } from "../components/MonthCalendarView";
import { LoginModal } from "../components/LoginModal";
import { createDefaultGroups } from "../lib/mockData";
import { applyPenaltyRules } from "../lib/attendanceRules";
import { driver } from "../lib/appData";
import { useAuth } from "../lib/AuthContext";
import { computeMemberStats, getLowScoreWarnings } from "../lib/statistics";
import type { AttendanceRecord, DailyDutyMember, ExtraDuty, Group } from "../lib/types";

type ViewMode = "calendar" | "list";

export default function HomePage() {
  const { admin, logout } = useAuth();
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [groups, setGroups] = useState<Group[]>(() => createDefaultGroups());
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [extraDuties, setExtraDuties] = useState<ExtraDuty[]>([]);
  const [dailyDutyMembers, setDailyDutyMembers] = useState<DailyDutyMember[]>([]);
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
    if (driver.listDailyDutyMembers) {
      void driver.listDailyDutyMembers().then(setDailyDutyMembers).catch(() => {});
    }
  }, []);
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
        penaltyDays: isSet ? 1 : 0,
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

  const getOccurrenceBasedPenalty = (
    draft: Omit<AttendanceRecord, "id"> & { id?: string }
  ) => {
    if (draft.isCompensation) {
      return draft.penaltyDays ?? 0;
    }
    if (draft.status !== "absent" && draft.status !== "fail") {
      return draft.penaltyDays ?? 0;
    }
    const existing = records.find(
      (r) => r.memberId === draft.memberId && r.date === draft.date
    );
    const priorCount = records.filter((r) => {
      const sameMember = r.memberId === draft.memberId;
      const sameStatus = r.status === draft.status;
      const sameDayRecord = existing ? r.id === existing.id : false;
      return sameMember && sameStatus && !sameDayRecord;
    }).length;
    const baseByOccurrence = priorCount <= 1 ? 1 : 2;
    return baseByOccurrence;
  };

  const handleSave = async (rec: Omit<AttendanceRecord, "id"> & { id?: string }) => {
    const normalizedPenalty = rec.isCompensation
      ? getOccurrenceBasedPenalty(rec)
      : applyPenaltyRules({
          date: rec.date,
          status: rec.status,
          penaltyDays: getOccurrenceBasedPenalty(rec),
          isImportantEvent: rec.isImportantEvent
        });
    const saved = await driver.upsertAttendanceRecord({
      ...rec,
      penaltyDays: normalizedPenalty
    });
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

  const handleAddExtraDuty = async (date: string, memberId: string, reason?: string) => {
    if (!driver.upsertExtraDuty || !date || !memberId) return;
    try {
      const saved = await driver.upsertExtraDuty({
        date,
        memberId,
        reason: reason || null
      });
      if (admin) {
        await driver.logAdminOperation?.({
          operatorUsername: admin.username,
          action: "add_extra_duty",
          target: `${saved.memberId}@${saved.date}`,
          detail: { reason: saved.reason ?? null }
        });
      }
      const hasAttendanceOnDate = records.some(
        (r) => r.memberId === saved.memberId && r.date === saved.date
      );
      const memberTotalPenalty = records
        .filter((r) => r.memberId === saved.memberId)
        .reduce((sum, r) => sum + (r.penaltyDays ?? 0), 0);
      if (!hasAttendanceOnDate && memberTotalPenalty > 0) {
        await handleSave({
          date: saved.date,
          memberId: saved.memberId,
          status: "pending",
          score: 0,
          penaltyDays: -1,
          isCompensation: true,
          isImportantEvent: false,
          isGroupAbsent: false
        });
      }
      setExtraDuties((prev) => [saved, ...prev].sort((a, b) => (a.date < b.date ? 1 : -1)));
    } catch {}
  };

  const handleDeleteExtraDuty = async (id: string) => {
    if (!driver.deleteExtraDuty) return;
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
    } catch {}
  };

  const handleAddDayMember = async (date: string, memberId: string) => {
    if (!driver.upsertDailyDutyMember || !date || !memberId) return;
    const saved = await driver.upsertDailyDutyMember({ date, memberId });
    setDailyDutyMembers((prev) => {
      if (prev.some((m) => m.date === saved.date && m.memberId === saved.memberId)) {
        return prev;
      }
      return [...prev, saved];
    });
  };

  const handleRemoveDayMember = async (date: string, memberId: string) => {
    if (!driver.deleteDailyDutyMember || !date || !memberId) return;
    await driver.deleteDailyDutyMember(date, memberId);
    setDailyDutyMembers((prev) =>
      prev.filter((m) => !(m.date === date && m.memberId === memberId))
    );
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
              dailyDutyMembers={dailyDutyMembers}
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
              extraDuties={extraDuties}
              dailyDutyMembers={dailyDutyMembers}
              scheduleOverrides={overrides}
              onSave={handleSave}
              onOverrideChange={handleOverride}
              onDeleteOverride={handleDeleteOverride}
              onGroupAbsent={handleGroupAbsent}
              onImportantEvent={handleImportantEvent}
              onResetDay={handleResetDay}
              isAdmin={!!admin}
              onAddExtraDuty={handleAddExtraDuty}
              onDeleteExtraDuty={handleDeleteExtraDuty}
              onAddDayMember={handleAddDayMember}
              onRemoveDayMember={handleRemoveDayMember}
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

