import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import AdminLayout from "../../components/layout/AdminLayout";
import StatusBadge from "../../components/ui/StatusBadge";
import Pagination from "../../components/ui/Pagination";
import { getBookings } from "../../api/bookingApi";
import { formatCurrency } from "../../utils/formatCurrency";
import { formatDate } from "../../utils/formatDate";
import { Search, Eye } from "lucide-react";

const TABS = [
  { key: "", label: "All Bookings" },
  { key: "flight", label: "Flight" },
  { key: "train", label: "Train" },
  { key: "bus", label: "Bus" },
];

export default function BookingListPage() {
  const navigate = useNavigate();
  const [bookings, setBookings] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [activeTab, setActiveTab] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);

  const fetchBookings = async (p = 1, service = activeTab, q = search) => {
    setLoading(true);
    try {
      const res = await getBookings({ page: p, limit: 10, service, search: q });
      const data = res.data.data;
      setBookings(data.items || []);
      setPage(data.page);
      setTotalPages(data.total_pages || 1);
      setTotal(data.total || 0);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchBookings(1, "", ""); }, []);

  const handleTabChange = (key) => {
    setActiveTab(key);
    setSearch("");
    fetchBookings(1, key, "");
  };

  const handleSearch = (e) => {
    e.preventDefault();
    fetchBookings(1, activeTab, search);
  };

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
      <div className="grid grid-cols-3 gap-4 mb-6">
        {["flight", "train", "bus"].map((s) => {
          const icons = { flight: "✈️", train: "🚂", bus: "🚌" };
          const labels = { flight: "Flight", train: "Train", bus: "Bus" };
          return (
            <div key={s} className="card flex items-center gap-4 cursor-pointer hover:border-blue-200 transition-colors" onClick={() => handleTabChange(s)}>
              <span className="text-3xl">{icons[s]}</span>
              <div>
                <p className="text-xs text-gray-400">{labels[s]}</p>
                <p className="text-xl font-bold text-gray-800">—</p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="card">
        {/* Search + filter row */}
        <div className="flex items-center justify-between mb-5">
          <form onSubmit={handleSearch} className="flex items-center gap-2">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm Booking Code, nhà cung cấp..."
              className="input-field w-72 text-sm"
            />
            <button type="submit" className="btn-primary flex items-center gap-1.5 text-sm">
              <Search size={15} /> Filter
            </button>
          </form>
        </div>

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
                <th className="py-3 px-3 font-medium">Trip ID</th>
                <th className="py-3 px-3 font-medium">Operator</th>
                <th className="py-3 px-3 font-medium">Service</th>
                <th className="py-3 px-3 font-medium">Route</th>
                <th className="py-3 px-3 font-medium">Travel Date</th>
                <th className="py-3 px-3 font-medium">Amount</th>
                <th className="py-3 px-3 font-medium">Status</th>
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
              {!loading && bookings.length === 0 && (
                <tr><td colSpan={8} className="py-10 text-center text-gray-400">Không có booking nào</td></tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex items-center justify-between pt-4 border-t border-gray-100 text-sm text-gray-500">
          <span>Tổng {total} booking</span>
          <Pagination page={page} totalPages={totalPages} onPageChange={(p) => fetchBookings(p)} />
        </div>
      </div>
    </AdminLayout>
  );
}

