import { useEffect, useState } from "react";
import { GroupsManagement } from "../components/GroupsManagement";
import { LoginModal } from "../components/LoginModal";
import { driver } from "../lib/appData";
import { useAuth } from "../lib/AuthContext";

export default function AdminManagementPage() {
  const { admin, logout } = useAuth();
  const [showLogin, setShowLogin] = useState(false);
  const [rows, setRows] = useState<
    {
      id: string;
      username: string;
      isRoot: boolean;
      isDisabled: boolean;
      createdAt?: string;
    }[]
  >([]);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const loadAdmins = async () => {
    if (!driver.listAdmins) return;
    try {
      const data = await driver.listAdmins();
      setRows(data);
    } catch (e) {
      setMsg(`加载管理员失败：${String(e)}`);
    }
  };

  useEffect(() => {
    if (!admin) return;
    void loadAdmins();
  }, [admin]);

  const createAdmin = async () => {
    if (!driver.createAdmin || !admin?.isRoot) return;
    const u = username.trim();
    const p = password.trim();
    if (!u || !p) {
      setMsg("请输入账户名称和密码");
      return;
    }
    setLoading(true);
    setMsg(null);
    try {
      await driver.createAdmin({ username: u, password: p, isRoot: false });
      setUsername("");
      setPassword("");
      setMsg("管理员已添加");
      await loadAdmins();
    } catch (e) {
      setMsg(`添加失败：${String(e)}`);
    } finally {
      setLoading(false);
    }
  };

  const toggleAdmin = async (id: string, disabled: boolean) => {
    if (!driver.setAdminDisabled || !admin?.isRoot) return;
    setLoading(true);
    setMsg(null);
    try {
      await driver.setAdminDisabled(id, disabled);
      setMsg(disabled ? "管理员已禁用" : "管理员已启用");
      await loadAdmins();
    } catch (e) {
      setMsg(`操作失败：${String(e)}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">管理员管理</h1>
          <p className="mt-1 text-sm text-gray-500">
            终端管理员可以在此添加/禁用管理员账号，管理值日组与成员名称。
          </p>
        </div>
        {admin ? (
          <div className="text-xs text-gray-600">
            已登录：{admin.username}
            <button
              type="button"
              className="ml-2 text-primary hover:underline"
              onClick={logout}
            >
              退出
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="btn-primary text-xs"
            onClick={() => setShowLogin(true)}
          >
            管理员登录
          </button>
        )}
      </div>

      {!admin ? (
        <section className="card p-6 text-sm text-gray-500">
          管理员管理页仅登录后可用，请先登录。
        </section>
      ) : (
        <>
      <section className="card p-4">
        <h2 className="text-sm font-semibold mb-3">值日组与成员名称</h2>
        <GroupsManagement />
      </section>

      <div className="grid gap-4 md:grid-cols-[2fr,3fr]">
        <section className="card p-4 space-y-3">
          <h2 className="text-sm font-semibold">添加新管理员</h2>
          <div className="space-y-2 text-xs">
            <div>
              <label className="mb-1 block text-gray-600">账户名称</label>
              <input
                className="w-full rounded-md border border-gray-300 px-2 py-1 text-xs"
                placeholder="例如：admin01"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={!admin.isRoot || loading}
              />
            </div>
            <div>
              <label className="mb-1 block text-gray-600">密码</label>
              <input
                type="password"
                className="w-full rounded-md border border-gray-300 px-2 py-1 text-xs"
                placeholder="请输入初始密码"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={!admin.isRoot || loading}
              />
            </div>
            {msg && (
              <p className={`text-xs ${msg.includes("失败") ? "text-red-600" : "text-green-600"}`}>
                {msg}
              </p>
            )}
            <div className="flex justify-end pt-1">
              <button
                className="btn-primary text-xs disabled:opacity-50"
                disabled={!admin.isRoot || loading}
                onClick={() => void createAdmin()}
              >
                {loading ? "提交中…" : "添加管理员"}
              </button>
            </div>
            {!admin.isRoot && (
              <p className="text-[11px] text-gray-400">仅终端管理员可添加管理员</p>
            )}
          </div>
        </section>

        <section className="card p-4 space-y-3">
          <h2 className="text-sm font-semibold">管理员列表</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-xs">
              <thead className="bg-gray-50 text-gray-600">
                <tr>
                  <th className="px-3 py-2">账号</th>
                  <th className="px-3 py-2">角色</th>
                  <th className="px-3 py-2">状态</th>
                  <th className="px-3 py-2">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y bg-white">
                {rows.map((row) => (
                  <tr key={row.id}>
                    <td className="px-3 py-2 text-xs text-gray-700">{row.username}</td>
                    <td className="px-3 py-2 text-xs text-gray-700">
                      {row.isRoot ? "终端管理员" : "普通管理员"}
                    </td>
                    <td
                      className={`px-3 py-2 text-xs ${
                        row.isDisabled ? "text-gray-500" : "text-green-600"
                      }`}
                    >
                      {row.isDisabled ? "禁用" : "启用"}
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {row.isRoot ? (
                        <span className="text-gray-400">不可禁用</span>
                      ) : (
                        <button
                          className="btn-outline text-xs disabled:opacity-50"
                          disabled={!admin.isRoot || loading}
                          onClick={() => void toggleAdmin(row.id, !row.isDisabled)}
                        >
                          {row.isDisabled ? "启用" : "禁用"}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
        </>
      )}

      {showLogin && <LoginModal onClose={() => setShowLogin(false)} />}
    </div>
  );
}

