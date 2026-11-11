import { useEffect, useState } from "react";
import AdminLayout from "../../components/layout/AdminLayout";
import StatusBadge from "../../components/ui/StatusBadge";
import Pagination from "../../components/ui/Pagination";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import { getUsers, updateUserStatus } from "../../api/userApi";
import { formatDate } from "../../utils/formatDate";
import { RotateCw, Search } from "lucide-react";

export default function UserListPage() {
  const [users, setUsers] = useState([]);
  const [totalAccounts, setTotalAccounts] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [confirmUser, setConfirmUser] = useState(null);

  const fetchUsers = async (p = 1) => {
    setLoading(true);
    try {
      const res = await getUsers({
        page: p,
        limit: 10,
        search,
        role: role === "all" ? "" : role,
        status: status === "all" ? "" : status,
      });
      const data = res.data.data;
      setUsers(data.items || []);
      setPage(data.page);
      setTotalPages(data.total_pages || 1);
      setTotalAccounts(res.data.total_accounts || data.total || 0);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers(1);
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    fetchUsers(1);
  };

  const handleReset = () => {
    setSearch("");
    setRole("");
    setStatus("");
    setTimeout(() => fetchUsers(1), 0);
  };

  const handleToggleStatus = async () => {
    if (!confirmUser) return;
    const newStatus = confirmUser.status === "ACTIVE" ? "LOCKED" : "ACTIVE";
    try {
      await updateUserStatus(confirmUser.id, newStatus);
      setConfirmUser(null);
      fetchUsers(page);
    } catch (err) {
      alert(err.response?.data?.message || "Thao tác thất bại");
    }
  };

  return (
    <AdminLayout title="Không gian quản trị">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Quản lý người dùng</h1>
          <p className="text-sm text-gray-500 mt-1">
            Quản lý tài khoản và trạng thái hoạt động của người dùng.
          </p>
        </div>
        <button
          onClick={handleReset}
          className="btn-secondary flex items-center gap-2 text-sm"
        >
          <RotateCw size={15} className={loading ? "animate-spin" : ""} />
          Làm mới
        </button>
      </div>

      {/* Top mini cards */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="card p-5">
          <p className="text-xs text-gray-400 font-medium mb-1">Tổng tài khoản</p>
          <p className="text-3xl font-bold text-gray-800">{totalAccounts}</p>
        </div>
        <div className="card p-5">
          <p className="text-xs text-gray-400 font-medium mb-1">Trang hiện tại</p>
          <p className="text-3xl font-bold text-gray-800">
            {page} / {totalPages}
          </p>
        </div>
      </div>

      {/* Filter and table card */}
      <div className="card">
        <form onSubmit={handleSearch} className="flex flex-wrap items-center gap-3 mb-6">
          <div className="flex-1 min-w-[240px]">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm theo tên hoặc email..."
              className="input-field"
            />
          </div>

          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="input-field w-40"
          >
            <option value="">Tất cả vai trò</option>
            <option value="CUSTOMER">Customer</option>
            <option value="ADMIN">Admin</option>
          </select>

          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="input-field w-40"
          >
            <option value="">Tất cả trạng thái</option>
            <option value="ACTIVE">Đang hoạt động</option>
            <option value="LOCKED">Đã khóa</option>
          </select>

          <button type="submit" className="btn-primary flex items-center gap-2 text-sm">
            <Search size={15} />
            Tìm kiếm
          </button>
        </form>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b border-gray-100 bg-gray-50/50">
                <th className="py-3 px-4 font-medium">Người dùng</th>
                <th className="py-3 px-4 font-medium">Email</th>
                <th className="py-3 px-4 font-medium">Số điện thoại</th>
                <th className="py-3 px-4 font-medium">Vai trò</th>
                <th className="py-3 px-4 font-medium">Trạng thái</th>
                <th className="py-3 px-4 font-medium">Ngày tạo</th>
                <th className="py-3 px-4 font-medium text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const initial = (u.name || u.email || "U").charAt(0).toUpperCase();
                const isAdmin = u.role === "ADMIN";
                const isLocked = u.status === "LOCKED";

                return (
                  <tr key={u.id} className="border-b border-gray-50 hover:bg-gray-50/60 transition-colors">
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-semibold text-xs">
                          {initial}
                        </div>
                        <span className="font-medium text-gray-800">{u.name || "Chưa đặt tên"}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-gray-600">{u.email}</td>
                    <td className="py-3.5 px-4 text-gray-600">{u.phone || "—"}</td>
                    <td className="py-3.5 px-4">
                      <StatusBadge status={u.role} />
                    </td>
                    <td className="py-3.5 px-4">
                      <StatusBadge status={u.status} />
                    </td>
                    <td className="py-3.5 px-4 text-gray-500">
                      {formatDate(u.created_at, "HH:mm:ss dd/MM/yyyy")}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      {isAdmin ? (
                        <span className="text-gray-400 text-xs italic">Không áp dụng</span>
                      ) : (
                        <button
                          onClick={() => setConfirmUser(u)}
                          className={`text-xs font-medium px-3 py-1 rounded transition-colors ${
                            isLocked
                              ? "bg-green-50 text-green-600 hover:bg-green-100"
                              : "bg-red-50 text-red-500 hover:bg-red-100"
                          }`}
                        >
                          {isLocked ? "Mở khóa" : "Khóa"}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {users.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-gray-400">
                    Không tìm thấy tài khoản nào
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-4 mt-2 border-t border-gray-100 text-sm text-gray-500">
          <span>Tổng {users.length} tài khoản</span>
          <Pagination
            page={page}
            totalPages={totalPages}
            onPageChange={(p) => fetchUsers(p)}
          />
        </div>
      </div>

      {confirmUser && (
        <ConfirmDialog
          message={`Bạn có chắc muốn ${
            confirmUser.status === "ACTIVE" ? "khóa" : "mở khóa"
          } tài khoản ${confirmUser.email}?`}
          confirmLabel={confirmUser.status === "ACTIVE" ? "Khóa" : "Mở khóa"}
          danger={confirmUser.status === "ACTIVE"}
          onConfirm={handleToggleStatus}
          onCancel={() => setConfirmUser(null)}
        />
      )}
    </AdminLayout>
  );
}
