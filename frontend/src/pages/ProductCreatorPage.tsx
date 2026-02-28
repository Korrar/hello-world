import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Check, Download, Sliders } from 'lucide-react'
import toast from 'react-hot-toast'
import { getProduct, createProduct } from '../api/products'
import { importFromIntiaro } from '../api/imports'
import type { Product, ProductConfiguration, ConfigurationOption } from '../types'

const STEPS = [
  { label: 'Dane podstawowe', key: 'basic' },
  { label: 'Konfiguracje', key: 'configs' },
  { label: 'Opcje (Choices)', key: 'options' },
  { label: 'Podsumowanie', key: 'summary' },
] as const

type Step = 0 | 1 | 2 | 3

export default function ProductCreatorPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const isEdit = !!id

  const [step, setStep] = useState<Step>(0)
  const [loading, setLoading] = useState(false)
  const [product, setProduct] = useState<Partial<Product>>({
    name: '', sku: '', manufacturer: '', collection: '', description: '',
    base_price: 0, currency: 'USD', is_active: true, product_type: '',
    configurations: [], categories: [], images: [],
    variable_groups: [], choice_groups: [], predicates: [], events: [],
    sectional_elements: [], attribute_mappings: [], default_configurations: [],
  })
  const [intiaroUrl, setIntiaroUrl] = useState('')
  const [importing, setImporting] = useState(false)
  const [selectedConfigIdx, setSelectedConfigIdx] = useState<number | null>(null)

  useEffect(() => {
    if (isEdit) {
      setLoading(true)
      getProduct(Number(id))
        .then(p => { setProduct(p); setLoading(false) })
        .catch(() => { toast.error('Nie znaleziono produktu'); navigate('/products') })
    }
  }, [id])

  const set = (key: string, val: unknown) => setProduct(p => ({ ...p, [key]: val }))
  const configs = (product.configurations || []) as ProductConfiguration[]

  const handleImport = async () => {
    if (!intiaroUrl) return
    setImporting(true)
    try {
      const report = await importFromIntiaro(intiaroUrl)
      const imported = await getProduct(report.product_id)
      setProduct(imported)
      toast.success(`Zaimportowano: ${report.product_name}`)
      setStep(1)
    } catch {
      toast.error('Błąd importu z Intiaro')
    } finally {
      setImporting(false)
    }
  }

  const handleSave = async () => {
    if (!product.name || !product.sku) {
      toast.error('Nazwa i SKU są wymagane')
      return
    }
    try {
      if (isEdit) {
        toast.success('Produkt zaktualizowany')
      } else {
        const created = await createProduct(product)
        toast.success('Produkt utworzony')
        navigate(`/products/${created.id}`)
      }
    } catch {
      toast.error('Błąd zapisu produktu')
    }
  }

  const updateConfig = (idx: number, key: string, val: unknown) => {
    const updated = [...configs]
    updated[idx] = { ...updated[idx], [key]: val }
    set('configurations', updated)
  }

  const removeConfig = (idx: number) => {
    const updated = configs.filter((_, i) => i !== idx)
    set('configurations', updated)
    if (selectedConfigIdx === idx) setSelectedConfigIdx(null)
  }

  const updateOption = (cfgIdx: number, optIdx: number, key: string, val: unknown) => {
    const updated = [...configs]
    const opts = [...updated[cfgIdx].options]
    opts[optIdx] = { ...opts[optIdx], [key]: val }
    updated[cfgIdx] = { ...updated[cfgIdx], options: opts }
    set('configurations', updated)
  }

  const removeOption = (cfgIdx: number, optIdx: number) => {
    const updated = [...configs]
    updated[cfgIdx] = { ...updated[cfgIdx], options: updated[cfgIdx].options.filter((_, i) => i !== optIdx) }
    set('configurations', updated)
  }

  if (loading) return <div>Ładowanie...</div>

  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button className="btn btn-secondary btn-icon" onClick={() => navigate(-1)}>
            <ArrowLeft size={16} />
          </button>
          <h2>{isEdit ? 'Edytuj produkt' : 'Nowy produkt'}</h2>
        </div>
      </div>

      {/* Stepper */}
      <div className="wizard-stepper">
        {STEPS.map((s, i) => (
          <div
            key={s.key}
            className={`wizard-step ${i === step ? 'active' : ''} ${i < step ? 'completed' : ''}`}
            onClick={() => { if (i <= step || isEdit) setStep(i as Step) }}
          >
            <div className="wizard-step-circle">
              {i < step ? <Check size={14} /> : i + 1}
            </div>
            <span>{s.label}</span>
          </div>
        ))}
      </div>

      <div className="card" style={{ marginTop: '1.5rem' }}>
        <div className="card-body">
          {/* STEP 0: Basic data */}
          {step === 0 && (
            <div>
              <div className="card" style={{ marginBottom: '1.5rem', borderColor: 'var(--info)' }}>
                <div className="card-header" style={{ background: '#d1ecf1' }}>
                  <Download size={16} style={{ marginRight: '0.5rem' }} />
                  Import z Intiaro
                </div>
                <div className="card-body">
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <input
                      className="form-input"
                      placeholder="URL produktu Intiaro (np. https://app.intiaro.com/api/...)"
                      value={intiaroUrl}
                      onChange={e => setIntiaroUrl(e.target.value)}
                    />
                    <button className="btn btn-primary" onClick={handleImport} disabled={importing || !intiaroUrl}>
                      {importing ? 'Importuję...' : 'Importuj'}
                    </button>
                  </div>
                </div>
              </div>

              <h3 style={{ marginBottom: '1rem' }}>Lub wypełnij ręcznie</h3>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Nazwa *</label>
                  <input className="form-input" value={product.name || ''} onChange={e => set('name', e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">SKU *</label>
                  <input className="form-input" value={product.sku || ''} onChange={e => set('sku', e.target.value)} />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Producent</label>
                  <input className="form-input" value={product.manufacturer || ''} onChange={e => set('manufacturer', e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Kolekcja</label>
                  <input className="form-input" value={product.collection || ''} onChange={e => set('collection', e.target.value)} />
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Typ produktu</label>
                  <input className="form-input" value={product.product_type || ''} onChange={e => set('product_type', e.target.value)} />
                </div>
                <div className="form-group">
                  <label className="form-label">Cena bazowa</label>
                  <input className="form-input" type="number" step="0.01" value={product.base_price || 0} onChange={e => set('base_price', Number(e.target.value))} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Opis</label>
                <textarea className="form-textarea" value={product.description || ''} onChange={e => set('description', e.target.value)} />
              </div>
            </div>
          )}

          {/* STEP 1: Configurations */}
          {step === 1 && (
            <div>
              <h3 style={{ marginBottom: '1rem' }}>Konfiguracje ({configs.length})</h3>
              {configs.length === 0 && (
                <p style={{ color: 'var(--text-muted)' }}>Brak konfiguracji. Zaimportuj produkt z Intiaro lub dodaj ręcznie.</p>
              )}
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Nazwa</th>
                      <th>Slug</th>
                      <th>Typ</th>
                      <th>Grupa</th>
                      <th>Variable Group</th>
                      <th>Predykat</th>
                      <th>Default</th>
                      <th>Opcje</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {configs.map((cfg, idx) => (
                      <tr key={idx}>
                        <td>
                          <input
                            className="form-input"
                            value={cfg.display_name || cfg.name}
                            onChange={e => updateConfig(idx, 'display_name', e.target.value)}
                            style={{ minWidth: 120 }}
                          />
                        </td>
                        <td><code>{cfg.slug || cfg.name}</code></td>
                        <td>
                          <span className="badge badge-secondary">{cfg.attribute_type || cfg.config_type}</span>
                        </td>
                        <td>{cfg.group || '—'}</td>
                        <td>{cfg.variable_group || '—'}</td>
                        <td>{cfg.predicate ? <code>{cfg.predicate}</code> : '—'}</td>
                        <td>{cfg.default_choice ? <code>{cfg.default_choice}</code> : '—'}</td>
                        <td>
                          <span className="badge badge-info">{cfg.options.length}</span>
                        </td>
                        <td>
                          <button className="btn btn-danger btn-sm btn-icon" onClick={() => removeConfig(idx)} title="Usuń">
                            &times;
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* STEP 2: Options/Choices */}
          {step === 2 && (
            <div>
              <h3 style={{ marginBottom: '1rem' }}>Opcje (Choices)</h3>
              <div style={{ marginBottom: '1rem' }}>
                <label className="form-label">Filtruj po konfiguracji</label>
                <select
                  className="form-select"
                  value={selectedConfigIdx ?? ''}
                  onChange={e => setSelectedConfigIdx(e.target.value === '' ? null : Number(e.target.value))}
                >
                  <option value="">Wszystkie konfiguracje</option>
                  {configs.map((cfg, idx) => (
                    <option key={idx} value={idx}>{cfg.display_name || cfg.name} ({cfg.options.length} opcji)</option>
                  ))}
                </select>
              </div>

              {configs
                .map((cfg, cfgIdx) => ({ cfg, cfgIdx }))
                .filter(({ cfgIdx }) => selectedConfigIdx === null || selectedConfigIdx === cfgIdx)
                .map(({ cfg, cfgIdx }) => (
                  <div key={cfgIdx} className="config-item" style={{ marginBottom: '1rem' }}>
                    <div className="config-item-header">
                      <strong>{cfg.display_name || cfg.name}</strong>
                      <span className="badge badge-info">{cfg.options.length} opcji</span>
                    </div>
                    <div className="table-container">
                      <table style={{ fontSize: '0.85rem' }}>
                        <thead>
                          <tr>
                            <th>Slug</th>
                            <th>Wartość</th>
                            <th>Grade</th>
                            <th>Choice Group</th>
                            <th>Tags</th>
                            <th>Ikona</th>
                            <th></th>
                          </tr>
                        </thead>
                        <tbody>
                          {cfg.options.map((opt, optIdx) => (
                            <tr key={optIdx}>
                              <td><code>{opt.slug || opt.value}</code></td>
                              <td>
                                <input
                                  className="form-input"
                                  value={opt.display_name || opt.value}
                                  onChange={e => updateOption(cfgIdx, optIdx, 'display_name', e.target.value)}
                                  style={{ minWidth: 100 }}
                                />
                              </td>
                              <td>{opt.grade || '—'}</td>
                              <td>{opt.choice_group || '—'}</td>
                              <td>{opt.tags?.join(', ') || '—'}</td>
                              <td>
                                {opt.icon ? (
                                  <img src={opt.icon} alt="" style={{ width: 24, height: 24, borderRadius: 4 }} />
                                ) : '—'}
                              </td>
                              <td>
                                <button className="btn btn-danger btn-sm btn-icon" onClick={() => removeOption(cfgIdx, optIdx)}>
                                  &times;
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
            </div>
          )}

          {/* STEP 3: Summary */}
          {step === 3 && (
            <div>
              <h3 style={{ marginBottom: '1rem' }}>Podsumowanie</h3>

              <div className="form-row" style={{ marginBottom: '1.5rem' }}>
                <div>
                  <div className="detail-row"><span className="label">Nazwa</span><span>{product.name}</span></div>
                  <div className="detail-row"><span className="label">SKU</span><span><code>{product.sku}</code></span></div>
                  <div className="detail-row"><span className="label">Producent</span><span>{product.manufacturer || '—'}</span></div>
                  <div className="detail-row"><span className="label">Kolekcja</span><span>{product.collection || '—'}</span></div>
                  <div className="detail-row"><span className="label">Konfiguracje</span><span>{configs.length}</span></div>
                  <div className="detail-row"><span className="label">Opcje łącznie</span><span>{configs.reduce((s, c) => s + c.options.length, 0)}</span></div>
                  <div className="detail-row"><span className="label">Sectional</span><span>{product.sectional_builder ? 'Tak' : 'Nie'}</span></div>
                </div>
                <div>
                  <div className="detail-row"><span className="label">Intiaro ID</span><span>{product.intiaro_id || '—'}</span></div>
                  <div className="detail-row"><span className="label">Variable Groups</span><span>{product.variable_groups?.length || 0}</span></div>
                  <div className="detail-row"><span className="label">Choice Groups</span><span>{product.choice_groups?.length || 0}</span></div>
                  <div className="detail-row"><span className="label">Predicates</span><span>{product.predicates?.length || 0}</span></div>
                  <div className="detail-row"><span className="label">Events</span><span>{product.events?.length || 0}</span></div>
                  <div className="detail-row"><span className="label">Sectional Elements</span><span>{product.sectional_elements?.length || 0}</span></div>
                  <div className="detail-row"><span className="label">Attribute Mappings</span><span>{product.attribute_mappings?.length || 0}</span></div>
                </div>
              </div>

              {/* Intiaro data sections */}
              {product.features && (
                <SummarySection title="Features">
                  <pre style={{ fontSize: '0.8rem' }}>{JSON.stringify(product.features, null, 2)}</pre>
                </SummarySection>
              )}
              {product.render_settings && (
                <SummarySection title="Render Settings">
                  <pre style={{ fontSize: '0.8rem' }}>{JSON.stringify(product.render_settings, null, 2)}</pre>
                </SummarySection>
              )}
              {(product.variable_groups?.length ?? 0) > 0 && (
                <SummarySection title="Variable Groups">
                  <pre style={{ fontSize: '0.8rem' }}>{JSON.stringify(product.variable_groups, null, 2)}</pre>
                </SummarySection>
              )}
              {(product.predicates?.length ?? 0) > 0 && (
                <SummarySection title="Predicates">
                  <pre style={{ fontSize: '0.8rem' }}>{JSON.stringify(product.predicates, null, 2)}</pre>
                </SummarySection>
              )}
              {(product.events?.length ?? 0) > 0 && (
                <SummarySection title="Events">
                  <pre style={{ fontSize: '0.8rem' }}>{JSON.stringify(product.events, null, 2)}</pre>
                </SummarySection>
              )}
              {(product.sectional_elements?.length ?? 0) > 0 && (
                <SummarySection title="Sectional Elements">
                  <pre style={{ fontSize: '0.8rem' }}>{JSON.stringify(product.sectional_elements, null, 2)}</pre>
                </SummarySection>
              )}
              {product.menu_settings && (
                <SummarySection title="Menu Settings">
                  <pre style={{ fontSize: '0.8rem' }}>{JSON.stringify(product.menu_settings, null, 2)}</pre>
                </SummarySection>
              )}
              {(product.attribute_mappings?.length ?? 0) > 0 && (
                <SummarySection title="Attribute Mappings">
                  <pre style={{ fontSize: '0.8rem' }}>{JSON.stringify(product.attribute_mappings, null, 2)}</pre>
                </SummarySection>
              )}
              {(product.default_configurations?.length ?? 0) > 0 && (
                <SummarySection title="Default Configurations">
                  <pre style={{ fontSize: '0.8rem' }}>{JSON.stringify(product.default_configurations, null, 2)}</pre>
                </SummarySection>
              )}

              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1.5rem' }}>
                {!isEdit && (
                  <button className="btn btn-primary" onClick={handleSave}>
                    <Check size={14} /> Utwórz produkt
                  </button>
                )}
                {product.id && (
                  <button className="btn btn-secondary" onClick={() => navigate(`/configurator?product=${product.id}`)}>
                    <Sliders size={14} /> Otwórz konfigurator
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Navigation buttons */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1rem' }}>
        <button className="btn btn-secondary" onClick={() => setStep(s => Math.max(0, s - 1) as Step)} disabled={step === 0}>
          <ArrowLeft size={14} /> Wstecz
        </button>
        {step < 3 && (
          <button className="btn btn-primary" onClick={() => setStep(s => Math.min(3, s + 1) as Step)}>
            Dalej <ArrowRight size={14} />
          </button>
        )}
      </div>
    </div>
  )
}

function SummarySection({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="collapsible-section">
      <div
        className="collapsible-section-header"
        onClick={() => setOpen(!open)}
        style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 0', borderBottom: '1px solid var(--border)' }}
      >
        <strong>{title}</strong>
        <span>{open ? '▲' : '▼'}</span>
      </div>
      {open && (
        <div style={{ padding: '0.75rem 0', overflow: 'auto', maxHeight: 300 }}>
          {children}
        </div>
      )}
    </div>
  )
}
