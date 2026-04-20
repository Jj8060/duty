# 项目协作修改与部署指南（Cursor + Supabase + Vercel）

本文档给后来维护者使用，目标是让别人可以快速：

1. 用 Cursor 找到并修改本项目代码
2. 用 Python 把数据上传到 Supabase
3. 完成 Supabase 连接与初始化
4. 在 Vercel 部署并绑定 Supabase

---

## 0. 先准备什么

- Node.js 18+（推荐 LTS）
- Python 3.10+（用于数据导入）
- Supabase 账号
- Vercel 账号
- Cursor（建议最新版）

项目环境变量在 `.env.example` 里定义：

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

项目 Supabase 客户端读取位置：`lib/supabaseClient.ts`。

---

## 1. 其他人如何用 Cursor 修改你的代码

### 1.1 推荐流程（给协作者）

1. 打开项目根目录
2. 打开 `功能策划书.md`，先改需求文档
3. 在 Cursor 对话框里明确说：  
   - 改了什么规则  
   - 希望改哪些行为  
   - 要不要同步数据库字段/SQL
4. 让 Cursor 搜索并修改对应文件
5. 本地运行测试后再提交
6. 如果可能尽量阅读每一条信息，部分信息例如时间轴，可能在本文档建立几年后失效，需要注意。


建议给 Cursor 的标准提示词：

```text
我已更新《功能策划书》中的某项规则，请你：
1) 找出相关实现代码；
2) 修改逻辑与文案；
3) 检查是否需要改数据库字段或 SQL；
4) 给出我需要验证的测试步骤。
```

### 1.2 示例：修改“惩罚机制”后，如何让 Cursor 找到对应代码并修改

本项目里，惩罚相关核心实现主要在：

- `lib/attendanceRules.ts`（默认惩罚与周五额外惩罚）
- `lib/storage.ts`（`penalty_days` 持久化到 Supabase）
- `pages/index.tsx`、`components/WeekListView.tsx`、`components/MonthCalendarView.tsx`（前端展示/录入逻辑）
- `lib/statistics.ts`、`pages/statistics.tsx`（统计显示）

你可以直接在 Cursor 里输入：

```text
我刚修改了《功能策划书》的惩罚机制：缺勤第1次1天，第2次及以后每次+2天；周五缺勤额外+1天。
请你在当前项目中定位惩罚逻辑并完成代码改造，同时更新受影响的统计与展示。
最后列出你改了哪些文件、如何验证。
```

如果你习惯先人工定位，再让 Cursor 改，也可以先搜索关键词：

- `penalty`
- `penalty_days`
- `applyPenaltyRules`
- `惩罚`

---

## 2. Supabase 链接信息与初始化教程

### 2.1 你需要的 Supabase 关键链接

创建 Supabase 项目后，常用链接如下：

- Dashboard: `https://supabase.com/dashboard/project/<你的project-ref>`
- SQL Editor: `https://supabase.com/dashboard/project/<你的project-ref>/sql/new`
- API 设置页（拿 URL 和 anon key）：  
  `https://supabase.com/dashboard/project/<你的project-ref>/settings/api`

### 2.2 本项目如何连接 Supabase

1. 复制环境变量模板：

```bash
cp .env.example .env.local
```

2. 在 `.env.local` 填入：

```env
NEXT_PUBLIC_SUPABASE_URL=https://<你的project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<你的anon_key>
```

3. 启动项目：

```bash
npm install
npm run dev
```

> 如果环境变量缺失，`lib/supabaseClient.ts` 会输出警告。

### 2.3 把 SQL 输入 Supabase 并完成数据库连接（你给的示例场景）

你可以让协作者按以下步骤操作：

1. 打开 SQL Editor  
2. 复制 `README-Supabase-SQL.md` 或 `supabase-schema.sql` 中的 SQL  
3. 一次性执行（该 SQL 使用 `if not exists`/`on conflict`，可重复执行）  
4. 回到页面操作一次考勤写入，确认 `attendance_records` 有数据

可直接给协作者的说明话术：

```text
请打开 Supabase 的 SQL Editor，把项目里的 supabase-schema.sql 全部粘贴进去并执行。
执行成功后，配置 .env.local 的 NEXT_PUBLIC_SUPABASE_URL 和 NEXT_PUBLIC_SUPABASE_ANON_KEY，
再运行 npm run dev，页面有写入行为时就会连接到 Supabase。
```

---

## 3. Python 上传教程（把数据导入 Supabase）

下面是最小可用教程，适合“批量导入成员/考勤”。

### 3.1 安装依赖

```bash
pip install supabase python-dotenv
```

### 3.2 创建 Python 环境变量（建议）

新建 `.env.python`：

```env
SUPABASE_URL=https://<你的project-ref>.supabase.co
SUPABASE_ANON_KEY=<你的anon_key>
```

### 3.3.1 示例脚本：上传成员数据

新建 `scripts/upload_members.py`：

```python
from dotenv import dotenv_values
from supabase import create_client

cfg = dotenv_values(".env.python")
url = cfg["SUPABASE_URL"]
key = cfg["SUPABASE_ANON_KEY"]

supabase = create_client(url, key)

rows = [
    {"id": "member-9-1", "name": "成员9-1", "group_id": "group-1"},
    {"id": "member-9-2", "name": "成员9-2", "group_id": "group-1"},
]

res = supabase.table("members").upsert(rows).execute()
print("上传完成：", len(res.data) if res.data else 0)
```

运行：

```bash
python scripts/upload_members.py
```

#3.3.2 上传成功后，后续上传代码：
git add .
git commit-m "你的名称"
git push origin main




### 3.4 常见报错排查

- `Invalid API key`：`SUPABASE_ANON_KEY` 填错
- `relation "members" does not exist`：未先执行 SQL 初始化
- `violates foreign key constraint`：`group_id` 在 `groups` 表不存在

---

## 4. Supabase + Vercel 建站信息与教程

### 4.1 在 Vercel 必填的环境变量

在 Vercel 项目设置里添加：

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

值与本地 `.env.local` 保持一致。

### 4.2 部署步骤（Next.js 项目）

1. 把代码推到 GitHub
2. Vercel 导入该仓库
3. Framework 选择 Next.js（通常自动识别）
4. 在 Project Settings -> Environment Variables 填入上述两个变量
5. 点击 Deploy
6. 部署后打开网站，验证页面是否能读写 Supabase

### 4.3 发布后验证清单

- 页面可正常加载（无 500）
- 管理员登录/查询正常
- 新增或修改考勤后，Supabase `attendance_records` 有变化
- 统计页与数据库数据一致

---

PS:注意，当一段时间没有打开过网站之后，需要resume，甚至更长时间后需要重新部署，所以请有规律的登录以及修改信息。

## 5. 给协作者的“标准修改模板”

可复制下面模板，让协作者和 Cursor 配合更稳定：

```text
【需求来源】
我刚更新了 功能策划书.md 的 xx 章节（例如惩罚机制）。

【你要做的事】
1) 找出当前代码中对应实现位置；
2) 按新规则修改；
3) 若涉及 Supabase 字段/SQL，请同步调整；
4) 列出修改文件；
5) 给出本地验证步骤。

【项目约束】
- 不要破坏现有管理员权限逻辑；
- 保持 TypeScript 类型正确；
- 保持 Supabase 字段命名与现有表结构一致（如 penalty_days）。
```

---

## 6. 本项目关键文件速查（给新维护者）

- 需求文档：`功能策划书.md`
- Supabase SQL：`supabase-schema.sql`
- SQL 说明：`README-Supabase-SQL.md`
- Supabase 客户端：`lib/supabaseClient.ts`
- 存储驱动与表读写：`lib/storage.ts`
- 惩罚规则核心：`lib/attendanceRules.ts`
- 首页：`pages/index.tsx`
- 统计页：`pages/statistics.tsx`

---

