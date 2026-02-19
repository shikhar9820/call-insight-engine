'use client'

import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Legend,
  Tooltip
} from 'recharts'

interface RiskChartProps {
  data: {
    high: number
    medium: number
    low: number
  }
}

export default function RiskChart({ data }: RiskChartProps) {
  const chartData = [
    { name: 'High Risk', value: data.high, color: '#ef4444' },
    { name: 'Medium Risk', value: data.medium, color: '#f59e0b' },
    { name: 'Low Risk', value: data.low, color: '#22c55e' }
  ].filter(item => item.value > 0)

  if (chartData.length === 0) {
    return (
      <div className="h-[300px] flex items-center justify-center text-gray-400">
        No data available
      </div>
    )
  }

  return (
    <div className="h-[300px]">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={100}
            paddingAngle={2}
            dataKey="value"
            label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
            labelLine={false}
          >
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value: number) => [value, 'Calls']}
          />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}
