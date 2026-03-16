"use client";

import { useState } from "react";
import { useAuth } from "../lib/AuthContext";

export function LoginModal(props: { onClose: () => void }) {
  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const err = await login(username.trim(), password);
    setLoading(false);
    if (err) {
      setError(err);
      return;
    }
    props.onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="card w-full max-w-sm p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold">管理员登录</h2>
          <button
            type="button"
            className="text-xs text-gray-400 hover:text-gray-600"
            onClick={props.onClose}
          >
            关闭
          </button>
        </div>
        <form className="mt-3 space-y-3 text-xs" onSubmit={handleSubmit}>
          <div>
            <label className="mb-1 block text-gray-600">账户名称</label>
            <input
              className="w-full rounded-md border border-gray-300 px-2 py-1.5"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="例如 ZRWY"
            />
          </div>
          <div>
            <label className="mb-1 block text-gray-600">密码</label>
            <input
              type="password"
              className="w-full rounded-md border border-gray-300 px-2 py-1.5"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="请输入密码"
            />
          </div>
          {error && (
            <p className="text-red-600">{error}</p>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn-outline" onClick={props.onClose}>
              取消
            </button>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? "验证中…" : "登录"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
