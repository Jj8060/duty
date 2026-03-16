import type { AttendanceStatusCode } from "./types";

export function getDefaultScoreByStatus(status: AttendanceStatusCode): number {
  switch (status) {
    case "perfect":
      return 4;
    case "present":
      return 3;
    case "improve":
      return 2;
    case "fail":
      return 1;
    case "absent":
      return 0;
    case "pending":
    default:
      return 0;
  }
}

export function getDefaultPenaltyByStatus(status: AttendanceStatusCode): number {
  switch (status) {
    case "absent":
    case "fail":
      return 1;
    default:
      return 0;
  }
}

export function isFriday(dateStr: string): boolean {
  const d = new Date(`${dateStr}T00:00:00`);
  return d.getDay() === 5;
}

export function applyPenaltyRules(params: {
  date: string;
  status: AttendanceStatusCode;
  penaltyDays: number;
  isImportantEvent?: boolean;
}): number {
  if (params.isImportantEvent) return 0;
  let penalty = Math.max(0, params.penaltyDays);
  if ((params.status === "absent" || params.status === "fail") && isFriday(params.date)) {
    penalty += 1;
  }
  return penalty;
}
