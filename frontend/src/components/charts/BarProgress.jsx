const COLORS = { flight: "#2563EB", train: "#8B5CF6", bus: "#F59E0B" };

export default function BarProgress({ data = [] }) {
  const max = Math.max(...data.map((d) => d.count), 1);
  return (
    <div className="space-y-3">
      {data.map((item) => (
        <div key={item.name}>
          <div className="flex justify-between text-sm mb-1">
            <span className="capitalize text-gray-700">{item.label || item.name}</span>
            <span className="text-gray-500">{item.count} chuyến</span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${(item.count / max) * 100}%`,
                background: COLORS[item.name] || "#2563EB",
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

