import { useEffect, useState } from "react";
import AdminLayout from "../../components/layout/AdminLayout";
import StatusBadge from "../../components/ui/StatusBadge";
import Pagination from "../../components/ui/Pagination";
import Modal from "../../components/ui/Modal";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import {
  getSuppliers, createSupplier, updateSupplier,
  deleteSupplier, updateSupplierStatus,
} from "../../api/supplierApi";
import { Search, Plus, Pencil, Trash2, ToggleLeft, ToggleRight } from "lucide-react";
import { useForm } from "react-hook-form";

const PROVIDER_TYPES = ["", "BUS", "FLIGHT", "TRAIN"];

function SupplierForm({ defaultValues, onSubmit, loading }) {
  const { register, handleSubmit, formState: { errors } } = useForm({ defaultValues });
  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Tên nhà cung cấp *</label>
          <input className="input-field" {...register("name", { required: "Bắt buộc" })} />
          {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Loại dịch vụ *</label>
          <select className="input-field" {...register("type", { required: "Bắt buộc" })}>
            {PROVIDER_TYPES.map(t => <option key={t} value={t}>{t || "— Chọn loại —"}</option>)}
          </select>
          {errors.type && <p className="text-red-500 text-xs mt-1">{errors.type.message}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Số điện thoại</label>
          <input className="input-field" {...register("phone")} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
          <input type="email" className="input-field" {...register("email")} />
        </div>
        <div className="col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">Địa chỉ</label>
          <input className="input-field" {...register("address")} />
        </div>
        <div className="col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">URL Logo</label>
          <input className="input-field" placeholder="https://..." {...register("logo")} />
        </div>
      </div>
      <div className="flex justify-end gap-3 pt-2">
        <button type="submit" disabled={loading} className="btn-primary text-sm">
          {loading ? "Đang lưu..." : "Lưu nhà cung cấp"}
        </button>
      </div>
    </form>
  );
}

export default function SupplierListPage() {
  const [suppliers, setSuppliers] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [saving, setSaving] = useState(false);

  const fetchSuppliers = async (p = 1) => {
    setLoading(true);
    try {
      const res = await getSuppliers({ page: p, limit: 10, search, type: typeFilter });
      const d = res.data.data;
      setSuppliers(d.items || []);
      setPage(d.page);
      setTotalPages(d.total_pages || 1);
      setTotal(d.total || 0);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchSuppliers(1); }, []);

  const handleSubmit = async (data) => {
    setSaving(true);
    try {
      if (modal.mode === "create") await createSupplier(data);
      else await updateSupplier(modal.data.id, data);
      setModal(null);
      fetchSuppliers(page);
    } catch (err) { alert(err.response?.data?.message || "Thao tác thất bại"); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    try { await deleteSupplier(confirmDelete.id); setConfirmDelete(null); fetchSuppliers(page); }
    catch (err) { alert(err.response?.data?.message || "Xóa thất bại"); }
  };

  const handleToggleStatus = async (s) => {
    const newStatus = s.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    try { await updateSupplierStatus(s.id, newStatus); fetchSuppliers(page); }
    catch (err) { alert(err.response?.data?.message || "Thao tác thất bại"); }
  };

  const typeColors = { BUS: "bg-yellow-50 text-yellow-700", FLIGHT: "bg-blue-50 text-blue-700", TRAIN: "bg-purple-50 text-purple-700" };

  return (
    <AdminLayout title="Không gian quản trị">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Suppliers</h1>
          <p className="text-sm text-gray-500 mt-1">Quản lý nhà cung cấp dịch vụ Bus, Flight, Train.</p>
        </div>
        <button onClick={() => setModal({ mode: "create", data: null })} className="btn-primary flex items-center gap-2 text-sm">
          <Plus size={16} /> Thêm nhà cung cấp
        </button>
      </div>

      <div className="card">
        <form onSubmit={(e) => { e.preventDefault(); fetchSuppliers(1); }} className="flex gap-3 mb-5">
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tìm tên, email nhà cung cấp..." className="input-field flex-1" />
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="input-field w-36">
            {PROVIDER_TYPES.map(t => <option key={t} value={t}>{t || "Tất cả loại"}</option>)}
          </select>
          <button type="submit" className="btn-primary flex items-center gap-1.5 text-sm"><Search size={15} /> Tìm</button>
        </form>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b bg-gray-50/50">
                {["Nhà cung cấp", "Loại", "Số điện thoại", "Email", "Địa chỉ", "Trạng thái", "Thao tác"].map(h => (
                  <th key={h} className="py-3 px-3 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {suppliers.map((s) => (
                <tr key={s.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                  <td className="py-3 px-3">
                    <div className="flex items-center gap-3">
                      {s.logo
                        ? <img src={s.logo} alt="" className="w-8 h-8 rounded object-cover bg-gray-100" />
                        : <div className="w-8 h-8 rounded bg-gray-100 flex items-center justify-center text-gray-400 text-xs font-bold">{s.name?.charAt(0)}</div>
                      }
                      <span className="font-medium text-gray-800">{s.name}</span>
                    </div>
                  </td>
                  <td className="py-3 px-3">
                    <span className={`text-xs px-2 py-0.5 rounded font-medium ${typeColors[s.type] || "bg-gray-50 text-gray-600"}`}>{s.type || "—"}</span>
                  </td>
                  <td className="py-3 px-3 text-gray-600">{s.phone || "—"}</td>
                  <td className="py-3 px-3 text-gray-600">{s.email || "—"}</td>
                  <td className="py-3 px-3 text-gray-500 max-w-[200px] truncate">{s.address || "—"}</td>
                  <td className="py-3 px-3"><StatusBadge status={s.status} /></td>
                  <td className="py-3 px-3">
                    <div className="flex gap-2 items-center">
                      <button onClick={() => handleToggleStatus(s)} title={s.status === "ACTIVE" ? "Tắt" : "Bật"}
                        className={s.status === "ACTIVE" ? "text-green-500 hover:text-green-700" : "text-gray-400 hover:text-green-500"}>
                        {s.status === "ACTIVE" ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
                      </button>
                      <button onClick={() => setModal({ mode: "edit", data: s })} className="text-blue-500 hover:text-blue-700"><Pencil size={15} /></button>
                      <button onClick={() => setConfirmDelete(s)} className="text-red-400 hover:text-red-600"><Trash2 size={15} /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && suppliers.length === 0 && (
                <tr><td colSpan={7} className="py-10 text-center text-gray-400">Không có nhà cung cấp nào</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between pt-4 border-t border-gray-100 text-sm text-gray-500 mt-2">
          <span>Tổng {total} nhà cung cấp</span>
          <Pagination page={page} totalPages={totalPages} onPageChange={fetchSuppliers} />
        </div>
      </div>

      {modal && (
        <Modal title={modal.mode === "create" ? "Thêm nhà cung cấp" : "Sửa nhà cung cấp"} onClose={() => setModal(null)} size="lg">
          <SupplierForm defaultValues={modal.data || {}} onSubmit={handleSubmit} loading={saving} />
        </Modal>
      )}
      {confirmDelete && (
        <ConfirmDialog message={`Xóa nhà cung cấp "${confirmDelete.name}"?`} onConfirm={handleDelete} onCancel={() => setConfirmDelete(null)} />
      )}
    </AdminLayout>
  );
}

