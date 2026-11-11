import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import AdminLayout from "../../components/layout/AdminLayout";
import StatusBadge from "../../components/ui/StatusBadge";
import { getBookingById } from "../../api/bookingApi";
import { formatCurrency } from "../../utils/formatCurrency";
import { formatDate } from "../../utils/formatDate";
import { ArrowLeft } from "lucide-react";

export default function BookingDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getBookingById(id)
      .then((r) => setBooking(r.data.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return (
    <AdminLayout title="Chi tiết Booking">
      <div className="flex items-center justify-center h-64 text-gray-400">Đang tải...</div>
    </AdminLayout>
  );

  if (!booking) return (
    <AdminLayout title="Chi tiết Booking">
      <div className="flex items-center justify-center h-64 text-gray-400">Không tìm thấy booking</div>
    </AdminLayout>
  );

  const snap = booking.tripSnapshot || {};

  return (
    <AdminLayout title="Không gian quản trị">
      <div className="mb-6 flex items-center gap-4">
        <button onClick={() => navigate(-1)} className="text-gray-500 hover:text-gray-700 transition-colors">
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Chi tiết Booking</h1>
          <p className="text-sm text-gray-500">{booking.bookingCode}</p>
        </div>
        <StatusBadge status={booking.status} />
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Booking Info */}
        <div className="card">
          <h2 className="font-semibold text-gray-700 mb-4 pb-2 border-b border-gray-100">Thông tin đặt vé</h2>
          <dl className="space-y-3 text-sm">
            {[
              ["Booking Code", booking.bookingCode],
              ["Loại dịch vụ", booking.orderType],
              ["Nhà cung cấp", booking.provider],
              ["Tuyến đường", `${snap.originCity || snap.originName || "—"} → ${snap.destinationCity || snap.destinationName || "—"}`],
              ["Ngày khởi hành", formatDate(snap.departureDate || snap.departureTime)],
              ["Tổng tiền", formatCurrency(booking.subtotal)],
              ["Giảm giá", formatCurrency(booking.discountAmount)],
              ["Thanh toán", formatCurrency(booking.finalAmount)],
              ["Ngày tạo", formatDate(booking.createdAt, "HH:mm dd/MM/yyyy")],
            ].map(([k, v]) => (
              <div key={k} className="flex justify-between">
                <dt className="text-gray-400">{k}</dt>
                <dd className="font-medium text-gray-800 text-right">{v || "—"}</dd>
              </div>
            ))}
          </dl>
        </div>

        {/* Passengers */}
        <div className="card">
          <h2 className="font-semibold text-gray-700 mb-4 pb-2 border-b border-gray-100">Hành khách</h2>
          {(booking.passengers || []).length === 0 ? (
            <p className="text-gray-400 text-sm">Không có thông tin hành khách</p>
          ) : (
            <div className="space-y-3">
              {booking.passengers.map((p, i) => (
                <div key={i} className="bg-gray-50 rounded-lg p-3 text-sm">
                  <p className="font-semibold text-gray-800">{p.name || p.fullName}</p>
                  <div className="text-gray-500 mt-1 space-y-0.5">
                    {p.phone && <p>📞 {p.phone}</p>}
                    {p.email && <p>✉️ {p.email}</p>}
                    {p.idNumber && <p>🪪 {p.idNumber}</p>}
                    {p.seatNumber && <p>💺 Ghế {p.seatNumber}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Tickets */}
        {booking.tickets && booking.tickets.length > 0 && (
          <div className="card col-span-2">
            <h2 className="font-semibold text-gray-700 mb-4 pb-2 border-b border-gray-100">Vé đã phát hành</h2>
            <div className="grid grid-cols-3 gap-3">
              {booking.tickets.map((t, i) => (
                <div key={i} className="border border-gray-100 rounded-lg p-3 text-sm">
                  <div className="flex justify-between items-start mb-2">
                    <span className="font-semibold text-primary">{t.ticketCode}</span>
                    <StatusBadge status={t.status} />
                  </div>
                  <p className="text-gray-500">Ghế: <span className="text-gray-700 font-medium">{t.seatNumber || "—"}</span></p>
                  {t.passenger?.name && <p className="text-gray-500">KH: <span className="text-gray-700">{t.passenger.name}</span></p>}
                  <p className="text-gray-400 text-xs mt-1">Phát hành: {formatDate(t.issuedAt, "HH:mm dd/MM/yyyy")}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}

