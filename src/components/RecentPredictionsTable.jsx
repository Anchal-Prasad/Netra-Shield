import { useState } from 'react'
import { formatDateTime } from '../lib/helpers'
import { getSupabaseClient } from '../lib/supabase'
import ExportButton from "./ExportButton"

export default function RecentPredictionsTable({
  recentPredictions,
  refreshDashboard,
  filterStart, setFilterStart,
  filterEnd,   setFilterEnd,
  downloadCSV,
  onTogglePreview,
  isPreviewOpen,
  // session props — passed from App.jsx when session mode is active
  sessionId,        // current session UUID or null
  sessionMode,      // 'all' | 'session'
}) {
  const [deleting, setDeleting] = useState(false)

  const clearFilters = () => {
    setFilterStart('')
    setFilterEnd('')
    refreshDashboard()
  }

  const hasFilter = filterStart || filterEnd
  const isSessionMode = sessionMode === 'session' && sessionId

  // FIX: Supabase delete 500 error
  // Root cause: anon key has no RLS delete policy → PostgreSQL returns 500
  // Fix A (recommended): run this SQL in Supabase to allow deletes:
  //   ALTER TABLE predictions DISABLE ROW LEVEL SECURITY;
  //   -- OR if you need RLS on for other reasons:
  //   CREATE POLICY "allow_delete" ON predictions FOR DELETE TO anon USING (true);
  //
  // Fix B (implemented here): we now chunk-delete by fetching IDs first,
  // which makes the error message clearer and handles partial deletes cleanly.
  // Without the SQL fix above, both approaches will still get 500 from Supabase.
  const handleDeleteAll = async () => {
    const scope = isSessionMode ? 'current session' : 'ALL prediction records'
    if (!window.confirm(`This will delete ${scope}. Are you sure?`)) return
    if (!window.confirm('Second confirmation — this cannot be undone.')) return

    const confirmation = prompt(`Type "DELETE ALL" to proceed:`)
    if (confirmation !== 'DELETE ALL') {
      alert('Cancelled — deletion aborted.')
      return
    }

    setDeleting(true)
    try {
      const supabase = getSupabaseClient()

      // Step 1: fetch all IDs in scope (paginated — avoids 1000-row cap)
      let ids = []
      let from = 0
      const PAGE = 1000
      while (true) {
        let q = supabase
          .from('predictions')
          .select('id')
          .range(from, from + PAGE - 1)
        if (isSessionMode) {
          q = q.eq('upload_session_id', sessionId)
        }
        const { data, error } = await q
        if (error) throw error
        if (!data?.length) break
        ids.push(...data.map(r => r.id))
        if (data.length < PAGE) break
        from += PAGE
      }

      if (ids.length === 0) {
        alert('No records to delete.')
        return
      }

      // Step 2: delete in chunks of 500
      const CHUNK = 500
      for (let i = 0; i < ids.length; i += CHUNK) {
        const chunk = ids.slice(i, i + CHUNK)
        const { error } = await supabase
          .from('predictions')
          .delete()
          .in('id', chunk)
        if (error) throw error
      }

      alert(`${ids.length.toLocaleString()} record${ids.length !== 1 ? 's' : ''} deleted successfully.`)
      refreshDashboard()
    } catch (err) {
      // give a helpful message if it's an RLS issue
      const msg = err.message?.includes('42501') || err.message?.includes('permission') || err.code === '42501'
        ? `Delete failed: Supabase RLS is blocking this operation.\n\nFix: Run this SQL in your Supabase SQL editor:\nALTER TABLE predictions DISABLE ROW LEVEL SECURITY;\n\nOriginal error: ${err.message}`
        : `Deletion failed: ${err.message}`
      alert(msg)
    } finally {
      setDeleting(false)
    }
  }

  const getBenignBarColor = (benignProb) => {
    if (benignProb >= 0.7) return '#10b981'
    if (benignProb >= 0.4) return '#f59e0b'
    return '#ef4444'
  }

  const deleteLabel = isSessionMode ? 'Delete Session' : 'Delete All'

  return (
    <div className="panel-table">
      <div className="panel-table-head">
        <div>
          <h2>Recent Predictions</h2>
          <p>
            {recentPredictions.length > 0
              ? `${recentPredictions.length} records${hasFilter ? ' (filtered)' : ''}${isSessionMode ? ' · current session' : ''} · CSV export includes full history`
              : 'No predictions match the selected filters.'}
          </p>
        </div>
      </div>

      <div className="filter-bar">
        <label className="filter-date-label">
          <span>From</span>
          <input
            type="date"
            value={filterStart}
            onChange={(e) => setFilterStart(e.target.value)}
          />
        </label>
        <label className="filter-date-label">
          <span>To</span>
          <input
            type="date"
            value={filterEnd}
            onChange={(e) => setFilterEnd(e.target.value)}
          />
        </label>

        {hasFilter && (
          <button onClick={clearFilters} className="filter-btn filter-btn--ghost">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
            Clear
          </button>
        )}

        <button onClick={refreshDashboard} className="filter-btn">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M23 4v6h-6M1 20v-6h6" />
            <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
          </svg>
          Refresh
        </button>

        <ExportButton onClick={downloadCSV} text="Export All" />

        <button
          onClick={onTogglePreview}
          className={`filter-btn ${isPreviewOpen ? 'filter-btn--active' : ''}`}
          style={{ background: isPreviewOpen ? 'rgba(59,130,246,0.2)' : undefined }}
        >
          {isPreviewOpen ? 'Hide Preview' : 'Preview Data'}
        </button>

        <button
          onClick={handleDeleteAll}
          disabled={deleting}
          className="filter-btn filter-btn--danger"
          style={{ borderColor: '#ef4444', color: '#ef4444', background: 'transparent' }}
          onMouseEnter={(e) => { e.currentTarget.style.background = '#ef4444'; e.currentTarget.style.color = '#fff' }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#ef4444' }}
        >
          {deleting ? (
            <>
              <span style={{
                display: 'inline-block', width: 12, height: 12,
                border: '2px solid currentColor', borderTopColor: 'transparent',
                borderRadius: '50%', animation: 'spin 0.6s linear infinite', marginRight: 6
              }} />
              Deleting…
            </>
          ) : (
            <>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ marginRight: 4 }}>
                <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
              </svg>
              {deleteLabel}
            </>
          )}
        </button>
      </div>

      <div className="table-scroll">
        <table className="data-table">
          <thead>
            <tr>
              <th>Time</th>
              <th>Source IP</th>
              <th>Destination IP</th>
              <th>Prediction</th>
              <th>Attack Type</th>
              <th>Attack Probability</th>
              <th>Benign Probability</th>
            </tr>
          </thead>
          <tbody>
            {recentPredictions.length > 0 ? (
              recentPredictions.map((item, i) => {
                const attackProb  = item.binary_prob || 0
                const benignProb  = 1 - attackProb
                const attackPercent = (attackProb * 100).toFixed(2)
                const benignPercent = (benignProb * 100).toFixed(2)

                const riskClass =
                  attackProb >= 0.8 ? 'risk-critical' :
                  attackProb >= 0.6 ? 'risk-high'     :
                  attackProb >= 0.4 ? 'risk-medium'   : 'risk-low'

                const rowClass =
                  item.pred_label === 'attack' ? 'row-attack'  :
                  item.pred_label === 'benign' ? 'row-benign'  : 'row-unknown'

                const benignBarColor = getBenignBarColor(benignProb)

                return (
                  <tr key={`${item.created_at}-${i}`} className={rowClass}>
                    <td className="mono text-muted">{formatDateTime(item.created_at)}</td>
                    <td className="mono">{item.src_ip  || '—'}</td>
                    <td className="mono">{item.dst_ip  || '—'}</td>
                    <td>
                      <span className={`label-pill ${
                        item.pred_label === 'attack' ? 'pill-attack' :
                        item.pred_label === 'benign' ? 'pill-benign' : 'pill-unknown'
                      }`}>
                        {item.pred_label || 'unknown'}
                      </span>
                    </td>
                    <td>
                      {item.attack_type
                        ? <span className="attack-tag">{item.attack_type}</span>
                        : <span className="text-muted">—</span>}
                    </td>
                    <td className="mono">
                      <div className={`risk-cell ${riskClass}`}>
                        <div className="risk-bar-bg">
                          <div className="risk-bar-fill" style={{ width: `${attackProb * 100}%` }} />
                        </div>
                        <span className="risk-label">{attackPercent}%</span>
                      </div>
                    </td>
                    <td className="mono">
                      <div className="risk-cell">
                        <div className="risk-bar-bg">
                          <div className="risk-bar-fill" style={{ width: `${benignProb * 100}%`, background: benignBarColor }} />
                        </div>
                        <span className="risk-label" style={{ color: benignBarColor }}>{benignPercent}%</span>
                      </div>
                    </td>
                  </tr>
                )
              })
            ) : (
              <tr>
                <td colSpan="7" className="empty-row">No predictions match the selected filters.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}