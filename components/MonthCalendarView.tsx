import {
  addDays,
  endOfMonth,
  endOfWeek,
  format,
  getMonth,
  getYear,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek
} from "date-fns";
import { useMemo, useState } from "react";
import { getDefaultGroupForWeek } from "../lib/mockData";
import type {
  AttendanceRecord,
  AttendanceStatusCode,
  Group,
  Member
} from "../lib/types";

interface AttendanceFormState {
  member: Member | null;
  date: string | null;
  status: AttendanceStatusCode;
  score: number;
  penaltyDays: number;
}

const STATUS_OPTIONS: { value: AttendanceStatusCode; label: string }[] = [
  { value: "present", label: "已到" },
  { value: "absent", label: "缺席" },
  { value: "fail", label: "不合格" },
  { value: "improve", label: "待改进" },
  { value: "pending", label: "待定" },
  { value: "perfect", label: "优秀" }
];

const WEEK_LABELS = ["一", "二", "三", "四", "五", "六", "日"];

export function MonthCalendarView(props: {
  groups: Group[];
  records?: AttendanceRecord[];
  scheduleOverrides?: Record<string, string>;
  onSave: (record: Omit<AttendanceRecord, "id"> & { id?: string }) => void | Promise<void>;
  onGroupAbsent?: (dateStr: string, memberIds: string[], isSet: boolean) => void | Promise<void>;
  onImportantEvent?: (dateStr: string, memberIds: string[], isSet: boolean) => void | Promise<void>;
  onResetDay?: (dateStr: string, memberIds: string[]) => void | Promise<void>;
  isAdmin?: boolean;
}) {
  const today = new Date();
  const [currentMonth, setCurrentMonth] = useState<Date>(() => today);
  const [selectedDate, setSelectedDate] = useState<Date | null>(today);
  const [form, setForm] = useState<AttendanceFormState | null>(null);

  const year = getYear(currentMonth);
  const month = getMonth(currentMonth) + 1;

  const monthStart = useMemo(() => startOfMonth(currentMonth), [currentMonth]);
  const monthEnd = useMemo(() => endOfMonth(currentMonth), [currentMonth]);
  const gridStart = useMemo(
    () => startOfWeek(monthStart, { weekStartsOn: 1 }),
    [monthStart]
  );
  const gridEnd = useMemo(
    () => endOfWeek(monthEnd, { weekStartsOn: 1 }),
    [monthEnd]
  );

  const days = useMemo(() => {
    const list: Date[] = [];
    let cursor = gridStart;
    while (cursor <= gridEnd) {
      list.push(cursor);
      cursor = addDays(cursor, 1);
    }
    return list;
  }, [gridStart, gridEnd]);

  const dateKey = (d: Date) => format(d, "yyyy-MM-dd");

  const getDayGroup = (d: Date): Group => {
    const weekStartISO = format(startOfWeek(d, { weekStartsOn: 1 }), "yyyy-MM-dd");
    const overrideId = props.scheduleOverrides?.[weekStartISO];
    if (overrideId) {
      const matched = props.groups.find((g) => g.id === overrideId);
      if (matched) return matched;
    }
    return getDefaultGroupForWeek(d, props.groups);
  };

  const getDayRecords = (d: Date) => {
    const g = getDayGroup(d);
    const ids = g.members.map((m) => m.id);
    const key = dateKey(d);
    return (props.records ?? []).filter(
      (r) => r.date === key && ids.includes(r.memberId)
    );
  };

  const openForm = (member: Member, date: Date) => {
    setForm({
      member,
      date: dateKey(date),
      status: "pending",
      score: 0,
      penaltyDays: 0
    });
  };

  const closeForm = () => setForm(null);

  const handleSave = () => {
    if (!form?.member || !form.date) return;
    void props.onSave({
      date: form.date,
      memberId: form.member.id,
      status: form.status,
      score: form.score,
      penaltyDays: form.penaltyDays
    });
    closeForm();
  };

  const selected = selectedDate ?? today;
  const selectedGroup = getDayGroup(selected);
  const selectedDateStr = dateKey(selected);
  const selectedMemberIds = selectedGroup.members.map((m) => m.id);
  const selectedDayRecords = getDayRecords(selected);
  const selectedAbsent = selectedDayRecords.some((r) => r.isGroupAbsent);
  const selectedEvent = selectedDayRecords.some((r) => r.isImportantEvent);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-xs text-gray-500">
          当前月份：{year}年{month}月
        </div>
        <div className="flex items-center gap-2">
          <select
            className="rounded border border-gray-300 px-2 py-1 text-xs"
            value={year}
            onChange={(e) =>
              setCurrentMonth(new Date(Number(e.target.value), month - 1, 1))
            }
          >
            {[2026, 2027, 2028, 2029, 2030].map((y) => (
              <option key={y} value={y}>
                {y}年
              </option>
            ))}
          </select>
          <select
            className="rounded border border-gray-300 px-2 py-1 text-xs"
            value={month}
            onChange={(e) =>
              setCurrentMonth(new Date(year, Number(e.target.value) - 1, 1))
            }
          >
            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
              <option key={m} value={m}>
                {m}月
              </option>
            ))}
          </select>
          <button
            type="button"
            className="btn-outline text-xs"
            onClick={() => {
              const now = new Date();
              setCurrentMonth(now);
              setSelectedDate(now);
            }}
          >
            回到今天
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-2">
        {WEEK_LABELS.map((w) => (
          <div key={w} className="rounded bg-gray-50 py-1 text-center text-xs text-gray-600">
            周{w}
          </div>
        ))}
        {days.map((d) => {
          const inMonth = isSameMonth(d, currentMonth);
          const key = dateKey(d);
          const dayGroup = getDayGroup(d);
          const dayRecs = getDayRecords(d);
          const absent = dayRecs.some((r) => r.isGroupAbsent);
          const important = dayRecs.some((r) => r.isImportantEvent);
          const evaluatedCount = dayRecs.filter((r) => r.status !== "pending").length;
          const isSelected = selectedDate ? dateKey(selectedDate) === key : false;
          return (
            <button
              key={key}
              type="button"
              className={`min-h-[92px] rounded border p-2 text-left transition ${
                isSelected
                  ? "border-primary bg-blue-50"
                  : "border-gray-200 hover:border-primary/60"
              } ${inMonth ? "bg-white" : "bg-gray-50 text-gray-400"}`}
              onClick={() => setSelectedDate(d)}
            >
              <div className="flex items-center justify-between">
                <span className={`text-xs font-medium ${isToday(d) ? "text-primary" : ""}`}>
                  {format(d, "d")}
                </span>
                {isToday(d) && <span className="text-[10px] text-primary">今日</span>}
              </div>
              <div className="mt-1 line-clamp-1 text-[11px]">{dayGroup.name}</div>
              <div className="mt-1 flex flex-wrap gap-1 text-[10px]">
                <span className="rounded bg-gray-100 px-1 py-0.5 text-gray-600">
                  已评 {evaluatedCount}/{dayGroup.members.length}
                </span>
                {absent && (
                  <span className="rounded bg-red-100 px-1 py-0.5 text-red-700">全缺</span>
                )}
                {important && (
                  <span className="rounded bg-amber-100 px-1 py-0.5 text-amber-700">活动</span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      <div className="rounded border border-gray-200 bg-white p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <div className="text-sm font-semibold">
              {format(selected, "yyyy-MM-dd")} · {selectedGroup.name}
            </div>
            <div className="text-xs text-gray-500">
              点击成员可打开评价面板
            </div>
          </div>
          {props.isAdmin && (
            <div className="flex flex-wrap gap-1">
              <button
                type="button"
                className="rounded border border-red-200 px-2 py-1 text-[11px] text-red-600 hover:bg-red-50"
                onClick={() =>
                  void props.onGroupAbsent?.(
                    selectedDateStr,
                    selectedMemberIds,
                    !selectedAbsent
                  )
                }
              >
                {selectedAbsent ? "取消全体缺勤" : "全体缺勤"}
              </button>
              <button
                type="button"
                className="rounded border border-amber-200 px-2 py-1 text-[11px] text-amber-600 hover:bg-amber-50"
                onClick={() =>
                  void props.onImportantEvent?.(
                    selectedDateStr,
                    selectedMemberIds,
                    !selectedEvent
                  )
                }
              >
                {selectedEvent ? "取消重大活动" : "重大活动"}
              </button>
              <button
                type="button"
                className="rounded border border-gray-200 px-2 py-1 text-[11px] text-gray-600 hover:bg-gray-50"
                onClick={() => void props.onResetDay?.(selectedDateStr, selectedMemberIds)}
              >
                重置当天
              </button>
            </div>
          )}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {selectedGroup.members.map((m) => (
            <button
              key={m.id}
              type="button"
              className="rounded-md border border-gray-200 px-2 py-1 text-xs hover:border-primary hover:text-primary"
              onClick={() => openForm(m, selected)}
            >
              {m.name}
              <span className="ml-1 text-[10px] text-gray-400">评价</span>
            </button>
          ))}
        </div>
      </div>

      {form && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/30">
          <div className="card w-full max-w-md p-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">考勤评价</h2>
              <button
                type="button"
                className="text-xs text-gray-400 hover:text-gray-600"
                onClick={closeForm}
              >
                关闭
              </button>
            </div>
            <div className="mt-3 space-y-3 text-xs">
              <div className="flex justify-between text-gray-600">
                <span>成员：{form.member?.name}</span>
                <span>日期：{form.date}</span>
              </div>

              <div className="space-y-1">
                <label className="block text-gray-600">出勤状态</label>
                <select
                  className="w-full rounded-md border border-gray-300 px-2 py-1 text-xs"
                  value={form.status}
                  onChange={(e) =>
                    setForm((prev) =>
                      prev
                        ? {
                            ...prev,
                            status: e.target.value as AttendanceStatusCode
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
                    className="w-full rounded-md border border-gray-300 px-2 py-1 text-xs"
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
                    className="w-full rounded-md border border-gray-300 px-2 py-1 text-xs"
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

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  className="btn-outline text-xs"
                  onClick={closeForm}
                >
                  取消
                </button>
                <button
                  type="button"
                  className="btn-primary text-xs"
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
