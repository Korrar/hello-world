import React, { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Search, Trash2, Eye, ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react'
import toast from 'react-hot-toast'
import { getProducts, deleteProduct, deleteProducts, createProduct, getSubProducts, getPresets, getDeleteInfo } from '../api/products'
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
  const [expandedProducts, setExpandedProducts] = useState<Set<number>>(new Set())
  const [subProductsCache, setSubProductsCache] = useState<Map<number, ProductListItem[]>>(new Map())
  const [expandedSubProducts, setExpandedSubProducts] = useState<Set<number>>(new Set())
  const [presetsCache, setPresetsCache] = useState<Map<number, ProductListItem[]>>(new Map())

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
    try {
      const info = await getDeleteInfo(id)
      const parts: string[] = []
      if (info.sub_products_count > 0) parts.push(`${info.sub_products_count} sub-produkt(ów)`)
      if (info.presets_count > 0) parts.push(`${info.presets_count} preset(ów)`)
      const extra = parts.length > 0
        ? `\n\nZostanie również usunięte: ${parts.join(', ')}.`
        : ''
      if (!confirm(`Czy na pewno chcesz usunąć ten produkt?${extra}`)) return
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

  const toggleExpand = async (productId: number) => {
    const next = new Set(expandedProducts)
    if (next.has(productId)) {
      next.delete(productId)
      setExpandedProducts(next)
      return
    }
    next.add(productId)
    setExpandedProducts(next)
    if (!subProductsCache.has(productId)) {
      try {
        const subs = await getSubProducts(productId)
        setSubProductsCache(prev => new Map(prev).set(productId, subs))
      } catch {
        toast.error('Blad ladowania sub-produktow')
      }
    }
  }

  const toggleExpandSub = async (subId: number) => {
    const next = new Set(expandedSubProducts)
    if (next.has(subId)) {
      next.delete(subId)
      setExpandedSubProducts(next)
      return
    }
    next.add(subId)
    setExpandedSubProducts(next)
    if (!presetsCache.has(subId)) {
      try {
        const presets = await getPresets(subId)
        setPresetsCache(prev => new Map(prev).set(subId, presets))
      } catch {
        toast.error('Blad ladowania presetow')
      }
    }
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
                <th>Producent / Brand</th>
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
              {!loading && data?.items.map(p => {
                const hasSubs = (p.sub_products_count ?? 0) > 0
                const isExpanded = expandedProducts.has(p.id)
                const subs = subProductsCache.get(p.id) || []
                return (
                  <React.Fragment key={p.id}>
                    <tr>
                      <td><input type="checkbox" checked={selected.has(p.id)} onChange={() => toggleSelect(p.id)} /></td>
                      <td><code style={{ fontSize: '0.85rem' }}>{p.sku}</code></td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          {hasSubs && (
                            <button
                              className="btn btn-icon"
                              style={{ padding: 0, minWidth: 'auto', background: 'none', border: 'none', cursor: 'pointer' }}
                              onClick={() => toggleExpand(p.id)}
                            >
                              {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                            </button>
                          )}
                          {p.thumbnail_url && <img src={p.thumbnail_url} alt="" style={{ width: 32, height: 32, borderRadius: 4, objectFit: 'cover' }} />}
                          <span style={{ fontWeight: 500 }}>{p.name}</span>
                          {hasSubs && (
                            <span className="badge badge-secondary" style={{ fontSize: '0.7rem' }}>
                              {p.sub_products_count} sub
                            </span>
                          )}
                        </div>
                      </td>
                      <td>
                        {p.manufacturer || '—'}
                        {p.brand && p.brand !== p.manufacturer && (
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Brand: {p.brand}</div>
                        )}
                      </td>
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
                    {isExpanded && subs.map(sub => {
                      const hasPresets = (sub.sub_products_count ?? 0) > 0
                      const isSubExpanded = expandedSubProducts.has(sub.id)
                      const presets = presetsCache.get(sub.id) || []
                      return (
                        <React.Fragment key={sub.id}>
                          <tr style={{ background: 'var(--bg-hover, #f8f9fa)' }}>
                            <td></td>
                            <td><code style={{ fontSize: '0.85rem' }}>{sub.sku}</code></td>
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', paddingLeft: '2rem' }}>
                                {hasPresets && (
                                  <button
                                    className="btn btn-icon"
                                    style={{ padding: 0, minWidth: 'auto', background: 'none', border: 'none', cursor: 'pointer' }}
                                    onClick={() => toggleExpandSub(sub.id)}
                                  >
                                    {isSubExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                  </button>
                                )}
                                {sub.thumbnail_url && <img src={sub.thumbnail_url} alt="" style={{ width: 32, height: 32, borderRadius: 4, objectFit: 'cover' }} />}
                                <span style={{ fontWeight: 500 }}>{sub.name}</span>
                                <span className="badge badge-info" style={{ fontSize: '0.65rem' }}>sub-produkt</span>
                                {hasPresets && (
                                  <span className="badge badge-secondary" style={{ fontSize: '0.65rem' }}>
                                    {sub.sub_products_count} preset
                                  </span>
                                )}
                              </div>
                            </td>
                            <td>
                              {sub.manufacturer || '—'}
                              {sub.brand && sub.brand !== sub.manufacturer && (
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Brand: {sub.brand}</div>
                              )}
                            </td>
                            <td>{sub.product_type || '—'}</td>
                            <td style={{ fontWeight: 600 }}>{sub.base_price.toLocaleString()} {sub.currency}</td>
                            <td>
                              <span className={`badge ${sub.is_active ? 'badge-success' : 'badge-danger'}`}>
                                {sub.is_active ? 'Aktywny' : 'Nieaktywny'}
                              </span>
                            </td>
                            <td>
                              <div className="btn-group">
                                <Link to={`/products/${sub.id}`} className="btn btn-secondary btn-sm btn-icon" title="Szczegóły">
                                  <Eye size={14} />
                                </Link>
                                <button className="btn btn-danger btn-sm btn-icon" onClick={() => handleDelete(sub.id)} title="Usuń">
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </td>
                          </tr>
                          {isSubExpanded && presets.map(preset => (
                            <tr key={preset.id} style={{ background: 'var(--bg-hover, #f0f1f3)' }}>
                              <td></td>
                              <td><code style={{ fontSize: '0.85rem' }}>{preset.sku}</code></td>
                              <td>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', paddingLeft: '4rem' }}>
                                  {preset.thumbnail_url && <img src={preset.thumbnail_url} alt="" style={{ width: 28, height: 28, borderRadius: 4, objectFit: 'cover' }} />}
                                  <span style={{ fontWeight: 500 }}>{preset.name}</span>
                                  <span className="badge badge-warning" style={{ fontSize: '0.6rem' }}>preset</span>
                                </div>
                              </td>
                              <td>{preset.brand || preset.manufacturer || '—'}</td>
                              <td>{preset.product_type || '—'}</td>
                              <td style={{ fontWeight: 600 }}>{preset.base_price.toLocaleString()} {preset.currency}</td>
                              <td>
                                <span className={`badge ${preset.is_active ? 'badge-success' : 'badge-danger'}`}>
                                  {preset.is_active ? 'Aktywny' : 'Nieaktywny'}
                                </span>
                              </td>
                              <td>
                                <div className="btn-group">
                                  <Link to={`/products/${preset.id}`} className="btn btn-secondary btn-sm btn-icon" title="Szczegóły">
                                    <Eye size={14} />
                                  </Link>
                                  <button className="btn btn-danger btn-sm btn-icon" onClick={() => handleDelete(preset.id)} title="Usuń">
                                    <Trash2 size={14} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </React.Fragment>
                      )
                    })}
                  </React.Fragment>
                )
              })}
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
