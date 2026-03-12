export default function AdminManagementPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-6 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">管理员管理</h1>
          <p className="mt-1 text-sm text-gray-500">
            终端管理员可以在此添加/禁用管理员账号，并查看管理员操作日志（当前为结构占位，后续接入 Supabase）。
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-[2fr,3fr]">
        <section className="card p-4 space-y-3">
          <h2 className="text-sm font-semibold">添加新管理员</h2>
          <div className="space-y-2 text-xs">
            <div>
              <label className="mb-1 block text-gray-600">账户名称</label>
              <input
                className="w-full rounded-md border border-gray-300 px-2 py-1 text-xs"
                placeholder="例如：admin01"
              />
            </div>
            <div>
              <label className="mb-1 block text-gray-600">密码</label>
              <input
                type="password"
                className="w-full rounded-md border border-gray-300 px-2 py-1 text-xs"
                placeholder="请输入初始密码"
              />
            </div>
            <div className="flex justify-end pt-1">
              <button className="btn-primary text-xs">
                添加（占位，后续接入 Supabase）
              </button>
            </div>
          </div>
        </section>

        <section className="card p-4 space-y-3">
          <h2 className="text-sm font-semibold">管理员列表（示意）</h2>
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
                <tr>
                  <td className="px-3 py-2 text-xs text-gray-700">ZRWY</td>
                  <td className="px-3 py-2 text-xs text-gray-700">
                    终端管理员
                  </td>
                  <td className="px-3 py-2 text-xs text-green-600">启用</td>
                  <td className="px-3 py-2 text-xs text-gray-400">
                    不可禁用
                  </td>
                </tr>
                <tr>
                  <td className="px-3 py-2 text-xs text-gray-700">admin01</td>
                  <td className="px-3 py-2 text-xs text-gray-700">
                    普通管理员
                  </td>
                  <td className="px-3 py-2 text-xs text-gray-600">启用</td>
                  <td className="px-3 py-2 text-xs">
                    <button className="btn-outline text-xs">
                      禁用（占位）
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}

