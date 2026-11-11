import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { formatNumber } from "../../utils/formatCurrency";

const SERVICE_COLORS = {
  Flight: "#1e40af", // Navy / Deep Blue (như trong ảnh)
  Train: "#9333ea",  // Purple
  Bus: "#f59e0b",    // Amber / Orange
};

export default function DonutChart({ data = [] }) {
  const total = data.reduce((sum, item) => sum + Number(item.value || 0), 0);

  const positiveData = data.filter((item) => Number(item.value) > 0);
  const chartSlices = positiveData.map((item) => ({
    name: item.name,
    value: Number(item.value),
    color: SERVICE_COLORS[item.name] || "#2563eb",
  }));

  return (
    <div className="grid grid-cols-1 items-center gap-6 md:grid-cols-[260px_minmax(0,1fr)] lg:gap-12 py-2">
      {/* Vòng tròn Donut có Text nằm giữa */}
      <div className="relative mx-auto h-[230px] w-[230px] sm:h-[240px] sm:w-[240px] shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartSlices}
              cx="50%"
              cy="50%"
              innerRadius={70}
              outerRadius={104}
              paddingAngle={chartSlices.length > 1 ? 2 : 0}
              dataKey="value"
              stroke="none"
              isAnimationActive={true}
            >
              {chartSlices.map((slice, index) => (
                <Cell
                  key={`slice-${index}`}
                  fill={slice.color || SLICE_PALETTE[index % SLICE_PALETTE.length]}
                />
              ))}
            </Pie>
            {positiveData.length > 0 && (
              <Tooltip
                formatter={(val) => [`${formatNumber(val)} đ`, "Doanh thu"]}
                contentStyle={{
                  backgroundColor: "#ffffff",
                  borderRadius: "10px",
                  border: "1px solid #e2e8f0",
                  boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)",
                  fontSize: "12px",
                }}
              />
            )}
          </PieChart>
        </ResponsiveContainer>

        {/* Nội dung trung tâm: Số tiền, ký hiệu đ, Total Revenue */}
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-[26px] sm:text-[28px] font-bold text-gray-900 leading-none tracking-tight">
            {formatNumber(total)}
          </span>
          <span className="text-[20px] sm:text-[22px] font-bold text-gray-900 leading-tight mt-0.5">
            đ
          </span>
          <span className="text-xs font-normal text-gray-400 mt-1">
            Total Revenue
          </span>
        </div>
      </div>

      {/* Danh sách dịch vụ & số tiền bên phải (Legend) */}
      <div className="flex flex-col justify-center space-y-5 w-full max-w-md px-2">
        {data.map((item) => {
          const value = Number(item.value || 0);
          const dotColor = SERVICE_COLORS[item.name] || "#94a3b8";

          return (
            <div
              key={item.name}
              className="flex items-center justify-between gap-4 text-sm"
            >
              {/* Chấm tròn + Tên dịch vụ */}
              <div className="flex items-center gap-3">
                <span
                  className="h-3 w-3 shrink-0 rounded-full"
                  style={{ backgroundColor: dotColor }}
                />
                <span className="font-normal text-gray-800 text-[15px]">
                  {item.name}
                </span>
              </div>

              {/* Số tiền đã định dạng */}
              <span className="font-normal text-gray-500 text-[15px] tabular-nums">
                {formatNumber(value)} đ
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
