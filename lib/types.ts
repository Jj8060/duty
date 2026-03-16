export type AttendanceStatusCode =
  | "present"
  | "absent"
  | "fail"
  | "improve"
  | "pending"
  | "perfect";

export interface Member {
  id: string; // member-1-1
  name: string;
  groupId: string; // group-1
}

export interface Group {
  id: string; // group-1
  name: string; // 小组1
  members: Member[];
}

export interface AttendanceRecord {
  id: string;
  date: string; // ISO 日期，yyyy-MM-dd
  memberId: string;
  status: AttendanceStatusCode;
  score: number; // 0-4
  penaltyDays: number;
  isSubstituted?: boolean;
  substitutedBy?: string | null;
  isExchanged?: boolean;
  exchangedWith?: string | null;
  isImportantEvent?: boolean;
  isGroupAbsent?: boolean;
  isCompensation?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface ExtraDuty {
  id: string;
  date: string; // yyyy-MM-dd
  memberId: string;
  reason?: string | null;
  createdAt?: string;
}

export interface AdminOperationLog {
  id: string;
  operatorUsername: string;
  action: string;
  target?: string | null;
  detail?: Record<string, any> | null;
  createdAt?: string;
}

export interface WeekMeta {
  year: number;
  weekIndex: number;
  startDate: Date;
  endDate: Date;
}

