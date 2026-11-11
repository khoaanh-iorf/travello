import { useEffect, useState } from "react";
import AdminLayout from "../../components/layout/AdminLayout";
import Modal from "../../components/ui/Modal";
import ConfirmDialog from "../../components/ui/ConfirmDialog";
import Pagination from "../../components/ui/Pagination";
import {
  getBanners, createBanner, updateBanner, deleteBanner,
  getBlogs, createBlog, updateBlog, deleteBlog,
} from "../../api/cmsApi";
import { getLocations, toggleFeaturedLocation } from "../../api/locationApi";
import { Plus, Pencil, Trash2, Star, ToggleLeft, ToggleRight } from "lucide-react";
import { useForm } from "react-hook-form";
import { formatDate } from "../../utils/formatDate";

const TABS = ["Banner / Hero", "Địa điểm nổi bật", "Tin tức / Blog"];

// ── Banner Form ──────────────────────────────────────────────────────────────
function BannerForm({ defaultValues, onSubmit, loading }) {
  const { register, handleSubmit } = useForm({ defaultValues });
  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Tiêu đề *</label>
        <input className="input-field" {...register("title", { required: true })} />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">URL Ảnh</label>
        <input className="input-field" placeholder="https://..." {...register("imageUrl")} />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Link khi click</label>
        <input className="input-field" placeholder="/destinations/..." {...register("link")} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Thứ tự</label>
          <input type="number" className="input-field" {...register("order")} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Trạng thái</label>
          <select className="input-field" {...register("status")}>
            <option value="ACTIVE">Hiển thị</option>
            <option value="INACTIVE">Ẩn</option>
          </select>
        </div>
      </div>
      <div className="flex justify-end pt-2">
        <button type="submit" disabled={loading} className="btn-primary text-sm">
          {loading ? "Đang lưu..." : "Lưu Banner"}
        </button>
      </div>
    </form>
  );
}

// ── Blog Form ────────────────────────────────────────────────────────────────
function BlogForm({ defaultValues, onSubmit, loading }) {
  const { register, handleSubmit } = useForm({ defaultValues });
  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Tiêu đề *</label>
        <input className="input-field" {...register("title", { required: true })} />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">URL Thumbnail</label>
        <input className="input-field" placeholder="https://..." {...register("thumbnail")} />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Tóm tắt</label>
        <textarea rows={2} className="input-field resize-none" {...register("summary")} />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Nội dung</label>
        <textarea rows={6} className="input-field resize-none font-mono text-xs" {...register("content")} />
      </div>
      <div className="flex items-center gap-2">
        <input type="checkbox" id="published" {...register("published")} />
        <label htmlFor="published" className="text-sm text-gray-700">Xuất bản ngay</label>
      </div>
      <div className="flex justify-end pt-2">
        <button type="submit" disabled={loading} className="btn-primary text-sm">
          {loading ? "Đang lưu..." : "Lưu bài viết"}
        </button>
      </div>
    </form>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────
export default function CmsPage() {
  const [activeTab, setActiveTab] = useState(0);

  // Banner state
  const [banners, setBanners] = useState([]);
  const [bannerModal, setBannerModal] = useState(null);
  const [confirmBanner, setConfirmBanner] = useState(null);
  const [bannerSaving, setBannerSaving] = useState(false);

  // Location featured state
  const [featuredLocs, setFeaturedLocs] = useState([]);
  const [locPage, setLocPage] = useState(1);
  const [locTotalPages, setLocTotalPages] = useState(1);

  // Blog state
  const [blogs, setBlogs] = useState([]);
  const [blogPage, setBlogPage] = useState(1);
  const [blogTotalPages, setBlogTotalPages] = useState(1);
  const [blogTotal, setBlogTotal] = useState(0);
  const [blogModal, setBlogModal] = useState(null);
  const [confirmBlog, setConfirmBlog] = useState(null);
  const [blogSaving, setBlogSaving] = useState(false);

  // ── Fetch ─────────────────────────────────────────────────────────────────
  const fetchBanners = async () => {
    try { const r = await getBanners(); setBanners(r.data.data || []); } catch (e) { console.error(e); }
  };

  const fetchFeaturedLocs = async (p = 1) => {
    try {
      const r = await getLocations({ page: p, limit: 12 });
      setFeaturedLocs(r.data.data.items || []);
      setLocPage(r.data.data.page);
      setLocTotalPages(r.data.data.total_pages || 1);
    } catch (e) { console.error(e); }
  };

  const fetchBlogs = async (p = 1) => {
    try {
      const r = await getBlogs({ page: p, limit: 8 });
      setBlogs(r.data.data.items || []);
      setBlogPage(r.data.data.page);
      setBlogTotalPages(r.data.data.total_pages || 1);
      setBlogTotal(r.data.data.total || 0);
    } catch (e) { console.error(e); }
  };

  useEffect(() => { fetchBanners(); fetchFeaturedLocs(); fetchBlogs(); }, []);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleBannerSubmit = async (data) => {
    setBannerSaving(true);
    try {
      if (bannerModal.mode === "create") await createBanner(data);
      else await updateBanner(bannerModal.data.id, data);
      setBannerModal(null); fetchBanners();
    } catch (e) { alert(e.response?.data?.message || "Thất bại"); }
    finally { setBannerSaving(false); }
  };

  const handleDeleteBanner = async () => {
    try { await deleteBanner(confirmBanner.id); setConfirmBanner(null); fetchBanners(); }
    catch (e) { alert(e.response?.data?.message || "Xóa thất bại"); }
  };

  const handleToggleFeatured = async (loc) => {
    try { await toggleFeaturedLocation(loc.id, !loc.featured); fetchFeaturedLocs(locPage); }
    catch (e) { alert(e.response?.data?.message || "Thất bại"); }
  };

  const handleBlogSubmit = async (data) => {
    setBlogSaving(true);
    try {
      if (blogModal.mode === "create") await createBlog(data);
      else await updateBlog(blogModal.data.id, data);
      setBlogModal(null); fetchBlogs(blogPage);
    } catch (e) { alert(e.response?.data?.message || "Thất bại"); }
    finally { setBlogSaving(false); }
  };

  const handleDeleteBlog = async () => {
    try { await deleteBlog(confirmBlog.id); setConfirmBlog(null); fetchBlogs(blogPage); }
    catch (e) { alert(e.response?.data?.message || "Xóa thất bại"); }
  };

  return (
    <AdminLayout title="Không gian quản trị">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Quản lý nội dung trang chủ</h1>
        <p className="text-sm text-gray-500 mt-1">Chỉnh sửa Banner, địa điểm nổi bật và bài viết.</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 mb-6 w-fit">
        {TABS.map((t, i) => (
          <button key={i} onClick={() => setActiveTab(i)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === i ? "bg-white shadow text-primary" : "text-gray-500 hover:text-gray-700"}`}>
            {t}
          </button>
        ))}
      </div>

      {/* ── Tab 0: Banners ──────────────────────────────────────────────────── */}
      {activeTab === 0 && (
        <div className="card">
          <div className="flex justify-between items-center mb-5">
            <h2 className="font-semibold text-gray-700">Danh sách Banner</h2>
            <button onClick={() => setBannerModal({ mode: "create", data: null })} className="btn-primary flex items-center gap-2 text-sm">
              <Plus size={15} /> Thêm Banner
            </button>
          </div>
          <div className="grid grid-cols-3 gap-4">
            {banners.map((b) => (
              <div key={b.id} className="border border-gray-100 rounded-xl overflow-hidden hover:shadow-md transition-shadow">
                {b.imageUrl
                  ? <img src={b.imageUrl} alt={b.title} className="w-full h-36 object-cover bg-gray-100" />
                  : <div className="w-full h-36 bg-gradient-to-br from-blue-100 to-blue-50 flex items-center justify-center text-blue-300 text-4xl">🖼️</div>
                }
                <div className="p-3">
                  <div className="flex justify-between items-start mb-1">
                    <p className="font-medium text-gray-800 text-sm truncate">{b.title}</p>
                    <span className={`text-xs px-1.5 py-0.5 rounded ml-2 flex-shrink-0 ${b.status === "ACTIVE" ? "bg-green-100 text-green-600" : "bg-gray-100 text-gray-500"}`}>
                      {b.status === "ACTIVE" ? "Hiển thị" : "Ẩn"}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 mb-3">Thứ tự: {b.order ?? "—"}</p>
                  <div className="flex gap-2">
                    <button onClick={() => setBannerModal({ mode: "edit", data: b })} className="flex-1 text-xs btn-secondary py-1.5 flex items-center justify-center gap-1">
                      <Pencil size={12} /> Sửa
                    </button>
                    <button onClick={() => setConfirmBanner(b)} className="text-xs px-3 py-1.5 bg-red-50 text-red-500 rounded-lg hover:bg-red-100 transition-colors">
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
            {banners.length === 0 && (
              <p className="col-span-3 py-10 text-center text-gray-400">Chưa có banner nào</p>
            )}
          </div>
        </div>
      )}

      {/* ── Tab 1: Featured Locations ────────────────────────────────────────── */}
      {activeTab === 1 && (
        <div className="card">
          <div className="mb-5">
            <h2 className="font-semibold text-gray-700 mb-1">Địa điểm nổi bật</h2>
            <p className="text-sm text-gray-400">Nhấn ⭐ để bật/tắt hiển thị địa điểm nổi bật trên trang chủ.</p>
          </div>
          <div className="grid grid-cols-4 gap-3">
            {featuredLocs.map((loc) => (
              <div key={loc.id} className={`border rounded-xl p-3 flex items-center gap-3 transition-colors ${loc.featured ? "border-yellow-200 bg-yellow-50/40" : "border-gray-100 hover:border-gray-200"}`}>
                <button onClick={() => handleToggleFeatured(loc)} className={`flex-shrink-0 ${loc.featured ? "text-yellow-500" : "text-gray-300 hover:text-yellow-400"}`}>
                  <Star size={18} fill={loc.featured ? "currentColor" : "none"} />
                </button>
                <div className="min-w-0">
                  <p className="font-medium text-gray-800 text-sm truncate">{loc.name}</p>
                  <p className="text-xs text-gray-400">{loc.city || loc.country}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="flex justify-end pt-4 mt-2 border-t border-gray-100">
            <Pagination page={locPage} totalPages={locTotalPages} onPageChange={fetchFeaturedLocs} />
          </div>
        </div>
      )}

      {/* ── Tab 2: Blogs ─────────────────────────────────────────────────────── */}
      {activeTab === 2 && (
        <div className="card">
          <div className="flex justify-between items-center mb-5">
            <div>
              <h2 className="font-semibold text-gray-700">Bài viết / Tin tức</h2>
              <p className="text-sm text-gray-400">Tổng {blogTotal} bài viết</p>
            </div>
            <button onClick={() => setBlogModal({ mode: "create", data: null })} className="btn-primary flex items-center gap-2 text-sm">
              <Plus size={15} /> Thêm bài viết
            </button>
          </div>
          <div className="space-y-3">
            {blogs.map((blog) => (
              <div key={blog.id} className="flex gap-4 border border-gray-100 rounded-xl p-4 hover:border-gray-200 transition-colors">
                {blog.thumbnail
                  ? <img src={blog.thumbnail} alt="" className="w-20 h-16 object-cover rounded-lg bg-gray-100 flex-shrink-0" />
                  : <div className="w-20 h-16 bg-gray-100 rounded-lg flex items-center justify-center text-gray-300 text-2xl flex-shrink-0">📰</div>
                }
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium text-gray-800 truncate">{blog.title}</p>
                    <span className={`text-xs px-2 py-0.5 rounded flex-shrink-0 ${blog.published ? "bg-green-100 text-green-600" : "bg-gray-100 text-gray-500"}`}>
                      {blog.published ? "Đã xuất bản" : "Nháp"}
                    </span>
                  </div>
                  <p className="text-sm text-gray-400 mt-1 line-clamp-1">{blog.summary || "—"}</p>
                  <p className="text-xs text-gray-300 mt-1">{formatDate(blog.createdAt, "dd/MM/yyyy HH:mm")}</p>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  <button onClick={() => setBlogModal({ mode: "edit", data: blog })} className="text-blue-500 hover:text-blue-700 p-1">
                    <Pencil size={15} />
                  </button>
                  <button onClick={() => setConfirmBlog(blog)} className="text-red-400 hover:text-red-600 p-1">
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            ))}
            {blogs.length === 0 && <p className="py-10 text-center text-gray-400">Chưa có bài viết nào</p>}
          </div>
          <div className="flex justify-end pt-4 border-t border-gray-100 mt-4">
            <Pagination page={blogPage} totalPages={blogTotalPages} onPageChange={fetchBlogs} />
          </div>
        </div>
      )}

      {/* Modals */}
      {bannerModal && (
        <Modal title={bannerModal.mode === "create" ? "Thêm Banner" : "Sửa Banner"} onClose={() => setBannerModal(null)}>
          <BannerForm defaultValues={bannerModal.data || {}} onSubmit={handleBannerSubmit} loading={bannerSaving} />
        </Modal>
      )}
      {confirmBanner && (
        <ConfirmDialog message={`Xóa banner "${confirmBanner.title}"?`} onConfirm={handleDeleteBanner} onCancel={() => setConfirmBanner(null)} />
      )}
      {blogModal && (
        <Modal title={blogModal.mode === "create" ? "Thêm bài viết" : "Sửa bài viết"} onClose={() => setBlogModal(null)} size="xl">
          <BlogForm defaultValues={blogModal.data || {}} onSubmit={handleBlogSubmit} loading={blogSaving} />
        </Modal>
      )}
      {confirmBlog && (
        <ConfirmDialog message={`Xóa bài viết "${confirmBlog.title}"?`} onConfirm={handleDeleteBlog} onCancel={() => setConfirmBlog(null)} />
      )}
    </AdminLayout>
  );
}

