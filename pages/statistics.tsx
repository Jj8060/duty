import { useEffect, useMemo, useState } from "react";
import { LoginModal } from "../components/LoginModal";
import { createDefaultGroups } from "../lib/mockData";
import { driver } from "../lib/appData";
import { useAuth } from "../lib/AuthContext";
import { computeMemberStats, getLowScoreWarnings } from "../lib/statistics";
import type { AttendanceRecord, Group, Member } from "../lib/types";

export default function StatisticsPage() {
  const { admin, logout } = useAuth();
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [groups, setGroups] = useState<Group[]>(() => createDefaultGroups());
  const [selectedGroupId, setSelectedGroupId] = useState<string>("all");
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [showLogin, setShowLogin] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!admin) return;
    void driver.listAttendanceRecords().then(setRecords).catch(() => setRecords([]));
    void driver
      .getGroups()
      .then((g) => setGroups(g.length > 0 ? g : createDefaultGroups()))
      .catch(() => {});
  }, [admin]);

  const stats = useMemo(() => computeMemberStats(records, groups), [records, groups]);
  const lowWarnings = useMemo(() => getLowScoreWarnings(stats).slice(0, 8), [stats]);
  const memberNameMap = useMemo(() => {
    return new Map(groups.flatMap((g) => g.members).map((m) => [m.id, m.name]));
  }, [groups]);
  const filteredStats = useMemo(
    () =>
      selectedGroupId === "all"
        ? stats
        : stats.filter((s) => s.member.groupId === selectedGroupId),
    [stats, selectedGroupId]
  );
  const selectedStat = useMemo(
    () => stats.find((s) => s.member.id === selectedMemberId) ?? null,
    [stats, selectedMemberId]
  );
  const memberRecords = useMemo(() => {
    if (!selectedMemberId) return [];
    return records
      .filter((r) => r.memberId === selectedMemberId)
      .sort((a, b) => (a.date < b.date ? 1 : -1));
  }, [records, selectedMemberId]);

  const removeRecord = async (id: string) => {
    if (!driver.deleteAttendanceRecord || !admin?.isRoot) return;
    setDeletingId(id);
    setMessage(null);
    try {
      await driver.deleteAttendanceRecord(id);
      setRecords((prev) => prev.filter((r) => r.id !== id));
      setMessage("记录已删除");
    } catch (e) {
      setMessage(`删除失败：${String(e)}`);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">考核统计</h1>
          <p className="mt-1 text-sm text-gray-500">
            按成员查看平均分、惩罚天数与考勤详情，支持按组筛选和记录明细。
          </p>
        </div>
        {admin ? (
          <div className="text-xs text-gray-600">
            已登录：{admin.username}
            <button
              type="button"
              className="ml-2 text-primary hover:underline"
              onClick={logout}
            >
              退出
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="btn-primary text-xs"
            onClick={() => setShowLogin(true)}
          >
            管理员登录后查看
          </button>
        )}
      </div>

      {!admin ? (
        <section className="card p-6 text-sm text-gray-500">
          统计数据仅管理员可见，请先登录后查看。
        </section>
      ) : (
        <>
          <div className="card p-4">
            <div className="text-sm font-medium">低分预警</div>
            {lowWarnings.length === 0 ? (
              <p className="mt-2 text-xs text-gray-500">暂无预警成员。</p>
            ) : (
              <ul className="mt-2 space-y-1 text-xs">
                {lowWarnings.map((w) => (
                  <li key={w.member.id} className="text-gray-600">
                    {w.groupName} · {w.member.name}：均分
                    <span className="text-red-600">
                      {" "}
                      {w.avgScore === null ? "-" : w.avgScore.toFixed(1)}
                    </span>
                    ，缺席 {w.absent}，不合格 {w.fail}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="card p-4">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="text-gray-500">组别筛选：</span>
              <select
                className="rounded border border-gray-300 px-2 py-1"
                value={selectedGroupId}
                onChange={(e) => setSelectedGroupId(e.target.value)}
              >
                <option value="all">全部</option>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
              <span className="text-gray-400">
                当前共 {filteredStats.length} 名成员（模式：{driver.isReady() ? "Supabase" : "本地内存"}）
              </span>
            </div>
          </div>

      <div className="card overflow-hidden">
        <div className="border-b px-4 py-3 text-sm font-medium">
          统计列表
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
              {filteredStats.map((s) => (
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
                    <button
                      className="btn-outline text-xs"
                      onClick={() => setSelectedMemberId(s.member.id)}
                    >
                      查看记录
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
        </>
      )}

      {selectedStat && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="card w-full max-w-3xl p-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold">
                  {selectedStat.groupName} · {selectedStat.member.name} 的记录详情
                </h2>
                <p className="mt-1 text-xs text-gray-500">
                  共 {memberRecords.length} 条记录
                </p>
              </div>
              <button
                type="button"
                className="text-xs text-gray-400 hover:text-gray-600"
                onClick={() => setSelectedMemberId(null)}
              >
                关闭
              </button>
            </div>
            {message && (
              <p className={`mt-2 text-xs ${message.includes("失败") ? "text-red-600" : "text-green-600"}`}>
                {message}
              </p>
            )}
            <div className="mt-3 max-h-[60vh] overflow-auto">
              <table className="min-w-full text-left text-xs">
                <thead className="bg-gray-50 text-gray-600">
                  <tr>
                    <th className="px-3 py-2">日期</th>
                    <th className="px-3 py-2">状态</th>
                    <th className="px-3 py-2">评分</th>
                    <th className="px-3 py-2">惩罚天数</th>
                    <th className="px-3 py-2">标记</th>
                    <th className="px-3 py-2">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y bg-white">
                  {memberRecords.map((r) => (
                    <tr key={r.id}>
                      <td className="px-3 py-2">{r.date}</td>
                      <td className="px-3 py-2">{r.status}</td>
                      <td className="px-3 py-2">{r.score}</td>
                      <td className="px-3 py-2">{r.penaltyDays}</td>
                      <td className="px-3 py-2 text-gray-500">
                        {[
                          r.isGroupAbsent ? "全体缺勤" : null,
                          r.isImportantEvent ? "重大活动" : null,
                          r.isSubstituted && r.substitutedBy
                            ? `代值(${memberNameMap.get(r.substitutedBy) ?? r.substitutedBy})`
                            : null,
                          r.isExchanged && r.exchangedWith
                            ? `还值(${memberNameMap.get(r.exchangedWith) ?? r.exchangedWith})`
                            : null
                        ]
                          .filter(Boolean)
                          .join(" · ") || "-"}
                      </td>
                      <td className="px-3 py-2">
                        {admin?.isRoot ? (
                          <button
                            type="button"
                            className="rounded border border-red-200 px-2 py-1 text-[11px] text-red-600 hover:bg-red-50 disabled:opacity-50"
                            disabled={deletingId === r.id}
                            onClick={() => void removeRecord(r.id)}
                          >
                            {deletingId === r.id ? "删除中…" : "删除"}
                          </button>
                        ) : (
                          <span className="text-gray-400">仅终端管理员可删</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {showLogin && <LoginModal onClose={() => setShowLogin(false)} />}
    </div>
  );
}

