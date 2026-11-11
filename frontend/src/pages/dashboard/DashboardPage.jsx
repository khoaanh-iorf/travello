import { useCallback, useEffect, useState } from "react";
import { DollarSign, BookOpen, Clock, Route, CalendarClock } from "lucide-react";
import AdminLayout from "../../components/layout/AdminLayout";
import StatCard from "../../components/ui/StatCard";
import DonutChart from "../../components/charts/DonutChart";
import BarProgress from "../../components/charts/BarProgress";
import { getBookings } from "../../api/bookingApi";
import { getRevenueReport, getStatsReport } from "../../api/reportApi";
import { getSuppliers } from "../../api/supplierApi";
import { formatCurrency } from "../../utils/formatCurrency";
import { formatDate } from "../../utils/formatDate";

const SERVICE_TABS = ["All Bookings", "Flight", "Train", "Bus"];

export default function DashboardPage() {
  const [stats, setStats] = useState(null);
  const [revenue, setRevenue] = useState(null);
  const [suppliers, setSuppliers] = useState([]);
  const [selectedSupplier, setSelectedSupplier] = useState("");
  const [bookings, setBookings] = useState([]);
  const [bookingsTotal, setBookingsTotal] = useState(0);
  const [activeTab, setActiveTab] = useState("All Bookings");
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");

  const fetchBookings = useCallback(async (service = "", q = "") => {
    try {
      const params = { limit: 8 };
      if (service && service !== "All Bookings") params.service = service.toLowerCase();
      if (q) params.search = q;
      const res = await getBookings(params);
      setBookings(res.data.data.items || []);
      setBookingsTotal(res.data.data.total || 0);
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Không thể tải booking gần đây");
    }
  }, []);

  // Tải danh sách nhà cung cấp để phục vụ lọc doanh thu
  useEffect(() => {
    getSuppliers({ limit: 100 })
      .then((res) => {
        setSuppliers(res.data.data.items || []);
      })
      .catch((requestError) => {
        setError(requestError.response?.data?.message || "Không thể tải danh sách nhà cung cấp");
      });
  }, []);

  // Load all-time paid transactions for the selected supplier.
  useEffect(() => {
    let active = true;
    getRevenueReport("all", selectedSupplier)
      .then((res) => {
        if (!active) return;
        setRevenue(res.data.data);
      })
      .catch((requestError) => {
        if (active) setError(requestError.response?.data?.message || "Không thể tải báo cáo doanh thu");
      });
    return () => { active = false; };
  }, [selectedSupplier]);

  // Tải thống kê tổng quan
  useEffect(() => {
    let active = true;
    getStatsReport()
      .then((res) => {
        if (!active) return;
        setStats(res.data.data);
      })
      .catch((requestError) => {
        if (active) setError(requestError.response?.data?.message || "Không thể tải thống kê dashboard");
      });
    fetchBookings();
    return () => { active = false; };
  }, [fetchBookings]);

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    fetchBookings(tab, search);
  };

  // Dữ liệu Donut Chart theo chuẩn Flight, Train, Bus
  const revenueMatchesSupplier = revenue?.supplier_id === (selectedSupplier || null);
  const donutData = revenueMatchesSupplier
    ? [
        { name: "Flight", value: revenue.by_service?.flight?.revenue || 0, count: revenue.by_service?.flight?.count || 0 },
        { name: "Train",  value: revenue.by_service?.train?.revenue || 0, count: revenue.by_service?.train?.count || 0 },
        { name: "Bus",    value: revenue.by_service?.bus?.revenue || 0, count: revenue.by_service?.bus?.count || 0 },
      ]
    : [
        { name: "Flight", value: 0, count: 0 },
        { name: "Train",  value: 0, count: 0 },
        { name: "Bus",    value: 0, count: 0 },
      ];

  const barData = stats
    ? [
        { name: "flight", label: "Flight", count: stats.trips_by_service?.flight || 0 },
        { name: "train",  label: "Train",  count: stats.trips_by_service?.train || 0 },
        { name: "bus",    label: "Bus",    count: stats.trips_by_service?.bus || 0 },
      ]
    : [];

  const totalBookingCount = stats?.total_bookings;

  return (
    <AdminLayout title="Không gian quản trị">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Tổng quan hệ thống</h1>
        <p className="text-sm text-gray-500 mt-1">Dữ liệu booking, chuyến chạy và tuyến từ các chức năng quản trị.</p>
      </div>

      {error && (
        <div role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <StatCard
          title="Doanh thu đã thanh toán"
          value={revenueMatchesSupplier ? formatCurrency(revenue.total_revenue) : "—"}
          subtitle={`Giao dịch PAID · Toàn thời gian${selectedSupplier ? " · Nhà cung cấp đã chọn" : ""}`}
          icon={DollarSign}
          color="green"
        />
        <StatCard
          title="Tổng booking"
          value={totalBookingCount == null ? "—" : totalBookingCount.toLocaleString("vi-VN")}
          subtitle="Tất cả trạng thái · Bus, Flight, Train"
          icon={BookOpen}
          color="blue"
        />
        <StatCard
          title="Booking chờ xử lý"
          value={stats ? stats.pending_bookings : "—"}
          subtitle="Trạng thái PENDING"
          icon={Clock}
          color="yellow"
        />
        <StatCard
          title="Tổng chuyến chạy"
          value={stats ? stats.total_trips : "—"}
          subtitle="Bus, Flight, Train"
          icon={CalendarClock}
          color="blue"
        />
        <StatCard
          title="Tuyến đang hoạt động"
          value={stats ? stats.active_routes : "—"}
          subtitle="Trạng thái ACTIVE"
          icon={Route}
          color="green"
        />
      </div>

      {/* Revenue Reports Card & Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* All-time payment totals by service */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 p-6 sm:p-7 shadow-sm">
          {/* Header */}
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
            <h2 className="text-lg sm:text-xl font-bold text-gray-900 tracking-tight">
              Revenue Reports
            </h2>
            <div className="flex items-center gap-2.5">
              {suppliers.length > 0 && (
                <select
                  value={selectedSupplier}
                  onChange={(e) => setSelectedSupplier(e.target.value)}
                  className="text-xs bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-xl px-3 py-1.5 text-gray-700 font-medium focus:outline-none focus:ring-2 focus:ring-primary/20 transition-colors"
                  title="Chọn nhà cung cấp để xem doanh thu"
                >
                  <option value="">Tất cả nhà cung cấp</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.type})
                    </option>
                  ))}
                </select>
              )}
              <span className="rounded-xl bg-slate-100 text-slate-500 px-3.5 py-1.5 text-xs font-normal">
                Bus / Flight / Train · Toàn thời gian
              </span>
            </div>
          </div>

          {/* Donut Chart Component */}
          <DonutChart data={donutData} />
        </div>

        {/* Chuyến chạy theo dịch vụ */}
        <div className="card flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-800">Chuyến chạy theo dịch vụ</h2>
            </div>
            <BarProgress data={barData} />
          </div>
          <div className="mt-4 pt-4 border-t border-gray-100 text-xs text-gray-400">
            Dữ liệu tổng hợp từ các bảng trips, flight_trips, rail_trips
          </div>
        </div>
      </div>

      {/* Booking Table */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-semibold text-gray-800">Booking gần đây</h2>
            <p className="text-xs text-gray-500 mt-1">{bookingsTotal.toLocaleString("vi-VN")} booking phù hợp với bộ lọc</p>
          </div>
          <div className="flex items-center gap-2">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && fetchBookings(activeTab, search)}
              placeholder="Search..."
              className="input-field w-48 py-1.5 text-xs"
            />
            <button
              onClick={() => fetchBookings(activeTab, search)}
              className="btn-primary text-xs py-1.5 px-3"
            >
              Filter
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-4 mb-4 border-b border-gray-100">
          {SERVICE_TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => handleTabChange(tab)}
              className={`pb-2 text-sm font-medium transition-colors border-b-2 ${
                activeTab === tab
                  ? "border-primary text-primary"
                  : "border-transparent text-gray-400 hover:text-gray-600"
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Table */}
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 border-b border-gray-100">
              <th className="pb-2 font-medium">Trip ID</th>
              <th className="pb-2 font-medium">Operator</th>
              <th className="pb-2 font-medium">Service</th>
              <th className="pb-2 font-medium">Route</th>
              <th className="pb-2 font-medium">Travel Date</th>
              <th className="pb-2 font-medium">Amount</th>
            </tr>
          </thead>
          <tbody>
            {bookings.map((b) => {
              const snap = b.tripSnapshot || {};
              const origin = snap.originCity || snap.originName || "—";
              const dest = snap.destinationCity || snap.destinationName || "—";
              const depDate = snap.departureDate || snap.departureTime;
              return (
                <tr key={b.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="py-3 text-primary font-medium">{b.bookingCode}</td>
                  <td className="py-3 text-gray-700">{b.provider}</td>
                  <td className="py-3">
                    <span className={`text-xs font-medium ${
                      b.serviceType === "flight" ? "text-blue-500" :
                      b.serviceType === "train" ? "text-purple-500" : "text-yellow-600"
                    }`}>{b.serviceType}</span>
                  </td>
                  <td className="py-3 text-gray-700">{origin} → {dest}</td>
                  <td className="py-3 text-gray-500">{formatDate(depDate)}</td>
                  <td className="py-3 font-medium text-gray-800">
                    {formatCurrency(b.finalAmount)}
                  </td>
                </tr>
              );
            })}
            {bookings.length === 0 && (
              <tr>
                <td colSpan={6} className="py-8 text-center text-gray-400">
                  Không có dữ liệu
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </AdminLayout>
  );
}
