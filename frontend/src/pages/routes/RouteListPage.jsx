import { useCallback, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { Eye, Pencil, Plus, Search, ToggleLeft, ToggleRight } from "lucide-react";
import AdminLayout from "../../components/layout/AdminLayout";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import Modal from "../../components/ui/Modal";
import Pagination from "../../components/ui/Pagination";
import StatusBadge from "../../components/ui/StatusBadge";
import { getLocations } from "../../api/locationApi";
import { getRouteById, getRoutes, createRoute, updateRoute, updateRouteStatus } from "../../api/routeApi";
import { getSuppliers } from "../../api/supplierApi";

const SERVICE_TYPES = [
  { value: "BUS", label: "Xe khách", locationType: "BUS_STATION" },
  { value: "FLIGHT", label: "Máy bay", locationType: "AIRPORT" },
  { value: "TRAIN", label: "Tàu hỏa", locationType: "TRAIN_STATION" },
];
const STATUS_OPTIONS = [
  { value: "", label: "Tất cả trạng thái" },
  { value: "ACTIVE", label: "Đang hoạt động" },
  { value: "INACTIVE", label: "Tạm ngưng" },
];

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

function RouteForm({ suppliers, locations, defaultValues, onSubmit, saving, submitLabel }) {
  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm({
    defaultValues,
  });
  const serviceTypeField = register("serviceType", { required: true });
  const serviceType = watch("serviceType");
  const originLocationId = watch("originLocationId");
  const matchingService = SERVICE_TYPES.find((item) => item.value === serviceType);
  const availableSuppliers = suppliers.filter((item) => item.type === serviceType && item.status === "ACTIVE");
  const availableLocations = locations.filter((item) => (
    item.status === "ACTIVE" && [matchingService?.locationType, "OTHER"].includes(item.type)
  ));

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Loại phương tiện *</label>
        <select
          className="input-field"
          {...serviceTypeField}
          onChange={(event) => {
            serviceTypeField.onChange(event);
            setValue("supplierId", "");
            setValue("originLocationId", "");
            setValue("destinationLocationId", "");
          }}
        >
          {SERVICE_TYPES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Nhà cung cấp *</label>
        <select className="input-field" {...register("supplierId", { required: "Vui lòng chọn nhà cung cấp" })}>
          <option value="">— Chọn nhà cung cấp —</option>
          {availableSuppliers.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
        </select>
        {errors.supplierId && <p className="text-red-500 text-xs mt-1">{errors.supplierId.message}</p>}
        {availableSuppliers.length === 0 && <p className="text-amber-600 text-xs mt-1">Chưa có nhà cung cấp đang hoạt động cho loại phương tiện này.</p>}
      </div>
      {["originLocationId", "destinationLocationId"].map((field, index) => (
        <div key={field}>
          <label className="block text-sm font-medium text-gray-700 mb-1">{index === 0 ? "Điểm đi" : "Điểm đến"} *</label>
          <select
            className="input-field"
            {...register(field, {
              required: `Vui lòng chọn ${index === 0 ? "điểm đi" : "điểm đến"}`,
              validate: (value) => field !== "destinationLocationId" || value !== originLocationId || "Điểm đi và điểm đến phải khác nhau",
            })}
          >
            <option value="">— Chọn địa điểm —</option>
            {availableLocations.map((item) => <option key={item.id} value={item.id}>{item.name} — {item.city}</option>)}
          </select>
          {errors[field] && <p className="text-red-500 text-xs mt-1">{errors[field].message}</p>}
        </div>
      ))}
      <p className="text-xs text-gray-500">
        Tuyến trùng chỉ bị từ chối trong phạm vi cùng nhà cung cấp, cùng phương tiện và cùng chiều đi.
      </p>
      <div className="flex justify-end pt-2">
        <button type="submit" disabled={saving} className="btn-primary text-sm">
          {saving ? "Đang lưu..." : submitLabel}
        </button>
      </div>
    </form>
  );
}

export default function RouteListPage() {
  const [routes, setRoutes] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [locations, setLocations] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [serviceFilter, setServiceFilter] = useState("");
  const [supplierFilter, setSupplierFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [filters, setFilters] = useState({ search: "", serviceType: "", supplierId: "", status: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [routeModal, setRouteModal] = useState(null);
  const [selectedRoute, setSelectedRoute] = useState(null);
  const [confirmToggle, setConfirmToggle] = useState(null);

  const fetchRoutes = useCallback(async (targetPage = 1) => {
    try {
      const response = await getRoutes({
        page: targetPage, limit: 10, ...filters,
      });
      const data = response.data.data;
      setRoutes(data.items || []);
      setPage(data.page || targetPage);
      setTotalPages(data.total_pages || 1);
      setTotal(data.total || 0);
    } catch (error) {
      alert(error.response?.data?.message || "Không thể tải danh sách tuyến");
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    Promise.all([
      loadAll(getSuppliers, {}),
      loadAll(getLocations, {}),
    ]).then(([supplierItems, locationItems]) => {
      setSuppliers(supplierItems);
      setLocations(locationItems);
    }).catch((error) => {
      alert(error.response?.data?.message || "Không thể tải nhà cung cấp hoặc địa điểm");
    });
  }, []);
  useEffect(() => { fetchRoutes(1); }, [fetchRoutes]);

  const handleSaveRoute = async (data) => {
    setSaving(true);
    try {
      if (routeModal.mode === "edit") await updateRoute(routeModal.route.id, data);
      else await createRoute(data);
      setRouteModal(null);
      await fetchRoutes(1);
    } catch (error) {
      alert(error.response?.data?.message || "Lưu tuyến thất bại");
    } finally {
      setSaving(false);
    }
  };

  const openRouteEditor = async (route) => {
    try {
      const response = await getRouteById(route.id);
      const detail = response.data.data;
      const locationIds = new Set(locations.map((location) => location.id));
      setRouteModal({
        mode: "edit",
        route: detail,
        defaultValues: {
          serviceType: detail.serviceType || "BUS",
          supplierId: detail.supplierId || "",
          originLocationId: locationIds.has(detail.originLocationId) ? detail.originLocationId : "",
          destinationLocationId: locationIds.has(detail.destinationLocationId) ? detail.destinationLocationId : "",
        },
        hasLegacyEndpoints: detail.hasLegacyEndpoints,
      });
    } catch (error) {
      alert(error.response?.data?.message || "Không thể tải tuyến để chỉnh sửa");
    }
  };

  const applyStatus = async (route, status) => {
    try {
      await updateRouteStatus(route.id, status);
      setConfirmToggle(null);
      if (selectedRoute?.id === route.id) {
        const response = await getRouteById(route.id);
        setSelectedRoute(response.data.data);
      }
      await fetchRoutes(page);
    } catch (error) {
      alert(error.response?.data?.message || "Cập nhật trạng thái tuyến thất bại");
    }
  };

  const handleToggle = async (route) => {
    const nextStatus = route.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    if (nextStatus === "INACTIVE") {
      try {
        const response = await getRouteById(route.id);
        const detail = response.data.data;
        if (detail.tripCount || detail.bookingCount) {
          setConfirmToggle({ route: detail, nextStatus });
          return;
        }
      } catch (error) {
        alert(error.response?.data?.message || "Không thể kiểm tra lịch và đặt chỗ của tuyến");
        return;
      }
    }
    await applyStatus(route, nextStatus);
  };

  return (
    <AdminLayout title="Quản lý tuyến">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Quản lý tuyến</h1>
          <p className="text-sm text-gray-500 mt-1">Quản lý cặp điểm đi–đến theo nhà cung cấp và loại phương tiện.</p>
        </div>
        <button onClick={() => setRouteModal({
          mode: "create",
          defaultValues: { serviceType: "BUS", supplierId: "", originLocationId: "", destinationLocationId: "" },
        })} className="btn-primary flex items-center gap-2 text-sm">
          <Plus size={16} /> Tạo tuyến
        </button>
      </div>

      <div className="card">
        <form onSubmit={(event) => {
          event.preventDefault();
          setFilters({ search, serviceType: serviceFilter, supplierId: supplierFilter, status: statusFilter });
        }} className="grid grid-cols-1 md:grid-cols-5 gap-3 mb-5">
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Tìm tuyến, địa điểm, nhà cung cấp..." className="input-field md:col-span-2" />
          <select value={serviceFilter} onChange={(event) => setServiceFilter(event.target.value)} className="input-field">
            <option value="">Tất cả phương tiện</option>
            {SERVICE_TYPES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
          <select value={supplierFilter} onChange={(event) => setSupplierFilter(event.target.value)} className="input-field">
            <option value="">Tất cả nhà cung cấp</option>
            {suppliers.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
          <button type="submit" className="btn-primary flex items-center justify-center gap-1.5 text-sm"><Search size={15} /> Lọc</button>
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="input-field md:col-start-3">
            {STATUS_OPTIONS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
        </form>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b bg-gray-50/50">
                {["Điểm đi", "Điểm đến", "Phương tiện", "Nhà cung cấp", "Trạng thái", "Thao tác"].map((heading) => (
                  <th key={heading} className="py-3 px-3 font-medium">{heading}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {routes.map((route) => (
                <tr key={route.id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="py-3 px-3 font-medium text-gray-800">
                    {route.originCity || route.originName || "Chưa xác định"}
                  </td>
                  <td className="py-3 px-3 font-medium text-gray-800">
                    {route.destinationCity || route.destinationName || "Chưa xác định"}
                  </td>
                  <td className="py-3 px-3 text-gray-600">{SERVICE_TYPES.find((item) => item.value === route.serviceType)?.label || route.serviceType}</td>
                  <td className="py-3 px-3 text-gray-600">{route.supplierName || "—"}</td>
                  <td className="py-3 px-3"><StatusBadge status={route.status} /></td>
                  <td className="py-3 px-3">
                    <div className="flex items-center gap-3">
                      <button onClick={() => openRouteEditor(route)} className="text-blue-500 hover:text-blue-700" title="Sửa điểm đi, điểm đến hoặc nhà cung cấp">
                        <Pencil size={16} />
                      </button>
                      <button onClick={async () => {
                        try {
                          const response = await getRouteById(route.id);
                          setSelectedRoute(response.data.data);
                        } catch (error) {
                          alert(error.response?.data?.message || "Không thể tải chi tiết tuyến");
                        }
                      }} className="text-blue-500 hover:text-blue-700" title="Xem chuyến thuộc tuyến">
                        <Eye size={17} />
                      </button>
                      <button onClick={() => handleToggle(route)} title={route.status === "ACTIVE" ? "Tắt tuyến" : "Bật tuyến"}
                        className={route.status === "ACTIVE" ? "text-green-500 hover:text-green-700" : "text-gray-400 hover:text-green-500"}>
                        {route.status === "ACTIVE" ? <ToggleRight size={19} /> : <ToggleLeft size={19} />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && routes.length === 0 && <tr><td colSpan={6} className="py-10 text-center text-gray-400">Không có tuyến phù hợp</td></tr>}
              {loading && <tr><td colSpan={6} className="py-10 text-center text-gray-400">Đang tải...</td></tr>}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between pt-4 border-t border-gray-100 text-sm text-gray-500 mt-2">
          <span>Tổng {total} tuyến</span>
          <Pagination page={page} totalPages={totalPages} onPageChange={fetchRoutes} />
        </div>
      </div>

      {routeModal && (
        <Modal
          title={routeModal.mode === "create" ? "Tạo tuyến mới" : "Chỉnh sửa tuyến"}
          onClose={() => setRouteModal(null)}
        >
          <div className="space-y-4">
            {routeModal.hasLegacyEndpoints && (
              <p className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800">
                Tuyến cũ đang lưu mã điểm đi/đến theo định dạng trước đây. Hãy chọn lại hai địa điểm để chuẩn hóa dữ liệu tuyến.
              </p>
            )}
            <RouteForm
              suppliers={suppliers}
              locations={locations}
              defaultValues={routeModal.defaultValues}
              onSubmit={handleSaveRoute}
              saving={saving}
              submitLabel={routeModal.mode === "create" ? "Tạo tuyến" : "Lưu thay đổi"}
            />
          </div>
        </Modal>
      )}
      {selectedRoute && (
        <Modal title="Chi tiết tuyến và chuyến chạy" onClose={() => setSelectedRoute(null)} size="lg">
          <div className="space-y-4">
            <div className="rounded-lg bg-gray-50 p-4 text-sm">
              <p className="font-semibold text-gray-800">{selectedRoute.originName} → {selectedRoute.destinationName}</p>
              <p className="text-gray-500 mt-1">{selectedRoute.supplierName} · {SERVICE_TYPES.find((item) => item.value === selectedRoute.serviceType)?.label}</p>
              <p className="text-gray-500 mt-1">{selectedRoute.tripCount} chuyến · {selectedRoute.bookingCount} đặt chỗ</p>
            </div>
            {selectedRoute.trips?.length ? (
              <div className="divide-y">
                {selectedRoute.trips.map((trip) => (
                  <div key={trip.id} className="flex justify-between gap-4 py-3 text-sm">
                    <span className="font-medium text-gray-700">{trip.code || `Chuyến ${trip.id.slice(-6)}`}</span>
                    <span className="text-gray-500">{trip.departure || "Chưa có giờ khởi hành"}</span>
                    <span className="text-gray-500">{trip.status || "—"}</span>
                  </div>
                ))}
              </div>
            ) : <p className="text-sm text-gray-400">Chưa có chuyến nào được liên kết tường minh với tuyến này.</p>}
          </div>
        </Modal>
      )}
      {confirmToggle && (
        <ConfirmDialog
          message={`Tuyến này có ${confirmToggle.route.tripCount} chuyến và ${confirmToggle.route.bookingCount} đặt chỗ liên quan. Tắt tuyến? Lịch chuyến và booking sẽ không bị thay đổi.`}
          confirmLabel="Tắt tuyến"
          danger={false}
          onCancel={() => setConfirmToggle(null)}
          onConfirm={() => applyStatus(confirmToggle.route, confirmToggle.nextStatus)}
        />
      )}
    </AdminLayout>
  );
}
