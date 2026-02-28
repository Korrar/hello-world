import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { Upload, FileText, Globe, Database, CheckCircle, Loader } from 'lucide-react'
import toast from 'react-hot-toast'
import { importFile, importJson, importFromApi, importFromIntiaro } from '../api/imports'
import type { BulkImportResult } from '../types'
import type { IntiaroImportReport } from '../types/intiaro'

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

function IntiaroImportResults({ report }: { report: IntiaroImportReport }) {
  return (
    <div className="import-results">
      <h4 style={{ marginBottom: '1rem' }}>
        <CheckCircle size={18} style={{ verticalAlign: 'middle', marginRight: '0.5rem', color: 'var(--success)' }} />
        Import Intiaro zakończony
      </h4>

      <div style={{ marginBottom: '1rem', padding: '0.75rem', background: 'var(--bg-secondary, #f8f9fa)', borderRadius: '6px' }}>
        <strong>{report.product_name}</strong>
        <span style={{ marginLeft: '1rem', color: 'var(--text-muted)' }}>SKU: {report.sku}</span>
        <span style={{ marginLeft: '1rem', color: 'var(--text-muted)' }}>ID: {report.product_id}</span>
      </div>

      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: '1rem' }}>
        <div className="stat-card">
          <div className="stat-value">{report.configurations_count}</div>
          <div className="stat-label">Konfiguracje</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{report.options_count}</div>
          <div className="stat-label">Opcje</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{report.variable_groups_count}</div>
          <div className="stat-label">Grupy zmiennych</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{report.choice_groups_count}</div>
          <div className="stat-label">Grupy opcji</div>
        </div>
      </div>

      <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginBottom: '1rem' }}>
        <div className="stat-card">
          <div className="stat-value">{report.predicates_count}</div>
          <div className="stat-label">Predykaty</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{report.events_count}</div>
          <div className="stat-label">Zdarzenia</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{report.sectional_elements_count}</div>
          <div className="stat-label">Elementy sekcji</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{report.attribute_mappings_count}</div>
          <div className="stat-label">Mapowania</div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', fontSize: '0.85rem' }}>
        <span style={{ padding: '0.25rem 0.5rem', borderRadius: '4px', background: report.has_render_settings ? 'var(--success)' : 'var(--text-muted)', color: '#fff' }}>
          Render Settings: {report.has_render_settings ? 'TAK' : 'NIE'}
        </span>
        <span style={{ padding: '0.25rem 0.5rem', borderRadius: '4px', background: report.has_product_features ? 'var(--success)' : 'var(--text-muted)', color: '#fff' }}>
          Product Features: {report.has_product_features ? 'TAK' : 'NIE'}
        </span>
        <span style={{ padding: '0.25rem 0.5rem', borderRadius: '4px', background: report.has_menu_settings ? 'var(--success)' : 'var(--text-muted)', color: '#fff' }}>
          Menu Settings: {report.has_menu_settings ? 'TAK' : 'NIE'}
        </span>
        <span style={{ padding: '0.25rem 0.5rem', borderRadius: '4px', background: report.default_configurations_count > 0 ? 'var(--success)' : 'var(--text-muted)', color: '#fff' }}>
          Default Config: {report.default_configurations_count}
        </span>
      </div>

      {report.errors.length > 0 && (
        <div style={{ marginTop: '1rem' }}>
          <h5 style={{ marginBottom: '0.5rem', color: 'var(--danger)' }}>Błędy:</h5>
          <div className="error-list">
            {report.errors.map((err, idx) => (
              <div key={idx} className="error-item">{err}</div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default function ImportPage() {
  const [activeTab, setActiveTab] = useState<'file' | 'json' | 'api' | 'intiaro'>('file')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<BulkImportResult | null>(null)
  const [intiaroReport, setIntiaroReport] = useState<IntiaroImportReport | null>(null)
  const [jsonText, setJsonText] = useState('')
  const [apiUrl, setApiUrl] = useState('')
  const [intiaroUrl, setIntiaroUrl] = useState('')

  const clearResults = () => {
    setResult(null)
    setIntiaroReport(null)
  }

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
    clearResults()
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
    clearResults()
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
    clearResults()
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

  // Intiaro dedicated import
  const handleIntiaroImport = async () => {
    if (!intiaroUrl.trim()) {
      toast.error('Podaj URL Intiaro PIM API')
      return
    }
    setLoading(true)
    clearResults()
    try {
      const report = await importFromIntiaro(intiaroUrl)
      setIntiaroReport(report)
      toast.success(`Import Intiaro zakończony: ${report.configurations_count} konfiguracji, ${report.options_count} opcji`)
    } catch (e: unknown) {
      const axiosErr = e as { response?: { data?: { detail?: IntiaroImportReport | string } } }
      if (axiosErr?.response?.data?.detail && typeof axiosErr.response.data.detail === 'object') {
        setIntiaroReport(axiosErr.response.data.detail as IntiaroImportReport)
        toast.error('Import zakończony z błędami')
      } else {
        toast.error('Błąd importu z Intiaro API')
      }
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
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '0.5rem', fontSize: '0.85rem' }}>
            <div>
              <strong>CSV:</strong> kolumny: sku, name, manufacturer, collection, description, base_price, currency, product_type, width, height, depth, weight, categories
            </div>
            <div>
              <strong>JSON:</strong> tablica obiektów z polami jak wyżej + configurations (zagnieżdżone)
            </div>
            <div>
              <strong>API:</strong> URL zwracający JSON z danymi produktów (ogólny format)
            </div>
            <div>
              <strong>Intiaro:</strong> Dedykowany import z pełnym mapowaniem modeli Intiaro PIM
            </div>
          </div>
        </div>
      </div>

      <div className="tabs">
        <button className={`tab ${activeTab === 'file' ? 'active' : ''}`} onClick={() => { setActiveTab('file'); clearResults() }}>
          <Upload size={14} style={{ marginRight: '0.5rem', verticalAlign: 'middle' }} />
          Plik CSV/JSON
        </button>
        <button className={`tab ${activeTab === 'json' ? 'active' : ''}`} onClick={() => { setActiveTab('json'); clearResults() }}>
          <FileText size={14} style={{ marginRight: '0.5rem', verticalAlign: 'middle' }} />
          Wklej JSON
        </button>
        <button className={`tab ${activeTab === 'api' ? 'active' : ''}`} onClick={() => { setActiveTab('api'); clearResults() }}>
          <Globe size={14} style={{ marginRight: '0.5rem', verticalAlign: 'middle' }} />
          Pobierz z API
        </button>
        <button className={`tab ${activeTab === 'intiaro' ? 'active' : ''}`} onClick={() => { setActiveTab('intiaro'); clearResults() }}>
          <Database size={14} style={{ marginRight: '0.5rem', verticalAlign: 'middle' }} />
          Import Intiaro
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
                placeholder="https://api.example.com/products"
                value={apiUrl}
                onChange={e => setApiUrl(e.target.value)}
              />
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
              Ogólny import z zewnętrznego API. Mapowanie podstawowych pól (id, name, manufacturer, itp.).
            </p>
            <button className="btn btn-primary" onClick={handleApiImport} disabled={loading}>
              {loading ? 'Importuję...' : 'Pobierz i importuj'}
            </button>
          </div>
        </div>
      )}

      {activeTab === 'intiaro' && (
        <div className="card">
          <div className="card-body">
            <div className="form-group">
              <label className="form-label">URL Intiaro PIM API (product_instance)</label>
              <input
                className="form-input"
                placeholder="https://public-api.intiaro.com/piminstanceapi/product_instance/5084"
                value={intiaroUrl}
                onChange={e => setIntiaroUrl(e.target.value)}
              />
            </div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
              <p style={{ marginBottom: '0.5rem' }}>
                Dedykowany import z Intiaro PIM API z pełnym mapowaniem do dedykowanych modeli:
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.25rem 1rem' }}>
                <span>- Konfiguracje (attributes)</span>
                <span>- Opcje (choices)</span>
                <span>- Render Settings</span>
                <span>- Product Features</span>
                <span>- Variable Groups</span>
                <span>- Choice Groups</span>
                <span>- Predicates</span>
                <span>- Events</span>
                <span>- Sectional Elements</span>
                <span>- Menu Settings</span>
                <span>- Attribute Mappings</span>
                <span>- Default Configurations</span>
              </div>
            </div>
            <button className="btn btn-primary" onClick={handleIntiaroImport} disabled={loading}>
              {loading ? (
                <>
                  <Loader size={14} className="spin" style={{ marginRight: '0.5rem', verticalAlign: 'middle' }} />
                  Importuję z Intiaro...
                </>
              ) : 'Importuj z Intiaro'}
            </button>
          </div>
        </div>
      )}

      {result && <ImportResults result={result} />}
      {intiaroReport && <IntiaroImportResults report={intiaroReport} />}
    </div>
  )
}
