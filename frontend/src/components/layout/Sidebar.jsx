import { NavLink, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, Users, MapPin, Tag, BookOpen,
  Building2, Globe, HeadphonesIcon,
  Plane, LogOut, CreditCard, Route, CalendarClock,
} from "lucide-react";
import { useAuthStore } from "../../store/authStore";
import { logoutAdmin } from "../../api/authApi";

const NAV_ITEMS = [
  { to: "/admin/dashboard",  icon: LayoutDashboard,   label: "Dashboard" },
  { to: "/admin/users",      icon: Users,              label: "Người dùng" },
  { to: "/admin/locations",  icon: MapPin,             label: "Địa điểm" },
  { to: "/admin/routes",     icon: Route,              label: "Quản lý tuyến" },
  { to: "/admin/trips",      icon: CalendarClock,      label: "Chuyến chạy" },
  { to: "/admin/promotions", icon: Tag,                label: "Mã giảm giá" },
  { to: "/admin/bookings",   icon: BookOpen,           label: "Đặt chỗ" },
  { to: "/admin/payments",   icon: CreditCard,         label: "Thanh toán" },
  { to: "/admin/suppliers",  icon: Building2,          label: "Nhà cung cấp" },
  { to: "/admin/cms",        icon: Globe,              label: "Nội dung trang" },
  { to: "/admin/support",    icon: HeadphonesIcon,     label: "Hỗ trợ KH" },
];

export default function Sidebar() {
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();

  const handleLogout = async () => {
    try { await logoutAdmin(); } catch {}
    logout();
    navigate("/admin/login");
  };

  return (
    <aside className="fixed top-0 left-0 h-full w-56 bg-sidebar-bg flex flex-col z-30">
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 py-5 border-b border-white/10">
        <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
          <Plane size={16} className="text-white" />
        </div>
        <div>
          <p className="text-white/50 text-[10px] uppercase tracking-widest">Admin</p>
          <p className="text-white font-bold text-sm leading-tight">Travel Mini</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 overflow-y-auto">
        {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-5 py-2.5 mx-2 rounded-lg text-sm transition-colors ${
                isActive
                  ? "bg-primary text-white font-medium"
                  : "text-sidebar-text hover:bg-sidebar-hover hover:text-white"
              }`
            }
          >
            <Icon size={16} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      {/* Logout */}
      <div className="p-4 border-t border-white/10">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-3 py-2.5 w-full rounded-lg text-sm text-sidebar-text hover:bg-sidebar-hover hover:text-white transition-colors"
        >
          <LogOut size={16} />
          <span>Đăng xuất</span>
        </button>
      </div>
    </aside>
  );
}
