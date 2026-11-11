import { Menu, ChevronDown } from "lucide-react";
import { useAuthStore } from "../../store/authStore";
import { useUIStore } from "../../store/uiStore";

export default function Topbar({ title = "Không gian quản trị" }) {
  const admin = useAuthStore((s) => s.admin);
  const toggleSidebar = useUIStore((s) => s.toggleSidebar);

  const initials = admin?.name?.charAt(0)?.toUpperCase() || "A";

  return (
    <header className="fixed top-0 left-56 right-0 h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6 z-20">
      <div className="flex items-center gap-4">
        <button
          onClick={toggleSidebar}
          className="text-gray-500 hover:text-gray-700 transition-colors"
        >
          <Menu size={20} />
        </button>
        <span className="text-gray-600 font-medium">{title}</span>
      </div>

      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white text-sm font-semibold">
          {initials}
        </div>
        <div className="text-right">
          <p className="text-sm font-semibold text-gray-800">{admin?.name || "admin"}</p>
          <p className="text-xs text-gray-400">{admin?.email}</p>
        </div>
        <ChevronDown size={16} className="text-gray-400" />
      </div>
    </header>
  );
}

