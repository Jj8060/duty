import { addDays, format, getWeek, startOfWeek } from "date-fns";
import { useMemo, useState } from "react";
import {
  getDateFromYearWeek,
  getDefaultGroupForWeek,
  getWeekDays,
  getWeeksInYear
} from "../lib/mockData";
import {
  applyPenaltyRules,
  getDefaultPenaltyByStatus,
  getDefaultScoreByStatus
} from "../lib/attendanceRules";
import type {
  AttendanceRecord,
  AttendanceStatusCode,
  ExtraDuty,
  Group,
  Member
} from "../lib/types";

interface AttendanceFormState {
  member: Member | null;
  date: string | null;
  status: AttendanceStatusCode;
  score: number;
  penaltyDays: number;
  isSubstituted: boolean;
  substitutedBy: string | null;
  isExchanged: boolean;
  exchangedWith: string | null;
}

const STATUS_OPTIONS: { value: AttendanceStatusCode; label: string }[] = [
  { value: "present", label: "已到" },
  { value: "absent", label: "缺席" },
  { value: "fail", label: "不合格" },
  { value: "improve", label: "待改进" },
  { value: "pending", label: "待定" },
  { value: "perfect", label: "优秀" }
];

export function WeekListView(props: {
  groups: Group[];
  records?: AttendanceRecord[];
  extraDuties?: ExtraDuty[];
  scheduleOverrides?: Record<string, string>;
  onSave: (record: Omit<AttendanceRecord, "id"> & { id?: string }) => void | Promise<void>;
  onOverrideChange?: (weekStart: string, groupId: string) => void;
  onDeleteOverride?: (weekStart: string) => void;
  onGroupAbsent?: (dateStr: string, memberIds: string[], isSet: boolean) => void | Promise<void>;
  onImportantEvent?: (dateStr: string, memberIds: string[], isSet: boolean) => void | Promise<void>;
  onResetDay?: (dateStr: string, memberIds: string[]) => void | Promise<void>;
  isAdmin?: boolean;
}) {
  const today = new Date();
  const [currentDate, setCurrentDate] = useState<Date>(() => today);
  const [includeWeekend, setIncludeWeekend] = useState(false);
  const [form, setForm] = useState<AttendanceFormState | null>(null);

  const year = currentDate.getFullYear();
  const weekNum = getWeek(currentDate, { weekStartsOn: 1 });
  const maxWeeks = getWeeksInYear(year);

  const weekDays = useMemo(() => getWeekDays(currentDate), [currentDate]);
  const displayDays = useMemo(
    () => (includeWeekend ? weekDays : weekDays.slice(0, 5)),
    [weekDays, includeWeekend]
  );
  const weekStartISO = useMemo(
    () => format(startOfWeek(currentDate, { weekStartsOn: 1 }), "yyyy-MM-dd"),
    [currentDate]
  );
  const defaultGroup = useMemo(
    () => getDefaultGroupForWeek(currentDate, props.groups),
    [currentDate, props.groups]
  );
  const weekGroup = useMemo(() => {
    const overrideId = props.scheduleOverrides?.[weekStartISO];
    if (overrideId) {
      const g = props.groups.find((x) => x.id === overrideId);
      if (g) return g;
    }
    return defaultGroup;
  }, [props.groups, props.scheduleOverrides, weekStartISO, defaultGroup]);
  const allMembers = useMemo(() => props.groups.flatMap((g) => g.members), [props.groups]);
  const memberNameMap = useMemo(
    () => new Map(allMembers.map((m) => [m.id, m.name])),
    [allMembers]
  );

  const goToWeek = (y: number, w: number) => {
    const max = getWeeksInYear(y);
    setCurrentDate(getDateFromYearWeek(y, Math.min(w, max)));
  };
  const goToToday = () => setCurrentDate(new Date());

  const openForm = (member: Member, date: Date) => {
    if (!props.isAdmin) return;
    const dateStr = format(date, "yyyy-MM-dd");
    const existing = (props.records ?? []).find(
      (r) => r.memberId === member.id && r.date === dateStr
    );
    setForm({
      member,
      date: dateStr,
      status: existing?.status ?? "pending",
      score: existing?.score ?? 0,
      penaltyDays: existing?.penaltyDays ?? 0,
      isSubstituted: Boolean(existing?.isSubstituted),
      substitutedBy: existing?.substitutedBy ?? null,
      isExchanged: Boolean(existing?.isExchanged),
      exchangedWith: existing?.exchangedWith ?? null
    });
  };

  const closeForm = () => setForm(null);

  const handleSave = () => {
    if (!form?.member || !form.date) return;
    const finalPenalty = applyPenaltyRules({
      date: form.date,
      status: form.status,
      penaltyDays: form.penaltyDays
    });
    const rec: Omit<AttendanceRecord, "id"> & { id?: string } = {
      date: form.date,
      memberId: form.member.id,
      status: form.status,
      score: form.score,
      penaltyDays: finalPenalty,
      isSubstituted: form.isSubstituted,
      substitutedBy: form.isSubstituted ? form.substitutedBy : null,
      isExchanged: form.isExchanged,
      exchangedWith: form.isExchanged ? form.exchangedWith : null
    };
    // 目前由上层接管保存（可接 Supabase）
    void props.onSave(rec);
    closeForm();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-sm font-medium text-gray-600">
            <span>当前周值日组：</span>
            {props.isAdmin && props.onOverrideChange ? (
              <select
                className="rounded border border-gray-300 px-2 py-1 text-xs font-semibold text-gray-900"
                value={props.scheduleOverrides?.[weekStartISO] ?? "__default__"}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === "__default__") {
                    props.onDeleteOverride?.(weekStartISO);
                  } else {
                    props.onOverrideChange?.(weekStartISO, v);
                  }
                }}
              >
                <option value="__default__">使用默认轮换</option>
                {props.groups.map((g) => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            ) : (
              <span className="font-semibold text-gray-900">{weekGroup.name}</span>
            )}
          </div>
          <div className="mt-1 text-sm text-gray-500">
            日期范围：
            {format(displayDays[0], "MM月dd日")} -{" "}
            {format(displayDays[displayDays.length - 1], "MM月dd日")}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm text-gray-500">周选择：</span>
          <select
            className="rounded border border-gray-300 px-2 py-1 text-sm"
            value={year}
            onChange={(e) => goToWeek(Number(e.target.value), weekNum)}
          >
            {[2026, 2027, 2028, 2029, 2030].map((y) => (
              <option key={y} value={y}>{y}年</option>
            ))}
          </select>
          <select
            className="rounded border border-gray-300 px-2 py-1 text-sm"
            value={weekNum}
            onChange={(e) => goToWeek(year, Number(e.target.value))}
          >
            {Array.from({ length: maxWeeks }, (_, i) => i + 1).map((w) => {
              const mon = getDateFromYearWeek(year, w);
              const sun = addDays(mon, 6);
              const crossYear = mon.getFullYear() !== sun.getFullYear();
              const monLabel = crossYear
                ? format(mon, "yyyy年M月d日")
                : format(mon, "M月d日");
              const sunLabel = crossYear
                ? format(sun, "yyyy年M月d日")
                : format(sun, "M月d日");
              return (
                <option key={w} value={w}>
                  {`第${w}周（${monLabel}～${sunLabel}）`}
                </option>
              );
            })}
          </select>
          <button
            type="button"
            className="btn-outline text-sm"
            onClick={goToToday}
          >
            回到今天
          </button>
          <label className="flex items-center gap-1.5 text-sm text-gray-600">
            <input
              type="checkbox"
              checked={includeWeekend}
              onChange={(e) => setIncludeWeekend(e.target.checked)}
            />
            包含周末
          </label>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="px-3 py-2">日期</th>
              <th className="px-3 py-2">星期</th>
              <th className="px-3 py-2">值日组</th>
              <th className="px-3 py-2">成员与操作</th>
              {props.isAdmin && (
                <th className="px-3 py-2">快速操作</th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y bg-white">
            {displayDays.map((day) => {
              const weekday = ["日", "一", "二", "三", "四", "五", "六"][
                day.getDay()
              ];
              const dateStr = format(day, "yyyy-MM-dd");
              const memberIds = weekGroup.members.map((m) => m.id);
              const dayRecords = (props.records ?? []).filter(
                (r) => r.date === dateStr && memberIds.includes(r.memberId)
              );
              const dayExtras = (props.extraDuties ?? []).filter((e) => e.date === dateStr);
              const isGroupAbsent = dayRecords.some((r) => r.isGroupAbsent);
              const isImportantEvent = dayRecords.some((r) => r.isImportantEvent);
              return (
                <tr key={day.toISOString()}>
                  <td className="px-3 py-2 align-top whitespace-nowrap font-medium">
                    {format(day, "MM月dd日")}
                  </td>
                  <td className="px-3 py-2 align-top text-gray-500">
                    周{weekday}
                  </td>
                  <td className="px-3 py-2 align-top text-gray-700">
                    {weekGroup.name}
                  </td>
                  <td className="px-3 py-2 align-top">
                    <div className="flex flex-wrap gap-2">
                      {weekGroup.members.map((m) => {
                        const rec = dayRecords.find((r) => r.memberId === m.id);
                        const evaluated = rec && rec.status !== "pending";
                        return (
                          <button
                            key={m.id}
                            type="button"
                            className={`rounded-md border px-2 py-1 text-sm ${
                              evaluated
                                ? "border-green-300 text-green-700 bg-green-50"
                                : props.isAdmin
                                  ? "border-gray-200 hover:border-primary hover:text-primary"
                                  : "border-gray-100 text-gray-400 cursor-not-allowed"
                            }`}
                            disabled={!props.isAdmin}
                            onClick={() => openForm(m, day)}
                          >
                            {m.name}
                            <span className="ml-1 text-xs text-gray-400">
                              {evaluated ? "✓" : "评价"}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                    {dayExtras.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {dayExtras.map((e) => (
                          <span
                            key={e.id}
                            className="rounded bg-purple-50 px-2 py-0.5 text-xs text-purple-700"
                            title={e.reason ?? "额外值日"}
                          >
                            额外：{memberNameMap.get(e.memberId) ?? e.memberId}
                            {e.reason ? ` · ${e.reason}` : ""}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                  {props.isAdmin && (
                    <td className="px-3 py-2 align-top">
                      <div className="flex flex-wrap gap-1">
                        <button
                          type="button"
                          className="rounded border border-red-200 px-2 py-0.5 text-xs text-red-600 hover:bg-red-50"
                          title="全体缺勤"
                          onClick={() =>
                            void props.onGroupAbsent?.(
                              dateStr,
                              memberIds,
                              !isGroupAbsent
                            )
                          }
                        >
                          {isGroupAbsent ? "取消缺勤" : "全体缺勤"}
                        </button>
                        <button
                          type="button"
                          className="rounded border border-amber-200 px-2 py-0.5 text-xs text-amber-600 hover:bg-amber-50"
                          title="重大活动"
                          onClick={() =>
                            void props.onImportantEvent?.(
                              dateStr,
                              memberIds,
                              !isImportantEvent
                            )
                          }
                        >
                          {isImportantEvent ? "取消活动" : "重大活动"}
                        </button>
                        <button
                          type="button"
                          className="rounded border border-gray-200 px-2 py-0.5 text-xs text-gray-600 hover:bg-gray-50"
                          title="重置当天"
                          onClick={() =>
                            void props.onResetDay?.(dateStr, memberIds)
                          }
                        >
                          重置
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {form && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30">
          <div className="card w-full max-w-md p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold">考勤评价</h2>
              <button
                type="button"
                className="text-sm text-gray-400 hover:text-gray-600"
                onClick={closeForm}
              >
                关闭
              </button>
            </div>
            <div className="mt-3 space-y-3 text-sm">
              <div className="flex justify-between text-gray-600">
                <span>成员：{form.member?.name}</span>
                <span>日期：{form.date}</span>
              </div>

              <div className="space-y-1">
                <label className="block text-gray-600">出勤状态</label>
                <select
                  className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm"
                  value={form.status}
                  onChange={(e) =>
                    setForm((prev) =>
                      prev
                        ? {
                            ...prev,
                            status: e.target.value as AttendanceStatusCode,
                            score: getDefaultScoreByStatus(
                              e.target.value as AttendanceStatusCode
                            ),
                            penaltyDays: getDefaultPenaltyByStatus(
                              e.target.value as AttendanceStatusCode
                            )
                          }
                        : prev
                    )
                  }
                >
                  {STATUS_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex gap-3">
                <div className="flex-1 space-y-1">
                  <label className="block text-gray-600">评分（0-4）</label>
                    <input
                    type="number"
                    min={0}
                    max={4}
                    className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm"
                    value={form.score}
                    onChange={(e) =>
                      setForm((prev) =>
                        prev
                          ? {
                              ...prev,
                              score: Number(e.target.value || 0)
                            }
                          : prev
                      )
                    }
                  />
                </div>
                <div className="flex-1 space-y-1">
                  <label className="block text-gray-600">惩罚天数</label>
                    <input
                    type="number"
                    min={0}
                    className="w-full rounded-md border border-gray-300 px-2 py-1 text-sm"
                    value={form.penaltyDays}
                    onChange={(e) =>
                      setForm((prev) =>
                        prev
                          ? {
                              ...prev,
                              penaltyDays: Number(e.target.value || 0)
                            }
                          : prev
                      )
                    }
                  />
                </div>
              </div>

              <div className="rounded border border-gray-200 p-2">
                <div className="space-y-2">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={form.isSubstituted}
                      onChange={(e) =>
                        setForm((prev) =>
                          prev
                            ? {
                                ...prev,
                                isSubstituted: e.target.checked,
                                substitutedBy: e.target.checked ? prev.substitutedBy : null
                              }
                            : prev
                        )
                      }
                    />
                    <span className="text-gray-700">代值</span>
                  </label>
                  {form.isSubstituted && (
                    <select
                      className="w-full rounded-md border border-gray-300 px-2 py-1"
                      value={form.substitutedBy ?? ""}
                      onChange={(e) =>
                        setForm((prev) =>
                          prev
                            ? {
                                ...prev,
                                substitutedBy: e.target.value || null
                              }
                            : prev
                        )
                      }
                    >
                      <option value="">选择代值人</option>
                      {allMembers
                        .filter((m) => m.id !== form.member?.id)
                        .map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name}
                          </option>
                        ))}
                    </select>
                  )}
                </div>
                <div className="mt-2 space-y-2">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={form.isExchanged}
                      onChange={(e) =>
                        setForm((prev) =>
                          prev
                            ? {
                                ...prev,
                                isExchanged: e.target.checked,
                                exchangedWith: e.target.checked ? prev.exchangedWith : null
                              }
                            : prev
                        )
                      }
                    />
                    <span className="text-gray-700">还值</span>
                  </label>
                  {form.isExchanged && (
                    <select
                      className="w-full rounded-md border border-gray-300 px-2 py-1"
                      value={form.exchangedWith ?? ""}
                      onChange={(e) =>
                        setForm((prev) =>
                          prev
                            ? {
                                ...prev,
                                exchangedWith: e.target.value || null
                              }
                            : prev
                        )
                      }
                    >
                      <option value="">选择还值对象</option>
                      {Array.from(
                        new Set(
                          (props.records ?? [])
                            .filter(
                              (r) =>
                                r.memberId === form.member?.id &&
                                Boolean(r.isSubstituted) &&
                                Boolean(r.substitutedBy)
                            )
                            .map((r) => r.substitutedBy as string)
                        )
                      ).map((id) => {
                        const m = allMembers.find((x) => x.id === id);
                        if (!m) return null;
                        return (
                          <option key={m.id} value={m.id}>
                            {m.name}
                          </option>
                        );
                      })}
                    </select>
                  )}
                </div>
              </div>

                <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  className="btn-outline text-sm"
                  onClick={closeForm}
                >
                  取消
                </button>
                <button
                  type="button"
                  className="btn-primary text-sm"
                  onClick={handleSave}
                >
                  保存
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

