import type { AttendanceRecord, Group } from "./types";
import { supabase } from "./supabaseClient";
import { createDefaultGroups } from "./mockData";

export interface StorageDriver {
  isReady(): boolean;

  getGroups(): Promise<Group[]>;

  upsertAttendanceRecord(
    record: Omit<AttendanceRecord, "id"> & { id?: string }
  ): Promise<AttendanceRecord>;

  listAttendanceRecords(params?: {
    fromDate?: string; // yyyy-MM-dd
    toDate?: string; // yyyy-MM-dd
  }): Promise<AttendanceRecord[]>;
}

export class MemoryDriver implements StorageDriver {
  private groups: Group[];
  private attendance: AttendanceRecord[] = [];

  constructor(groups: Group[]) {
    this.groups = groups;
  }

  isReady() {
    return true;
  }

  async getGroups(): Promise<Group[]> {
    return this.groups;
  }

  async upsertAttendanceRecord(
    record: Omit<AttendanceRecord, "id"> & { id?: string }
  ): Promise<AttendanceRecord> {
    const id = record.id ?? `${record.memberId}-${record.date}`;
    const now = new Date().toISOString();
    const existingIdx = this.attendance.findIndex((r) => r.id === id);
    const full: AttendanceRecord = {
      ...record,
      id,
      createdAt: record.createdAt ?? now,
      updatedAt: now
    };
    if (existingIdx >= 0) {
      this.attendance[existingIdx] = full;
    } else {
      this.attendance.push(full);
    }
    return full;
  }

  async listAttendanceRecords(params?: {
    fromDate?: string;
    toDate?: string;
  }): Promise<AttendanceRecord[]> {
    const from = params?.fromDate;
    const to = params?.toDate;
    return this.attendance.filter((r) => {
      if (from && r.date < from) return false;
      if (to && r.date > to) return false;
      return true;
    });
  }
}

export class SupabaseDriver implements StorageDriver {
  isReady() {
    return Boolean(
      process.env.NEXT_PUBLIC_SUPABASE_URL &&
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );
  }

  async getGroups(): Promise<Group[]> {
    // 目前 groups 仍由前端默认生成；后续如需可迁移到 Supabase 表
    return createDefaultGroups();
  }

  async upsertAttendanceRecord(
    record: Omit<AttendanceRecord, "id"> & { id?: string }
  ): Promise<AttendanceRecord> {
    // 对应策划书：attendance_records 表
    // 字段映射：memberId -> member_id, penaltyDays -> penalty_days, createdAt/updatedAt -> created_at/updated_at
    const payload = {
      id: record.id,
      date: record.date,
      member_id: record.memberId,
      status: record.status,
      score: record.score,
      penalty_days: record.penaltyDays,
      is_substituted: record.isSubstituted ?? false,
      substituted_by: record.substitutedBy ?? null,
      is_exchanged: record.isExchanged ?? false,
      exchanged_with: record.exchangedWith ?? null,
      is_important_event: record.isImportantEvent ?? false,
      is_group_absent: record.isGroupAbsent ?? false,
      is_compensation: record.isCompensation ?? false
    };

    const { data, error } = await supabase
      .from("attendance_records")
      .upsert(payload)
      .select(
        "id,date,member_id,status,score,penalty_days,is_substituted,substituted_by,is_exchanged,exchanged_with,is_important_event,is_group_absent,is_compensation,created_at,updated_at"
      )
      .single();

    if (error || !data) {
      throw new Error(error?.message ?? "Supabase upsert 失败");
    }

    return {
      id: data.id,
      date: data.date,
      memberId: data.member_id,
      status: data.status,
      score: data.score,
      penaltyDays: data.penalty_days,
      isSubstituted: data.is_substituted,
      substitutedBy: data.substituted_by,
      isExchanged: data.is_exchanged,
      exchangedWith: data.exchanged_with,
      isImportantEvent: data.is_important_event,
      isGroupAbsent: data.is_group_absent,
      isCompensation: data.is_compensation,
      createdAt: data.created_at,
      updatedAt: data.updated_at
    };
  }

  async listAttendanceRecords(params?: {
    fromDate?: string;
    toDate?: string;
  }): Promise<AttendanceRecord[]> {
    let q = supabase
      .from("attendance_records")
      .select(
        "id,date,member_id,status,score,penalty_days,is_substituted,substituted_by,is_exchanged,exchanged_with,is_important_event,is_group_absent,is_compensation,created_at,updated_at"
      );
    if (params?.fromDate) q = q.gte("date", params.fromDate);
    if (params?.toDate) q = q.lte("date", params.toDate);

    const { data, error } = await q;
    if (error) throw new Error(error.message);

    return (data ?? []).map((row: any) => ({
      id: row.id,
      date: row.date,
      memberId: row.member_id,
      status: row.status,
      score: row.score,
      penaltyDays: row.penalty_days,
      isSubstituted: row.is_substituted,
      substitutedBy: row.substituted_by,
      isExchanged: row.is_exchanged,
      exchangedWith: row.exchanged_with,
      isImportantEvent: row.is_important_event,
      isGroupAbsent: row.is_group_absent,
      isCompensation: row.is_compensation,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));
  }
}

