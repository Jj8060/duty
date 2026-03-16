import type { AttendanceRecord, ExtraDuty, Group } from "./types";
import { supabase } from "./supabaseClient";
import { createDefaultGroups } from "./mockData";

export interface StorageDriver {
  isReady(): boolean;

  getGroups(): Promise<Group[]>;

  getScheduleOverrides?(): Promise<Record<string, string>>;
  upsertScheduleOverride?(weekStart: string, groupId: string): Promise<void>;
  deleteScheduleOverride?(weekStart: string): Promise<void>;

  updateGroupName?(id: string, name: string): Promise<void>;
  updateMemberName?(id: string, name: string): Promise<void>;
  listAdmins?(): Promise<
    {
      id: string;
      username: string;
      isRoot: boolean;
      isDisabled: boolean;
      createdAt?: string;
    }[]
  >;
  createAdmin?(params: {
    username: string;
    password: string;
    isRoot?: boolean;
  }): Promise<void>;
  setAdminDisabled?(id: string, disabled: boolean): Promise<void>;

  listExtraDuties?(params?: {
    fromDate?: string;
    toDate?: string;
  }): Promise<ExtraDuty[]>;
  upsertExtraDuty?(data: Omit<ExtraDuty, "id" | "createdAt"> & { id?: string }): Promise<ExtraDuty>;
  deleteExtraDuty?(id: string): Promise<void>;

  upsertAttendanceRecord(
    record: Omit<AttendanceRecord, "id"> & { id?: string }
  ): Promise<AttendanceRecord>;

  listAttendanceRecords(params?: {
    fromDate?: string; // yyyy-MM-dd
    toDate?: string; // yyyy-MM-dd
  }): Promise<AttendanceRecord[]>;

  deleteAttendanceRecordsByDateAndMembers?(
    date: string,
    memberIds: string[]
  ): Promise<void>;
  deleteAttendanceRecord?(id: string): Promise<void>;
}

export class MemoryDriver implements StorageDriver {
  private groups: Group[];
  private attendance: AttendanceRecord[] = [];
  private extraDuties: ExtraDuty[] = [];
  private admins: {
    id: string;
    username: string;
    password: string;
    isRoot: boolean;
    isDisabled: boolean;
    createdAt: string;
  }[] = [
    {
      id: "admin-root-1",
      username: "ZRWY",
      password: "goodday",
      isRoot: true,
      isDisabled: false,
      createdAt: new Date().toISOString()
    }
  ];

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

  private overrides: Record<string, string> = {};

  async getScheduleOverrides(): Promise<Record<string, string>> {
    return { ...this.overrides };
  }

  async upsertScheduleOverride(weekStart: string, groupId: string): Promise<void> {
    this.overrides[weekStart] = groupId;
  }

  async deleteScheduleOverride(weekStart: string): Promise<void> {
    delete this.overrides[weekStart];
  }

  async deleteAttendanceRecordsByDateAndMembers(
    date: string,
    memberIds: string[]
  ): Promise<void> {
    const ids = new Set(memberIds);
    this.attendance = this.attendance.filter(
      (r) => !(r.date === date && ids.has(r.memberId))
    );
  }

  async deleteAttendanceRecord(id: string): Promise<void> {
    this.attendance = this.attendance.filter((r) => r.id !== id);
  }

  async listAdmins(): Promise<
    {
      id: string;
      username: string;
      isRoot: boolean;
      isDisabled: boolean;
      createdAt?: string;
    }[]
  > {
    return this.admins.map((a) => ({
      id: a.id,
      username: a.username,
      isRoot: a.isRoot,
      isDisabled: a.isDisabled,
      createdAt: a.createdAt
    }));
  }

  async createAdmin(params: {
    username: string;
    password: string;
    isRoot?: boolean;
  }): Promise<void> {
    const exists = this.admins.some((a) => a.username === params.username);
    if (exists) throw new Error("管理员账号已存在");
    this.admins.push({
      id: `admin-${Date.now()}`,
      username: params.username,
      password: params.password,
      isRoot: Boolean(params.isRoot),
      isDisabled: false,
      createdAt: new Date().toISOString()
    });
  }

  async setAdminDisabled(id: string, disabled: boolean): Promise<void> {
    this.admins = this.admins.map((a) =>
      a.id === id ? { ...a, isDisabled: disabled } : a
    );
  }

  async listExtraDuties(params?: {
    fromDate?: string;
    toDate?: string;
  }): Promise<ExtraDuty[]> {
    return this.extraDuties.filter((d) => {
      if (params?.fromDate && d.date < params.fromDate) return false;
      if (params?.toDate && d.date > params.toDate) return false;
      return true;
    });
  }

  async upsertExtraDuty(
    data: Omit<ExtraDuty, "id" | "createdAt"> & { id?: string }
  ): Promise<ExtraDuty> {
    const id = data.id ?? `extra-${Date.now()}`;
    const existing = this.extraDuties.findIndex((d) => d.id === id);
    const full: ExtraDuty = {
      id,
      date: data.date,
      memberId: data.memberId,
      reason: data.reason ?? null,
      createdAt: new Date().toISOString()
    };
    if (existing >= 0) {
      this.extraDuties[existing] = full;
    } else {
      this.extraDuties.push(full);
    }
    return full;
  }

  async deleteExtraDuty(id: string): Promise<void> {
    this.extraDuties = this.extraDuties.filter((d) => d.id !== id);
  }
}

export class SupabaseDriver implements StorageDriver {
  isReady() {
    return Boolean(
      process.env.NEXT_PUBLIC_SUPABASE_URL &&
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    );
  }

  async getScheduleOverrides(): Promise<Record<string, string>> {
    const { data, error } = await supabase
      .from("schedule_overrides")
      .select("week_start, group_id");
    if (error) return {};
    const out: Record<string, string> = {};
    for (const r of data ?? []) {
      out[String(r.week_start)] = r.group_id;
    }
    return out;
  }

  async upsertScheduleOverride(weekStart: string, groupId: string): Promise<void> {
    const { error } = await supabase
      .from("schedule_overrides")
      .upsert({ week_start: weekStart, group_id: groupId }, { onConflict: "week_start" });
    if (error) throw new Error(error.message);
  }

  async deleteScheduleOverride(weekStart: string): Promise<void> {
    const { error } = await supabase
      .from("schedule_overrides")
      .delete()
      .eq("week_start", weekStart);
    if (error) throw new Error(error.message);
  }

  async updateGroupName(id: string, name: string): Promise<void> {
    const { error } = await supabase.from("groups").update({ name }).eq("id", id);
    if (error) throw new Error(error.message);
  }

  async updateMemberName(id: string, name: string): Promise<void> {
    const { error } = await supabase.from("members").update({ name }).eq("id", id);
    if (error) throw new Error(error.message);
  }

  async getGroups(): Promise<Group[]> {
    const { data: groupsRows, error: ge } = await supabase
      .from("groups")
      .select("id, name")
      .order("id");
    if (ge || !groupsRows?.length) return createDefaultGroups();

    const { data: membersRows, error: me } = await supabase
      .from("members")
      .select("id, name, group_id")
      .order("id");
    if (me || !membersRows?.length) return createDefaultGroups();

    const byGroup = new Map<string, { id: string; name: string; groupId: string }[]>();
    for (const r of membersRows as { id: string; name: string; group_id: string }[]) {
      const list = byGroup.get(r.group_id) ?? [];
      list.push({ id: r.id, name: r.name, groupId: r.group_id });
      byGroup.set(r.group_id, list);
    }
    return groupsRows.map((g: { id: string; name: string }) => ({
      id: g.id,
      name: g.name,
      members: byGroup.get(g.id) ?? []
    }));
  }

  async upsertAttendanceRecord(
    record: Omit<AttendanceRecord, "id"> & { id?: string }
  ): Promise<AttendanceRecord> {
    const payload = {
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
      .upsert(payload, { onConflict: "member_id,date" })
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

  async deleteAttendanceRecordsByDateAndMembers(
    date: string,
    memberIds: string[]
  ): Promise<void> {
    const { error } = await supabase
      .from("attendance_records")
      .delete()
      .eq("date", date)
      .in("member_id", memberIds);
    if (error) throw new Error(error.message);
  }

  async deleteAttendanceRecord(id: string): Promise<void> {
    const { error } = await supabase.from("attendance_records").delete().eq("id", id);
    if (error) throw new Error(error.message);
  }

  async listAdmins(): Promise<
    {
      id: string;
      username: string;
      isRoot: boolean;
      isDisabled: boolean;
      createdAt?: string;
    }[]
  > {
    const { data, error } = await supabase
      .from("admins")
      .select("id, username, is_root, is_disabled, created_at")
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []).map((r: any) => ({
      id: r.id,
      username: r.username,
      isRoot: Boolean(r.is_root),
      isDisabled: Boolean(r.is_disabled),
      createdAt: r.created_at
    }));
  }

  async createAdmin(params: {
    username: string;
    password: string;
    isRoot?: boolean;
  }): Promise<void> {
    const { error } = await supabase.from("admins").insert({
      username: params.username,
      password: params.password,
      is_root: Boolean(params.isRoot),
      is_disabled: false
    });
    if (error) throw new Error(error.message);
  }

  async setAdminDisabled(id: string, disabled: boolean): Promise<void> {
    const { error } = await supabase
      .from("admins")
      .update({ is_disabled: disabled })
      .eq("id", id);
    if (error) throw new Error(error.message);
  }

  async listExtraDuties(params?: {
    fromDate?: string;
    toDate?: string;
  }): Promise<ExtraDuty[]> {
    let q = supabase
      .from("extra_duties")
      .select("id,date,member_id,reason,created_at")
      .order("date", { ascending: false });
    if (params?.fromDate) q = q.gte("date", params.fromDate);
    if (params?.toDate) q = q.lte("date", params.toDate);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return (data ?? []).map((r: any) => ({
      id: r.id,
      date: r.date,
      memberId: r.member_id,
      reason: r.reason,
      createdAt: r.created_at
    }));
  }

  async upsertExtraDuty(
    data: Omit<ExtraDuty, "id" | "createdAt"> & { id?: string }
  ): Promise<ExtraDuty> {
    const payload = {
      id: data.id,
      date: data.date,
      member_id: data.memberId,
      reason: data.reason ?? null
    };
    const { data: row, error } = await supabase
      .from("extra_duties")
      .upsert(payload)
      .select("id,date,member_id,reason,created_at")
      .single();
    if (error || !row) throw new Error(error?.message ?? "保存额外值日失败");
    return {
      id: row.id,
      date: row.date,
      memberId: row.member_id,
      reason: row.reason,
      createdAt: row.created_at
    };
  }

  async deleteExtraDuty(id: string): Promise<void> {
    const { error } = await supabase.from("extra_duties").delete().eq("id", id);
    if (error) throw new Error(error.message);
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

