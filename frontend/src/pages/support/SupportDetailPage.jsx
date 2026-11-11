import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import AdminLayout from "../../components/layout/AdminLayout";
import StatusBadge from "../../components/ui/StatusBadge";
import { getSupportTicketById, updateTicketStatus, replyTicket } from "../../api/supportApi";
import { formatDate } from "../../utils/formatDate";
import { ArrowLeft, Send } from "lucide-react";

const STATUS_OPTIONS = ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"];

export default function SupportDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [ticket, setTicket] = useState(null);
  const [loading, setLoading] = useState(true);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);
  const [newStatus, setNewStatus] = useState("");

  const fetchTicket = async () => {
    try {
      const r = await getSupportTicketById(id);
      const t = r.data.data;
      setTicket(t);
      setNewStatus(t.status);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchTicket(); }, [id]);

  const handleStatusChange = async (s) => {
    setNewStatus(s);
    try { await updateTicketStatus(id, s); fetchTicket(); }
    catch (err) { alert(err.response?.data?.message || "Thất bại"); }
  };

  const handleReply = async (e) => {
    e.preventDefault();
    if (!replyText.trim()) return;
    setSending(true);
    try {
      await replyTicket(id, replyText);
      setReplyText("");
      fetchTicket();
    } catch (err) { alert(err.response?.data?.message || "Gửi thất bại"); }
    finally { setSending(false); }
  };

  if (loading) return <AdminLayout title="Hỗ trợ"><div className="flex justify-center py-20 text-gray-400">Đang tải...</div></AdminLayout>;
  if (!ticket) return <AdminLayout title="Hỗ trợ"><div className="text-center py-20 text-gray-400">Không tìm thấy ticket</div></AdminLayout>;

  return (
    <AdminLayout title="Không gian quản trị">
      <div className="mb-6 flex items-center gap-4">
        <button onClick={() => navigate(-1)} className="text-gray-500 hover:text-gray-700"><ArrowLeft size={20} /></button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-gray-800">{ticket.subject}</h1>
          <p className="text-sm text-gray-400">{ticket.ticketCode || id.slice(-8).toUpperCase()} · {formatDate(ticket.createdAt, "HH:mm dd/MM/yyyy")}</p>
        </div>
        {/* Status selector */}
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          {STATUS_OPTIONS.map((s) => (
            <button key={s} onClick={() => handleStatusChange(s)}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${newStatus === s ? "bg-white shadow text-primary" : "text-gray-500 hover:text-gray-700"}`}>
              {s === "IN_PROGRESS" ? "Đang xử lý" : s === "RESOLVED" ? "Đã giải quyết" : s === "CLOSED" ? "Đóng" : "Mở"}
            </button>
          ))}
        </div>
        <StatusBadge status={ticket.status} />
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Chat thread */}
        <div className="col-span-2 card">
          <h2 className="font-semibold text-gray-700 mb-4 pb-2 border-b border-gray-100">Cuộc trò chuyện</h2>

          {/* Original message */}
          <div className="mb-4 bg-gray-50 rounded-xl p-4">
            <div className="flex justify-between mb-2">
              <span className="text-xs font-semibold text-gray-600">Khách hàng</span>
              <span className="text-xs text-gray-400">{formatDate(ticket.createdAt, "HH:mm dd/MM/yyyy")}</span>
            </div>
            <p className="text-sm text-gray-700 leading-relaxed">{ticket.message}</p>
          </div>

          {/* Replies */}
          <div className="space-y-3 mb-5">
            {(ticket.replies || []).map((r, i) => (
              <div key={i} className={`rounded-xl p-4 ${r.sender === "ADMIN" ? "bg-blue-50 border border-blue-100 ml-6" : "bg-gray-50 mr-6"}`}>
                <div className="flex justify-between mb-1">
                  <span className={`text-xs font-semibold ${r.sender === "ADMIN" ? "text-primary" : "text-gray-600"}`}>
                    {r.sender === "ADMIN" ? "Admin" : "Khách hàng"}
                  </span>
                  <span className="text-xs text-gray-400">{r.sentAt ? formatDate(r.sentAt, "HH:mm dd/MM/yyyy") : ""}</span>
                </div>
                <p className="text-sm text-gray-700">{r.message}</p>
              </div>
            ))}
          </div>

          {/* Reply form */}
          <form onSubmit={handleReply} className="border-t border-gray-100 pt-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">Phản hồi của Admin</label>
            <textarea
              rows={4} value={replyText} onChange={(e) => setReplyText(e.target.value)}
              placeholder="Nhập nội dung phản hồi..."
              className="input-field resize-none mb-3"
            />
            <div className="flex justify-end">
              <button type="submit" disabled={sending || !replyText.trim()} className="btn-primary flex items-center gap-2 text-sm disabled:opacity-60">
                <Send size={15} />
                {sending ? "Đang gửi..." : "Gửi phản hồi"}
              </button>
            </div>
          </form>
        </div>

        {/* Info panel */}
        <div className="card h-fit">
          <h2 className="font-semibold text-gray-700 mb-4 pb-2 border-b border-gray-100">Thông tin ticket</h2>
          <dl className="space-y-3 text-sm">
            {[
              ["Mã Ticket", ticket.ticketCode || "—"],
              ["Trạng thái", <StatusBadge status={ticket.status} />],
              ["Ngày tạo", formatDate(ticket.createdAt, "dd/MM/yyyy HH:mm")],
              ["Cập nhật", formatDate(ticket.updatedAt, "dd/MM/yyyy HH:mm")],
              ["Số phản hồi", (ticket.replies || []).length],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between items-center">
                <dt className="text-gray-400">{k}</dt>
                <dd className="font-medium text-gray-700 text-right">{v}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </AdminLayout>
  );
}

