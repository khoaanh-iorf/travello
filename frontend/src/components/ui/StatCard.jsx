export default function StatCard({ title, value, subtitle, icon: Icon, color = "blue" }) {
  const colorMap = {
    blue:   { bg: "bg-blue-50",   icon: "text-blue-500",   border: "border-blue-100" },
    green:  { bg: "bg-green-50",  icon: "text-green-500",  border: "border-green-100" },
    yellow: { bg: "bg-yellow-50", icon: "text-yellow-500", border: "border-yellow-100" },
    purple: { bg: "bg-purple-50", icon: "text-purple-500", border: "border-purple-100" },
  };
  const c = colorMap[color] || colorMap.blue;

  return (
    <div className={`bg-white rounded-xl border ${c.border} p-5 flex items-start gap-4`}>
      {Icon && (
        <div className={`w-10 h-10 rounded-lg ${c.bg} flex items-center justify-center flex-shrink-0`}>
          <Icon size={20} className={c.icon} />
        </div>
      )}
      <div>
        <p className="text-xs text-gray-500 font-medium mb-1">{title}</p>
        <p className="text-2xl font-bold text-gray-800">{value}</p>
        {subtitle && <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>}
      </div>
    </div>
  );
}

