"use client";

import { useEffect, useState } from "react";
import { driver } from "../lib/appData";
import type { Group, Member } from "../lib/types";

export function GroupsManagement() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [saving, setSaving] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    void driver.getGroups().then(setGroups).catch(() => setGroups([]));
  }, []);

  const saveGroupName = async (id: string, name: string) => {
    if (!driver.updateGroupName) return;
    setSaving(id);
    setMsg(null);
    try {
      await driver.updateGroupName(id, name);
      setGroups((prev) =>
        prev.map((g) => (g.id === id ? { ...g, name } : g))
      );
      setMsg("小组名称已保存");
    } catch (e) {
      setMsg(String(e));
    } finally {
      setSaving(null);
    }
  };

  const saveMemberName = async (id: string, name: string) => {
    if (!driver.updateMemberName) return;
    setSaving(id);
    setMsg(null);
    try {
      await driver.updateMemberName(id, name);
      setGroups((prev) =>
        prev.map((g) => ({
          ...g,
          members: g.members.map((m) =>
            m.id === id ? { ...m, name } : m
          )
        }))
      );
      setMsg("成员名称已保存");
    } catch (e) {
      setMsg(String(e));
    } finally {
      setSaving(null);
    }
  };

  if (!driver.isReady()) {
    return (
      <p className="text-sm text-gray-500">
        值日组与成员名称编辑需要连接 Supabase，请在 .env.local 中配置后使用。
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-gray-500">
        在此修改小组名称和成员姓名，修改后会在首页排班、统计等页面生效。
      </p>
      {msg && (
        <p className={`text-xs ${msg.includes("已保存") ? "text-green-600" : "text-red-600"}`}>
          {msg}
        </p>
      )}
      <div className="space-y-4">
        {groups.map((g) => (
          <div key={g.id} className="card p-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xs text-gray-500">小组名称：</span>
              <input
                className="flex-1 max-w-[120px] rounded border border-gray-300 px-2 py-1 text-sm"
                defaultValue={g.name}
                onBlur={(e) => {
                  const v = e.target.value.trim();
                  if (v && v !== g.name) void saveGroupName(g.id, v);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    const v = (e.target as HTMLInputElement).value.trim();
                    if (v && v !== g.name) void saveGroupName(g.id, v);
                  }
                }}
              />
              {saving === g.id && (
                <span className="text-xs text-gray-400">保存中…</span>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {g.members.map((m) => (
                <div key={m.id} className="flex items-center gap-1">
                  <span className="text-xs text-gray-400">成员：</span>
                  <input
                    className="w-20 rounded border border-gray-300 px-2 py-1 text-xs"
                    defaultValue={m.name}
                    onBlur={(e) => {
                      const v = e.target.value.trim();
                      if (v && v !== m.name) void saveMemberName(m.id, v);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        const v = (e.target as HTMLInputElement).value.trim();
                        if (v && v !== m.name) void saveMemberName(m.id, v);
                      }
                    }}
                  />
                  {saving === m.id && (
                    <span className="text-[10px] text-gray-400">保存中</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
