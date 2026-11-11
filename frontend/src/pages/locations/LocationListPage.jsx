import { useEffect, useState, useCallback } from "react";
import AdminLayout from "../../components/layout/AdminLayout";
import StatusBadge from "../../components/ui/StatusBadge";
import Pagination from "../../components/ui/Pagination";
import Modal from "../../components/ui/Modal";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import {
  getLocations, getLocationById, createLocation,
  updateLocation, deleteLocation, updateLocationStatus,
  toggleFeaturedLocation,
} from "../../api/locationApi";
import { formatDate } from "../../utils/formatDate";
import {
  Search, Plus, Pencil, Trash2, Eye,
  RotateCw, Star, ToggleLeft, ToggleRight,
  Plane, Train, Bus, MapPin,
} from "lucide-react";
import { useForm } from "react-hook-form";

// ── Hằng số ──────────────────────────────────────────────────────────────────
const LOCATION_TYPES = [
  { value: "",              label: "Tất cả loại",     icon: null },
  { value: "AIRPORT",       label: "Sân bay",          icon: "✈️" },
  { value: "TRAIN_STATION", label: "Ga tàu hỏa",       icon: "🚂" },
  { value: "BUS_STATION",   label: "Bến xe khách",     icon: "🚌" },
  { value: "OTHER",         label: "Điểm đón / Khác",  icon: "📍" },
];

const STATUS_OPTS = [
  { value: "",         label: "Tất cả trạng thái" },
  { value: "ACTIVE",   label: "Đang hoạt động" },
  { value: "INACTIVE", label: "Tạm ngưng" },
];

const TIMEZONES = [
  "Asia/Ho_Chi_Minh",
  "Asia/Bangkok",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Asia/Seoul",
  "UTC",
];

// ── Helpers ───────────────────────────────────────────────────────────────────
const typeConfig = {
  AIRPORT:       { label: "Sân bay",         icon: "✈️", cls: "bg-blue-50 text-blue-700 border-blue-100" },
  TRAIN_STATION: { label: "Ga tàu hỏa",       icon: "🚂", cls: "bg-purple-50 text-purple-700 border-purple-100" },
  BUS_STATION:   { label: "Bến xe khách",     icon: "🚌", cls: "bg-amber-50 text-amber-700 border-amber-100" },
  OTHER:         { label: "Điểm đón / Khác",  icon: "📍", cls: "bg-gray-100 text-gray-700 border-gray-200" },
};

function TypeBadge({ type }) {
  const cfg = typeConfig[type] || { label: type, icon: "📍", cls: "bg-gray-100 text-gray-700" };
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border ${cfg.cls}`}>
      <span>{cfg.icon}</span>
      <span>{cfg.label}</span>
    </span>
  );
}

// ── Form Thêm / Sửa ───────────────────────────────────────────────────────────
function LocationForm({ defaultValues, onSubmit, onCancel, saving }) {
  const { register, handleSubmit, formState: { errors }, watch, setValue } = useForm({
    defaultValues: {
      code: "",
      external_code: "",
      name: "",
      type: "AIRPORT",
      city: "",
      country: "VN",
      address: "",
      timezone: "Asia/Ho_Chi_Minh",
      status: "ACTIVE",
      ...defaultValues,
    },
  });

  // Tự động uppercase mã nội bộ khi gõ
  const codeValue = watch("code");
  useEffect(() => {
    if (codeValue !== codeValue?.toUpperCase()) {
      setValue("code", codeValue?.toUpperCase());
    }
  }, [codeValue, setValue]);

  const selectedType = watch("type");

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      {/* ── Phân loại ── */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          Loại địa điểm <span className="text-red-500">*</span>
        </label>
        <div className="grid grid-cols-4 gap-2">
          {LOCATION_TYPES.filter(t => t.value).map((t) => (
            <label
              key={t.value}
              className={`flex flex-col items-center gap-1 p-2.5 rounded-xl border-2 cursor-pointer transition-all text-xs font-medium ${
                selectedType === t.value
                  ? "border-primary bg-primary/5 text-primary"
                  : "border-gray-200 text-gray-500 hover:border-gray-300"
              }`}
            >
              <input type="radio" value={t.value} {...register("type", { required: true })} className="sr-only" />
              <span className="text-xl">{t.icon}</span>
              <span className="text-center leading-tight">{t.label}</span>
            </label>
          ))}
        </div>
        {errors.type && <p className="text-red-500 text-xs mt-1">Vui lòng chọn loại địa điểm</p>}
      </div>

      {/* ── Mã định danh ── */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Mã nội bộ hệ thống <span className="text-red-500">*</span>
            <span className="text-xs text-gray-400 font-normal ml-1">(2–20 ký tự in hoa)</span>
          </label>
          <input
            className="input-field uppercase font-mono tracking-widest"
            placeholder="VD: SGN, BX-MD, GA-HN"
            {...register("code", {
              required: "Mã nội bộ là bắt buộc",
              pattern: { value: /^[A-Z0-9\-_]{2,20}$/, message: "Chỉ dùng chữ in hoa, số, gạch ngang (2–20 ký tự)" },
            })}
          />
          {errors.code && <p className="text-red-500 text-xs mt-1">{errors.code.message}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Mã chuẩn ngành (Tùy chọn)
            <span className="text-xs text-gray-400 font-normal ml-1">(IATA, ICAO, Mã ga...)</span>
          </label>
          <input
            className="input-field uppercase font-mono"
            placeholder="VD: SGN, VVTS, HAN"
            {...register("external_code")}
          />
        </div>
      </div>

      {/* ── Tên địa điểm ── */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Tên địa điểm <span className="text-red-500">*</span>
        </label>
        <input
          className="input-field"
          placeholder="VD: Sân bay Quốc tế Tân Sơn Nhất"
          {...register("name", { required: "Tên địa điểm là bắt buộc" })}
        />
        {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
      </div>

      {/* ── Tỉnh thành + Quốc gia ── */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Thành phố / Tỉnh <span className="text-red-500">*</span>
          </label>
          <input
            className="input-field"
            placeholder="VD: TP. Hồ Chí Minh, Đà Nẵng"
            {...register("city", { required: "Thành phố là bắt buộc" })}
          />
          {errors.city && <p className="text-red-500 text-xs mt-1">{errors.city.message}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Quốc gia</label>
          <input className="input-field" {...register("country")} />
        </div>
      </div>

      {/* ── Địa chỉ chi tiết ── */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Địa chỉ chi tiết</label>
        <input
          className="input-field"
          placeholder="VD: Đường Trường Sơn, Phường 2, Quận Tân Bình"
          {...register("address")}
        />
      </div>

      {/* ── Múi giờ + Trạng thái ── */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Múi giờ</label>
          <select className="input-field" {...register("timezone")}>
            {TIMEZONES.map((tz) => (
              <option key={tz} value={tz}>{tz}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Trạng thái hoạt động</label>
          <select className="input-field" {...register("status")}>
            <option value="ACTIVE">🟢 Đang hoạt động</option>
            <option value="INACTIVE">🔴 Tạm ngưng</option>
          </select>
        </div>
      </div>

      {/* ── Nút hành động ── */}
      <div className="flex justify-end gap-3 pt-2 border-t border-gray-100">
        <button type="button" onClick={onCancel} className="btn-secondary text-sm">Hủy</button>
        <button type="submit" disabled={saving} className="btn-primary text-sm min-w-[120px]">
          {saving ? "Đang lưu..." : "Lưu địa điểm"}
        </button>
      </div>
    </form>
  );
}

// ── Modal Xem chi tiết ────────────────────────────────────────────────────────
function LocationDetailModal({ locationId, onClose }) {
  const [loc, setLoc] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getLocationById(locationId)
      .then((r) => setLoc(r.data.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [locationId]);

  if (loading) return (
    <Modal title="Chi tiết địa điểm" onClose={onClose}>
      <div className="py-10 text-center text-gray-400">Đang tải thông tin...</div>
    </Modal>
  );

  if (!loc) return (
    <Modal title="Chi tiết địa điểm" onClose={onClose}>
      <div className="py-10 text-center text-gray-400">Không tìm thấy địa điểm</div>
    </Modal>
  );

  const cfg = typeConfig[loc.type] || typeConfig.OTHER;

  return (
    <Modal title="Chi tiết địa điểm" onClose={onClose} size="lg">
      {/* Header */}
      <div className={`-mx-6 -mt-2 px-6 py-4 mb-5 rounded-t-none border-b ${
        loc.type === "AIRPORT"       ? "bg-blue-50 border-blue-100" :
        loc.type === "TRAIN_STATION" ? "bg-purple-50 border-purple-100" :
        loc.type === "BUS_STATION"   ? "bg-amber-50 border-amber-100" :
        "bg-gray-50 border-gray-100"
      }`}>
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-2xl">{cfg.icon}</span>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${cfg.cls}`}>{cfg.label}</span>
              <StatusBadge status={loc.status} />
              {loc.featured && (
                <span className="inline-flex items-center gap-0.5 text-xs font-medium text-yellow-600 bg-yellow-50 border border-yellow-200 px-2 py-0.5 rounded-full">
                  <Star size={10} fill="currentColor" /> Nổi bật
                </span>
              )}
            </div>
            <h3 className="text-lg font-bold text-gray-800">{loc.name}</h3>
            <p className="text-sm text-gray-500 mt-0.5">{loc.city}{loc.country ? ` · ${loc.country}` : ""}</p>
          </div>
        </div>
      </div>

      {/* Thông tin mã */}
      <div className="grid grid-cols-2 gap-4 mb-5">
        <div className="bg-gray-50 rounded-xl p-4">
          <p className="text-xs text-gray-400 mb-1 font-medium uppercase tracking-wide">Mã nội bộ hệ thống</p>
          <p className="text-xl font-bold font-mono text-gray-800 tracking-widest">{loc.code}</p>
        </div>
        <div className="bg-gray-50 rounded-xl p-4">
          <p className="text-xs text-gray-400 mb-1 font-medium uppercase tracking-wide">Mã chuẩn ngành (IATA/ICAO/...)</p>
          <p className="text-xl font-bold font-mono text-gray-800 tracking-widest">{loc.external_code || <span className="text-gray-300">Chưa có</span>}</p>
        </div>
      </div>

      {/* Chi tiết địa lý */}
      <div className="space-y-3 mb-5">
        <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Thông tin địa lý</h4>
        <div className="grid grid-cols-2 gap-3">
          {[
            ["🏙️ Thành phố / Tỉnh", loc.city],
            ["🌐 Quốc gia", loc.country],
            ["🕐 Múi giờ", loc.timezone],
            ["🗺️ Loại địa điểm", cfg.label],
          ].map(([k, v]) => (
            <div key={k} className="flex flex-col gap-0.5">
              <span className="text-xs text-gray-400">{k}</span>
              <span className="text-sm font-medium text-gray-700">{v || "—"}</span>
            </div>
          ))}
        </div>
        {loc.address && (
          <div className="flex flex-col gap-0.5">
            <span className="text-xs text-gray-400">📍 Địa chỉ chi tiết</span>
            <span className="text-sm font-medium text-gray-700">{loc.address}</span>
          </div>
        )}
      </div>

      {/* Dấu vết hệ thống */}
      <div className="border-t border-gray-100 pt-4">
        <div className="grid grid-cols-2 gap-3 text-xs text-gray-400">
          <div><span>Ngày tạo:</span> <span className="text-gray-600 font-medium">{formatDate(loc.created_at, "HH:mm dd/MM/yyyy")}</span></div>
          <div><span>Cập nhật:</span> <span className="text-gray-600 font-medium">{formatDate(loc.updated_at, "HH:mm dd/MM/yyyy")}</span></div>
        </div>
      </div>
    </Modal>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function LocationListPage() {
  const [locations, setLocations]       = useState([]);
  const [page, setPage]                 = useState(1);
  const [totalPages, setTotalPages]     = useState(1);
  const [totalActive, setTotalActive]   = useState(0);
  const [totalAll, setTotalAll]         = useState(0);
  const [loading, setLoading]           = useState(false);

  // Filters
  const [search, setSearch]             = useState("");
  const [typeFilter, setTypeFilter]     = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  // Modal state
  const [formModal, setFormModal]       = useState(null); // null | { mode: 'create'|'edit', data }
  const [detailId, setDetailId]         = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [togglingId, setTogglingId]     = useState(null);
  const [saving, setSaving]             = useState(false);

  // ── Fetch ────────────────────────────────────────────────────────────────
  const fetchLocations = useCallback(async (p = 1) => {
    setLoading(true);
    try {
      const res = await getLocations({
        page: p, limit: 10,
        search, type: typeFilter, status: statusFilter,
      });
      const d = res.data.data;
      setLocations(d.items || []);
      setPage(d.page);
      setTotalPages(d.total_pages || 1);
      setTotalActive(res.data.total_active ?? 0);
      setTotalAll(res.data.total_all ?? 0);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  }, [search, typeFilter, statusFilter]);

  useEffect(() => { fetchLocations(1); }, []);

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleSearch = (e) => {
    e.preventDefault();
    fetchLocations(1);
  };

  const handleReset = () => {
    setSearch(""); setTypeFilter(""); setStatusFilter("");
    // Fetch với giá trị mặc định trực tiếp
    setLoading(true);
    getLocations({ page: 1, limit: 10, search: "", type: "", status: "" })
      .then((res) => {
        const d = res.data.data;
        setLocations(d.items || []);
        setPage(d.page);
        setTotalPages(d.total_pages || 1);
        setTotalActive(res.data.total_active ?? 0);
        setTotalAll(res.data.total_all ?? 0);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  };

  const handleFormSubmit = async (data) => {
    setSaving(true);
    try {
      if (formModal.mode === "create") {
        await createLocation(data);
      } else {
        await updateLocation(formModal.data.id, data);
      }
      setFormModal(null);
      fetchLocations(page);
    } catch (err) {
      alert(err.response?.data?.message || "Thao tác thất bại");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    try {
      await deleteLocation(confirmDelete.id);
      setConfirmDelete(null);
      fetchLocations(page);
    } catch (err) {
      alert(err.response?.data?.message || "Xóa thất bại");
    }
  };

  const handleToggleStatus = async (loc) => {
    setTogglingId(loc.id);
    const newStatus = loc.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    try {
      await updateLocationStatus(loc.id, newStatus);
      // Cập nhật local state ngay để UI phản hồi tức thì
      setLocations((prev) =>
        prev.map((l) => l.id === loc.id ? { ...l, status: newStatus } : l)
      );
    } catch (err) {
      alert(err.response?.data?.message || "Thao tác thất bại");
    } finally {
      setTogglingId(null);
    }
  };

  const handleToggleFeatured = async (loc) => {
    try {
      await toggleFeaturedLocation(loc.id, !loc.featured);
      setLocations((prev) =>
        prev.map((l) => l.id === loc.id ? { ...l, featured: !loc.featured } : l)
      );
    } catch (err) {
      alert(err.response?.data?.message || "Thao tác thất bại");
    }
  };

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <AdminLayout title="Không gian quản trị">
      {/* ── Page Header ── */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Quản lý địa điểm</h1>
          <p className="text-sm text-gray-500 mt-1">
            Quản lý danh sách sân bay, ga tàu, bến xe và điểm đón toàn hệ thống
          </p>
        </div>
        <button
          onClick={() => setFormModal({ mode: "create", data: null })}
          className="btn-primary flex items-center gap-2 text-sm"
        >
          <Plus size={16} /> Thêm địa điểm
        </button>
      </div>

      {/* ── Stat Cards ── */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: "Tổng địa điểm",    value: totalAll,                icon: "🗺️",  cls: "border-blue-100" },
          { label: "Đang hoạt động",    value: totalActive,             icon: "🟢", cls: "border-green-100" },
          { label: "Tạm ngưng",         value: totalAll - totalActive,  icon: "🔴", cls: "border-red-100" },
          { label: "Trang hiện tại",    value: `${page} / ${totalPages || 1}`, icon: "📄", cls: "border-gray-100" },
        ].map((s) => (
          <div key={s.label} className={`bg-white rounded-xl border ${s.cls} p-4`}>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-lg">{s.icon}</span>
              <p className="text-xs text-gray-400 font-medium">{s.label}</p>
            </div>
            <p className="text-2xl font-bold text-gray-800">{s.value}</p>
          </div>
        ))}
      </div>

      {/* ── Filter + Table Card ── */}
      <div className="card">
        {/* Filter Bar */}
        <form onSubmit={handleSearch} className="flex flex-wrap items-center gap-3 mb-6">
          <div className="flex-1 min-w-[260px] relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm theo tên, mã code, IATA, thành phố, địa chỉ..."
              className="input-field pl-9"
            />
          </div>

          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="input-field w-44">
            {LOCATION_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.icon ? `${t.icon} ${t.label}` : t.label}</option>
            ))}
          </select>

          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="input-field w-44">
            {STATUS_OPTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>

          <button type="submit" className="btn-primary flex items-center gap-1.5 text-sm">
            <Search size={15} /> Lọc
          </button>
          <button type="button" onClick={handleReset} className="btn-secondary flex items-center gap-1.5 text-sm">
            <RotateCw size={14} className={loading ? "animate-spin" : ""} /> Làm mới
          </button>
        </form>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b border-gray-100 bg-gray-50/60">
                <th className="py-3 px-3 font-medium">Mã nội bộ</th>
                <th className="py-3 px-3 font-medium">Mã chuẩn ngành</th>
                <th className="py-3 px-3 font-medium">Tên địa điểm</th>
                <th className="py-3 px-3 font-medium">Phân loại</th>
                <th className="py-3 px-3 font-medium">Thành phố / Địa chỉ</th>
                <th className="py-3 px-3 font-medium text-center">Nổi bật</th>
                <th className="py-3 px-3 font-medium">Trạng thái</th>
                <th className="py-3 px-3 font-medium text-right">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {locations.map((loc) => {
                const isToggling = togglingId === loc.id;
                const isActive = loc.status === "ACTIVE";
                return (
                  <tr key={loc.id} className="border-b border-gray-50 hover:bg-gray-50/60 transition-colors">
                    {/* Mã nội bộ */}
                    <td className="py-3.5 px-3">
                      <span className="font-mono font-bold text-gray-800 tracking-widest bg-gray-100 px-2 py-0.5 rounded text-xs">
                        {loc.code}
                      </span>
                    </td>

                    {/* Mã chuẩn ngành */}
                    <td className="py-3.5 px-3">
                      {loc.external_code
                        ? <span className="font-mono text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded">{loc.external_code}</span>
                        : <span className="text-gray-300 text-xs">—</span>
                      }
                    </td>

                    {/* Tên */}
                    <td className="py-3.5 px-3 font-medium text-gray-800 max-w-[220px]">
                      <span className="line-clamp-1">{loc.name}</span>
                    </td>

                    {/* Phân loại */}
                    <td className="py-3.5 px-3">
                      <TypeBadge type={loc.type} />
                    </td>

                    {/* Thành phố / Địa chỉ */}
                    <td className="py-3.5 px-3">
                      <p className="text-gray-700 font-medium text-xs">{loc.city}</p>
                      {loc.address && (
                        <p className="text-gray-400 text-xs mt-0.5 line-clamp-1 max-w-[160px]">{loc.address}</p>
                      )}
                    </td>

                    {/* Nổi bật */}
                    <td className="py-3.5 px-3 text-center">
                      <button
                        onClick={() => handleToggleFeatured(loc)}
                        title={loc.featured ? "Bỏ nổi bật" : "Đánh dấu nổi bật"}
                        className={`transition-all duration-200 ${loc.featured ? "text-yellow-500 hover:text-yellow-600" : "text-gray-200 hover:text-yellow-400"}`}
                      >
                        <Star size={16} fill={loc.featured ? "currentColor" : "none"} />
                      </button>
                    </td>

                    {/* Trạng thái (Toggle 1-click) */}
                    <td className="py-3.5 px-3">
                      <button
                        onClick={() => handleToggleStatus(loc)}
                        disabled={isToggling}
                        title={isActive ? "Nhấn để tạm ngưng" : "Nhấn để kích hoạt"}
                        className={`flex items-center gap-1.5 transition-all duration-200 disabled:opacity-60 ${
                          isActive ? "text-green-600 hover:text-green-700" : "text-gray-400 hover:text-green-500"
                        }`}
                      >
                        {isActive
                          ? <ToggleRight size={22} />
                          : <ToggleLeft size={22} />
                        }
                        <span className="text-xs font-medium">
                          {isToggling ? "..." : isActive ? "Hoạt động" : "Tạm ngưng"}
                        </span>
                      </button>
                    </td>

                    {/* Thao tác */}
                    <td className="py-3.5 px-3">
                      <div className="flex gap-1.5 justify-end">
                        <button
                          onClick={() => setDetailId(loc.id)}
                          title="Xem chi tiết"
                          className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
                        >
                          <Eye size={15} />
                        </button>
                        <button
                          onClick={() => setFormModal({ mode: "edit", data: loc })}
                          title="Chỉnh sửa"
                          className="p-1.5 text-gray-400 hover:text-primary hover:bg-blue-50 rounded-lg transition-colors"
                        >
                          <Pencil size={15} />
                        </button>
                        <button
                          onClick={() => setConfirmDelete(loc)}
                          title="Xóa"
                          className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {!loading && locations.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-16 text-center">
                    <div className="flex flex-col items-center gap-2 text-gray-400">
                      <MapPin size={32} className="opacity-30" />
                      <p className="font-medium">Không tìm thấy địa điểm nào</p>
                      <p className="text-xs">Thử thay đổi bộ lọc hoặc thêm địa điểm mới</p>
                    </div>
                  </td>
                </tr>
              )}

              {loading && (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-gray-400">
                    <RotateCw size={20} className="animate-spin mx-auto mb-2" />
                    Đang tải dữ liệu...
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination footer */}
        <div className="flex items-center justify-between pt-4 mt-2 border-t border-gray-100">
          <span className="text-sm text-gray-400">
            Hiển thị {locations.length} / {totalAll} địa điểm
          </span>
          <Pagination page={page} totalPages={totalPages} onPageChange={fetchLocations} />
        </div>
      </div>

      {/* ── Modals ── */}

      {/* Form Thêm / Sửa */}
      {formModal && (
        <Modal
          title={formModal.mode === "create" ? "✈️ Thêm địa điểm mới" : "✏️ Chỉnh sửa địa điểm"}
          onClose={() => setFormModal(null)}
          size="lg"
        >
          <LocationForm
            defaultValues={formModal.data || {}}
            onSubmit={handleFormSubmit}
            onCancel={() => setFormModal(null)}
            saving={saving}
          />
        </Modal>
      )}

      {/* Modal Chi tiết */}
      {detailId && (
        <LocationDetailModal
          locationId={detailId}
          onClose={() => setDetailId(null)}
        />
      )}

      {/* Confirm Xóa */}
      {confirmDelete && (
        <ConfirmDialog
          message={`Xóa địa điểm "${confirmDelete.name}" (${confirmDelete.code})?`}
          confirmLabel="Xóa địa điểm"
          danger={true}
          onConfirm={handleDelete}
          onCancel={() => setConfirmDelete(null)}
        />
      )}
    </AdminLayout>
  );
}
