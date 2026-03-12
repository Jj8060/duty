import { useEffect, useMemo, useState } from "react";
import { driver, groups } from "../lib/appData";
import type { AttendanceRecord, Member } from "../lib/types";

type MemberStats = {
  member: Member;
  groupName: string;
  avgScore: number | null;
  totalPenaltyDays: number;
  present: number;
  improve: number;
  absent: number;
  fail: number;
  perfect: number;
};

function computeStats(records: AttendanceRecord[]): MemberStats[] {
  const members = groups.flatMap((g) =>
    g.members.map((m) => ({ m, groupName: g.name }))
  );
  return members.map(({ m, groupName }) => {
    const mr = records.filter((r) => r.memberId === m.id);
    const validScores = mr.filter((r) => r.score > 0).map((r) => r.score);
    const avg =
      validScores.length > 0
        ? validScores.reduce((a, b) => a + b, 0) / validScores.length
        : null;
    const totalPenalty = mr.reduce((sum, r) => sum + (r.penaltyDays ?? 0), 0);
    const count = (s: AttendanceRecord["status"]) =>
      mr.filter((r) => r.status === s).length;
    return {
      member: m,
      groupName,
      avgScore: avg,
      totalPenaltyDays: totalPenalty,
      present: count("present"),
      improve: count("improve"),
      absent: count("absent"),
      fail: count("fail"),
      perfect: count("perfect")
    };
  });
}

export default function StatisticsPage() {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);

  useEffect(() => {
    void driver.listAttendanceRecords().then(setRecords).catch(() => setRecords([]));
  }, []);

  const stats = useMemo(() => computeStats(records), [records]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">考核统计</h1>
          <p className="mt-1 text-sm text-gray-500">
            按成员维度查看平均分、惩罚天数、考勤次数等数据（当前为结构占位，后续接入 Supabase）。
          </p>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="border-b px-4 py-3 text-sm font-medium">
          统计列表（已连接：{driver.isReady() ? "Supabase" : "本地内存"}）
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-xs">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="px-3 py-2">组别</th>
                <th className="px-3 py-2">成员</th>
                <th className="px-3 py-2">平均分</th>
                <th className="px-3 py-2">惩罚天数</th>
                <th className="px-3 py-2">考勤情况</th>
                <th className="px-3 py-2">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y bg-white">
              {stats.map((s) => (
                <tr key={s.member.id}>
                  <td className="px-3 py-2 text-xs text-gray-700">
                    {s.groupName}
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-700">
                    {s.member.name}
                  </td>
                  <td
                    className={`px-3 py-2 text-xs ${
                      s.avgScore === null
                        ? "text-gray-400"
                        : s.avgScore >= 3
                          ? "text-green-600"
                          : s.avgScore >= 2
                            ? "text-orange-600"
                            : "text-red-600"
                    }`}
                  >
                    {s.avgScore === null ? "-" : s.avgScore.toFixed(1)}
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-700">
                    {s.totalPenaltyDays >= 0
                      ? `+${s.totalPenaltyDays} 天`
                      : `${s.totalPenaltyDays} 天`}
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-500">
                    已到 {s.present} · 待改进 {s.improve} · 缺席 {s.absent} · 不合格{" "}
                    {s.fail} · 优秀 {s.perfect}
                  </td>
                  <td className="px-3 py-2 text-xs">
                    <button className="btn-outline text-xs" disabled>
                      查看记录（下一步）
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

