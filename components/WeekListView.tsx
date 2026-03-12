import { format } from "date-fns";
import { useMemo, useState } from "react";
import { getDefaultGroupForWeek, getWeekDays } from "../lib/mockData";
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

export function WeekListView(props: {
  groups: Group[];
  onSave: (record: Omit<AttendanceRecord, "id"> & { id?: string }) => void | Promise<void>;
}) {
  const [currentDate] = useState<Date>(new Date());
  const [form, setForm] = useState<AttendanceFormState | null>(null);

  const weekDays = useMemo(() => getWeekDays(currentDate), [currentDate]);
  const weekGroup = useMemo(
    () => getDefaultGroupForWeek(currentDate, props.groups),
    [currentDate, props.groups]
  );

  const openForm = (member: Member, date: Date) => {
    setForm({
      member,
      date: format(date, "yyyy-MM-dd"),
      status: "pending",
      score: 0,
      penaltyDays: 0
    });
  };

  const closeForm = () => setForm(null);

  const handleSave = () => {
    if (!form?.member || !form.date) return;
    const rec: Omit<AttendanceRecord, "id"> & { id?: string } = {
      date: form.date,
      memberId: form.member.id,
      status: form.status,
      score: form.score,
      penaltyDays: form.penaltyDays
    };
    // 目前由上层接管保存（可接 Supabase）
    void props.onSave(rec);
    closeForm();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm text-gray-500">
            当前周值日组：
            <span className="font-semibold text-gray-900">
              {weekGroup.name}
            </span>
          </div>
          <div className="mt-1 text-xs text-gray-400">
            日期范围：
            {format(weekDays[0], "MM月dd日")} -{" "}
            {format(weekDays[6], "MM月dd日")}
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-xs">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="px-3 py-2">日期</th>
              <th className="px-3 py-2">星期</th>
              <th className="px-3 py-2">值日组</th>
              <th className="px-3 py-2">成员与操作</th>
            </tr>
          </thead>
          <tbody className="divide-y bg-white">
            {weekDays.map((day) => {
              const weekday = ["日", "一", "二", "三", "四", "五", "六"][
                day.getDay()
              ];
              return (
                <tr key={day.toISOString()}>
                  <td className="px-3 py-2 align-top whitespace-nowrap">
                    <div className="text-xs">
                      {format(day, "MM-dd")}
                    </div>
                  </td>
                  <td className="px-3 py-2 align-top text-xs text-gray-500">
                    周{weekday}
                  </td>
                  <td className="px-3 py-2 align-top text-xs text-gray-700">
                    {weekGroup.name}
                  </td>
                  <td className="px-3 py-2 align-top">
                    <div className="flex flex-wrap gap-2">
                      {weekGroup.members.map((m) => (
                        <button
                          key={m.id}
                          type="button"
                          className="rounded-md border border-gray-200 px-2 py-1 text-xs hover:border-primary hover:text-primary"
                          onClick={() => openForm(m, day)}
                        >
                          {m.name}
                          <span className="ml-1 text-[10px] text-gray-400">
                            评价
                          </span>
                        </button>
                      ))}
                    </div>
                  </td>
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
                            status: e.target
                              .value as AttendanceStatusCode
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

