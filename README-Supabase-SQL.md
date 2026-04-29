# Supabase 初始化 SQL（可直接复制）

将以下 SQL 整段复制到 Supabase 的 SQL Editor 执行即可。  
该脚本使用了 `if not exists` 和 `on conflict do nothing`，可以重复执行。

```sql
-- =========================
-- 值日系统完整初始化 SQL（可重复执行）
-- =========================

-- 1) 小组表
create table if not exists public.groups (
  id text primary key,
  name text not null,
  created_at timestamptz default now()
);

-- 2) 成员表
create table if not exists public.members (
  id text primary key,
  name text not null,
  group_id text not null references public.groups(id) on delete cascade,
  created_at timestamptz default now()
);

-- 3) 管理员表
create table if not exists public.admins (
  id uuid primary key default gen_random_uuid(),
  username text not null unique,
  password text not null,
  is_root boolean not null default false,
  is_disabled boolean not null default false,
  created_at timestamptz default now()
);

-- 4) 考勤记录表
create table if not exists public.attendance_records (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  member_id text not null,
  status text not null,
  score integer not null default 0,
  penalty_days integer not null default 0,
  is_substituted boolean not null default false,
  substituted_by text,
  is_exchanged boolean not null default false,
  exchanged_with text,
  is_important_event boolean not null default false,
  is_group_absent boolean not null default false,
  is_compensation boolean not null default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create unique index if not exists attendance_member_date_idx
  on public.attendance_records(member_id, date);

-- 5) 排班覆盖表
create table if not exists public.schedule_overrides (
  id uuid primary key default gen_random_uuid(),
  week_start date not null unique,
  group_id text not null references public.groups(id),
  created_at timestamptz default now()
);

-- 6) 额外值日表
create table if not exists public.extra_duties (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  member_id text not null references public.members(id),
  reason text,
  created_at timestamptz default now()
);

-- 6.1) 每日值日成员覆盖表（支持按日期自由增减人员）
create table if not exists public.daily_duty_members (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  member_id text not null references public.members(id) on delete cascade,
  created_at timestamptz default now()
);

create unique index if not exists daily_duty_members_date_member_idx
  on public.daily_duty_members(date, member_id);

-- 7) 代值/还值关系表
create table if not exists public.substitution_records (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  original_member_id text not null references public.members(id),
  substitute_member_id text not null references public.members(id),
  is_return boolean not null default false,
  note text,
  created_at timestamptz default now()
);

create unique index if not exists substitution_records_unique_idx
  on public.substitution_records(date, original_member_id, substitute_member_id, is_return);

-- 8) 管理员操作日志表
create table if not exists public.admin_operation_logs (
  id uuid primary key default gen_random_uuid(),
  operator_username text not null,
  action text not null,
  target text,
  detail jsonb,
  created_at timestamptz default now()
);

-- 9) 种子：8 组
insert into public.groups (id, name)
values
  ('group-1','小组1'),('group-2','小组2'),('group-3','小组3'),('group-4','小组4'),
  ('group-5','小组5'),('group-6','小组6'),('group-7','小组7'),('group-8','小组8')
on conflict (id) do nothing;

-- 10) 种子：24 人
insert into public.members (id, name, group_id)
values
  ('member-1-1','成员1-1','group-1'),('member-1-2','成员1-2','group-1'),('member-1-3','成员1-3','group-1'),
  ('member-2-1','成员2-1','group-2'),('member-2-2','成员2-2','group-2'),('member-2-3','成员2-3','group-2'),
  ('member-3-1','成员3-1','group-3'),('member-3-2','成员3-2','group-3'),('member-3-3','成员3-3','group-3'),
  ('member-4-1','成员4-1','group-4'),('member-4-2','成员4-2','group-4'),('member-4-3','成员4-3','group-4'),
  ('member-5-1','成员5-1','group-5'),('member-5-2','成员5-2','group-5'),('member-5-3','成员5-3','group-5'),
  ('member-6-1','成员6-1','group-6'),('member-6-2','成员6-2','group-6'),('member-6-3','成员6-3','group-6'),
  ('member-7-1','成员7-1','group-7'),('member-7-2','成员7-2','group-7'),('member-7-3','成员7-3','group-7'),
  ('member-8-1','成员8-1','group-8'),('member-8-2','成员8-2','group-8'),('member-8-3','成员8-3','group-8')
on conflict (id) do nothing;

-- 11) 默认管理员
insert into public.admins (username, password, is_root)
values ('ZRWY', 'goodday', true)
on conflict (username) do nothing;
```
