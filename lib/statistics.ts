import type { AttendanceRecord, Group, Member } from "./types";

export type MemberStats = {
  member: Member;
  groupName: string;
  avgScore: number | null;
  /** 有效评分记录数（score > 0 的记录条数），用于低分预警“至少2条才预警” */
  validScoreCount: number;
  /** 惩罚天数-正常：所有记录 penaltyDays 的代数和（含补值减免的负值） */
  totalPenaltyDays: number;
  /** 惩罚天数累计：只累加正值，不抵消 */
  cumulativePenaltyDays: number;
  present: number;
  improve: number;
  absent: number;
  fail: number;
  perfect: number;
  /** 该成员曾代替过的成员 ID 列表（去重） */
  substitutedForIds: string[];
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
    const cumulativePenalty = mr.reduce(
      (sum, r) => sum + Math.max(0, r.penaltyDays ?? 0),
      0
    );
    const count = (s: AttendanceRecord["status"]) =>
      mr.filter((r) => r.status === s).length;
    // 找出所有 "该成员作为代值人" 的原值日人（即其他人记录中 substitutedBy === m.id）
    const substitutedForIds = Array.from(
      new Set(
        records
          .filter((r) => r.substitutedBy === m.id)
          .map((r) => r.memberId)
      )
    );
    return {
      member: m,
      groupName,
      avgScore: avg,
      validScoreCount: validScores.length,
      totalPenaltyDays: totalPenalty,
      cumulativePenaltyDays: cumulativePenalty,
      present: count("present"),
      improve: count("improve"),
      absent: count("absent"),
      fail: count("fail"),
      perfect: count("perfect"),
      substitutedForIds
    };
  });
}

/**
 * 低分预警：仅当「平均分大于0且小于2分」且「至少有2条有效评分记录」时显示（与功能策划书 3.6.1 一致）。
 */
export function getLowScoreWarnings(stats: MemberStats[]): MemberStats[] {
  return stats
    .filter(
      (s) =>
        s.avgScore !== null &&
        s.avgScore > 0 &&
        s.avgScore < 2 &&
        s.validScoreCount >= 2
    )
    .sort((a, b) => {
      const aScore = a.avgScore ?? 999;
      const bScore = b.avgScore ?? 999;
      if (aScore !== bScore) return aScore - bScore;
      return b.totalPenaltyDays - a.totalPenaltyDays;
    });
}
