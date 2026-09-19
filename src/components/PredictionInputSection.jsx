import { useRef, useEffect } from 'react'

export default function PredictionInputSection({
  activeMode, setActiveMode,
  apiAvailable, missingApiConfig,
  loading, uploading,
  uploadProgress, uploadSpeed, uploadETA,
  onCancelUpload,
  featureNames, manualValues, updateManualValue,
  handleManualSubmit, handleUpload,
  manualResult, uploadResult,
}) {
  const hiddenFileInput = useRef(null)

  const apiMsg = missingApiConfig
    ? 'Set VITE_API_URL in your .env file to enable predictions.'
    : 'API unreachable — check your backend URL and CORS settings.'

  const formatETA = (sec) => {
    if (sec == null || sec < 0) return '–'
    if (sec < 60) return `${sec}s`
    if (sec < 3600) return `${Math.floor(sec / 60)}m ${sec % 60}s`
    return `${Math.floor(sec / 3600)}h ${Math.floor((sec % 3600) / 60)}m`
  }

  // Update file picker accept attribute based on active mode
  useEffect(() => {
    if (hiddenFileInput.current) {
      if (activeMode === 'csv') {
        hiddenFileInput.current.accept = '.csv'
      } else if (activeMode === 'pcap') {
        hiddenFileInput.current.accept = '.pcap,.pcapng'
      }
    }
  }, [activeMode])

  const handleFileChange = (e) => {
    const file = e.target.files?.[0]
    if (file) {
      console.log(`[${activeMode}] FILE SELECTED:`, file.name)
      handleUpload(file, activeMode)
    }
    if (hiddenFileInput.current) hiddenFileInput.current.value = ''
  }

  const openFilePicker = () => {
    if (!apiAvailable || loading || uploading) {
      console.log(`[${activeMode}] Cannot open – disabled`)
      return
    }
    console.log(`[${activeMode}] Opening file picker`)
    hiddenFileInput.current?.click()
  }

  const CSVProgressUI = uploading && activeMode === 'csv' && (
    <div className="upload-progress-panel">
      <div className="upload-progress-header">
        <div className="upload-status-row">
          <div className="upload-spinner" />
          <span className="upload-status-text">Uploading CSV…</span>
          {uploadSpeed > 0 && (
            <span className="upload-speed-badge">{uploadSpeed} KB/s</span>
          )}
        </div>
        {uploadETA !== null && (
          <span className="upload-eta">ETA {formatETA(uploadETA)}</span>
        )}
      </div>
      <div className="upload-progress-bar-wrap">
        <div className="upload-progress-bar-fill" style={{ width: `${uploadProgress}%` }} />
      </div>
      <div className="upload-progress-stats">
        <span className="progress-pct">{uploadProgress}%</span>
      </div>
      <div className="upload-controls">
        <button className="btn-cancel" onClick={onCancelUpload}>✕ Cancel</button>
      </div>
    </div>
  )

  // PCAP progress UI (now enabled)
  const PCAPProgressUI = uploading && activeMode === 'pcap' && (
    <div className="upload-progress-panel">
      <div className="upload-progress-header">
        <div className="upload-status-row">
          <div className="upload-spinner" />
          <span className="upload-status-text">Processing PCAP (flow extraction)…</span>
        </div>
      </div>
      <div className="upload-progress-stats" style={{ justifyContent: 'center' }}>
        <span className="progress-pct" style={{ fontSize: 13 }}>Please wait – this may take a moment</span>
      </div>
      <div className="upload-controls">
        <button className="btn-cancel" onClick={onCancelUpload}>✕ Cancel</button>
      </div>
    </div>
  )

  const ManualResultUI = manualResult && (
    <div className="result-panel">
      <div className="result-panel-title">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" /><path d="M12 8v4m0 4h.01" />
        </svg>
        Prediction Result
      </div>
      <div className="result-grid-4">
        <ResultCell label="Classification" value={manualResult.prediction ?? manualResult.pred_label ?? '–'} highlight />
        <ResultCell label="Attack Type"    value={manualResult.attack_type ?? '–'} />
        <ResultCell label="Confidence"     value={Number(manualResult.confidence ?? 0).toFixed(4)} mono />
        <ResultCell label="Stage"          value={manualResult.stage ?? '–'} />
      </div>
    </div>
  )

  const UploadResultUI = uploadResult && (
    <div className="result-panel success">
      <div className="result-panel-title">
        <span className="result-check">✓</span>
        Upload Complete — {uploadResult.endpoint.toUpperCase()}
      </div>
      <div className="result-grid-4">
        {uploadResult.result.total_rows != null && (
          <ResultCell label="Rows Processed" value={uploadResult.result.total_rows.toLocaleString()} highlight />
        )}
        {uploadResult.result.total_flows != null && (
          <ResultCell label="Flows Extracted" value={uploadResult.result.total_flows.toLocaleString()} highlight />
        )}
        <ResultCell label="Status" value={uploadResult.result.status ?? 'success'} />
      </div>
    </div>
  )

  const UploadDropZone = ({ label, hint }) => (
    <div
      className="upload-drop-zone"
      onClick={openFilePicker}
      style={{
        cursor: loading || uploading ? 'not-allowed' : 'pointer',
        opacity: loading || uploading ? 0.6 : 1,
      }}
    >
      <div className="upload-icon">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
          <polyline points="17 8 12 3 7 8" />
          <line x1="12" y1="3" x2="12" y2="15" />
        </svg>
      </div>
      <div className="upload-label">{label}</div>
      <div className="upload-hint">{hint}</div>
      {!loading && !uploading && (
        <div
          className="upload-btn-ghost"
          onClick={(e) => { e.stopPropagation(); openFilePicker() }}
        >
          Choose File
        </div>
      )}
    </div>
  )

  const TABS = [
    { id: 'manual', icon: '⌨️',  label: 'Manual Input' },
    { id: 'csv',    icon: '📊',  label: 'CSV Upload'   },
    { id: 'pcap',   icon: 'PCAP', label: 'PCAP Upload' },  // PCAP tab enabled
  ]

  return (
    <section className="inputs-section">
      <input
        ref={hiddenFileInput}
        type="file"
        style={{ display: 'none' }}
        onChange={handleFileChange}
        disabled={!apiAvailable || loading || uploading}
      />

      <div className="inputs-header">
        <div>
          <h2>Prediction Input</h2>
          <p>Submit network flow features for classification via manual entry, CSV batch upload, or PCAP file.</p>
        </div>
      </div>

      <div className="mode-tabs">
        {TABS.map(({ id, icon, label }) => (
          <button
            key={id}
            className={`mode-tab ${activeMode === id ? 'active' : ''}`}
            onClick={() => setActiveMode(id)}
          >
            <span>{icon}</span> {label}
          </button>
        ))}
      </div>

      <div className="mode-panel">
        {activeMode === 'manual' && (
          <form className="manual-form" onSubmit={handleManualSubmit}>
            <div className="field-grid">
              {featureNames.map((name) => (
                <label key={name} className="field-label">
                  <span className="field-name">{name}</span>
                  <input
                    type="number"
                    step="any"
                    className="field-input"
                    value={manualValues[name] ?? ''}
                    onChange={(e) => updateManualValue(name, e.target.value)}
                    required
                    placeholder="0"
                  />
                </label>
              ))}
            </div>
            <div className="form-actions">
              <button type="submit" className="btn-primary" disabled={loading || !apiAvailable}>
                {loading
                  ? <><span className="btn-spinner" /> Running…</>
                  : <>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <polygon points="5 3 19 12 5 21 5 3" />
                      </svg>
                      Run Prediction
                    </>}
              </button>
            </div>
            {!apiAvailable && <div className="api-warn">{apiMsg}</div>}
            {ManualResultUI}
          </form>
        )}

        {activeMode === 'csv' && (
          <div className="upload-panel">
            <UploadDropZone
              label="Drop CSV file here or click to browse"
              hint="Expects 25 feature columns matching the model's input schema"
            />
            {!apiAvailable && <div className="api-warn">{apiMsg}</div>}
            {CSVProgressUI}
            {UploadResultUI}
          </div>
        )}

        {activeMode === 'pcap' && (
          <div className="upload-panel">
            <UploadDropZone
              label="Drop PCAP capture here or click to browse"
              hint=".pcap / .pcapng — flows extracted via scapy (bidirectional)"
            />
            {!apiAvailable && <div className="api-warn">{apiMsg}</div>}
            {PCAPProgressUI}
            {UploadResultUI}
          </div>
        )}
      </div>
    </section>
  )
}

function ResultCell({ label, value, highlight, mono }) {
  return (
    <div className="result-cell">
      <span className="result-cell-label">{label}</span>
      <strong className={`result-cell-value ${highlight ? 'highlight' : ''} ${mono ? 'mono' : ''}`}>
        {value}
      </strong>
    </div>
  )
}