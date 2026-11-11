import { useEffect, useState } from "react";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import AdminLayout from "../../components/layout/AdminLayout";
import { getRevenueReport, getStatsReport } from "../../api/reportApi";
import { formatCurrency } from "../../utils/formatCurrency";

const PERIODS = [
  { key: "week", label: "7 ngày" },
  { key: "month", label: "30 ngày" },
  { key: "year", label: "1 năm" },
  { key: "all", label: "Tất cả" },
];

export default function ReportPage() {
  const [period, setPeriod] = useState("month");
  const [revenue, setRevenue] = useState(null);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchData = async (p) => {
    setLoading(true);
    try {
      const [revRes, statRes] = await Promise.all([
        getRevenueReport(p),
        getStatsReport(),
      ]);
      setRevenue(revRes.data.data);
      setStats(statRes.data.data);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(period); }, [period]);

  // Merge daily data from all services
  const buildDailyChart = () => {
    if (!revenue?.daily) return [];
    const dateMap = {};
    const merge = (arr, key) => arr.forEach(({ _id, revenue: rev }) => {
      if (!dateMap[_id]) dateMap[_id] = { date: _id };
      dateMap[_id][key] = rev;
    });
    merge(revenue.daily.bus || [], "Bus");
    merge(revenue.daily.flight || [], "Flight");
    merge(revenue.daily.train || [], "Train");
    return Object.values(dateMap).sort((a, b) => a.date.localeCompare(b.date));
  };

  const dailyData = buildDailyChart();
  const byService = revenue?.by_service || {};

  const serviceBarData = [
    { name: "Bus",    revenue: byService.bus?.revenue || 0, bookings: byService.bus?.count || 0 },
    { name: "Flight", revenue: byService.flight?.revenue || 0, bookings: byService.flight?.count || 0 },
    { name: "Train",  revenue: byService.train?.revenue || 0, bookings: byService.train?.count || 0 },
  ];

  return (
    <AdminLayout title="Không gian quản trị">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Reports</h1>
          <p className="text-sm text-gray-500 mt-1">Thống kê doanh thu và hoạt động hệ thống.</p>
        </div>
        {/* Period selector */}
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          {PERIODS.map((p) => (
            <button key={p.key} onClick={() => setPeriod(p.key)}
              className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${period === p.key ? "bg-white shadow text-primary" : "text-gray-500 hover:text-gray-700"}`}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Top stat cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: "Tổng doanh thu", value: formatCurrency(revenue?.total_revenue || 0), color: "text-green-600", bg: "bg-green-50" },
          { label: "Tổng booking", value: revenue?.total_bookings || 0, color: "text-blue-600", bg: "bg-blue-50" },
          { label: "Tổng khách hàng", value: stats?.total_users || 0, color: "text-purple-600", bg: "bg-purple-50" },
          { label: "Tổng chuyến", value: stats?.total_trips || 0, color: "text-yellow-600", bg: "bg-yellow-50" },
        ].map((s) => (
          <div key={s.label} className={`card text-center py-5`}>
            <p className="text-xs text-gray-400 mb-2">{s.label}</p>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Revenue by service bar chart */}
      <div className="card mb-6">
        <h2 className="font-semibold text-gray-700 mb-4">Doanh thu theo loại dịch vụ</h2>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={serviceBarData} margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="name" tick={{ fontSize: 12 }} />
            <YAxis tickFormatter={(v) => `${(v / 1000000).toFixed(1)}M`} tick={{ fontSize: 12 }} />
            <Tooltip formatter={(v) => formatCurrency(v)} />
            <Legend />
            <Bar dataKey="revenue" name="Doanh thu" fill="#2563EB" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Daily revenue line chart */}
      {dailyData.length > 0 && (
        <div className="card mb-6">
          <h2 className="font-semibold text-gray-700 mb-4">Doanh thu theo ngày</h2>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart data={dailyData} margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis tickFormatter={(v) => `${(v / 1000000).toFixed(1)}M`} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v) => formatCurrency(v)} />
              <Legend />
              <Line type="monotone" dataKey="Bus" stroke="#F59E0B" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="Flight" stroke="#2563EB" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="Train" stroke="#8B5CF6" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Service detail table */}
      <div className="card">
        <h2 className="font-semibold text-gray-700 mb-4">Chi tiết theo dịch vụ</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 border-b bg-gray-50/50">
              {["Dịch vụ", "Số booking", "Doanh thu", "Trung bình/booking"].map(h => (
                <th key={h} className="py-3 px-4 font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {serviceBarData.map((row) => (
              <tr key={row.name} className="border-b border-gray-50">
                <td className="py-3 px-4 font-semibold text-gray-800">{row.name}</td>
                <td className="py-3 px-4 text-gray-600">{row.bookings}</td>
                <td className="py-3 px-4 font-medium text-gray-800">{formatCurrency(row.revenue)}</td>
                <td className="py-3 px-4 text-gray-600">
                  {row.bookings > 0 ? formatCurrency(Math.round(row.revenue / row.bookings)) : "—"}
                </td>
              </tr>
            ))}
            <tr className="bg-gray-50 font-semibold">
              <td className="py-3 px-4">Tổng cộng</td>
              <td className="py-3 px-4">{revenue?.total_bookings || 0}</td>
              <td className="py-3 px-4">{formatCurrency(revenue?.total_revenue || 0)}</td>
              <td className="py-3 px-4">—</td>
            </tr>
          </tbody>
        </table>
      </div>
    </AdminLayout>
  );
}

