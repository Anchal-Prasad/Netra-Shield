export const numeric = (value) =>
  typeof value === 'number' ? value : Number(value) || 0

export const formatPercent = (value) => {
  const n = Number(value) || 0
  return `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`
}

export const formatDateTime = (value) => {
  if (!value) return '–'
  const d = new Date(value)
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

export const formatDuration = (ms) => {
  const total = Math.floor(ms / 1000)
  const d = Math.floor(total / 86400)
  const h = Math.floor((total % 86400) / 3600)
  const m = Math.floor((total % 3600) / 60)
  return [d ? `${d}d` : null, h ? `${h}h` : null, `${m}m`].filter(Boolean).join(' ')
}

export const getRiskScore = (prediction) => {
  const prob = numeric(prediction.binary_prob)
  return prediction.pred_label === 'attack' ? prob : 1 - prob
}

export const computeChange = (current, previous) => {
  if (!previous) return current > 0 ? 100 : 0
  return ((current - previous) / Math.abs(previous)) * 100
}
