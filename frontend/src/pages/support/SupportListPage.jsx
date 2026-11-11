import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import AdminLayout from "../../components/layout/AdminLayout";
import StatusBadge from "../../components/ui/StatusBadge";
import Pagination from "../../components/ui/Pagination";
import { getSupportTickets } from "../../api/supportApi";
import { formatDate } from "../../utils/formatDate";
import { Search, Eye } from "lucide-react";

const STATUS_OPTS = ["", "OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"];
const STATUS_LABELS = { "": "Tất cả", OPEN: "Mở", IN_PROGRESS: "Đang xử lý", RESOLVED: "Đã giải quyết", CLOSED: "Đã đóng" };

export default function SupportListPage() {
  const navigate = useNavigate();
  const [tickets, setTickets] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(false);

  const fetchTickets = async (p = 1) => {
    setLoading(true);
    try {
      const res = await getSupportTickets({ page: p, limit: 10, search, status: statusFilter });
      const d = res.data.data;
      setTickets(d.items || []);
      setPage(d.page);
      setTotalPages(d.total_pages || 1);
      setTotal(d.total || 0);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchTickets(1); }, []);

  const statusCountColor = { OPEN: "bg-yellow-100 text-yellow-700", IN_PROGRESS: "bg-blue-100 text-blue-700", RESOLVED: "bg-green-100 text-green-700", CLOSED: "bg-gray-100 text-gray-500" };

  return (
    <AdminLayout title="Không gian quản trị">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Hỗ trợ khách hàng</h1>
        <p className="text-sm text-gray-500 mt-1">Xử lý yêu cầu hỗ trợ từ khách hàng.</p>
      </div>

      {/* Quick filter tabs */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {STATUS_OPTS.map((s) => (
          <button key={s} onClick={() => { setStatusFilter(s); setTimeout(() => fetchTickets(1), 0); }}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all border ${statusFilter === s ? "bg-primary text-white border-primary" : "bg-white border-gray-200 text-gray-600 hover:border-primary/40"}`}>
            {STATUS_LABELS[s]}
          </button>
        ))}
      </div>

      <div className="card">
        <form onSubmit={(e) => { e.preventDefault(); fetchTickets(1); }} className="flex gap-3 mb-5">
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tìm mã ticket, tiêu đề..." className="input-field flex-1" />
          <button type="submit" className="btn-primary flex items-center gap-1.5 text-sm"><Search size={15} /> Tìm</button>
        </form>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b bg-gray-50/50">
                {["Mã Ticket", "Tiêu đề", "Trạng thái", "Phản hồi", "Ngày tạo", "Chi tiết"].map(h => (
                  <th key={h} className="py-3 px-3 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tickets.map((t) => (
                <tr key={t.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors cursor-pointer" onClick={() => navigate(`/admin/support/${t.id}`)}>
                  <td className="py-3.5 px-3 font-mono text-xs text-primary font-semibold">{t.ticketCode || t.id.slice(-8).toUpperCase()}</td>
                  <td className="py-3.5 px-3 font-medium text-gray-800 max-w-[300px] truncate">{t.subject}</td>
                  <td className="py-3.5 px-3"><StatusBadge status={t.status} /></td>
                  <td className="py-3.5 px-3 text-gray-500">{(t.replies || []).length} tin</td>
                  <td className="py-3.5 px-3 text-gray-400">{formatDate(t.createdAt, "HH:mm dd/MM/yyyy")}</td>
                  <td className="py-3.5 px-3">
                    <button onClick={(e) => { e.stopPropagation(); navigate(`/admin/support/${t.id}`); }}
                      className="text-blue-500 hover:text-blue-700">
                      <Eye size={16} />
                    </button>
                  </td>
                </tr>
              ))}
              {!loading && tickets.length === 0 && (
                <tr><td colSpan={6} className="py-10 text-center text-gray-400">Không có ticket nào</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between pt-4 border-t border-gray-100 text-sm text-gray-500 mt-2">
          <span>Tổng {total} ticket</span>
          <Pagination page={page} totalPages={totalPages} onPageChange={fetchTickets} />
        </div>
      </div>
    </AdminLayout>
  );
}

