import { useEffect, useState, useCallback, useRef } from 'react'
import './App.css'
import StatsGrid from './components/StatsGrid'
import PredictionCharts from './components/PredictionCharts'
import RecentPredictionsTable from './components/RecentPredictionsTable'
import PredictionInputSection from './components/PredictionInputSection'
import { FEATURE_NAMES, CHART_HOURS, ATTACK_TYPES } from './lib/constants'
import { numeric, formatDateTime, formatDuration, computeChange } from './lib/helpers'
import { getSupabaseClient, isMissingSupabaseConfig } from './lib/supabase'
import DataPreviewTable from './components/DataPreviewTable'

const API_URL = import.meta.env.VITE_API_URL?.replace(/\/$/, '')
const missingSupabaseConfig = isMissingSupabaseConfig
const missingApiConfig = !API_URL
const apiAvailable = !missingApiConfig

const CACHE_KEY = 'iot_ids_v2'
const CACHE_TTL_MS = 8 * 60 * 60 * 1000

const saveCache = (data) => {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify({ ...data, savedAt: Date.now() })) } catch {}
}
const loadCache = () => {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    if (!raw) return null
    const data = JSON.parse(raw)
    if (Date.now() - data.savedAt > CACHE_TTL_MS) return null
    return data
  } catch { return null }
}
const clearCache = () => { try { localStorage.removeItem(CACHE_KEY) } catch {} }

// FIX: keys are lowercase to match backend response (ddos, mitm, dos etc.)
const ATTACK_KEY_MAP = Object.fromEntries(
  ATTACK_TYPES.map((t) => [t.key.toLowerCase(), t.key])
)
const normalizeAttackType = (raw) => {
  if (!raw) return null
  const lower = raw.toLowerCase()
  if (lower === 'unknown attack') return 'Unknown'
  return ATTACK_KEY_MAP[lower] ?? null
}

const normalizeManualResult = (raw) => {
  if (!raw) return null
  if (raw.prediction !== undefined) {
    return {
      prediction:  raw.prediction,
      attack_type: (raw.prediction !== 'Benign' && raw.prediction !== 'Unknown Attack') ? raw.prediction : null,
      confidence:  raw.confidence,
      binary_prob: raw.binary_prob ?? raw.confidence,
      stage:       raw.stage ?? 'multiclass',
    }
  }
  const isAttack = String(raw.label || raw.pred_label || '').toLowerCase() === 'attack'
  return {
    prediction:  isAttack ? raw.attack_type || 'Attack' : 'Benign',
    attack_type: raw.attack_type ?? null,
    confidence:  raw.confidence,
    binary_prob: raw.binary_prob ?? raw.confidence,
    stage:       isAttack ? 'multiclass' : 'binary',
  }
}

const emptyHourly = () =>
  CHART_HOURS.map((hour) => ({
    hour,
    benign: 0,
    attack: 0,
    unknown: 0,
    ...Object.fromEntries(ATTACK_TYPES.map((t) => [t.key, 0])),
  }))

// generate a unique session id for each upload
const newSessionId = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `sess_${Date.now()}_${Math.random().toString(36).slice(2)}`

export default function App() {
  const [recentPredictions, setRecentPredictions]   = useState([])
  const [chartData, setChartData]                   = useState(emptyHourly)
  const [attackTypeTotals, setAttackTypeTotals]     = useState([])
  const [topAttack, setTopAttack]                   = useState(null)
  const [stats, setStats]                           = useState({ total: 0, attacks: 0, benign: 0, unknown: 0 })
  const [changes, setChanges]                       = useState({ total: 0, attacks: 0, benign: 0, unknown: 0 })
  const [systemInfo, setSystemInfo]                 = useState({ lastUpdated: null, uptime: '0m', processed: '0.00 GB' })
  const [confidenceMetrics, setConfidenceMetrics]   = useState({ avg: 0, max: 0 })
  const [apiStatus, setApiStatus]                   = useState('Checking')
  const [activeMode, setActiveMode]                 = useState('manual')
  const [manualValues, setManualValues]             = useState(FEATURE_NAMES.reduce((acc, n) => ({ ...acc, [n]: '' }), {}))
  const [manualResult, setManualResult]             = useState(null)
  const [uploadResult, setUploadResult]             = useState(null)
  const [loading, setLoading]                       = useState(false)
  const [refreshing, setRefreshing]                 = useState(false)
  const [error, setError]                           = useState(null)
  const [uploadProgress, setUploadProgress]         = useState(0)
  const [uploadSpeed, setUploadSpeed]               = useState(0)
  const [uploadETA, setUploadETA]                   = useState(null)
  const [uploading, setUploading]                   = useState(false)
  const [lastRefreshed, setLastRefreshed]           = useState(null)
  const [elapsed, setElapsed]                       = useState(0)
  const [filterStart, setFilterStart]               = useState('')
  const [filterEnd, setFilterEnd]                   = useState('')
  const [previewRefresh, setPreviewRefresh]         = useState(0)
  const [showPreview, setShowPreview]               = useState(false)

  // SESSION TRACKING — isolates data per upload so File B doesn't mix with File A
  const [currentSessionId, setCurrentSessionId]   = useState(null)
  const [sessionMode, setSessionMode]              = useState('all') // 'all' | 'session'

  const abortControllerRef    = useRef(null)
  const refreshDashboardRef   = useRef(null)
  const retryTimersRef        = useRef([])

  const clearRetryTimers = () => {
    retryTimersRef.current.forEach(clearTimeout)
    retryTimersRef.current = []
  }

  useEffect(() => {
    const c = loadCache()
    if (!c) return
    if (c.attackTypeTotals) setAttackTypeTotals(c.attackTypeTotals)
    if (c.topAttack !== undefined) setTopAttack(c.topAttack)
    if (c.savedAt) setLastRefreshed(new Date(c.savedAt))
    setTimeout(() => refreshDashboardRef.current?.(), 100)
  }, [])

  useEffect(() => {
    const t = setInterval(() => {
      if (lastRefreshed) setElapsed(Math.floor((Date.now() - lastRefreshed.getTime()) / 1000))
    }, 1000)
    return () => clearInterval(t)
  }, [lastRefreshed])

  useEffect(() => () => clearRetryTimers(), [])

  const downloadCSV = async () => {
    try {
      const supabase = getSupabaseClient()
      const headers  = ['created_at', 'src_ip', 'dst_ip', 'pred_label', 'attack_type', 'confidence', 'binary_prob']
      const csvRows  = [headers.join(',')]
      let from = 0
      const PAGE = 1000
      while (true) {
        let q = supabase
          .from('predictions')
          .select('created_at, src_ip, dst_ip, pred_label, attack_type, confidence, binary_prob')
          .order('created_at', { ascending: false })
          .range(from, from + PAGE - 1)
        if (sessionMode === 'session' && currentSessionId)
          q = q.eq('upload_session_id', currentSessionId)
        const { data, error: err } = await q
        if (err) throw err
        if (!data?.length) break
        for (const row of data)
          csvRows.push(headers.map((h) => `"${String(row[h] ?? '').replace(/"/g, '""')}"`).join(','))
        if (data.length < PAGE) break
        from += PAGE
      }
      if (csvRows.length <= 1) { alert('No data to download'); return }
      const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' })
      const url  = URL.createObjectURL(blob)
      const a    = Object.assign(document.createElement('a'), {
        href:     url,
        download: `iot_ids_${sessionMode === 'session' ? 'session' : 'full'}_${new Date().toISOString().slice(0, 10)}.csv`,
      })
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err) {
      setError(`Download failed: ${err.message}`)
    }
  }

  const togglePreview = () => setShowPreview(prev => !prev)

  // helper: apply session filter to any supabase query when in session mode
  const applySessionFilter = useCallback((query) => {
    if (sessionMode === 'session' && currentSessionId)
      return query.eq('upload_session_id', currentSessionId)
    return query
  }, [sessionMode, currentSessionId])

  const refreshDashboard = useCallback(async () => {
    if (missingSupabaseConfig) { setError('Missing Supabase config.'); return }
    setRefreshing(true)
    try {
      const supabase    = getSupabaseClient()
      const todayStart  = new Date()
      todayStart.setHours(0, 0, 0, 0)

      // count queries — all filtered by session when in session mode
      const base = () => supabase.from('predictions')

      const [
        cTotal, cBenign, cAttackKnown,
        yTotal, yBenign, yAttackKnown,
      ] = await Promise.all([
        applySessionFilter(base().select('*', { count: 'exact', head: true })),
        applySessionFilter(base().select('*', { count: 'exact', head: true }).eq('pred_label', 'benign')),
        applySessionFilter(base().select('*', { count: 'exact', head: true })
          .eq('pred_label', 'attack').not('attack_type', 'is', null).neq('attack_type', 'Unknown Attack')),
        applySessionFilter(base().select('*', { count: 'exact', head: true })
          .lt('created_at', todayStart.toISOString())),
        applySessionFilter(base().select('*', { count: 'exact', head: true })
          .eq('pred_label', 'benign').lt('created_at', todayStart.toISOString())),
        applySessionFilter(base().select('*', { count: 'exact', head: true })
          .eq('pred_label', 'attack').not('attack_type', 'is', null)
          .neq('attack_type', 'Unknown Attack').lt('created_at', todayStart.toISOString())),
      ])

      const totalN   = cTotal.count   || 0
      const benignN  = cBenign.count  || 0
      const attackN  = cAttackKnown.count || 0
      const unknownN = Math.max(0, totalN - benignN - attackN)
      const cumulativeCounts = { total: totalN, attacks: attackN, benign: benignN, unknown: unknownN }

      const yTotalN   = yTotal.count   || 0
      const yBenignN  = yBenign.count  || 0
      const yAttackN  = yAttackKnown.count || 0
      const yUnknownN = Math.max(0, yTotalN - yBenignN - yAttackN)
      const yesterCounts = { total: yTotalN, attacks: yAttackN, benign: yBenignN, unknown: yUnknownN }

      const newChanges = {
        total:   computeChange(cumulativeCounts.total,   yesterCounts.total),
        attacks: computeChange(cumulativeCounts.attacks, yesterCounts.attacks),
        benign:  computeChange(cumulativeCounts.benign,  yesterCounts.benign),
        unknown: computeChange(cumulativeCounts.unknown, yesterCounts.unknown),
      }

      // attack type breakdown — paginated
      let allAttackTypes = []
      let from = 0
      const AT_PAGE = 1000
      while (true) {
        const { data, error } = await applySessionFilter(
          base()
            .select('attack_type')
            .eq('pred_label', 'attack')
            .not('attack_type', 'is', null)
            .neq('attack_type', 'Unknown Attack')
            .range(from, from + AT_PAGE - 1)
        )
        if (error) throw error
        if (!data || data.length === 0) break
        allAttackTypes.push(...data)
        if (data.length < AT_PAGE) break
        from += AT_PAGE
      }

      const typeCounts = {}
      allAttackTypes.forEach(row => {
        const key = normalizeAttackType(row.attack_type)
        if (key && key !== 'Unknown') typeCounts[key] = (typeCounts[key] || 0) + 1
      })

      // FIX: use label from ATTACK_TYPES for display (DDoS not Ddos, MITM not Mitm)
      const totalsArray = Object.entries(typeCounts)
        .map(([key, value]) => {
          const at = ATTACK_TYPES.find(t => t.key === key)
          return {
            name:  at?.label || key.charAt(0).toUpperCase() + key.slice(1),
            value,
            color: at?.color || '#888',
          }
        })
        .sort((a, b) => b.value - a.value)
        .slice(0, 7)

      setAttackTypeTotals(totalsArray)

      let newTopAttack = null
      if (totalsArray.length > 0) {
        const top = totalsArray[0]
        newTopAttack = {
          type:       top.name,
          count:      top.value,
          percentage: (top.value / (cumulativeCounts.attacks || 1)) * 100,
          color:      top.color,
        }
      }
      setTopAttack(newTopAttack)

      // confidence metrics
      const { data: confData, error: confErr } = await applySessionFilter(
        base().select('confidence').order('created_at', { ascending: false }).limit(1000)
      )
      if (!confErr && confData?.length) {
        let sum = 0, maxConf = 0
        confData.forEach(r => {
          const c = Number(r.confidence) || 0
          sum += c
          if (c > maxConf) maxConf = c
        })
        setConfidenceMetrics({ avg: sum / confData.length, max: maxConf })
      } else {
        setConfidenceMetrics({ avg: 0, max: 0 })
      }

      // hourly chart — last 24h, paginated
      const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      let hourlyRows = []
      let hFrom = 0
      const H_PAGE = 5000
      while (true) {
        const { data, error } = await applySessionFilter(
          base()
            .select('created_at, pred_label, attack_type')
            .gte('created_at', last24h)
            .order('created_at', { ascending: true })
            .range(hFrom, hFrom + H_PAGE - 1)
        )
        if (error) throw error
        if (!data?.length) break
        hourlyRows.push(...data)
        if (data.length < H_PAGE) break
        hFrom += H_PAGE
      }

      const grouped = emptyHourly()
      let lastTs = null
      hourlyRows.forEach(p => {
        const date = new Date(p.created_at)
        const hour = String(date.getHours()).padStart(2, '0') + ':00'
        const row  = grouped.find(r => r.hour === hour)
        if (!row) return
        const label = String(p.pred_label || '').toLowerCase()
        if (label === 'attack') {
          row.attack += 1
          const key = normalizeAttackType(p.attack_type) ?? 'Unknown'
          if (key !== 'Unknown') row[key] = (row[key] || 0) + 1
        } else if (label === 'benign') {
          row.benign += 1
        } else {
          row.unknown += 1
        }
        const ts = date.getTime()
        lastTs = lastTs === null ? ts : Math.max(lastTs, ts)
      })
      setChartData(grouped)

      // recent predictions
      let recentQuery = applySessionFilter(
        base()
          .select('created_at, src_ip, dst_ip, pred_label, attack_type, confidence, binary_prob')
          .order('created_at', { ascending: false })
          .limit(200)
      )
      if (filterStart) recentQuery = recentQuery.gte('created_at', new Date(filterStart).toISOString())
      if (filterEnd)   recentQuery = recentQuery.lte('created_at', new Date(filterEnd + 'T23:59:59').toISOString())
      const { data: recent, error: recentErr } = await recentQuery
      if (recentErr) throw recentErr
      setRecentPredictions(recent || [])

      // uptime from oldest record
      const { data: firstLast, error: flErr } = await applySessionFilter(
        base().select('created_at').order('created_at', { ascending: true }).limit(1)
      )
      if (!flErr && firstLast?.length) {
        const firstTsDate = new Date(firstLast[0].created_at)
        const uptimeMs    = Date.now() - firstTsDate.getTime()
        setSystemInfo(prev => ({
          ...prev,
          uptime:      formatDuration(uptimeMs),
          processed:   `${((cumulativeCounts.total * 0.35) / 1024).toFixed(2)} GB`,
          lastUpdated: lastTs ? new Date(lastTs).toISOString() : null,
        }))
      } else {
        setSystemInfo(prev => ({ ...prev, uptime: '0m', processed: '0.00 GB', lastUpdated: null }))
      }

      setStats(cumulativeCounts)
      setChanges(newChanges)
      setError(null)

      const now = new Date()
      setLastRefreshed(now)
      setElapsed(0)

      saveCache({ attackTypeTotals: totalsArray, topAttack: newTopAttack, savedAt: now.getTime() })
    } catch (err) {
      console.error('Refresh error:', err)
      setError(err?.message || String(err))
    } finally {
      setRefreshing(false)
    }
  }, [filterStart, filterEnd, applySessionFilter])

  useEffect(() => {
    refreshDashboardRef.current = refreshDashboard
  }, [refreshDashboard])

  // re-fetch when session mode changes
  useEffect(() => {
    clearCache()
    refreshDashboardRef.current?.()
  }, [sessionMode, currentSessionId])

  const checkApiStatus = useCallback(async () => {
    if (!API_URL) { setApiStatus('No URL'); return }
    try {
      const res = await fetch(`${API_URL}/health`)
      setApiStatus(res.ok ? 'Healthy' : 'Unhealthy')
    } catch {
      setApiStatus('Unhealthy')
    }
  }, [])

  useEffect(() => {
    if (!missingSupabaseConfig) refreshDashboard()
    if (!missingApiConfig)      checkApiStatus()
  }, [])

  useEffect(() => {
    if (missingSupabaseConfig) return
    const id = setInterval(() => refreshDashboardRef.current?.(), 30_000)
    return () => clearInterval(id)
  }, [])

  const updateManualValue = (name, value) =>
    setManualValues((cur) => ({ ...cur, [name]: value }))

  const handleManualSubmit = async (e) => {
    e.preventDefault()
    if (!apiAvailable) return
    setError(null)
    setManualResult(null)
    setLoading(true)
    // manual predictions get their own session or reuse current
    const sessionId = currentSessionId || newSessionId()
    if (!currentSessionId) {
      setCurrentSessionId(sessionId)
      setSessionMode('session')
    }
    try {
      const body = {
        features:   FEATURE_NAMES.reduce((acc, n) => ({ ...acc, [n]: numeric(manualValues[n]) }), {}),
        session_id: sessionId,
      }
      const res = await fetch(`${API_URL}/predict/manual`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result?.error || result?.message || `Server error ${res.status}`)
      setManualResult(normalizeManualResult(result?.results?.[0] ?? result))
      clearCache()
      await refreshDashboardRef.current?.()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  // CSV upload → /predict/csv?session_id=...
  const uploadCSV = (file, sessionId) =>
    new Promise((resolve, reject) => {
      const startTime = Date.now()
      const xhr = new XMLHttpRequest()
      abortControllerRef.current = { abort: () => xhr.abort() }
      xhr.upload.addEventListener('progress', (e) => {
        if (!e.lengthComputable) return
        const pct  = Math.round((e.loaded / e.total) * 100)
        const secs = (Date.now() - startTime) / 1000
        const bps  = secs > 0 ? e.loaded / secs : 0
        setUploadProgress(pct)
        setUploadSpeed((bps / 1024).toFixed(1))
        setUploadETA(bps > 0 ? Math.ceil((e.total - e.loaded) / bps) : null)
      })
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try { resolve(JSON.parse(xhr.responseText)) } catch { resolve({}) }
        } else {
          let msg = `CSV upload failed (${xhr.status})`
          try { const e = JSON.parse(xhr.responseText); if (e.detail) msg = e.detail } catch {}
          reject(new Error(msg))
        }
      }
      xhr.onerror = () => reject(new Error('Network error during CSV upload'))
      xhr.onabort = () => reject(new Error('Upload cancelled'))
      const fd = new FormData()
      fd.append('file', file)
      xhr.open('POST', `${API_URL}/predict/csv?session_id=${encodeURIComponent(sessionId)}`)
      xhr.send(fd)
    })

  // PCAP upload → /predict/pcap?session_id=...
  // FIX: was calling /predict/csv before, causing 400 error on PCAP files
  const uploadPCAP = (file, sessionId) =>
    new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest()
      abortControllerRef.current = { abort: () => xhr.abort() }
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try { resolve(JSON.parse(xhr.responseText)) } catch { resolve({}) }
        } else {
          let msg = `PCAP upload failed (${xhr.status})`
          try { const e = JSON.parse(xhr.responseText); if (e.detail) msg = e.detail } catch {}
          reject(new Error(msg))
        }
      }
      xhr.onerror = () => reject(new Error('Network error during PCAP upload'))
      xhr.onabort = () => reject(new Error('PCAP upload cancelled'))
      const fd = new FormData()
      fd.append('file', file)
      xhr.open('POST', `${API_URL}/predict/pcap?session_id=${encodeURIComponent(sessionId)}`)
      xhr.send(fd)
    })

  const handleUpload = async (file, endpoint) => {
    if (!file || !apiAvailable) return
    clearRetryTimers()
    setError(null)
    setUploadResult(null)
    setUploadProgress(0)
    setUploadSpeed(0)
    setUploadETA(null)
    setUploading(true)
    setLoading(true)

    // new session per upload — this is the key fix for data mixing
    const sessionId = newSessionId()
    setCurrentSessionId(sessionId)
    setSessionMode('session') // auto-switch to show only this upload's data

    try {
      const result = endpoint === 'pcap'
        ? await uploadPCAP(file, sessionId)
        : await uploadCSV(file, sessionId)

      setUploadResult({ endpoint, result, sessionId })
      clearCache()
      await refreshDashboardRef.current?.()
    } catch (err) {
      setError(err.message)
    } finally {
      setUploading(false)
      setLoading(false)
      setUploadProgress(0)
      setUploadSpeed(0)
      setUploadETA(null)
      abortControllerRef.current = null
    }
  }

  const cancelUpload = () => {
    clearRetryTimers()
    abortControllerRef.current?.abort()
    abortControllerRef.current = null
    setUploading(false)
    setLoading(false)
    setUploadProgress(0)
    setUploadSpeed(0)
    setUploadETA(null)
    setError('Upload cancelled.')
  }

  const formatElapsed = (s) => {
    if (s < 60)   return `${s}s ago`
    if (s < 3600) return `${Math.floor(s / 60)}m ago`
    return `${Math.floor(s / 3600)}h ago`
  }

  if (missingSupabaseConfig) {
    return (
      <div className="app-shell">
        <div className="error-banner" style={{ margin: 24, borderRadius: 8 }}>
          <strong>Missing environment variables.</strong> Create a <code>.env</code> file:
          <pre>{`VITE_SUPABASE_URL=https://your-project.supabase.co\nVITE_SUPABASE_ANON_KEY=your-anon-key\nVITE_API_URL=https://your-api-url`}</pre>
          Then restart the dev server.
        </div>
      </div>
    )
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar-brand">
          <div className="brand-icon">
            <img src="/LogoSvg.svg" alt="NetraShield Logo" style={{ width: 70, height: 70, objectFit: 'contain' }} />
          </div>
          <div>
            <span className="brand-name">NetraShield</span>
            <p className="brand-sub">IoT Devices Malware Detection</p>
          </div>
        </div>

        <div className="top-actions">
          {/* session toggle — All Time vs Current Upload */}
          <div className="session-toggle">
            <button
              className={`session-btn ${sessionMode === 'all' ? 'session-btn--active' : ''}`}
              onClick={() => setSessionMode('all')}
            >
              All Time
            </button>
            <button
              className={`session-btn ${sessionMode === 'session' ? 'session-btn--active' : ''}`}
              onClick={() => { if (currentSessionId) setSessionMode('session') }}
              disabled={!currentSessionId}
              title={currentSessionId ? `Session: ${currentSessionId.slice(0, 8)}…` : 'Upload a file first'}
            >
              Current Upload
              {currentSessionId && (
                <span className="session-id-badge">#{currentSessionId.slice(0, 6)}</span>
              )}
            </button>
          </div>

          <div className="refresh-meta">
            {lastRefreshed && (
              <span className="refresh-ts">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" />
                </svg>
                {formatElapsed(elapsed)}
              </span>
            )}
          </div>

          <div className={`status-pill ${apiStatus === 'Healthy' ? 'status-ok' : 'status-warn'}`}>
            <span className="status-dot" /> API {apiStatus}
          </div>
          <div className="status-pill status-ok"><span className="status-dot" /> Live</div>

          <button
            className={`btn-refresh ${refreshing ? 'btn-refresh--spinning' : ''}`}
            onClick={() => { clearCache(); refreshDashboardRef.current?.() }}
            disabled={refreshing}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M23 4v6h-6M1 20v-6h6" />
              <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
            </svg>
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
      </header>

      {missingApiConfig && (
        <div className="info-banner">⚠ VITE_API_URL not set</div>
      )}

      <main>
        <div className="overview-header">
          <div>
            <h1>Dashboard</h1>
            <p>
              Real-time IoT network threat detection · CIC-IoT 2025
              {sessionMode === 'session' && currentSessionId && (
                <span className="session-label"> · Session #{currentSessionId.slice(0, 8)}</span>
              )}
            </p>
          </div>
        </div>

        <StatsGrid stats={stats} changes={changes} />

        <PredictionCharts
          binaryStats={{ benign: stats.benign, attack: stats.attacks }}
          chartData={chartData}
          attackTypeTotals={attackTypeTotals}
          topAttack={topAttack}
          confidenceMetrics={confidenceMetrics}
          systemInfo={systemInfo}
        />

        <RecentPredictionsTable
          recentPredictions={recentPredictions}
          refreshDashboard={() => { clearCache(); refreshDashboardRef.current?.() }}
          filterStart={filterStart}
          setFilterStart={setFilterStart}
          filterEnd={filterEnd}
          setFilterEnd={setFilterEnd}
          downloadCSV={downloadCSV}
          onTogglePreview={togglePreview}
          isPreviewOpen={showPreview}
          sessionId={currentSessionId}
          sessionMode={sessionMode}
        />

        {showPreview && (
          <div style={{ marginTop: '24px' }}>
            <DataPreviewTable
              refreshTrigger={previewRefresh}
              sessionId={sessionMode === 'session' ? currentSessionId : null}
            />
          </div>
        )}

        {error && (
          <div className="error-banner">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10" /><path d="M12 8v4m0 4h.01" />
            </svg>
            {error}
          </div>
        )}

        <PredictionInputSection
          activeMode={activeMode}
          setActiveMode={setActiveMode}
          apiAvailable={apiAvailable}
          missingApiConfig={missingApiConfig}
          loading={loading}
          uploadProgress={uploadProgress}
          uploadSpeed={uploadSpeed}
          uploadETA={uploadETA}
          uploading={uploading}
          onCancelUpload={cancelUpload}
          featureNames={FEATURE_NAMES}
          manualValues={manualValues}
          updateManualValue={updateManualValue}
          handleManualSubmit={handleManualSubmit}
          handleUpload={handleUpload}
          manualResult={manualResult}
          uploadResult={uploadResult}
        />
      </main>
    </div>
  )
}