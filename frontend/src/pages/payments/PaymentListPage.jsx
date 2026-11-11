import { useEffect, useState } from "react";
import {
  ArrowDownToLine,
  ArrowLeftRight,
  CalendarDays,
  ChevronDown,
  CircleAlert,
  CircleCheck,
  Clock3,
  CreditCard,
  Search,
  X,
} from "lucide-react";
import AdminLayout from "../../components/layout/AdminLayout";
import { exportPayments, getPayments } from "../../api/paymentApi";
import { formatCurrency } from "../../utils/formatCurrency";

const STATUS_TABS = [
  { key: "ALL", label: "Tất cả" },
  { key: "PENDING", label: "Chờ thanh toán" },
  { key: "PAID", label: "Đã thanh toán" },
  { key: "FAILED", label: "Thất bại" },
];

const STATUS_STYLES = {
  PAID: "bg-emerald-50 text-emerald-700 ring-emerald-600/15",
  PENDING: "bg-amber-50 text-amber-700 ring-amber-600/15",
  FAILED: "bg-rose-50 text-rose-700 ring-rose-600/15",
};

const STATUS_LABELS = {
  PAID: "Thành công",
  PENDING: "Đang chờ",
  FAILED: "Thất bại",
};

const SERVICE_STYLES = {
  BUS: "bg-orange-50 text-orange-700",
  FLIGHT: "bg-sky-50 text-sky-700",
  TRAIN: "bg-violet-50 text-violet-700",
};

const SERVICE_LABELS = {
  BUS: "Xe khách",
  FLIGHT: "Máy bay",
  TRAIN: "Tàu hỏa",
};

function formatDate(value) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function StatusBadge({ status }) {
  const Icon = status === "PAID" ? CircleCheck : status === "FAILED" ? X : Clock3;
  const style = STATUS_STYLES[status] || "bg-slate-50 text-slate-700 ring-slate-500/15";
  const label = STATUS_LABELS[status] || status || "Chưa xác định";

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${style}`}>
      <Icon size={13} strokeWidth={2.2} />
      {label}
    </span>
  );
}

function StatCard({ title, value, caption, icon: Icon, tone }) {
  const tones = {
    blue: "bg-blue-50 text-blue-600",
    green: "bg-emerald-50 text-emerald-600",
    amber: "bg-amber-50 text-amber-600",
    red: "bg-rose-50 text-rose-600",
  };

  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm shadow-slate-200/40">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-slate-500">{title}</p>
          <p className="mt-3 text-2xl font-bold tracking-tight text-slate-900">{value}</p>
          <p className="mt-1 text-xs text-slate-400">{caption}</p>
        </div>
        <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${tones[tone]}`}>
          <Icon size={20} />
        </span>
      </div>
    </div>
  );
}

export default function PaymentListPage() {
  const [activeStatus, setActiveStatus] = useState("ALL");
  const [service, setService] = useState("ALL");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [refreshKey, setRefreshKey] = useState(0);
  const [payments, setPayments] = useState([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [summary, setSummary] = useState({ total: 0, revenue: 0, pending: 0, failed: 0 });
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");
  const pageSize = 10;

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      setError("");

      try {
        const response = await getPayments(
          { page, limit: pageSize, status: activeStatus, service, search: search.trim() },
          { signal: controller.signal },
        );
        const data = response.data.data;
        setPayments(data.items || []);
        setTotal(data.total || 0);
        setTotalPages(data.total_pages || 1);
        setSummary(data.summary || { total: 0, revenue: 0, pending: 0, failed: 0 });
      } catch (requestError) {
        if (requestError.name !== "CanceledError") {
          setPayments([]);
          setTotal(0);
          setTotalPages(1);
          setSummary({ total: 0, revenue: 0, pending: 0, failed: 0 });
          setError(requestError.response?.data?.message || "Không thể tải danh sách thanh toán.");
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 250);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [activeStatus, page, refreshKey, search, service]);

  const updateStatus = (status) => {
    setActiveStatus(status);
    setPage(1);
  };

  const updateService = (event) => {
    setService(event.target.value);
    setPage(1);
  };

  const updateSearch = (event) => {
    setSearch(event.target.value);
    setPage(1);
  };

  const exportCsv = async () => {
    setExporting(true);
    setError("");
    try {
      const response = await exportPayments({
        status: activeStatus,
        service,
        search: search.trim(),
      });
      const url = URL.createObjectURL(response.data);
      const link = document.createElement("a");
      link.href = url;
      link.download = "payments.csv";
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 0);
    } catch (requestError) {
      setError(requestError.response?.data?.message || "Không thể xuất danh sách thanh toán.");
    } finally {
      setExporting(false);
    }
  };

  return (
    <AdminLayout title="Quản lý thanh toán">
      <div className="mx-auto max-w-[1400px] space-y-6">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <div className="mb-2 flex items-center gap-2 text-xs font-medium text-slate-400">
              <span>Quản lý</span>
              <span className="text-slate-300">/</span>
              <span className="text-blue-600">Thanh toán</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Quản lý thanh toán</h1>
            <p className="mt-1 text-sm text-slate-500">
              Theo dõi giao dịch và trạng thái thanh toán của các đơn đặt dịch vụ.
            </p>
          </div>
          <button
            type="button"
            onClick={exportCsv}
            disabled={exporting}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 disabled:cursor-wait disabled:opacity-60"
          >
            <ArrowDownToLine size={16} />
            {exporting ? "Đang xuất..." : "Xuất danh sách"}
          </button>
        </div>

        {error && (
          <div role="alert" className="flex items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
            <span>{error}</span>
            <button
              type="button"
              onClick={() => setRefreshKey((key) => key + 1)}
              className="shrink-0 font-semibold underline underline-offset-2"
            >
              Thử lại
            </button>
          </div>
        )}

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            title="Tổng giao dịch"
            value={summary.total}
            caption="Tất cả giao dịch"
            icon={ArrowLeftRight}
            tone="blue"
          />
          <StatCard
            title="Tổng tiền thành công"
            value={formatCurrency(summary.revenue)}
            caption="Chỉ tính giao dịch đã thanh toán"
            icon={CreditCard}
            tone="green"
          />
          <StatCard
            title="Đang chờ thanh toán"
            value={summary.pending}
            caption="Giao dịch cần theo dõi"
            icon={Clock3}
            tone="amber"
          />
          <StatCard
            title="Giao dịch thất bại"
            value={summary.failed}
            caption="Không bao gồm giao dịch đang chờ"
            icon={CircleAlert}
            tone="red"
          />
        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm shadow-slate-200/40">
          <div className="border-b border-slate-100 px-5 pt-5">
            <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
              <div>
                <h2 className="text-base font-bold text-slate-900">Danh sách giao dịch</h2>
                <p className="mt-1 text-xs text-slate-400">Tìm kiếm theo mã giao dịch, booking, nhà cung cấp hoặc khách hàng.</p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <label className="relative block sm:w-80">
                  <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    value={search}
                    onChange={updateSearch}
                    placeholder="Tìm mã giao dịch, booking..."
                    className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm text-slate-700 outline-none transition placeholder:text-slate-400 focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
                  />
                </label>
                <label className="relative">
                  <CalendarDays size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <select
                    value={service}
                    onChange={updateService}
                    className="h-10 appearance-none rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-9 text-sm text-slate-600 outline-none transition focus:border-blue-400 focus:ring-4 focus:ring-blue-50"
                    aria-label="Lọc theo dịch vụ"
                  >
                    <option value="ALL">Tất cả dịch vụ</option>
                    <option value="BUS">Xe khách</option>
                    <option value="FLIGHT">Máy bay</option>
                    <option value="TRAIN">Tàu hỏa</option>
                  </select>
                  <ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                </label>
              </div>
            </div>

            <div className="mt-5 flex gap-5 overflow-x-auto">
              {STATUS_TABS.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => updateStatus(tab.key)}
                  className={`relative whitespace-nowrap pb-3 text-sm font-semibold transition ${
                    activeStatus === tab.key
                      ? "text-blue-700"
                      : "text-slate-400 hover:text-slate-700"
                  }`}
                >
                  {tab.label}
                  {activeStatus === tab.key && (
                    <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-blue-600" />
                  )}
                </button>
              ))}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead className="bg-slate-50/80 text-xs font-semibold uppercase tracking-wide text-slate-400">
                <tr>
                  <th className="px-5 py-3.5">Giao dịch / Booking</th>
                  <th className="px-4 py-3.5">Dịch vụ</th>
                  <th className="px-4 py-3.5">Nhà cung cấp</th>
                  <th className="px-4 py-3.5">Thời gian</th>
                  <th className="px-4 py-3.5 text-right">Số tiền</th>
                  <th className="px-5 py-3.5">Trạng thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {payments.map((payment) => (
                  <tr key={payment.id} className="transition hover:bg-slate-50/70">
                    <td className="px-5 py-4">
                      <p className="font-semibold text-slate-800">{payment.transactionCode}</p>
                      <p className="mt-1 text-xs text-slate-400">{payment.bookingCode}</p>
                    </td>
                    <td className="px-4 py-4">
                      <span className={`inline-flex rounded-lg px-2.5 py-1 text-xs font-semibold ${SERVICE_STYLES[payment.orderType] || "bg-slate-100 text-slate-600"}`}>
                        {SERVICE_LABELS[payment.orderType] || payment.orderType || "Khác"}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <p className="font-medium text-slate-700">{payment.provider}</p>
                      <p className="mt-1 text-xs text-slate-400">User: {payment.userId}</p>
                    </td>
                    <td className="px-4 py-4">
                      <p className="text-slate-600">{formatDate(payment.createdAt)}</p>
                      {payment.paidAt && (
                        <p className="mt-1 text-xs text-slate-400">Đã trả: {formatDate(payment.paidAt)}</p>
                      )}
                    </td>
                    <td className="px-4 py-4 text-right">
                      <p className="font-bold text-slate-800">
                        {payment.amount == null ? "—" : formatCurrency(payment.amount, payment.currency || "VND")}
                      </p>
                      <p className="mt-1 text-xs text-slate-400">{payment.currency || "—"}</p>
                    </td>
                    <td className="px-5 py-4">
                      <StatusBadge status={payment.status} />
                    </td>
                  </tr>
                ))}
                {loading && (
                  <tr>
                    <td colSpan={6} className="px-5 py-16 text-center text-sm text-slate-400">
                      Đang tải giao dịch...
                    </td>
                  </tr>
                )}
                {!loading && payments.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-5 py-16 text-center">
                      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
                        <Search size={20} />
                      </div>
                      <p className="mt-3 font-semibold text-slate-700">Không tìm thấy giao dịch</p>
                      <p className="mt-1 text-sm text-slate-400">Thử thay đổi từ khóa hoặc bộ lọc.</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-3 border-t border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-slate-500">
              Hiển thị{" "}
              <span className="font-semibold text-slate-700">
                {total === 0 ? 0 : (page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)}
              </span>{" "}
              trong <span className="font-semibold text-slate-700">{total}</span> giao dịch
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                disabled={page === 1}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Trước
              </button>
              <span className="px-2 text-sm text-slate-500">
                Trang <span className="font-semibold text-slate-700">{page}</span> / {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setPage((current) => Math.min(totalPages, current + 1))}
                disabled={page >= totalPages}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Sau
              </button>
            </div>
          </div>
        </section>
      </div>
    </AdminLayout>
  );
}
