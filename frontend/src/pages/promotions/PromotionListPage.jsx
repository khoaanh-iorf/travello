import { useEffect, useState } from "react";
import AdminLayout from "../../components/layout/AdminLayout";
import StatusBadge from "../../components/ui/StatusBadge";
import Pagination from "../../components/ui/Pagination";
import Modal from "../../components/ui/Modal";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import { getPromotions, createPromotion, updatePromotion, deletePromotion, updatePromotionStatus } from "../../api/promotionApi";
import { Search, Plus, Pencil, Trash2, ToggleLeft, ToggleRight } from "lucide-react";
import { useForm } from "react-hook-form";
import { formatDate } from "../../utils/formatDate";

function PromoForm({ defaultValues, onSubmit, loading }) {
  const { register, handleSubmit, formState: { errors } } = useForm({ defaultValues });
  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Mã giảm giá *</label>
          <input className="input-field uppercase" {...register("code", { required: "Bắt buộc" })} />
          {errors.code && <p className="text-red-500 text-xs mt-1">{errors.code.message}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Loại *</label>
          <select className="input-field" {...register("type", { required: "Bắt buộc" })}>
            <option value="">— Chọn loại —</option>
            <option value="PERCENT">Phần trăm (%)</option>
            <option value="FIXED">Cố định (VND)</option>
          </select>
          {errors.type && <p className="text-red-500 text-xs mt-1">{errors.type.message}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Giá trị *</label>
          <input type="number" className="input-field" {...register("value", { required: "Bắt buộc", min: 0 })} />
          {errors.value && <p className="text-red-500 text-xs mt-1">{errors.value.message}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Đơn hàng tối thiểu (VND)</label>
          <input type="number" className="input-field" {...register("minOrderAmount")} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Giảm tối đa (VND)</label>
          <input type="number" className="input-field" {...register("maxDiscount")} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Giới hạn lượt dùng</label>
          <input type="number" className="input-field" {...register("usageLimit")} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Ngày bắt đầu</label>
          <input type="date" className="input-field" {...register("startDate")} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Ngày hết hạn</label>
          <input type="date" className="input-field" {...register("endDate")} />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Mô tả</label>
        <textarea rows={2} className="input-field resize-none" {...register("description")} />
      </div>
      <div className="flex justify-end gap-3 pt-2">
        <button type="submit" disabled={loading} className="btn-primary text-sm">
          {loading ? "Đang lưu..." : "Lưu mã giảm giá"}
        </button>
      </div>
    </form>
  );
}

export default function PromotionListPage() {
  const [promos, setPromos] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(false);
  const [modal, setModal] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [saving, setSaving] = useState(false);

  const fetchPromos = async (p = 1) => {
    setLoading(true);
    try {
      const res = await getPromotions({ page: p, limit: 10, search, status: statusFilter });
      const d = res.data.data;
      setPromos(d.items || []);
      setPage(d.page);
      setTotalPages(d.total_pages || 1);
      setTotal(d.total || 0);
    } catch (err) { console.error(err); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchPromos(1); }, []);

  const handleSubmit = async (data) => {
    setSaving(true);
    try {
      if (modal.mode === "create") await createPromotion(data);
      else await updatePromotion(modal.data.id, data);
      setModal(null);
      fetchPromos(page);
    } catch (err) { alert(err.response?.data?.message || "Thao tác thất bại"); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    try { await deletePromotion(confirmDelete.id); setConfirmDelete(null); fetchPromos(page); }
    catch (err) { alert(err.response?.data?.message || "Xóa thất bại"); }
  };

  const handleToggleStatus = async (promo) => {
    const newStatus = promo.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    try { await updatePromotionStatus(promo.id, newStatus); fetchPromos(page); }
    catch (err) { alert(err.response?.data?.message || "Thao tác thất bại"); }
  };

  return (
    <AdminLayout title="Không gian quản trị">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Quản lý mã giảm giá</h1>
          <p className="text-sm text-gray-500 mt-1">Tạo và quản lý các chương trình khuyến mãi.</p>
        </div>
        <button onClick={() => setModal({ mode: "create", data: null })} className="btn-primary flex items-center gap-2 text-sm">
          <Plus size={16} /> Thêm mã giảm giá
        </button>
      </div>

      <div className="card">
        <form onSubmit={(e) => { e.preventDefault(); fetchPromos(1); }} className="flex gap-3 mb-5">
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Tìm mã giảm giá..." className="input-field flex-1" />
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="input-field w-40">
            <option value="">Tất cả trạng thái</option>
            <option value="ACTIVE">Đang hoạt động</option>
            <option value="INACTIVE">Không hoạt động</option>
          </select>
          <button type="submit" className="btn-primary flex items-center gap-1.5 text-sm"><Search size={15} /> Tìm</button>
        </form>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b bg-gray-50/50">
                {["Mã", "Loại", "Giá trị", "Đơn tối thiểu", "Ngày hết hạn", "Lượt dùng", "Trạng thái", "Thao tác"].map(h => (
                  <th key={h} className="py-3 px-3 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {promos.map((p) => (
                <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                  <td className="py-3 px-3 font-mono font-semibold text-primary">{p.code}</td>
                  <td className="py-3 px-3">
                    <span className="bg-purple-50 text-purple-600 text-xs px-2 py-0.5 rounded">{p.type}</span>
                  </td>
                  <td className="py-3 px-3 font-medium text-gray-800">
                    {p.type === "PERCENT" ? `${p.value}%` : `${p.value?.toLocaleString("vi-VN")}đ`}
                  </td>
                  <td className="py-3 px-3 text-gray-500">{p.minOrderAmount ? `${p.minOrderAmount?.toLocaleString("vi-VN")}đ` : "—"}</td>
                  <td className="py-3 px-3 text-gray-500">{formatDate(p.endDate) || "—"}</td>
                  <td className="py-3 px-3 text-gray-600">{p.usedCount ?? 0} / {p.usageLimit ?? "∞"}</td>
                  <td className="py-3 px-3"><StatusBadge status={p.status} /></td>
                  <td className="py-3 px-3">
                    <div className="flex gap-2 items-center">
                      <button onClick={() => handleToggleStatus(p)} title={p.status === "ACTIVE" ? "Tắt" : "Bật"}
                        className={p.status === "ACTIVE" ? "text-green-500 hover:text-green-700" : "text-gray-400 hover:text-green-500"}>
                        {p.status === "ACTIVE" ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
                      </button>
                      <button onClick={() => setModal({ mode: "edit", data: p })} className="text-blue-500 hover:text-blue-700"><Pencil size={15} /></button>
                      <button onClick={() => setConfirmDelete(p)} className="text-red-400 hover:text-red-600"><Trash2 size={15} /></button>
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && promos.length === 0 && (
                <tr><td colSpan={8} className="py-10 text-center text-gray-400">Không có mã giảm giá nào</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between pt-4 border-t border-gray-100 text-sm text-gray-500 mt-2">
          <span>Tổng {total} mã giảm giá</span>
          <Pagination page={page} totalPages={totalPages} onPageChange={fetchPromos} />
        </div>
      </div>

      {modal && (
        <Modal title={modal.mode === "create" ? "Thêm mã giảm giá" : "Sửa mã giảm giá"} onClose={() => setModal(null)} size="lg">
          <PromoForm defaultValues={modal.data || {}} onSubmit={handleSubmit} loading={saving} />
        </Modal>
      )}
      {confirmDelete && (
        <ConfirmDialog message={`Xóa mã "${confirmDelete.code}"?`} onConfirm={handleDelete} onCancel={() => setConfirmDelete(null)} />
      )}
    </AdminLayout>
  );
}

