'use client'

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts'
import { format, parseISO } from 'date-fns'

interface TrendChartProps {
  data: Array<{
    date: string
    total_calls: number
    high_risk_calls: number
    avg_churn_risk: number
  }>
}

export default function TrendChart({ data }: TrendChartProps) {
  const formattedData = data.map(item => ({
    ...item,
    date: format(parseISO(item.date), 'dd MMM'),
    avg_churn_risk_percent: Math.round(item.avg_churn_risk * 100)
  })).reverse()

  if (!data.length) {
    return (
      <div className="h-[300px] flex items-center justify-center text-gray-400">
        No trend data available
      </div>
    )
  }

  return (
    <div className="h-[300px]">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={formattedData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 12 }}
            tickLine={false}
          />
          <YAxis
            yAxisId="left"
            tick={{ fontSize: 12 }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            tick={{ fontSize: 12 }}
            tickLine={false}
            axisLine={false}
            domain={[0, 100]}
            tickFormatter={(value) => `${value}%`}
          />
          <Tooltip />
          <Legend />
          <Line
            yAxisId="left"
            type="monotone"
            dataKey="total_calls"
            name="Total Calls"
            stroke="#3b82f6"
            strokeWidth={2}
            dot={false}
          />
          <Line
            yAxisId="left"
            type="monotone"
            dataKey="high_risk_calls"
            name="High Risk"
            stroke="#ef4444"
            strokeWidth={2}
            dot={false}
          />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="avg_churn_risk_percent"
            name="Avg Risk %"
            stroke="#f59e0b"
            strokeWidth={2}
            strokeDasharray="5 5"
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
