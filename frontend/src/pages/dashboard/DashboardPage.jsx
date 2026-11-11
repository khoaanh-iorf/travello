import { useEffect, useState } from "react";
import { DollarSign, BookOpen, Clock, Users } from "lucide-react";
import AdminLayout from "../../components/layout/AdminLayout";
import StatCard from "../../components/ui/StatCard";
import DonutChart from "../../components/charts/DonutChart";
import BarProgress from "../../components/charts/BarProgress";
import StatusBadge from "../../components/ui/StatusBadge";
import { getBookings } from "../../api/bookingApi";
import axiosClient from "../../api/axiosClient";
import { formatCurrency } from "../../utils/formatCurrency";
import { formatDate } from "../../utils/formatDate";

const SERVICE_TABS = ["All Bookings", "Flight", "Train", "Bus"];

export default function DashboardPage() {
  const [stats, setStats] = useState(null);
  const [revenue, setRevenue] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [activeTab, setActiveTab] = useState("All Bookings");
  const [search, setSearch] = useState("");

  useEffect(() => {
    axiosClient.get("/admin/reports/stats").then((r) => setStats(r.data.data));
    axiosClient.get("/admin/reports/revenue?period=month").then((r) => setRevenue(r.data.data));
    fetchBookings();
  }, []);

  const fetchBookings = async (service = "", q = "") => {
    const params = { limit: 8 };
    if (service && service !== "All Bookings") params.service = service.toLowerCase();
    if (q) params.search = q;
    const res = await getBookings(params);
    setBookings(res.data.data.items || []);
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    fetchBookings(tab, search);
  };

  const donutData = revenue
    ? [
        { name: "Flight", value: revenue.by_service?.flight?.revenue || 0 },
        { name: "Train",  value: revenue.by_service?.train?.revenue || 0 },
        { name: "Bus",    value: revenue.by_service?.bus?.revenue || 0 },
      ]
    : [];

  const barData = stats
    ? [
        { name: "flight", label: "Flight", count: stats.trips_by_service?.flight || 0 },
        { name: "train",  label: "Train",  count: stats.trips_by_service?.train || 0 },
        { name: "bus",    label: "Bus",    count: stats.trips_by_service?.bus || 0 },
      ]
    : [];

  return (
    <AdminLayout title="Không gian quản trị">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Welcome to Travel Mini Admin Portal</h1>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <StatCard
          title="Total Revenue"
          value={formatCurrency(revenue?.total_revenue || 0)}
          subtitle="Tổng giá trị các chuyến"
          icon={DollarSign}
          color="green"
        />
        <StatCard
          title="Total Bookings"
          value={revenue?.total_bookings || 0}
          subtitle="Tổng số chuyến sẵn bế"
          icon={BookOpen}
          color="blue"
        />
        <StatCard
          title="Pending Bookings"
          value={stats?.pending_bookings || 0}
          subtitle="Chuyến đang ngừng hoạt động"
          icon={Clock}
          color="yellow"
        />
        <StatCard
          title="Total Customers"
          value={stats?.total_users || 0}
          subtitle="Tổng số chỗ cung cấp"
          icon={Users}
          color="purple"
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-800">Revenue Reports</h2>
            <span className="text-xs text-gray-400">Bus / Flight / Train</span>
          </div>
          <DonutChart data={donutData} />
        </div>
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-800">Trips by Service</h2>
          </div>
          <BarProgress data={barData} />
        </div>
      </div>

      {/* Booking Table */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-800">Booking Management</h2>
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

