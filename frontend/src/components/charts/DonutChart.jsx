import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { formatCurrency } from "../../utils/formatCurrency";

const COLORS = ["#2563EB", "#10B981", "#F59E0B"];

export default function DonutChart({ data = [] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={60}
          outerRadius={90}
          dataKey="value"
        >
          {data.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip formatter={(v) => formatCurrency(v)} />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
}

