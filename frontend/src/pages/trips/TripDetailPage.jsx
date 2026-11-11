import { useEffect, useState } from "react";
import { useParams, useSearchParams, Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft, Bus, Plane, Train, Calendar, Clock,
  Users, Ticket, ChevronRight, AlertCircle,
} from "lucide-react";
import AdminLayout from "../../components/layout/AdminLayout";
import StatusBadge from "../../components/ui/StatusBadge";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import { getTripById, updateTripStatus } from "../../api/tripApi";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SVC_LABEL = { BUS: "Xe khách", FLIGHT: "Máy bay", TRAIN: "Tàu hỏa" };
const SvcIcon = { BUS: Bus, FLIGHT: Plane, TRAIN: Train };

const STATUS_NEXT = {
  SCHEDULED: ["RUNNING", "CANCELLED"],
  RUNNING: ["COMPLETED"],
  COMPLETED: [],
  CANCELLED: [],
};

const STATUS_LABELS = {
  SCHEDULED: "Đã lên lịch",
  RUNNING: "Đang chạy",
  COMPLETED: "Hoàn thành",
  CANCELLED: "Đã hủy",
};

const STATUS_COLORS = {
  SCHEDULED: "bg-blue-50 text-blue-700 border-blue-200",
  RUNNING: "bg-green-50 text-green-700 border-green-200",
  COMPLETED: "bg-gray-100 text-gray-700 border-gray-200",
  CANCELLED: "bg-red-50 text-red-700 border-red-200",
};

const BOOKING_STATUS_LABEL = {
  PENDING: "Chờ xác nhận",
  CONFIRMED: "Đã xác nhận",
  PAID: "Đã thanh toán",
  CANCELLED: "Đã hủy",
  REFUNDED: "Đã hoàn tiền",
};

function fmt(dt) {
  if (!dt) return "—";
  return new Date(dt).toLocaleString("vi-VN", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function fmtVND(n) {
  if (n == null) return "—";
  return new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND" }).format(n);
}

function InfoRow({ label, value }) {
  return (
    <div className="flex items-start justify-between py-2.5 border-b border-gray-100 last:border-0">
      <span className="text-sm text-gray-500 shrink-0 w-40">{label}</span>
      <span className="text-sm text-gray-800 font-medium text-right">{value || "—"}</span>
    </div>
  );
}

function SeatProgress({ booked, total }) {
  const remaining = Math.max(total - booked, 0);
  const pct = total > 0 ? Math.round((booked / total) * 100) : 0;
  return (
    <div className="space-y-2">
      <div className="flex justify-between text-xs text-gray-600">
        <span>Đã đặt: <strong className="text-gray-900">{booked}</strong></span>
        <span>Còn lại: <strong className={remaining < 5 ? "text-amber-600" : "text-green-600"}>{remaining}</strong></span>
        <span>Tổng: <strong>{total}</strong></span>
      </div>
      <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${
            pct >= 90 ? "bg-red-500" : pct >= 70 ? "bg-amber-500" : "bg-green-500"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-xs text-gray-400 text-right">{pct}% đã lấp đầy</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// TripDetailPage
// ---------------------------------------------------------------------------

export default function TripDetailPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const serviceType = searchParams.get("serviceType") || "";

  const [trip, setTrip] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [confirmState, setConfirmState] = useState({
    open: false, newStatus: null, loading: false,
  });

  const fetchTrip = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getTripById(id, serviceType);
      setTrip(res.data.data);
    } catch (e) {
      setError(e.response?.data?.message || "Không thể tải thông tin chuyến");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchTrip(); }, [id, serviceType]);

  const handleStatusChange = async () => {
    if (!confirmState.newStatus) return;
    setConfirmState((prev) => ({ ...prev, loading: true }));
    try {
      const res = await updateTripStatus(id, trip.serviceType, confirmState.newStatus);
      if (res.data.warning) {
        // eslint-disable-next-line no-alert
        alert(res.data.warning);
      }
      setConfirmState({ open: false, newStatus: null, loading: false });
      fetchTrip();
    } catch (e) {
      alert(e.response?.data?.message || "Đổi trạng thái thất bại");
      setConfirmState((prev) => ({ ...prev, loading: false }));
    }
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="p-6 flex items-center justify-center min-h-96">
          <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
        </div>
      </AdminLayout>
    );
  }

  if (error || !trip) {
    return (
      <AdminLayout>
        <div className="p-6">
          <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center space-y-3">
            <AlertCircle className="mx-auto text-red-500" size={40} />
            <p className="text-red-700 font-medium">{error || "Không tìm thấy chuyến"}</p>
            <button
              onClick={() => navigate("/admin/trips")}
              className="text-sm text-primary underline"
            >
              Quay lại danh sách
            </button>
          </div>
        </div>
      </AdminLayout>
    );
  }

  const Icon = SvcIcon[trip.serviceType] || Bus;
  const nextStatuses = STATUS_NEXT[trip.status] || [];
  const bookings = trip.bookings || [];
  const booked = trip.bookedCount ?? 0;
  const capacity = trip.seatCapacity ?? 0;

  return (
    <AdminLayout>
      <div className="p-6 space-y-5 max-w-6xl">
        {/* Back + header */}
        <div>
          <button
            onClick={() => navigate("/admin/trips")}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-primary mb-3 transition-colors"
          >
            <ArrowLeft size={15} /> Quay lại danh sách chuyến
          </button>
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Icon size={20} className="text-primary" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900 font-mono">
                  {trip.tripCode || "—"}
                </h1>
                <p className="text-sm text-gray-500">
                  {SVC_LABEL[trip.serviceType]} · {trip.originName} → {trip.destinationName}
                </p>
              </div>
            </div>
            <div className={`px-3 py-1 rounded-full border text-sm font-medium ${STATUS_COLORS[trip.status]}`}>
              {STATUS_LABELS[trip.status]}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* LEFT — Thông tin chuyến */}
          <div className="lg:col-span-2 space-y-5">
            {/* Thông tin cơ bản */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h2 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <Calendar size={15} /> Thông tin chuyến
              </h2>
              <InfoRow label="Mã chuyến" value={trip.tripCode} />
              <InfoRow label="Loại phương tiện" value={SVC_LABEL[trip.serviceType]} />
              <InfoRow label="Nhà cung cấp" value={trip.providerName} />
              <InfoRow
                label="Tuyến"
                value={`${trip.originName || "?"} → ${trip.destinationName || "?"}`}
              />
              <InfoRow
                label="Giờ khởi hành"
                value={
                  <span className="flex items-center gap-1 justify-end">
                    <Clock size={12} /> {fmt(trip.departureTime)}
                  </span>
                }
              />
              <InfoRow
                label="Giờ đến"
                value={
                  <span className="flex items-center gap-1 justify-end">
                    <Clock size={12} /> {fmt(trip.arrivalTime)}
                  </span>
                }
              />
              <InfoRow label="Giá cơ bản" value={fmtVND(trip.basePrice)} />
            </div>

            {/* Chỗ ngồi */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h2 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
                <Users size={15} /> Thống kê chỗ ngồi
              </h2>
              <SeatProgress booked={booked} total={capacity} />
            </div>

            {/* Đổi trạng thái */}
            {nextStatuses.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h2 className="text-sm font-semibold text-gray-700 mb-3">Chuyển trạng thái</h2>
                <div className="flex gap-2 flex-wrap">
                  {nextStatuses.map((s) => (
                    <button
                      key={s}
                      onClick={() => setConfirmState({ open: true, newStatus: s, loading: false })}
                      className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${
                        s === "CANCELLED"
                          ? "border-red-300 text-red-700 bg-red-50 hover:bg-red-100"
                          : "border-primary/30 text-primary bg-primary/5 hover:bg-primary/10"
                      }`}
                    >
                      → {STATUS_LABELS[s]}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* RIGHT — Danh sách booking */}
          <div className="bg-white rounded-xl border border-gray-200 flex flex-col">
            <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
              <Ticket size={15} className="text-gray-500" />
              <h2 className="text-sm font-semibold text-gray-700">
                Đặt chỗ ({trip.totalBookings ?? bookings.length})
              </h2>
            </div>
            <div className="flex-1 overflow-y-auto divide-y divide-gray-100 max-h-[500px]">
              {bookings.length === 0 ? (
                <p className="text-center text-gray-400 text-sm py-10">Chưa có đặt chỗ</p>
              ) : (
                bookings.map((b) => (
                  <div key={b.id} className="px-5 py-3 hover:bg-gray-50 transition-colors">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-xs font-mono font-semibold text-gray-800 truncate">
                          #{b.bookingCode}
                        </p>
                        <p className="text-xs text-gray-600 truncate mt-0.5">
                          {b.passengerName || "Không rõ"}
                        </p>
                        {b.phone && (
                          <p className="text-xs text-gray-400">{b.phone}</p>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <StatusBadge status={b.status} />
                        <p className="text-xs text-gray-600 mt-1">{fmtVND(b.finalAmount)}</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between mt-1.5">
                      <span className="text-xs text-gray-400">{fmt(b.createdAt)}</span>
                      <Link
                        to={`/admin/bookings/${b.id}`}
                        className="text-xs text-primary hover:underline flex items-center gap-0.5"
                      >
                        Chi tiết <ChevronRight size={11} />
                      </Link>
                    </div>
                  </div>
                ))
              )}
            </div>
            {(trip.totalBookings ?? 0) > bookings.length && (
              <div className="px-5 py-3 border-t border-gray-100 text-xs text-gray-400 text-center">
                Hiển thị {bookings.length}/{trip.totalBookings} đặt chỗ
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Confirm đổi trạng thái — chỉ render khi open=true và có trip */}
      {confirmState.open && trip && (
        <ConfirmDialog
          message={
            confirmState.newStatus === "CANCELLED"
              ? `Bạn có chắc muốn HỦY chuyến "${trip.tripCode}"? Hành động này không thể hoàn tác.`
              : `Chuyển trạng thái sang "${STATUS_LABELS[confirmState.newStatus]}"?`
          }
          onConfirm={handleStatusChange}
          onCancel={() => setConfirmState({ open: false, newStatus: null, loading: false })}
          confirmLabel={confirmState.newStatus === "CANCELLED" ? "Xác nhận hủy" : "Xác nhận"}
          danger={confirmState.newStatus === "CANCELLED"}
        />
      )}
    </AdminLayout>
  );
}
