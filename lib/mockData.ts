import { addDays, getWeek, startOfWeek } from "date-fns";
import type { Group, Member } from "./types";

/** 获取某年的总周数
 *  注意：某些年份的 12月28-31 日属于下一年第1周（例如 2026 年）
 *  此时 getWeek(dec31) 会返回 1，需退而检查 12月24 日，
 *  该日期永远处于当年最后几周内（周1系统下最早的"第1周"起点为12月26日）。
 */
export function getWeeksInYear(year: number): number {
  const dec31 = new Date(year, 11, 31);
  const w = getWeek(dec31, { weekStartsOn: 1 });
  if (w === 1) {
    return getWeek(new Date(year, 11, 24), { weekStartsOn: 1 });
  }
  return w;
}

/** 根据年份和周数得到该周周一日期 */
export function getDateFromYearWeek(year: number, week: number): Date {
  const jan4 = new Date(year, 0, 4); // ISO 周：1月4日所在周为第1周
  const jan4WeekStart = startOfWeek(jan4, { weekStartsOn: 1 });
  const targetMonday = addDays(jan4WeekStart, (week - 1) * 7);
  return targetMonday;
}

export function createDefaultGroups(): Group[] {
  const groups: Group[] = [];
  for (let g = 1; g <= 8; g += 1) {
    const groupId = `group-${g}`;
    const members: Member[] = [];
    for (let i = 1; i <= 3; i += 1) {
      members.push({
        id: `member-${g}-${i}`,
        name: `成员${g}-${i}`,
        groupId
      });
    }
    groups.push({
      id: groupId,
      name: `小组${g}`,
      members
    });
  }
  return groups;
}

export function getDefaultGroupForWeek(
  baseDate: Date,
  groups: Group[]
): Group {
  if (groups.length === 0) {
    return createDefaultGroups()[0];
  }
  // 以周一为一周起点
  const weekStart = startOfWeek(baseDate, { weekStartsOn: 1 });
  const epoch = new Date(2026, 1, 24); // 接近 2 月 28 日的一个周一
  const diffDays = Math.floor(
    (weekStart.getTime() - epoch.getTime()) / (1000 * 60 * 60 * 24)
  );
  const diffWeeks = Math.floor(diffDays / 7);
  const index = ((diffWeeks % groups.length) + groups.length) % groups.length;
  return groups[index];
}

export function getWeekDays(weekDate: Date): Date[] {
  const start = startOfWeek(weekDate, { weekStartsOn: 1 });
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

