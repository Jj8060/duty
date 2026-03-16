-- 值日排班系统 - Supabase 表结构（在 SQL Editor 中执行）
-- 若已创建 attendance_records，可只执行 groups / members / admins 部分

-- 1. 小组表
create table if not exists public.groups (
  id text primary key,
  name text not null,
  created_at timestamptz default now()
);

-- 2. 成员表（归属某组）
create table if not exists public.members (
  id text primary key,
  name text not null,
  group_id text not null references public.groups(id) on delete cascade,
  created_at timestamptz default now()
);

-- 3. 考勤记录表（若尚未创建）
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

-- 4. 排班覆盖表（手动调整某周的值日组）
create table if not exists public.schedule_overrides (
  id uuid primary key default gen_random_uuid(),
  week_start date not null unique,
  group_id text not null references public.groups(id),
  created_at timestamptz default now()
);

-- 5. 管理员表
create table if not exists public.admins (
  id uuid primary key default gen_random_uuid(),
  username text not null unique,
  password text not null,
  is_root boolean not null default false,
  is_disabled boolean not null default false,
  created_at timestamptz default now()
);

-- 5.1 管理员操作日志（框架）
create table if not exists public.admin_operation_logs (
  id uuid primary key default gen_random_uuid(),
  operator_username text not null,
  action text not null,
  target text,
  detail jsonb,
  created_at timestamptz default now()
);

-- 5.2 额外值日人员（框架）
create table if not exists public.extra_duties (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  member_id text not null references public.members(id),
  reason text,
  created_at timestamptz default now()
);

-- 5.3 代值/还值关系（框架）
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

-- 6. 种子数据：默认 8 组、每组 3 人（仅当表为空时执行）
insert into public.groups (id, name)
select * from (values
  ('group-1','小组1'),('group-2','小组2'),('group-3','小组3'),('group-4','小组4'),
  ('group-5','小组5'),('group-6','小组6'),('group-7','小组7'),('group-8','小组8')
) as t(id, name)
on conflict (id) do nothing;

insert into public.members (id, name, group_id)
select * from (values
  ('member-1-1','成员1-1','group-1'),('member-1-2','成员1-2','group-1'),('member-1-3','成员1-3','group-1'),
  ('member-2-1','成员2-1','group-2'),('member-2-2','成员2-2','group-2'),('member-2-3','成员2-3','group-2'),
  ('member-3-1','成员3-1','group-3'),('member-3-2','成员3-2','group-3'),('member-3-3','成员3-3','group-3'),
  ('member-4-1','成员4-1','group-4'),('member-4-2','成员4-2','group-4'),('member-4-3','成员4-3','group-4'),
  ('member-5-1','成员5-1','group-5'),('member-5-2','成员5-2','group-5'),('member-5-3','成员5-3','group-5'),
  ('member-6-1','成员6-1','group-6'),('member-6-2','成员6-2','group-6'),('member-6-3','成员6-3','group-6'),
  ('member-7-1','成员7-1','group-7'),('member-7-2','成员7-2','group-7'),('member-7-3','成员7-3','group-7'),
  ('member-8-1','成员8-1','group-8'),('member-8-2','成员8-2','group-8'),('member-8-3','成员8-3','group-8')
) as t(id, name, group_id)
on conflict (id) do nothing;

-- 7. 默认终端管理员（策划书：ZRWY / goodday）
insert into public.admins (username, password, is_root)
values ('ZRWY', 'goodday', true)
on conflict (username) do nothing;
