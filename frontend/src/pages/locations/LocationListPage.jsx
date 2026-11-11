import { useEffect, useState } from "react";
import AdminLayout from "../../components/layout/AdminLayout";
import StatusBadge from "../../components/ui/StatusBadge";
import Pagination from "../../components/ui/Pagination";
import Modal from "../../components/ui/Modal";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import { getLocations, createLocation, updateLocation, deleteLocation, toggleFeaturedLocation } from "../../api/locationApi";
import { Search, Plus, Pencil, Trash2, Star } from "lucide-react";
import { useForm } from "react-hook-form";

const LOCATION_TYPES = ["", "airport", "station", "city", "port"];

function LocationForm({ defaultValues, onSubmit, loading }) {
  const { register, handleSubmit, formState: { errors } } = useForm({ defaultValues });
  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Tên địa điểm *</label>
          <input className="input-field" {...register("name", { required: "Bắt buộc" })} />
          {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Mã (code) *</label>
          <input className="input-field uppercase" {...register("code", { required: "Bắt buộc" })} />
          {errors.code && <p className="text-red-500 text-xs mt-1">{errors.code.message}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Thành phố</label>
          <input className="input-field" {...register("city")} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Quốc gia</label>
          <input className="input-field" defaultValue="VN" {...register("country")} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Loại</label>
          <select className="input-field" {...register("type")}>
            {LOCATION_TYPES.map((t) => <option key={t} value={t}>{t || "— Chọn loại —"}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Trạng thái</label>
          <select className="input-field" {...register("status")}>
            <option value="ACTIVE">Hoạt động</option>
            <option value="INACTIVE">Không hoạt động</option>
          </select>
        </div>
      </div>
      <div className="flex justify-end gap-3 pt-2">
        <button type="submit" disabled={loading} className="btn-primary text-sm">
          {loading ? "Đang lưu..." : "Lưu địa điểm"}
        </button>
      </div>
    </form>
  );
}

export default function LocationListPage() {
  const [locations, setLocations] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState(null); // null | { mode: 'create'|'edit', data }
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [saving, setSaving] = useState(false);

  const fetchLocations = async (p = 1) => {
    setLoading(true);
    try {
      const res = await getLocations({ page: p, limit: 10, search, type: typeFilter });
      const d = res.data.data;
      setLocations(d.items || []);
      setPage(d.page);
      setTotalPages(d.total_pages || 1);
      setTotal(d.total || 0);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchLocations(1); }, []);

  const handleSubmit = async (data) => {
    setSaving(true);
    try {
      if (modal.mode === "create") await createLocation(data);
      else await updateLocation(modal.data.id, data);
      setModal(null);
      fetchLocations(page);
    } catch (err) { alert(err.response?.data?.message || "Thao tác thất bại"); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    try { await deleteLocation(confirmDelete.id); setConfirmDelete(null); fetchLocations(page); }
    catch (err) { alert(err.response?.data?.message || "Xóa thất bại"); }
  };

  const handleToggleFeatured = async (loc) => {
    try { await toggleFeaturedLocation(loc.id, !loc.featured); fetchLocations(page); }
    catch (err) { alert(err.response?.data?.message || "Thao tác thất bại"); }
  };

  return (
    <AdminLayout title="Không gian quản trị">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Quản lý địa điểm</h1>
          <p className="text-sm text-gray-500 mt-1">Quản lý danh sách địa điểm du lịch.</p>
        </div>
        <button onClick={() => setModal({ mode: "create", data: null })} className="btn-primary flex items-center gap-2 text-sm">
          <Plus size={16} /> Thêm địa điểm
        </button>
      </div>

      <div className="card">
        <form onSubmit={(e) => { e.preventDefault(); fetchLocations(1); }} className="flex gap-3 mb-5">
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tìm tên, mã, thành phố..." className="input-field flex-1" />
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="input-field w-36">
            {LOCATION_TYPES.map((t) => <option key={t} value={t}>{t || "Tất cả loại"}</option>)}
          </select>
          <button type="submit" className="btn-primary flex items-center gap-1.5 text-sm"><Search size={15} /> Tìm</button>
        </form>

        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-500 border-b bg-gray-50/50">
              {["Tên địa điểm", "Code", "Thành phố", "Quốc gia", "Loại", "Nổi bật", "Trạng thái", "Thao tác"].map((h) => (
                <th key={h} className="py-3 px-3 font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {locations.map((loc) => (
              <tr key={loc.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                <td className="py-3 px-3 font-medium text-gray-800">{loc.name}</td>
                <td className="py-3 px-3 text-gray-500 font-mono text-xs">{loc.code}</td>
                <td className="py-3 px-3 text-gray-600">{loc.city || "—"}</td>
                <td className="py-3 px-3 text-gray-500">{loc.country}</td>
                <td className="py-3 px-3"><span className="bg-blue-50 text-blue-600 text-xs px-2 py-0.5 rounded">{loc.type || "—"}</span></td>
                <td className="py-3 px-3">
                  <button onClick={() => handleToggleFeatured(loc)} className={`transition-colors ${loc.featured ? "text-yellow-500" : "text-gray-300 hover:text-yellow-400"}`}>
                    <Star size={16} fill={loc.featured ? "currentColor" : "none"} />
                  </button>
                </td>
                <td className="py-3 px-3"><StatusBadge status={loc.status} /></td>
                <td className="py-3 px-3">
                  <div className="flex gap-2">
                    <button onClick={() => setModal({ mode: "edit", data: loc })} className="text-blue-500 hover:text-blue-700"><Pencil size={15} /></button>
                    <button onClick={() => setConfirmDelete(loc)} className="text-red-400 hover:text-red-600"><Trash2 size={15} /></button>
                  </div>
                </td>
              </tr>
            ))}
            {!loading && locations.length === 0 && (
              <tr><td colSpan={8} className="py-10 text-center text-gray-400">Không có địa điểm nào</td></tr>
            )}
          </tbody>
        </table>

        <div className="flex items-center justify-between pt-4 border-t border-gray-100 text-sm text-gray-500 mt-2">
          <span>Tổng {total} địa điểm</span>
          <Pagination page={page} totalPages={totalPages} onPageChange={fetchLocations} />
        </div>
      </div>

      {modal && (
        <Modal title={modal.mode === "create" ? "Thêm địa điểm mới" : "Sửa địa điểm"} onClose={() => setModal(null)} size="lg">
          <LocationForm defaultValues={modal.data || {}} onSubmit={handleSubmit} loading={saving} />
        </Modal>
      )}
      {confirmDelete && (
        <ConfirmDialog message={`Xóa địa điểm "${confirmDelete.name}"?`} onConfirm={handleDelete} onCancel={() => setConfirmDelete(null)} />
      )}
    </AdminLayout>
  );
}

