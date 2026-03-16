import type { AttendanceRecord, Group, Member } from "./types";

export type MemberStats = {
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

export function computeMemberStats(
  records: AttendanceRecord[],
  groups: Group[]
): MemberStats[] {
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

export function getLowScoreWarnings(stats: MemberStats[]): MemberStats[] {
  return stats
    .filter(
      (s) =>
        (s.avgScore !== null && s.avgScore < 2) ||
        s.fail >= 2 ||
        s.absent >= 2
    )
    .sort((a, b) => {
      const aScore = a.avgScore ?? 999;
      const bScore = b.avgScore ?? 999;
      if (aScore !== bScore) return aScore - bScore;
      return b.totalPenaltyDays - a.totalPenaltyDays;
    });
}
