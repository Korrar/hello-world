import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { Upload, FileText, Globe, CheckCircle, AlertCircle, Loader } from 'lucide-react'
import toast from 'react-hot-toast'
import { importFile, importJson, importFromApi } from '../api/imports'
import type { BulkImportResult } from '../types'

function ImportResults({ result }: { result: BulkImportResult }) {
  return (
    <div className="import-results">
      <h4 style={{ marginBottom: '1rem' }}>Wyniki importu</h4>
      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        <div className="stat-card">
          <div className="stat-value">{result.total_rows}</div>
          <div className="stat-label">Wierszy</div>
        </div>
        <div className="stat-card" style={{ borderLeftColor: 'var(--success)', borderLeftWidth: 3, borderLeftStyle: 'solid' }}>
          <div className="stat-value" style={{ color: 'var(--success)' }}>{result.imported}</div>
          <div className="stat-label">Zaimportowano</div>
        </div>
        <div className="stat-card" style={{ borderLeftColor: 'var(--info)', borderLeftWidth: 3, borderLeftStyle: 'solid' }}>
          <div className="stat-value" style={{ color: 'var(--info)' }}>{result.updated}</div>
          <div className="stat-label">Zaktualizowano</div>
        </div>
        <div className="stat-card" style={{ borderLeftColor: 'var(--danger)', borderLeftWidth: 3, borderLeftStyle: 'solid' }}>
          <div className="stat-value" style={{ color: 'var(--danger)' }}>{result.errors.length}</div>
          <div className="stat-label">Błędów</div>
        </div>
      </div>
      {result.errors.length > 0 && (
        <div style={{ marginTop: '1rem' }}>
          <h5 style={{ marginBottom: '0.5rem' }}>Błędy:</h5>
          <div className="error-list">
            {result.errors.map((err, idx) => (
              <div key={idx} className="error-item">
                <strong>Wiersz {err.row}:</strong> {err.error}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default function ImportPage() {
  const [activeTab, setActiveTab] = useState<'file' | 'json' | 'api'>('file')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<BulkImportResult | null>(null)
  const [jsonText, setJsonText] = useState('')
  const [apiUrl, setApiUrl] = useState('')

  // File upload
  const onDrop = useCallback(async (files: File[]) => {
    if (files.length === 0) return
    const file = files[0]
    const ext = file.name.split('.').pop()?.toLowerCase()
    if (!['csv', 'json'].includes(ext || '')) {
      toast.error('Obsługiwane formaty: CSV, JSON')
      return
    }
    setLoading(true)
    setResult(null)
    try {
      const res = await importFile(file)
      setResult(res)
      toast.success(`Import zakończony: ${res.imported} nowych, ${res.updated} zaktualizowanych`)
    } catch {
      toast.error('Błąd importu pliku')
    } finally {
      setLoading(false)
    }
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'text/csv': ['.csv'], 'application/json': ['.json'] },
    maxFiles: 1,
    disabled: loading,
  })

  // JSON paste
  const handleJsonImport = async () => {
    if (!jsonText.trim()) {
      toast.error('Wklej dane JSON')
      return
    }
    setLoading(true)
    setResult(null)
    try {
      const data = JSON.parse(jsonText)
      const rows = Array.isArray(data) ? data : [data]
      const res = await importJson(rows)
      setResult(res)
      toast.success(`Import zakończony: ${res.imported} nowych, ${res.updated} zaktualizowanych`)
    } catch (e) {
      if (e instanceof SyntaxError) {
        toast.error('Nieprawidłowy format JSON')
      } else {
        toast.error('Błąd importu')
      }
    } finally {
      setLoading(false)
    }
  }

  // API fetch
  const handleApiImport = async () => {
    if (!apiUrl.trim()) {
      toast.error('Podaj URL API')
      return
    }
    setLoading(true)
    setResult(null)
    try {
      const res = await importFromApi(apiUrl)
      setResult(res)
      toast.success(`Import zakończony: ${res.imported} nowych, ${res.updated} zaktualizowanych`)
    } catch {
      toast.error('Błąd importu z API')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <div className="page-header">
        <h2>Import danych produktowych</h2>
      </div>

      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div className="card-body">
          <p style={{ color: 'var(--text-muted)', marginBottom: '1rem' }}>
            Importuj duże ilości danych produktowych z plików CSV/JSON, przez wklejenie JSON lub pobierając z zewnętrznego API (np. Intiaro PIM).
            Istniejące produkty (po SKU) zostaną zaktualizowane.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem', fontSize: '0.85rem' }}>
            <div>
              <strong>CSV:</strong> kolumny: sku, name, manufacturer, collection, description, base_price, currency, product_type, width, height, depth, weight, categories
            </div>
            <div>
              <strong>JSON:</strong> tablica obiektów z polami jak wyżej + configurations (zagnieżdżone)
            </div>
            <div>
              <strong>API:</strong> URL zwracający JSON z danymi produktów (obsługa formatu Intiaro PIM)
            </div>
          </div>
        </div>
      </div>

      <div className="tabs">
        <button className={`tab ${activeTab === 'file' ? 'active' : ''}`} onClick={() => { setActiveTab('file'); setResult(null) }}>
          <Upload size={14} style={{ marginRight: '0.5rem', verticalAlign: 'middle' }} />
          Plik CSV/JSON
        </button>
        <button className={`tab ${activeTab === 'json' ? 'active' : ''}`} onClick={() => { setActiveTab('json'); setResult(null) }}>
          <FileText size={14} style={{ marginRight: '0.5rem', verticalAlign: 'middle' }} />
          Wklej JSON
        </button>
        <button className={`tab ${activeTab === 'api' ? 'active' : ''}`} onClick={() => { setActiveTab('api'); setResult(null) }}>
          <Globe size={14} style={{ marginRight: '0.5rem', verticalAlign: 'middle' }} />
          Pobierz z API
        </button>
      </div>

      {activeTab === 'file' && (
        <div className="card">
          <div className="card-body">
            <div {...getRootProps()} className={`dropzone ${isDragActive ? 'dropzone-active' : ''}`}>
              <input {...getInputProps()} />
              <div className="dropzone-icon">
                {loading ? <Loader size={48} className="spin" /> : <Upload size={48} />}
              </div>
              {loading ? (
                <p>Importuję dane...</p>
              ) : isDragActive ? (
                <p>Upuść plik tutaj...</p>
              ) : (
                <>
                  <p><strong>Przeciągnij i upuść</strong> plik CSV lub JSON tutaj</p>
                  <p>lub kliknij, aby wybrać plik</p>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'json' && (
        <div className="card">
          <div className="card-body">
            <div className="form-group">
              <label className="form-label">Wklej dane JSON (tablica produktów lub pojedynczy obiekt)</label>
              <textarea
                className="form-textarea"
                style={{ minHeight: 250, fontFamily: 'monospace', fontSize: '0.85rem' }}
                placeholder={`[
  {
    "sku": "PROD-001",
    "name": "Sofa narożna",
    "manufacturer": "Bernhardt",
    "base_price": 2500,
    "product_type": "sofa",
    "configurations": [
      {
        "name": "fabric",
        "display_name": "Materiał",
        "config_type": "material",
        "options": [
          {"value": "leather", "display_name": "Skóra", "price_modifier": 500},
          {"value": "velvet", "display_name": "Welur", "price_modifier": 200}
        ]
      }
    ]
  }
]`}
                value={jsonText}
                onChange={e => setJsonText(e.target.value)}
              />
            </div>
            <button className="btn btn-primary" onClick={handleJsonImport} disabled={loading}>
              {loading ? 'Importuję...' : 'Importuj JSON'}
            </button>
          </div>
        </div>
      )}

      {activeTab === 'api' && (
        <div className="card">
          <div className="card-body">
            <div className="form-group">
              <label className="form-label">URL zewnętrznego API</label>
              <input
                className="form-input"
                placeholder="https://public-api.stage.intiaro.com/piminstanceapi/..."
                value={apiUrl}
                onChange={e => setApiUrl(e.target.value)}
              />
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
              System automatycznie zmapuje pola z formatu Intiaro PIM (id, name, manufacturer, configurations, itp.) do naszego formatu.
            </p>
            <button className="btn btn-primary" onClick={handleApiImport} disabled={loading}>
              {loading ? 'Importuję...' : 'Pobierz i importuj'}
            </button>
          </div>
        </div>
      )}

      {result && <ImportResults result={result} />}
    </div>
  )
}
