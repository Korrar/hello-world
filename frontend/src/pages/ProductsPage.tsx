import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Search, Trash2, Eye, ChevronLeft, ChevronRight } from 'lucide-react'
import toast from 'react-hot-toast'
import { getProducts, deleteProduct, deleteProducts, createProduct } from '../api/products'
import type { ProductListItem, PaginatedResponse } from '../types'

function ProductFormModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    sku: '', name: '', manufacturer: '', collection: '',
    description: '', base_price: 0, currency: 'USD',
    product_type: '', width: '', height: '', depth: '', weight: '',
  })
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      await createProduct({
        ...form,
        base_price: Number(form.base_price),
        width: form.width ? Number(form.width) : undefined,
        height: form.height ? Number(form.height) : undefined,
        depth: form.depth ? Number(form.depth) : undefined,
        weight: form.weight ? Number(form.weight) : undefined,
      } as never)
      toast.success('Produkt dodany')
      onSaved()
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string } } }
      toast.error(error.response?.data?.detail || 'Błąd zapisu')
    } finally {
      setSaving(false)
    }
  }

  const set = (key: string, val: string | number) => setForm(f => ({ ...f, [key]: val }))

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Nowy produkt</h3>
          <button className="btn btn-icon" onClick={onClose}>&times;</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">SKU *</label>
                <input className="form-input" required value={form.sku} onChange={e => set('sku', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Nazwa *</label>
                <input className="form-input" required value={form.name} onChange={e => set('name', e.target.value)} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Producent</label>
                <input className="form-input" value={form.manufacturer} onChange={e => set('manufacturer', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Kolekcja</label>
                <input className="form-input" value={form.collection} onChange={e => set('collection', e.target.value)} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Typ produktu</label>
                <input className="form-input" value={form.product_type} onChange={e => set('product_type', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Cena bazowa</label>
                <input className="form-input" type="number" step="0.01" value={form.base_price} onChange={e => set('base_price', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Waluta</label>
                <select className="form-select" value={form.currency} onChange={e => set('currency', e.target.value)}>
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                  <option value="PLN">PLN</option>
                  <option value="GBP">GBP</option>
                </select>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Opis</label>
              <textarea className="form-textarea" value={form.description} onChange={e => set('description', e.target.value)} />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Szerokość</label>
                <input className="form-input" type="number" step="0.1" value={form.width} onChange={e => set('width', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Wysokość</label>
                <input className="form-input" type="number" step="0.1" value={form.height} onChange={e => set('height', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Głębokość</label>
                <input className="form-input" type="number" step="0.1" value={form.depth} onChange={e => set('depth', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Waga</label>
                <input className="form-input" type="number" step="0.1" value={form.weight} onChange={e => set('weight', e.target.value)} />
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Anuluj</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Zapisuję...' : 'Zapisz produkt'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function ProductsPage() {
  const [data, setData] = useState<PaginatedResponse<ProductListItem> | null>(null)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getProducts({ page, page_size: 25, search })
      setData(res)
    } catch {
      toast.error('Błąd ładowania produktów')
    } finally {
      setLoading(false)
    }
  }, [page, search])

  useEffect(() => { load() }, [load])

  const handleDelete = async (id: number) => {
    if (!confirm('Czy na pewno chcesz usunąć ten produkt?')) return
    try {
      await deleteProduct(id)
      toast.success('Produkt usunięty')
      load()
    } catch {
      toast.error('Błąd usuwania')
    }
  }

  const handleBulkDelete = async () => {
    if (selected.size === 0) return
    if (!confirm(`Usunąć ${selected.size} produktów?`)) return
    try {
      await deleteProducts([...selected])
      setSelected(new Set())
      toast.success(`Usunięto ${selected.size} produktów`)
      load()
    } catch {
      toast.error('Błąd usuwania')
    }
  }

  const toggleSelect = (id: number) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleAll = () => {
    if (!data) return
    if (selected.size === data.items.length) setSelected(new Set())
    else setSelected(new Set(data.items.map(p => p.id)))
  }

  return (
    <div>
      <div className="page-header">
        <h2>Produkty</h2>
        <button className="btn btn-primary" onClick={() => setShowForm(true)}>
          <Plus size={16} /> Dodaj produkt
        </button>
      </div>

      <div className="toolbar">
        <div className="search-input">
          <input
            className="form-input"
            placeholder="Szukaj po nazwie lub SKU..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
          />
        </div>
        {selected.size > 0 && (
          <button className="btn btn-danger btn-sm" onClick={handleBulkDelete}>
            <Trash2 size={14} /> Usuń zaznaczone ({selected.size})
          </button>
        )}
      </div>

      <div className="card">
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th style={{ width: 40 }}>
                  <input type="checkbox" onChange={toggleAll} checked={data ? selected.size === data.items.length && data.items.length > 0 : false} />
                </th>
                <th>SKU</th>
                <th>Nazwa</th>
                <th>Producent</th>
                <th>Typ</th>
                <th>Cena</th>
                <th>Status</th>
                <th style={{ width: 100 }}>Akcje</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={8} style={{ textAlign: 'center', padding: '2rem' }}>Ładowanie...</td></tr>
              )}
              {!loading && data?.items.length === 0 && (
                <tr><td colSpan={8} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                  Brak produktów. Dodaj pierwszy produkt lub zaimportuj dane.
                </td></tr>
              )}
              {!loading && data?.items.map(p => (
                <tr key={p.id}>
                  <td><input type="checkbox" checked={selected.has(p.id)} onChange={() => toggleSelect(p.id)} /></td>
                  <td><code style={{ fontSize: '0.85rem' }}>{p.sku}</code></td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      {p.thumbnail_url && <img src={p.thumbnail_url} alt="" style={{ width: 32, height: 32, borderRadius: 4, objectFit: 'cover' }} />}
                      <span style={{ fontWeight: 500 }}>{p.name}</span>
                    </div>
                  </td>
                  <td>{p.manufacturer || '—'}</td>
                  <td>{p.product_type || '—'}</td>
                  <td style={{ fontWeight: 600 }}>{p.base_price.toLocaleString()} {p.currency}</td>
                  <td>
                    <span className={`badge ${p.is_active ? 'badge-success' : 'badge-danger'}`}>
                      {p.is_active ? 'Aktywny' : 'Nieaktywny'}
                    </span>
                  </td>
                  <td>
                    <div className="btn-group">
                      <Link to={`/products/${p.id}`} className="btn btn-secondary btn-sm btn-icon" title="Szczegóły">
                        <Eye size={14} />
                      </Link>
                      <button className="btn btn-danger btn-sm btn-icon" onClick={() => handleDelete(p.id)} title="Usuń">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {data && data.total_pages > 1 && (
          <div className="pagination">
            <div className="pagination-info">
              Strona {data.page} z {data.total_pages} ({data.total} produktów)
            </div>
            <div className="pagination-buttons">
              <button className="btn btn-secondary btn-sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                <ChevronLeft size={14} /> Poprzednia
              </button>
              <button className="btn btn-secondary btn-sm" disabled={page >= data.total_pages} onClick={() => setPage(p => p + 1)}>
                Następna <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>

      {showForm && <ProductFormModal onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load() }} />}
    </div>
  )
}
