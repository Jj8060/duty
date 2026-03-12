import { addDays, startOfWeek } from "date-fns";
import type { Group, Member } from "./types";

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
    throw new Error("groups 不能为空");
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

