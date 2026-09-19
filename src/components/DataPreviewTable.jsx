import { useState, useEffect } from 'react'
import { getSupabaseClient } from '../lib/supabase'
import ExportButton from "./ExportButton"

export default function DataPreviewTable({ refreshTrigger, sessionId }) {
    const [data, setData] = useState([])
    const [loading, setLoading] = useState(false)
    const [filterStart, setFilterStart] = useState('')
    const [filterEnd, setFilterEnd] = useState('')
    const [page, setPage] = useState(0)
    const [totalCount, setTotalCount] = useState(0)
    const [filterBySession, setFilterBySession] = useState(false)
    const pageSize = 20

    const fetchData = async () => {
        setLoading(true)
        try {
            const supabase = getSupabaseClient()
            let query = supabase
                .from('predictions')
                .select('created_at, src_ip, dst_ip, pred_label, attack_type, confidence, binary_prob', { count: 'exact' })
                .order('created_at', { ascending: false })
                .range(page * pageSize, (page + 1) * pageSize - 1)

            if (filterStart) query = query.gte('created_at', new Date(filterStart).toISOString())
            if (filterEnd) query = query.lte('created_at', new Date(filterEnd + 'T23:59:59').toISOString())
            if (filterBySession && sessionId) query = query.eq('upload_session_id', sessionId)

            const { data, error, count } = await query
            if (error) throw error
            setData(data || [])
            setTotalCount(count || 0)
        } catch (err) {
            console.error('Preview fetch error:', err)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchData()
    }, [page, filterStart, filterEnd, refreshTrigger, filterBySession, sessionId])

    const handleDownload = async () => {
        try {
            const supabase = getSupabaseClient()
            let query = supabase
                .from('predictions')
                .select('created_at, src_ip, dst_ip, pred_label, attack_type, confidence, binary_prob')
                .order('created_at', { ascending: false })

            if (filterStart) query = query.gte('created_at', new Date(filterStart).toISOString())
            if (filterEnd) query = query.lte('created_at', new Date(filterEnd + 'T23:59:59').toISOString())
            if (filterBySession && sessionId) query = query.eq('upload_session_id', sessionId)

            const { data, error } = await query
            if (error) throw error
            if (!data.length) { alert('No data to download'); return }

            const headers = ['created_at', 'src_ip', 'dst_ip', 'pred_label', 'attack_type', 'confidence', 'binary_prob']
            const csvRows = [headers.join(',')]
            for (const row of data) {
                csvRows.push(headers.map(h => `"${String(row[h] ?? '').replace(/"/g, '""')}"`).join(','))
            }
            const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' })
            const url = URL.createObjectURL(blob)
            const a = Object.assign(document.createElement('a'), {
                href: url,
                download: `preview_${new Date().toISOString().slice(0, 19)}.csv`,
            })
            document.body.appendChild(a)
            a.click()
            document.body.removeChild(a)
            URL.revokeObjectURL(url)
        } catch (err) {
            alert(`Download failed: ${err.message}`)
        }
    }

    return (
        <div className="data-preview-panel">
            <div className="panel-head">
                <h2>Preview Data</h2>
                {sessionId && (
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px' }}>
                        <input
                            type="checkbox"
                            checked={filterBySession}
                            onChange={(e) => { setFilterBySession(e.target.checked); setPage(0); }}
                        />
                        Show only current upload
                    </label>
                )}
            </div>

            <div className="filter-bar">
                <div className="filter-group">
                    <label>From:</label>
                    <input type="date" value={filterStart} onChange={(e) => { setFilterStart(e.target.value); setPage(0); }} />
                </div>
                <div className="filter-group">
                    <label>To:</label>
                    <input type="date" value={filterEnd} onChange={(e) => { setFilterEnd(e.target.value); setPage(0); }} />
                </div>
                <ExportButton
                    onClick={handleDownload}
                    text="Export Filtered"
                />
                <button className="btn-refresh" onClick={fetchData} disabled={loading}>⟳ Refresh</button>
            </div>

            {loading ? (
                <div className="loading-placeholder">Loading data...</div>
            ) : (
                <>
                    <div className="table-wrapper">
                        <table className="preview-table">
                            <thead>
                                <tr>
                                    <th>Time</th><th>Source IP</th><th>Dest IP</th><th>Prediction</th><th>Attack Type</th><th>Confidence</th><th>Binary Prob</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.length === 0 ? (
                                    <tr><td colSpan="7" className="empty-row">No records match the filters</td></tr>
                                ) : (
                                    data.map((row, idx) => (
                                        <tr key={idx}>
                                            <td>{new Date(row.created_at).toLocaleString()}</td>
                                            <td>{row.src_ip || '—'}</td>
                                            <td>{row.dst_ip || '—'}</td>
                                            <td>{row.pred_label || '—'}</td>
                                            <td>{row.attack_type || '—'}</td>
                                            <td>{row.confidence?.toFixed(4) || '—'}</td>
                                            <td>{row.binary_prob?.toFixed(4) || '—'}</td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                    <div className="pagination">
                        <button disabled={page === 0} onClick={() => setPage(p => p - 1)}>◀ Previous</button>
                        <span>Page {page + 1} of {Math.ceil(totalCount / pageSize)}</span>
                        <button disabled={(page + 1) * pageSize >= totalCount} onClick={() => setPage(p => p + 1)}>Next ▶</button>
                    </div>
                </>
            )}
        </div>
    )
}