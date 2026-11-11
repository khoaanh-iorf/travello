import Sidebar from "./Sidebar";
import Topbar from "./Topbar";

export default function AdminLayout({ children, title }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar />
      <Topbar title={title} />
      <main className="ml-56 pt-16 min-h-screen">
        <div className="p-8">{children}</div>
      </main>
    </div>
  );
}

