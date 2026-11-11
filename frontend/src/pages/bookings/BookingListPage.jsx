import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import AdminLayout from "../../components/layout/AdminLayout";
import StatusBadge from "../../components/ui/StatusBadge";
import Pagination from "../../components/ui/Pagination";
import { getBookings } from "../../api/bookingApi";
import { getRoutes } from "../../api/routeApi";
import { getTrips } from "../../api/tripApi";
import { formatCurrency } from "../../utils/formatCurrency";
import { formatDate } from "../../utils/formatDate";
import { Search, Eye } from "lucide-react";

const TABS = [
  { key: "", label: "All Bookings" },
  { key: "flight", label: "Flight" },
  { key: "train", label: "Train" },
  { key: "bus", label: "Bus" },
];

const BOOKING_STATUSES = [
  { value: "", label: "Tất cả trạng thái" },
  { value: "PENDING", label: "Chờ xử lý" },
  { value: "CONFIRMED", label: "Đã xác nhận" },
  { value: "PAID", label: "Đã thanh toán" },
  { value: "CANCELLED", label: "Đã hủy" },
  { value: "REFUNDED", label: "Đã hoàn tiền" },
];

const EMPTY_FILTERS = { status: "", routeId: "", tripId: "", dateFrom: "", dateTo: "" };

async function loadAll(fetchPage, params) {
  const first = await fetchPage({ ...params, page: 1, limit: 100 });
  const result = first.data.data;
  const items = result.items || [];
  for (let page = 2; page <= (result.total_pages || 1); page += 1) {
    const response = await fetchPage({ ...params, page, limit: 100 });
    items.push(...(response.data.data.items || []));
  }
  return items;
}

export default function BookingListPage() {
  const navigate = useNavigate();
  const [bookings, setBookings] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalsByService, setTotalsByService] = useState({ all: 0, flight: 0, train: 0, bus: 0 });
  const [activeTab, setActiveTab] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [routeFilter, setRouteFilter] = useState("");
  const [tripFilter, setTripFilter] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [routes, setRoutes] = useState([]);
  const [trips, setTrips] = useState([]);

  const fetchBookings = async (p = 1, service = activeTab, q = search, filters = EMPTY_FILTERS) => {
    setLoading(true);
    setError("");
    try {
      const res = await getBookings({
        page: p, limit: 10, service, search: q,
        status: filters.status,
        routeId: filters.routeId,
        tripId: filters.tripId,
        dateFrom: filters.dateFrom,
        dateTo: filters.dateTo,
      });
      const data = res.data.data;
      setBookings(data.items || []);
      setPage(data.page);
      setTotalPages(data.total_pages || 1);
      setTotal(data.total || 0);
      setTotalsByService(data.totals_by_service || { all: 0, flight: 0, train: 0, bus: 0 });
    } catch (err) {
      setError(err.response?.data?.message || "Không thể tải danh sách booking");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBookings(1, "", "", EMPTY_FILTERS);
    Promise.all([
      loadAll(getRoutes, {}),
      ...["BUS", "FLIGHT", "TRAIN"].map((serviceType) => loadAll(getTrips, { serviceType })),
    ]).then(([routeItems, ...tripGroups]) => {
      setRoutes(routeItems);
      setTrips(tripGroups.flat());
    }).catch((err) => {
      setError(err.response?.data?.message || "Không thể tải bộ lọc tuyến/chuyến");
    });
  }, []);

  const handleTabChange = (key) => {
    setActiveTab(key);
    setSearch("");
    setStatusFilter("");
    setRouteFilter("");
    setTripFilter("");
    setDateFrom("");
    setDateTo("");
    fetchBookings(1, key, "", EMPTY_FILTERS);
  };

  const handleSearch = (e) => {
    e.preventDefault();
    fetchBookings(1, activeTab, search, {
      status: statusFilter, routeId: routeFilter, tripId: tripFilter, dateFrom, dateTo,
    });
  };

  const serviceType = activeTab.toUpperCase();
  const availableRoutes = routes.filter((route) => !serviceType || route.serviceType === serviceType);
  const availableTrips = trips.filter((trip) => (
    (!serviceType || trip.serviceType === serviceType) && (!routeFilter || trip.routeId === routeFilter)
  ));
  const serviceColor = (type) => ({
    flight: "text-blue-500", train: "text-purple-500", bus: "text-yellow-600",
  }[type] || "text-gray-500");

  return (
    <AdminLayout title="Không gian quản trị">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Booking Management</h1>
        <p className="text-sm text-gray-500 mt-1">Quản lý tất cả đặt vé Bus, Flight, Train.</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {["all", "flight", "train", "bus"].map((s) => {
          const icons = { all: "🎫", flight: "✈️", train: "🚂", bus: "🚌" };
          const labels = { all: "Tất cả booking", flight: "Flight", train: "Train", bus: "Bus" };
          return (
            <div
              key={s}
              className={`card flex items-center gap-4 cursor-pointer hover:border-blue-200 transition-colors ${activeTab === (s === "all" ? "" : s) ? "border-primary" : ""}`}
              onClick={() => handleTabChange(s === "all" ? "" : s)}
            >
              <span className="text-3xl">{icons[s]}</span>
              <div>
                <p className="text-xs text-gray-400">{labels[s]}</p>
                <p className="text-xl font-bold text-gray-800">{totalsByService[s].toLocaleString("vi-VN")}</p>
                <p className="text-xs text-gray-400">Mọi trạng thái</p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="card">
        {/* Search + filter row */}
        <form onSubmit={handleSearch} className="grid grid-cols-1 md:grid-cols-3 xl:grid-cols-6 gap-3 mb-5">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm Booking Code, nhà cung cấp..."
              className="input-field text-sm md:col-span-2"
            />
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="input-field text-sm">
              {BOOKING_STATUSES.map((status) => <option key={status.value} value={status.value}>{status.label}</option>)}
            </select>
            <select
              value={routeFilter}
              onChange={(e) => { setRouteFilter(e.target.value); setTripFilter(""); }}
              className="input-field text-sm"
            >
              <option value="">Tất cả tuyến</option>
              {availableRoutes.map((route) => (
                <option key={route.id} value={route.id}>
                  {route.originName} → {route.destinationName}
                </option>
              ))}
            </select>
            <select value={tripFilter} onChange={(e) => setTripFilter(e.target.value)} className="input-field text-sm">
              <option value="">Tất cả chuyến</option>
              {availableTrips.map((trip) => (
                <option key={`${trip.serviceType}-${trip.id}`} value={trip.id}>
                  {trip.tripCode || trip.flightNumber || trip.trainNumber || trip.id.slice(-6)}
                </option>
              ))}
            </select>
            <input aria-label="Từ ngày khởi hành" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="input-field text-sm" />
            <input aria-label="Đến ngày khởi hành" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="input-field text-sm" />
            <button type="submit" className="btn-primary flex items-center justify-center gap-1.5 text-sm">
              <Search size={15} /> Lọc
            </button>
        </form>

        {error && <div role="alert" className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}

        {/* Tabs */}
        <div className="flex gap-5 border-b border-gray-100 mb-5">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => handleTabChange(tab.key)}
              className={`pb-2.5 text-sm font-medium transition-colors border-b-2 ${
                activeTab === tab.key
                  ? "border-primary text-primary"
                  : "border-transparent text-gray-400 hover:text-gray-600"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b border-gray-100 bg-gray-50/50">
                <th className="py-3 px-3 font-medium">Mã booking</th>
                <th className="py-3 px-3 font-medium">Nhà cung cấp</th>
                <th className="py-3 px-3 font-medium">Dịch vụ</th>
                <th className="py-3 px-3 font-medium">Tuyến</th>
                <th className="py-3 px-3 font-medium">Ngày đi</th>
                <th className="py-3 px-3 font-medium">Số tiền</th>
                <th className="py-3 px-3 font-medium">Trạng thái</th>
                <th className="py-3 px-3 font-medium text-right">Chi tiết</th>
              </tr>
            </thead>
            <tbody>
              {bookings.map((b) => {
                const snap = b.tripSnapshot || {};
                const origin = snap.originCity || snap.originName || "—";
                const dest = snap.destinationCity || snap.destinationName || "—";
                const depDate = snap.departureDate || snap.departureTime;
                return (
                  <tr key={b.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                    <td className="py-3 px-3 text-primary font-semibold">{b.bookingCode}</td>
                    <td className="py-3 px-3 text-gray-700 font-medium">{b.provider}</td>
                    <td className="py-3 px-3">
                      <span className={`text-xs font-semibold capitalize ${serviceColor(b.serviceType)}`}>
                        {b.serviceType}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-gray-600">{origin} → {dest}</td>
                    <td className="py-3 px-3 text-gray-500">{formatDate(depDate)}</td>
                    <td className="py-3 px-3 font-semibold text-gray-800">{formatCurrency(b.finalAmount)}</td>
                    <td className="py-3 px-3"><StatusBadge status={b.status} /></td>
                    <td className="py-3 px-3 text-right">
                      <button
                        onClick={() => navigate(`/admin/bookings/${b.id}`)}
                        className="text-blue-500 hover:text-blue-700 transition-colors"
                      >
                        <Eye size={16} />
                      </button>
                    </td>
                  </tr>
                );
              })}
              {loading && <tr><td colSpan={8} className="py-10 text-center text-gray-400">Đang tải...</td></tr>}
              {!loading && bookings.length === 0 && (
                <tr><td colSpan={8} className="py-10 text-center text-gray-400">Không có booking nào</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between pt-4 border-t border-gray-100 text-sm text-gray-500">
          <span>Tổng {total} booking</span>
          <Pagination page={page} totalPages={totalPages} onPageChange={(p) => fetchBookings(p, activeTab, search, {
            status: statusFilter, routeId: routeFilter, tripId: tripFilter, dateFrom, dateTo,
          })} />
        </div>
      </div>
    </AdminLayout>
  );
}
