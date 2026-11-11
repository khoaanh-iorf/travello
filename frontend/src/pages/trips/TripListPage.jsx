import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import {
  Bus, Plane, Train, Plus, Eye, ChevronDown,
  RefreshCw, Search, AlertCircle,
} from "lucide-react";
import AdminLayout from "../../components/layout/AdminLayout";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import Modal from "../../components/ui/Modal";
import Pagination from "../../components/ui/Pagination";
import StatusBadge from "../../components/ui/StatusBadge";
import { getTrips, createTrip, updateTripStatus } from "../../api/tripApi";
import { getRoutes } from "../../api/routeApi";
import { getSuppliers } from "../../api/supplierApi";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SERVICE_TABS = [
  { value: "", label: "Tất cả", Icon: null },
  { value: "BUS", label: "Xe khách", Icon: Bus },
  { value: "FLIGHT", label: "Máy bay", Icon: Plane },
  { value: "TRAIN", label: "Tàu hỏa", Icon: Train },
];

const STATUS_OPTIONS = [
  { value: "", label: "Tất cả trạng thái" },
  { value: "SCHEDULED", label: "Đã lên lịch" },
  { value: "RUNNING", label: "Đang chạy" },
  { value: "COMPLETED", label: "Hoàn thành" },
  { value: "CANCELLED", label: "Đã hủy" },
];

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

const SVC_LABEL = { BUS: "Xe khách", FLIGHT: "Máy bay", TRAIN: "Tàu hỏa" };

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

async function loadAll(fetchFn, params) {
  const first = await fetchFn({ ...params, page: 1, limit: 100 });
  const result = first.data.data;
  const items = result.items || [];
  for (let p = 2; p <= (result.total_pages || 1); p++) {
    const r = await fetchFn({ ...params, page: p, limit: 100 });
    items.push(...(r.data.data.items || []));
  }
  return items;
}

// ---------------------------------------------------------------------------
// TripForm — Modal tạo chuyến mới
// ---------------------------------------------------------------------------

function TripForm({ routes, suppliers, onSubmit, saving }) {
  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm({
    defaultValues: {
      serviceType: "BUS",
      routeId: "",
      supplierId: "",
      departureTime: "",
      arrivalTime: "",
      basePrice: "",
      seatCapacity: "",
      flightNumber: "",
      trainNumber: "",
      providerTripCode: "",
    },
  });

  const serviceType = watch("serviceType");
  const supplierId = watch("supplierId");
  const availableRoutes = routes.filter(
    (r) => r.serviceType === serviceType && r.supplierId === supplierId && r.status === "ACTIVE"
  );
  const availableSuppliers = suppliers.filter(
    (s) => s.type === serviceType && s.status === "ACTIVE"
  );
  const supplierRegister = register("supplierId", { required: "Vui lòng chọn nhà cung cấp" });

  // Reset route/supplier khi đổi serviceType
  useEffect(() => {
    setValue("routeId", "");
    setValue("supplierId", "");
  }, [serviceType, setValue]);

  return (
    <form id="trip-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      {/* Loại phương tiện */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Loại phương tiện <span className="text-red-500">*</span>
        </label>
        <select
          {...register("serviceType", { required: true })}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
        >
          <option value="BUS">Xe khách</option>
          <option value="FLIGHT">Máy bay</option>
          <option value="TRAIN">Tàu hỏa</option>
        </select>
      </div>

      {/* Nhà cung cấp */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Nhà cung cấp <span className="text-red-500">*</span>
        </label>
        <select
          {...supplierRegister}
          onChange={(event) => {
            supplierRegister.onChange(event);
            setValue("routeId", "");
          }}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
        >
          <option value="">-- Chọn nhà cung cấp --</option>
          {availableSuppliers.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
        {errors.supplierId && <p className="text-red-500 text-xs mt-1">{errors.supplierId.message}</p>}
      </div>

      {/* Tuyến */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Tuyến đường <span className="text-red-500">*</span>
        </label>
        <select
          {...register("routeId", { required: "Vui lòng chọn tuyến" })}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          disabled={!supplierId}
        >
          <option value="">-- Chọn tuyến --</option>
          {availableRoutes.map((r) => (
            <option key={r.id} value={r.id}>
              {r.originName || r.originLocationId} → {r.destinationName || r.destinationLocationId}
            </option>
          ))}
        </select>
        {errors.routeId && <p className="text-red-500 text-xs mt-1">{errors.routeId.message}</p>}
        {supplierId && availableRoutes.length === 0 && (
          <p className="text-amber-600 text-xs mt-1">
            Nhà cung cấp này chưa có tuyến ACTIVE cho loại phương tiện đã chọn.
          </p>
        )}
      </div>

      {/* Số hiệu — riêng theo loại */}
      {serviceType === "FLIGHT" && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Số hiệu chuyến bay <span className="text-red-500">*</span>
          </label>
          <input
            {...register("flightNumber", { required: "Vui lòng nhập số hiệu chuyến bay" })}
            placeholder="Ví dụ: VN123"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
          {errors.flightNumber && <p className="text-red-500 text-xs mt-1">{errors.flightNumber.message}</p>}
        </div>
      )}

      {serviceType === "TRAIN" && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Số hiệu tàu <span className="text-red-500">*</span>
          </label>
          <input
            {...register("trainNumber", { required: "Vui lòng nhập số hiệu tàu" })}
            placeholder="Ví dụ: SE1"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
          {errors.trainNumber && <p className="text-red-500 text-xs mt-1">{errors.trainNumber.message}</p>}
        </div>
      )}

      {serviceType === "BUS" && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Mã chuyến của nhà xe (tùy chọn)
          </label>
          <input
            {...register("providerTripCode")}
            placeholder="Mã nội bộ nhà xe (nếu có)"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
          <p className="text-gray-400 text-xs mt-1">Mã hệ thống sẽ được tự động tạo.</p>
        </div>
      )}

      {/* Thời gian */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Giờ khởi hành <span className="text-red-500">*</span>
          </label>
          <input
            type="datetime-local"
            {...register("departureTime", { required: "Vui lòng nhập giờ khởi hành" })}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
          {errors.departureTime && <p className="text-red-500 text-xs mt-1">{errors.departureTime.message}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Giờ đến <span className="text-red-500">*</span>
          </label>
          <input
            type="datetime-local"
            {...register("arrivalTime", { required: "Vui lòng nhập giờ đến" })}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
          {errors.arrivalTime && <p className="text-red-500 text-xs mt-1">{errors.arrivalTime.message}</p>}
        </div>
      </div>

      {/* Giá & Sức chứa */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Giá cơ bản (VNĐ) <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            min="1000"
            step="1000"
            {...register("basePrice", {
              required: "Vui lòng nhập giá",
              min: { value: 1000, message: "Giá tối thiểu 1.000 VNĐ" },
            })}
            placeholder="150000"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
          {errors.basePrice && <p className="text-red-500 text-xs mt-1">{errors.basePrice.message}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Sức chứa (chỗ) <span className="text-red-500">*</span>
          </label>
          <input
            type="number"
            min="1"
            {...register("seatCapacity", {
              required: "Vui lòng nhập sức chứa",
              min: { value: 1, message: "Tối thiểu 1 chỗ" },
            })}
            placeholder="40"
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
          {errors.seatCapacity && <p className="text-red-500 text-xs mt-1">{errors.seatCapacity.message}</p>}
        </div>
      </div>

      {saving && (
        <p className="text-primary text-sm text-center animate-pulse">Đang tạo chuyến...</p>
      )}
    </form>
  );
}

// ---------------------------------------------------------------------------
// StatusDropdown — nút đổi trạng thái inline
// ---------------------------------------------------------------------------

function StatusDropdown({ trip, onStatusChange }) {
  const [open, setOpen] = useState(false);
  const nextStatuses = STATUS_NEXT[trip.status] || [];
  if (nextStatuses.length === 0) return <StatusBadge status={trip.status} />;

  return (
    <div className="relative inline-block">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 text-xs text-primary hover:underline"
      >
        <StatusBadge status={trip.status} />
        <ChevronDown size={12} />
      </button>
      {open && (
        <div className="absolute z-20 left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg min-w-[140px]">
          {nextStatuses.map((s) => (
            <button
              key={s}
              onClick={() => { setOpen(false); onStatusChange(trip, s); }}
              className="block w-full text-left px-3 py-2 text-xs hover:bg-gray-50 text-gray-700"
            >
              → {STATUS_LABELS[s]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// TripListPage
// ---------------------------------------------------------------------------

export default function TripListPage() {
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  // Filter state
  const [activeTab, setActiveTab] = useState("");   // serviceType
  const [filterStatus, setFilterStatus] = useState("");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [search, setSearch] = useState("");

  // Modal + confirm
  const [showCreate, setShowCreate] = useState(false);
  const [saving, setSaving] = useState(false);
  const [createError, setCreateError] = useState(null);

  const [confirmState, setConfirmState] = useState({
    open: false, trip: null, newStatus: null, loading: false,
  });

  // Options for form
  const [routes, setRoutes] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const optionsLoaded = useRef(false);

  const LIMIT = 10;

  const [optionsError, setOptionsError] = useState("");

  // Load options (routes + suppliers) once
  useEffect(() => {
    if (optionsLoaded.current) return;
    optionsLoaded.current = true;
    Promise.all([
      loadAll(getRoutes, {}),
      loadAll(getSuppliers, {}),
    ]).then(([r, s]) => {
      setRoutes(r);
      setSuppliers(s);
    }).catch((e) => {
      setOptionsError(e.response?.data?.message || "Không thể tải tuyến và nhà cung cấp");
    });
  }, []);

  const fetchTrips = useCallback(async (p = 1) => {
    setLoading(true);
    setError(null);
    try {
      const params = {
        page: p, limit: LIMIT,
        ...(activeTab && { serviceType: activeTab }),
        ...(filterStatus && { status: filterStatus }),
        ...(filterDateFrom && { dateFrom: filterDateFrom }),
        ...(filterDateTo && { dateTo: filterDateTo }),
        ...(search && { search }),
      };
      const res = await getTrips(params);
      const data = res.data.data;
      setTrips(data.items || []);
      setTotalPages(data.total_pages || 1);
      setTotal(data.total || 0);
      setPage(p);
    } catch (e) {
      setError(e.response?.data?.message || "Không thể tải danh sách chuyến");
    } finally {
      setLoading(false);
    }
  }, [activeTab, filterStatus, filterDateFrom, filterDateTo, search]);

  useEffect(() => { fetchTrips(1); }, [fetchTrips]);

  // Tạo chuyến
  const handleCreate = async (formData) => {
    setSaving(true);
    setCreateError(null);
    try {
      const payload = {
        ...formData,
        basePrice: Number(formData.basePrice),
        seatCapacity: Number(formData.seatCapacity),
      };
      await createTrip(payload);
      setShowCreate(false);
      fetchTrips(1);
    } catch (e) {
      setCreateError(e.response?.data?.message || "Tạo chuyến thất bại");
    } finally {
      setSaving(false);
    }
  };

  // Xác nhận đổi trạng thái
  const openStatusConfirm = (trip, newStatus) => {
    setConfirmState({ open: true, trip, newStatus, loading: false });
  };

  const handleStatusConfirm = async () => {
    const { trip, newStatus } = confirmState;
    setConfirmState((prev) => ({ ...prev, loading: true }));
    try {
      const res = await updateTripStatus(trip.id, trip.serviceType, newStatus);
      if (res.data.warning) {
        // eslint-disable-next-line no-alert
        alert(res.data.warning);
      }
      setConfirmState({ open: false, trip: null, newStatus: null, loading: false });
      fetchTrips(page);
    } catch (e) {
      alert(e.response?.data?.message || "Đổi trạng thái thất bại");
      setConfirmState((prev) => ({ ...prev, loading: false }));
    }
  };

  const SvcIcon = { BUS: Bus, FLIGHT: Plane, TRAIN: Train };

  return (
    <AdminLayout>
      <div className="p-6 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Chuyến chạy</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Quản lý lịch chạy xe khách, máy bay và tàu hỏa
            </p>
          </div>
          <button
            onClick={() => { setShowCreate(true); setCreateError(null); }}
            className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            <Plus size={16} /> Thêm chuyến
          </button>
        </div>

        {/* Service type tabs */}
        <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
          {SERVICE_TABS.map(({ value, label, Icon }) => (
            <button
              key={value}
              onClick={() => setActiveTab(value)}
              className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                activeTab === value
                  ? "bg-white text-primary shadow-sm"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              {Icon && <Icon size={14} />}
              {label}
            </button>
          ))}
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs text-gray-500 mb-1">Tìm kiếm</label>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && fetchTrips(1)}
                placeholder="Mã chuyến, số hiệu..."
                className="pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm w-full focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Trạng thái</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Từ ngày</label>
            <input
              type="date"
              value={filterDateFrom}
              onChange={(e) => setFilterDateFrom(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">Đến ngày</label>
            <input
              type="date"
              value={filterDateTo}
              onChange={(e) => setFilterDateTo(e.target.value)}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          <button
            onClick={() => fetchTrips(1)}
            className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            <RefreshCw size={14} /> Tìm
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-2 text-red-700 text-sm">
            <AlertCircle size={16} /> {error}
          </div>
        )}

        {/* Table */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
            <span className="text-sm text-gray-500">
              {loading ? "Đang tải..." : `${total} chuyến`}
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3 text-left">Mã / Số chuyến</th>
                  <th className="px-4 py-3 text-left">Loại</th>
                  <th className="px-4 py-3 text-left">Tuyến</th>
                  <th className="px-4 py-3 text-left">Nhà cung cấp</th>
                  <th className="px-4 py-3 text-left">Khởi hành</th>
                  <th className="px-4 py-3 text-left">Đến nơi</th>
                  <th className="px-4 py-3 text-right">Giá</th>
                  <th className="px-4 py-3 text-center">Chỗ còn</th>
                  <th className="px-4 py-3 text-left">Trạng thái</th>
                  <th className="px-4 py-3 text-center">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      {Array.from({ length: 10 }).map((__, j) => (
                        <td key={j} className="px-4 py-3">
                          <div className="h-4 bg-gray-100 rounded w-3/4" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : trips.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-4 py-10 text-center text-gray-400">
                      Không có chuyến nào
                    </td>
                  </tr>
                ) : (
                  trips.map((trip) => {
                    const Icon = SvcIcon[trip.serviceType];
                    const remaining = trip.remaining ?? (trip.seatCapacity - trip.bookedCount);
                    return (
                      <tr key={trip.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3 font-mono text-xs font-medium text-gray-800">
                          {trip.tripCode || "—"}
                        </td>
                        <td className="px-4 py-3">
                          <span className="flex items-center gap-1 text-xs text-gray-600">
                            {Icon && <Icon size={13} className="text-primary" />}
                            {SVC_LABEL[trip.serviceType]}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-700 max-w-[160px] truncate">
                          {trip.originName || "?"} → {trip.destinationName || "?"}
                        </td>
                        <td className="px-4 py-3 text-gray-600 text-xs">
                          {trip.providerName || "—"}
                        </td>
                        <td className="px-4 py-3 text-gray-600 text-xs whitespace-nowrap">
                          {fmt(trip.departureTime)}
                        </td>
                        <td className="px-4 py-3 text-gray-600 text-xs whitespace-nowrap">
                          {fmt(trip.arrivalTime)}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-800 font-medium text-xs">
                          {fmtVND(trip.basePrice)}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`text-xs font-semibold ${
                            remaining === 0 ? "text-red-600" :
                            remaining < 5 ? "text-amber-600" : "text-green-600"
                          }`}>
                            {remaining}/{trip.seatCapacity}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <StatusDropdown trip={trip} onStatusChange={openStatusConfirm} />
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Link
                            to={`/admin/trips/${trip.id}?serviceType=${trip.serviceType}`}
                            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                          >
                            <Eye size={13} /> Xem
                          </Link>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <Pagination
            page={page}
            totalPages={totalPages}
            onPageChange={(p) => fetchTrips(p)}
          />
        )}
      </div>

      {/* Modal tạo chuyến */}
      {showCreate && (
        <Modal
          onClose={() => setShowCreate(false)}
          title="Thêm chuyến chạy mới"
          size="lg"
        >
            {(createError || optionsError) && (
            <div role="alert" className="mb-3 bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm flex items-center gap-2">
                <AlertCircle size={14} /> {createError || optionsError}
            </div>
          )}
          <TripForm
            routes={routes}
            suppliers={suppliers}
            onSubmit={handleCreate}
            saving={saving}
          />
          <div className="flex gap-3 justify-end mt-5 pt-4 border-t border-gray-100">
            <button
              type="button"
              onClick={() => setShowCreate(false)}
              className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50"
            >
              Hủy
            </button>
            <button
              type="submit"
              form="trip-form"
              disabled={saving}
              className="px-4 py-2 text-sm bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-60"
            >
              {saving ? "Đang tạo..." : "Tạo chuyến"}
            </button>
          </div>
        </Modal>
      )}

      {/* Confirm đổi trạng thái — chỉ render khi open=true */}
      {confirmState.open && confirmState.trip && (
        <ConfirmDialog
          message={
            confirmState.newStatus === "CANCELLED"
              ? `Bạn có chắc muốn HỦY chuyến "${confirmState.trip.tripCode}"? Hành động này không thể hoàn tác và cần xử lý hoàn tiền cho khách đã đặt.`
              : `Chuyển trạng thái chuyến "${confirmState.trip.tripCode}" sang "${STATUS_LABELS[confirmState.newStatus]}"?`
          }
          onConfirm={handleStatusConfirm}
          onCancel={() => setConfirmState({ open: false, trip: null, newStatus: null, loading: false })}
          confirmLabel={confirmState.newStatus === "CANCELLED" ? "Xác nhận hủy" : "Xác nhận"}
          danger={confirmState.newStatus === "CANCELLED"}
        />
      )}
    </AdminLayout>
  );
}
