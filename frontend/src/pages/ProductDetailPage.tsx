import { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, Plus, Trash2, Save, Sliders, ChevronDown, ChevronRight } from 'lucide-react'
import toast from 'react-hot-toast'
import { getProduct, updateProduct, deleteProduct, addConfiguration, deleteConfiguration, addElement, deleteElement } from '../api/products'
import type { Product, ProductConfiguration, ConfigurationOption, SectionalElement } from '../types'

function ConfigurationEditor({
  productId,
  configurations,
  onUpdate,
}: {
  productId: number
  configurations: ProductConfiguration[]
  onUpdate: () => void
}) {
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({
    name: '',
    display_name: '',
    config_type: 'select',
    is_required: false,
    options: [{ value: '', display_name: '', price_modifier: 0, price_modifier_type: 'absolute', is_default: false, sort_order: 0 }] as Partial<ConfigurationOption>[],
  })

  const addOption = () => {
    setForm(f => ({
      ...f,
      options: [...f.options, { value: '', display_name: '', price_modifier: 0, price_modifier_type: 'absolute', is_default: false, sort_order: f.options.length }],
    }))
  }

  const removeOption = (idx: number) => {
    setForm(f => ({ ...f, options: f.options.filter((_, i) => i !== idx) }))
  }

  const setOption = (idx: number, key: string, val: unknown) => {
    setForm(f => ({
      ...f,
      options: f.options.map((o, i) => i === idx ? { ...o, [key]: val } : o),
    }))
  }

  const handleSave = async () => {
    if (!form.name || form.options.some(o => !o.value)) {
      toast.error('Uzupełnij nazwę konfiguracji i wartości opcji')
      return
    }
    try {
      await addConfiguration(productId, form)
      toast.success('Konfiguracja dodana')
      setAdding(false)
      setForm({
        name: '', display_name: '', config_type: 'select', is_required: false,
        options: [{ value: '', display_name: '', price_modifier: 0, price_modifier_type: 'absolute', is_default: false, sort_order: 0 }],
      })
      onUpdate()
    } catch {
      toast.error('Błąd zapisu konfiguracji')
    }
  }

  const handleDelete = async (configId: number) => {
    if (!confirm('Usunąć tę konfigurację?')) return
    try {
      await deleteConfiguration(productId, configId)
      toast.success('Konfiguracja usunięta')
      onUpdate()
    } catch {
      toast.error('Błąd usuwania')
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h4 style={{ margin: 0 }}>Konfiguracje ({configurations.length})</h4>
        {!adding && (
          <button className="btn btn-primary btn-sm" onClick={() => setAdding(true)}>
            <Plus size={14} /> Dodaj konfigurację
          </button>
        )}
      </div>

      {configurations.map(cfg => (
        <div key={cfg.id} className="config-item">
          <div className="config-item-header">
            <div>
              <strong>{cfg.display_name || cfg.name}</strong>
              <span className="badge badge-secondary" style={{ marginLeft: '0.5rem' }}>{cfg.config_type}</span>
              {cfg.is_required && <span className="badge badge-warning" style={{ marginLeft: '0.25rem' }}>Wymagane</span>}
            </div>
            <button className="btn btn-danger btn-sm btn-icon" onClick={() => handleDelete(cfg.id!)}>
              <Trash2 size={14} />
            </button>
          </div>
          <table style={{ fontSize: '0.85rem' }}>
            <thead>
              <tr>
                <th>Wartość</th>
                <th>Nazwa wyświetlana</th>
                <th>Modyfikator ceny</th>
                <th>Domyślna</th>
              </tr>
            </thead>
            <tbody>
              {cfg.options.map(opt => (
                <tr key={opt.id}>
                  <td><code>{opt.value}</code></td>
                  <td>{opt.display_name || '—'}</td>
                  <td>
                    {opt.price_modifier !== 0 && (
                      <span style={{ color: opt.price_modifier > 0 ? 'var(--danger)' : 'var(--success)' }}>
                        {opt.price_modifier > 0 ? '+' : ''}{opt.price_modifier}
                        {opt.price_modifier_type === 'percentage' ? '%' : ' USD'}
                      </span>
                    )}
                    {opt.price_modifier === 0 && '—'}
                  </td>
                  <td>{opt.is_default ? 'Tak' : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}

      {adding && (
        <div className="config-item" style={{ borderColor: 'var(--primary)' }}>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Nazwa (klucz)</label>
              <input className="form-input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="np. color, fabric" />
            </div>
            <div className="form-group">
              <label className="form-label">Nazwa wyświetlana</label>
              <input className="form-input" value={form.display_name} onChange={e => setForm(f => ({ ...f, display_name: e.target.value }))} placeholder="np. Kolor, Materiał" />
            </div>
            <div className="form-group">
              <label className="form-label">Typ</label>
              <select className="form-select" value={form.config_type} onChange={e => setForm(f => ({ ...f, config_type: e.target.value }))}>
                <option value="select">Select</option>
                <option value="color">Kolor</option>
                <option value="material">Materiał</option>
                <option value="size">Rozmiar</option>
                <option value="text">Tekst</option>
              </select>
            </div>
          </div>

          <label className="checkbox-label" style={{ marginBottom: '1rem' }}>
            <input type="checkbox" checked={form.is_required} onChange={e => setForm(f => ({ ...f, is_required: e.target.checked }))} />
            Wymagane
          </label>

          <div style={{ marginBottom: '0.5rem', fontWeight: 600, fontSize: '0.85rem' }}>Opcje</div>
          {form.options.map((opt, idx) => (
            <div key={idx} className="option-row">
              <input className="form-input" placeholder="Wartość" value={opt.value} onChange={e => setOption(idx, 'value', e.target.value)} />
              <input className="form-input" placeholder="Nazwa wyświetlana" value={opt.display_name} onChange={e => setOption(idx, 'display_name', e.target.value)} />
              <input className="form-input" type="number" step="0.01" placeholder="Cena +/-" value={opt.price_modifier} onChange={e => setOption(idx, 'price_modifier', Number(e.target.value))} />
              <button className="btn btn-danger btn-sm btn-icon" onClick={() => removeOption(idx)} disabled={form.options.length <= 1}>
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          <button className="btn btn-secondary btn-sm" onClick={addOption} style={{ marginTop: '0.5rem' }}>
            <Plus size={14} /> Dodaj opcję
          </button>

          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', justifyContent: 'flex-end' }}>
            <button className="btn btn-secondary" onClick={() => setAdding(false)}>Anuluj</button>
            <button className="btn btn-primary" onClick={handleSave}>
              <Save size={14} /> Zapisz konfigurację
            </button>
          </div>
        </div>
      )}

      {configurations.length === 0 && !adding && (
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
          Brak konfiguracji. Dodaj pierwszą konfigurację produktu.
        </p>
      )}
    </div>
  )
}

function ElementEditor({
  productId,
  elements,
  onUpdate,
}: {
  productId: number
  elements: SectionalElement[]
  onUpdate: () => void
}) {
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ element_id: 0, name: '', file_id: '' })

  const handleAdd = async () => {
    if (!form.name) {
      toast.error('Nazwa elementu jest wymagana')
      return
    }
    try {
      const nextId = elements.length > 0
        ? Math.max(...elements.map(e => e.element_id ?? 0)) + 1
        : 1
      await addElement(productId, {
        element_id: form.element_id || nextId,
        name: form.name,
        file_id: form.file_id || undefined,
      })
      toast.success('Element dodany')
      setAdding(false)
      setForm({ element_id: 0, name: '', file_id: '' })
      onUpdate()
    } catch {
      toast.error('Błąd dodawania elementu')
    }
  }

  const handleDelete = async (el: SectionalElement) => {
    if (!confirm(`Usunąć element "${el.name || `#${el.element_id}`}"?`)) return
    try {
      await deleteElement(productId, el.id)
      toast.success('Element usunięty')
      onUpdate()
    } catch {
      toast.error('Błąd usuwania elementu')
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h4 style={{ margin: 0 }}>Elementy ({elements.length})</h4>
        {!adding && (
          <button className="btn btn-primary btn-sm" onClick={() => setAdding(true)}>
            <Plus size={14} /> Dodaj element
          </button>
        )}
      </div>

      {elements.length > 0 && (
        <table style={{ fontSize: '0.85rem', marginBottom: '1rem' }}>
          <thead>
            <tr>
              <th>Element ID</th>
              <th>Nazwa</th>
              <th>File ID</th>
              <th>Default Variables</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {elements.map(el => (
              <tr key={el.id}>
                <td><code>{el.element_id}</code></td>
                <td>{el.name || '—'}</td>
                <td>{el.file_id ? <code>{el.file_id}</code> : '—'}</td>
                <td>
                  {el.default_variables && Object.keys(el.default_variables).length > 0
                    ? <span className="badge badge-info">{Object.keys(el.default_variables).length} zmiennych</span>
                    : '—'}
                </td>
                <td>
                  <button className="btn btn-danger btn-sm btn-icon" onClick={() => handleDelete(el)}>
                    <Trash2 size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {adding && (
        <div className="config-item" style={{ borderColor: 'var(--primary)' }}>
          <div className="form-row">
            <div className="form-group">
              <label className="form-label">Nazwa *</label>
              <input className="form-input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="np. Fotel lewy" />
            </div>
            <div className="form-group">
              <label className="form-label">Element ID</label>
              <input className="form-input" type="number" value={form.element_id || ''} onChange={e => setForm(f => ({ ...f, element_id: Number(e.target.value) }))} placeholder="Auto" />
            </div>
            <div className="form-group">
              <label className="form-label">File ID</label>
              <input className="form-input" value={form.file_id} onChange={e => setForm(f => ({ ...f, file_id: e.target.value }))} placeholder="Opcjonalnie" />
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem', justifyContent: 'flex-end' }}>
            <button className="btn btn-secondary" onClick={() => setAdding(false)}>Anuluj</button>
            <button className="btn btn-primary" onClick={handleAdd}>
              <Save size={14} /> Dodaj element
            </button>
          </div>
        </div>
      )}

      {elements.length === 0 && !adding && (
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
          Brak elementów. Dodaj elementy, aby aktywować konfigurator wieloelementowy.
        </p>
      )}
    </div>
  )
}

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [product, setProduct] = useState<Product | null>(null)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState<Record<string, unknown>>({})

  const load = async () => {
    try {
      const p = await getProduct(Number(id))
      setProduct(p)
      setForm({
        name: p.name, sku: p.sku, manufacturer: p.manufacturer, collection: p.collection,
        description: p.description, base_price: p.base_price, currency: p.currency,
        product_type: p.product_type, is_active: p.is_active,
        width: p.width, height: p.height, depth: p.depth, weight: p.weight,
      })
    } catch {
      toast.error('Nie znaleziono produktu')
      navigate('/products')
    }
  }

  useEffect(() => { load() }, [id])

  const handleSave = async () => {
    try {
      await updateProduct(Number(id), form as never)
      toast.success('Produkt zaktualizowany')
      setEditing(false)
      load()
    } catch {
      toast.error('Błąd zapisu')
    }
  }

  const handleDelete = async () => {
    if (!confirm('Czy na pewno chcesz usunąć ten produkt? Tej operacji nie można cofnąć.')) return
    try {
      await deleteProduct(Number(id))
      toast.success('Produkt usunięty')
      navigate('/products')
    } catch {
      toast.error('Błąd usuwania produktu')
    }
  }

  if (!product) return <div>Ładowanie...</div>

  const set = (key: string, val: unknown) => setForm(f => ({ ...f, [key]: val }))

  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <Link to="/products" className="btn btn-secondary btn-icon"><ArrowLeft size={16} /></Link>
          <div>
            <h2>{product.name}</h2>
            <small style={{ color: 'var(--text-muted)' }}>SKU: {product.sku}</small>
          </div>
        </div>
        <div className="btn-group">
          <Link to={`/configurator?product=${product.id}`} className="btn btn-secondary">
            <Sliders size={14} /> Konfigurator
          </Link>
          {!editing ? (
            <>
              <button className="btn btn-primary" onClick={() => setEditing(true)}>Edytuj</button>
              <button className="btn btn-danger" onClick={handleDelete}><Trash2 size={14} /> Usuń</button>
            </>
          ) : (
            <>
              <button className="btn btn-secondary" onClick={() => setEditing(false)}>Anuluj</button>
              <button className="btn btn-primary" onClick={handleSave}><Save size={14} /> Zapisz</button>
            </>
          )}
        </div>
      </div>

      <div className="product-detail-grid">
        <div>
          <div className="card">
            <div className="card-header">Informacje podstawowe</div>
            <div className="card-body">
              {editing ? (
                <>
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Nazwa</label>
                      <input className="form-input" value={form.name as string} onChange={e => set('name', e.target.value)} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">SKU</label>
                      <input className="form-input" value={form.sku as string} onChange={e => set('sku', e.target.value)} />
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Producent</label>
                      <input className="form-input" value={(form.manufacturer as string) || ''} onChange={e => set('manufacturer', e.target.value)} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Kolekcja</label>
                      <input className="form-input" value={(form.collection as string) || ''} onChange={e => set('collection', e.target.value)} />
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Typ</label>
                      <input className="form-input" value={(form.product_type as string) || ''} onChange={e => set('product_type', e.target.value)} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Cena bazowa</label>
                      <input className="form-input" type="number" step="0.01" value={form.base_price as number} onChange={e => set('base_price', Number(e.target.value))} />
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Opis</label>
                    <textarea className="form-textarea" value={(form.description as string) || ''} onChange={e => set('description', e.target.value)} />
                  </div>
                  <label className="checkbox-label">
                    <input type="checkbox" checked={form.is_active as boolean} onChange={e => set('is_active', e.target.checked)} />
                    Aktywny
                  </label>
                </>
              ) : (
                <div className="detail-section">
                  <div className="detail-row"><span className="label">Nazwa</span><span>{product.name}</span></div>
                  <div className="detail-row"><span className="label">SKU</span><span><code>{product.sku}</code></span></div>
                  <div className="detail-row"><span className="label">Producent</span><span>{product.manufacturer || '—'}</span></div>
                  <div className="detail-row"><span className="label">Kolekcja</span><span>{product.collection || '—'}</span></div>
                  <div className="detail-row"><span className="label">Typ</span><span>{product.product_type || '—'}</span></div>
                  <div className="detail-row"><span className="label">Cena bazowa</span><span style={{ fontWeight: 600 }}>{product.base_price.toLocaleString()} {product.currency}</span></div>
                  <div className="detail-row"><span className="label">Status</span><span className={`badge ${product.is_active ? 'badge-success' : 'badge-danger'}`}>{product.is_active ? 'Aktywny' : 'Nieaktywny'}</span></div>
                  {product.description && <div style={{ marginTop: '1rem', fontSize: '0.9rem', color: 'var(--text-muted)' }}>{product.description}</div>}
                </div>
              )}
            </div>
          </div>

          {(product.width || product.height || product.depth || product.weight) && (
            <div className="card" style={{ marginTop: '1rem' }}>
              <div className="card-header">Wymiary</div>
              <div className="card-body">
                <div className="detail-row"><span className="label">Szerokość</span><span>{product.width ?? '—'} {product.dimension_unit}</span></div>
                <div className="detail-row"><span className="label">Wysokość</span><span>{product.height ?? '—'} {product.dimension_unit}</span></div>
                <div className="detail-row"><span className="label">Głębokość</span><span>{product.depth ?? '—'} {product.dimension_unit}</span></div>
                <div className="detail-row"><span className="label">Waga</span><span>{product.weight ?? '—'} {product.weight_unit}</span></div>
              </div>
            </div>
          )}
        </div>

        <div>
          <div className="card">
            <div className="card-body">
              <ConfigurationEditor
                productId={product.id}
                configurations={product.configurations}
                onUpdate={load}
              />
            </div>
          </div>

          <div className="card" style={{ marginTop: '1rem' }}>
            <div className="card-body">
              <ElementEditor
                productId={product.id}
                elements={product.sectional_elements || []}
                onUpdate={load}
              />
            </div>
          </div>

          {product.extra_data && Object.keys(product.extra_data).length > 0 && (
            <div className="card" style={{ marginTop: '1rem' }}>
              <div className="card-header">Dodatkowe dane</div>
              <div className="card-body">
                <pre style={{ fontSize: '0.8rem', overflow: 'auto', maxHeight: 300 }}>
                  {JSON.stringify(product.extra_data, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Intiaro data sections */}
      {product.intiaro_id && (
        <div style={{ marginTop: '2rem' }}>
          <h3 style={{ marginBottom: '1rem' }}>Dane Intiaro</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <IntiaroSection title="Features" data={product.features} />
            <IntiaroSection title="Render Settings" data={product.render_settings} />
            <IntiaroSection title={`Variable Groups (${product.variable_groups?.length || 0})`} data={product.variable_groups} />
            <IntiaroSection title={`Choice Groups (${product.choice_groups?.length || 0})`} data={product.choice_groups} />
            <IntiaroSection title={`Predicates (${product.predicates?.length || 0})`} data={product.predicates} />
            <IntiaroSection title={`Events (${product.events?.length || 0})`} data={product.events} />
            <IntiaroSection title={`Sectional Elements (${product.sectional_elements?.length || 0})`} data={product.sectional_elements} />
            <IntiaroSection title="Menu Settings" data={product.menu_settings} />
            <IntiaroSection title={`Attribute Mappings (${product.attribute_mappings?.length || 0})`} data={product.attribute_mappings} />
            <IntiaroSection title={`Default Configurations (${product.default_configurations?.length || 0})`} data={product.default_configurations} />
          </div>
        </div>
      )}
    </div>
  )
}

function IntiaroSection({ title, data }: { title: string; data: unknown }) {
  const [open, setOpen] = useState(false)
  const isEmpty = !data || (Array.isArray(data) && data.length === 0)

  if (isEmpty) return null

  return (
    <div className="card">
      <div
        className="card-header"
        style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
        onClick={() => setOpen(!open)}
      >
        <span>{title}</span>
        {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
      </div>
      {open && (
        <div className="card-body">
          <pre style={{ fontSize: '0.8rem', overflow: 'auto', maxHeight: 250 }}>
            {JSON.stringify(data, null, 2)}
          </pre>
        </div>
      )}
    </div>
  )
}
