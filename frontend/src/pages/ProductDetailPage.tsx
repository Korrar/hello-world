import { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, Plus, Trash2, Save } from 'lucide-react'
import toast from 'react-hot-toast'
import { getProduct, updateProduct, addConfiguration, deleteConfiguration } from '../api/products'
import type { Product, ProductConfiguration, ConfigurationOption } from '../types'

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
          {!editing ? (
            <button className="btn btn-primary" onClick={() => setEditing(true)}>Edytuj</button>
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
    </div>
  )
}
