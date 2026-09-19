import React, { useMemo } from 'react'
import {
  BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, Legend,
  PieChart, Pie, Cell, Bar, AreaChart, Area
} from 'recharts'
import { ATTACK_TYPES } from '../lib/constants'

const TOOLTIP_STYLE = {
  backgroundColor: '#0a1120',
  border: '1px solid rgba(59,130,246,0.25)',
  borderRadius: 6,
  fontSize: 12,
  color: '#e2e8f0',
  boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
}

const PieTooltip = ({ active, payload, totalValue }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload
    const percent = totalValue > 0 ? ((data.value / totalValue) * 100).toFixed(1) : 0
    return (
      <div style={TOOLTIP_STYLE}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px' }}>
          <span style={{ width: 10, height: 10, borderRadius: '50%', background: data.color }} />
          <strong style={{ color: '#e2e8f0' }}>{data.name}</strong>
          <span style={{ fontFamily: 'monospace', fontWeight: 700, color: data.color }}>
            {data.value.toLocaleString()} ({percent}%)
          </span>
        </div>
      </div>
    )
  }
  return null
}

const HorizontalBarTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload
    return (
      <div style={TOOLTIP_STYLE}>
        <div style={{ padding: '6px 10px' }}>
          <strong style={{ color: data.color }}>{data.name}</strong>
          <span style={{ marginLeft: 12, fontFamily: 'monospace' }}>{data.value.toLocaleString()} events</span>
        </div>
      </div>
    )
  }
  return null
}

const HourlyTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    const total = payload.reduce((sum, p) => sum + (p.value || 0), 0)
    return (
      <div style={{ ...TOOLTIP_STYLE, minWidth: 160 }}>
        <div style={{ padding: '6px 10px 4px', borderBottom: '1px solid rgba(255,255,255,0.06)', marginBottom: 4 }}>
          <strong style={{ color: '#e2e8f0', fontFamily: 'monospace' }}>{label}</strong>
          <span style={{ float: 'right', color: '#64748b', fontSize: 11 }}>{total} total</span>
        </div>
        {payload.filter(p => p.value > 0).map((p, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '2px 10px' }}>
            <span style={{ width: 8, height: 8, borderRadius: 2, background: p.fill, flexShrink: 0 }} />
            <span style={{ color: '#94a3b8', fontSize: 11, flex: 1 }}>{p.name}</span>
            <span style={{ fontFamily: 'monospace', fontSize: 11, color: p.fill }}>{p.value}</span>
          </div>
        ))}
      </div>
    )
  }
  return null
}

// FIX: added chartData to the function signature — was missing, causing hourly chart to never render
export default function PredictionCharts({ binaryStats, chartData, attackTypeTotals, topAttack, confidenceMetrics, systemInfo }) {
  const pieData = [
    { name: 'Benign', value: binaryStats.benign, color: '#10b981' },
    { name: 'Attack', value: binaryStats.attack, color: '#ef4444' },
  ]
  const totalPieValue = binaryStats.benign + binaryStats.attack

  // Filter hourly data to only show hours with at least some activity
  // avoids a completely flat/empty chart when data is sparse
  const activeHours = useMemo(() => {
    if (!chartData?.length) return []
    const hasActivity = chartData.some(h =>
      h.benign > 0 || h.attack > 0 || h.unknown > 0
    )
    if (!hasActivity) return chartData
    // show active window + 1 hour buffer on each side
    let firstActive = chartData.findIndex(h => h.benign > 0 || h.attack > 0 || h.unknown > 0)
    let lastActive  = chartData.length - 1 - [...chartData].reverse()
      .findIndex(h => h.benign > 0 || h.attack > 0 || h.unknown > 0)
    firstActive = Math.max(0, firstActive - 1)
    lastActive  = Math.min(chartData.length - 1, lastActive + 1)
    return chartData.slice(firstActive, lastActive + 1)
  }, [chartData])

  // Only show attack type bars that have at least one non-zero value in the data
  const activeAttackKeys = useMemo(() => {
    if (!activeHours.length) return []
    return ATTACK_TYPES
      .filter(t => t.key !== 'Unknown' && activeHours.some(h => (h[t.key] || 0) > 0))
      .map(t => t)
  }, [activeHours])

  const hasHourlyData = activeHours.some(h => h.benign > 0 || h.attack > 0)

  return (
    <>
      {/* Row 1: Binary Classification + Confidence Metrics */}
      <div className="panel-grid two-col">
        <div className="panel">
          <div className="panel-head">
            <div>
              <h2>Binary Classification: Traffic Overview</h2>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={80}
                paddingAngle={3}
                dataKey="value"
                label={({ name, percent }) => {
                  const pct = (percent * 100).toFixed(0)
                  return pct === '0' ? '' : `${name} ${pct}%`
                }}
                labelLine={{ stroke: '#475569', strokeWidth: 1 }}
                isAnimationActive={false}
              >
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} stroke="rgba(0,0,0,0.2)" strokeWidth={1} />
                ))}
              </Pie>
              <Tooltip content={<PieTooltip totalValue={totalPieValue} />} />
              <Legend
                wrapperStyle={{ fontSize: 11, paddingTop: 10, color: '#64748b' }}
                iconType="circle"
                iconSize={8}
                formatter={(value) => {
                  const item = pieData.find(d => d.name === value)
                  return `${value} (${item?.value.toLocaleString() || 0})`
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="panel">
          <div className="panel-head">
            <div>
              <h2>Confidence Metrics</h2>
              <p>Model prediction confidence · Session</p>
            </div>
          </div>
          <div className="metric-grid-3">
            <MetricCard label="Peak Confidence" value={confidenceMetrics.max.toFixed(4)} sub="Session high"  accent="#ef4444" />
            <MetricCard label="Avg Confidence"  value={confidenceMetrics.avg.toFixed(4)} sub="Session mean"  accent="#3b82f6" />
            <MetricCard label="Data Throughput" value={systemInfo.processed}             sub="Est. volume"   accent="#10b981" />
          </div>

          {topAttack && topAttack.type ? (
            <div className="dominant-attack-mini" style={{ marginTop: 16 }}>
              <div className="dominant-attack-mini-header">
                <span className="dominant-attack-mini-label">Most Dominant Attack</span>
                <span className="dominant-attack-mini-badge">{topAttack.percentage.toFixed(1)}% of attacks</span>
              </div>
              <div className="dominant-attack-mini-value">
                <strong>{topAttack.type}</strong>
                <span>{topAttack.count.toLocaleString()} events</span>
              </div>
              <div className="dominant-attack-mini-bar" style={{ width: `${Math.min(topAttack.percentage, 100)}%`, backgroundColor: '#ef4444' }} />
            </div>
          ) : (
            <div className="dominant-attack-mini empty" style={{ marginTop: 16 }}>
              <span>No attacks detected yet</span>
            </div>
          )}
        </div>
      </div>

      {/* Row 2: Attack Type Breakdown */}
      <div style={{ width: '100%', marginTop: '10px' }}>
        <div className="panel">
          <div className="panel-head">
            <div>
              <h2>Attack Type Breakdown</h2>
              <p>Top attack types by total count</p>
            </div>
          </div>
          {attackTypeTotals.length > 0 ? (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart
                layout="vertical"
                data={attackTypeTotals}
                margin={{ top: 8, right: 16, bottom: 8, left: 40 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.035)" horizontal={false} />
                <XAxis type="number" tick={{ fill: '#475569', fontSize: 10 }} />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fill: '#94a3b8', fontSize: 11 }}
                  width={70}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip content={<HorizontalBarTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={20}>
                  {attackTypeTotals.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart label="No attack data yet" sub="Upload a CSV to see attack type breakdown" />
          )}
        </div>
      </div>

      {/* Row 3: Hourly Timeline — was computed in App.jsx but never rendered (chartData ignored) */}
      <div style={{ width: '100%', marginTop: '10px' }}>
        <div className="panel">
          <div className="panel-head">
            <div>
              <h2>Hourly Traffic Timeline</h2>
              <p>Last 24 hours · Benign vs attack type distribution</p>
            </div>
            {hasHourlyData && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: '#64748b' }}>
                  <span style={{ width: 8, height: 8, borderRadius: 2, background: '#10b981' }} />
                  Benign
                </span>
                {activeAttackKeys.map(t => (
                  <span key={t.key} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: '#64748b' }}>
                    <span style={{ width: 8, height: 8, borderRadius: 2, background: t.color }} />
                    {t.label}
                  </span>
                ))}
              </div>
            )}
          </div>

          {hasHourlyData ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart
                data={activeHours}
                margin={{ top: 4, right: 8, bottom: 4, left: 0 }}
                barCategoryGap="20%"
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="rgba(255,255,255,0.04)"
                  vertical={false}
                />
                <XAxis
                  dataKey="hour"
                  tick={{ fill: '#475569', fontSize: 10 }}
                  tickLine={false}
                  axisLine={{ stroke: 'rgba(255,255,255,0.06)' }}
                  interval="preserveStartEnd"
                />
                <YAxis
                  tick={{ fill: '#475569', fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                  width={28}
                />
                <Tooltip content={<HourlyTooltip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
                {/* Benign bar always shown */}
                <Bar dataKey="benign" name="Benign" stackId="a" fill="#10b981" radius={[0, 0, 0, 0]} isAnimationActive={false} />
                {/* One stacked bar per active attack type */}
                {activeAttackKeys.map((t, i) => (
                  <Bar
                    key={t.key}
                    dataKey={t.key}
                    name={t.label}
                    stackId="a"
                    fill={t.color}
                    radius={i === activeAttackKeys.length - 1 ? [3, 3, 0, 0] : [0, 0, 0, 0]}
                    isAnimationActive={false}
                  />
                ))}
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart
              label="No traffic data in the last 24 hours"
              sub="Upload a CSV or PCAP to see the hourly breakdown"
            />
          )}
        </div>
      </div>
    </>
  )
}

function EmptyChart({ label, sub }) {
  return (
    <div className="chart-empty">
      <div className="chart-empty-icon">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <path d="M9 17V13M12 17V9M15 17V13" />
        </svg>
      </div>
      <p>{label}</p>
      <small>{sub}</small>
    </div>
  )
}

function MetricCard({ label, value, sub, accent }) {
  return (
    <div className="metric-card" style={{ '--accent': accent }}>
      <span className="metric-label">{label}</span>
      <strong className="metric-value mono" style={{ color: accent }}>{value}</strong>
      <small className="metric-sub">{sub}</small>
      <div className="metric-line" style={{ background: accent }} />
    </div>
  )
}