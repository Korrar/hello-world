import { useEffect, useState } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, Plus, Trash2, Save, Search } from 'lucide-react'
import toast from 'react-hot-toast'
import { getQuote, updateQuote, addQuoteItem, deleteQuoteItem } from '../api/quotes'
import { getProducts, getProduct } from '../api/products'
import type { Quote, ProductListItem, Product, ProductConfiguration } from '../types'

const STATUS_LABELS: Record<string, string> = {
  draft: 'Szkic',
  sent: 'Wysłana',
  accepted: 'Zaakceptowana',
  rejected: 'Odrzucona',
  expired: 'Wygasła',
}

function AddItemModal({
  quoteId,
  onClose,
  onAdded,
}: {
  quoteId: number
  onClose: () => void
  onAdded: () => void
}) {
  const [search, setSearch] = useState('')
  const [products, setProducts] = useState<ProductListItem[]>([])
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [quantity, setQuantity] = useState(1)
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    getProducts({ page: 1, page_size: 50, search }).then(res => setProducts(res.items)).catch(() => {})
  }, [search])

  const handleSelectProduct = async (productId: number) => {
    try {
      const p = await getProduct(productId)
      setSelectedProduct(p)
      const defaults: Record<string, string> = {}
      p.configurations.forEach(cfg => {
        const def = cfg.options.find(o => o.is_default)
        if (def) defaults[cfg.name] = def.value
        else if (cfg.options.length > 0) defaults[cfg.name] = cfg.options[0].value
      })
      setSelectedOptions(defaults)
    } catch {
      toast.error('Błąd ładowania produktu')
    }
  }

  const calculatePrice = () => {
    if (!selectedProduct) return 0
    let price = selectedProduct.base_price
    selectedProduct.configurations.forEach(cfg => {
      const selected = selectedOptions[cfg.name]
      if (selected) {
        const opt = cfg.options.find(o => o.value === selected)
        if (opt) {
          if (opt.price_modifier_type === 'percentage') {
            price += price * (opt.price_modifier / 100)
          } else {
            price += opt.price_modifier
          }
        }
      }
    })
    return price
  }

  const handleAdd = async () => {
    if (!selectedProduct) return
    setSaving(true)
    try {
      await addQuoteItem(quoteId, {
        product_id: selectedProduct.id,
        quantity,
        unit_price: calculatePrice(),
        selected_options: selectedOptions,
      })
      toast.success('Pozycja dodana')
      onAdded()
    } catch {
      toast.error('Błąd dodawania pozycji')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Dodaj pozycję do wyceny</h3>
          <button className="btn btn-icon" onClick={onClose}>&times;</button>
        </div>
        <div className="modal-body">
          {!selectedProduct ? (
            <>
              <div className="form-group">
                <input
                  className="form-input"
                  placeholder="Szukaj produktu..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  autoFocus
                />
              </div>
              <div style={{ maxHeight: 400, overflow: 'auto' }}>
                <table>
                  <thead>
                    <tr>
                      <th>SKU</th>
                      <th>Nazwa</th>
                      <th>Cena</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {products.map(p => (
                      <tr key={p.id} style={{ cursor: 'pointer' }} onClick={() => handleSelectProduct(p.id)}>
                        <td><code>{p.sku}</code></td>
                        <td>{p.name}</td>
                        <td>{p.base_price.toLocaleString()} {p.currency}</td>
                        <td><button className="btn btn-primary btn-sm">Wybierz</button></td>
                      </tr>
                    ))}
                    {products.length === 0 && (
                      <tr><td colSpan={4} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Brak produktów</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <>
              <div style={{ marginBottom: '1rem', padding: '1rem', background: 'var(--bg)', borderRadius: 'var(--radius)' }}>
                <strong>{selectedProduct.name}</strong>
                <span style={{ marginLeft: '0.5rem', color: 'var(--text-muted)' }}>({selectedProduct.sku})</span>
                <button className="btn btn-secondary btn-sm" style={{ float: 'right' }} onClick={() => setSelectedProduct(null)}>
                  Zmień produkt
                </button>
              </div>

              {selectedProduct.configurations.map(cfg => (
                <div key={cfg.id} className="form-group">
                  <label className="form-label">
                    {cfg.display_name || cfg.name}
                    {cfg.is_required && ' *'}
                  </label>
                  <select
                    className="form-select"
                    value={selectedOptions[cfg.name] || ''}
                    onChange={e => setSelectedOptions(prev => ({ ...prev, [cfg.name]: e.target.value }))}
                  >
                    {cfg.options.map(opt => (
                      <option key={opt.value} value={opt.value}>
                        {opt.display_name || opt.value}
                        {opt.price_modifier !== 0 && ` (${opt.price_modifier > 0 ? '+' : ''}${opt.price_modifier}${opt.price_modifier_type === 'percentage' ? '%' : ` ${selectedProduct.currency}`})`}
                      </option>
                    ))}
                  </select>
                </div>
              ))}

              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Ilość</label>
                  <input className="form-input" type="number" min={1} value={quantity} onChange={e => setQuantity(Number(e.target.value))} />
                </div>
                <div className="form-group">
                  <label className="form-label">Cena jednostkowa (z konfiguracją)</label>
                  <input className="form-input" type="number" value={calculatePrice().toFixed(2)} readOnly style={{ background: 'var(--bg)' }} />
                </div>
                <div className="form-group">
                  <label className="form-label">Razem</label>
                  <input className="form-input" value={`${(calculatePrice() * quantity).toLocaleString()} ${selectedProduct.currency}`} readOnly style={{ background: 'var(--bg)', fontWeight: 600 }} />
                </div>
              </div>
            </>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Anuluj</button>
          {selectedProduct && (
            <button className="btn btn-primary" onClick={handleAdd} disabled={saving}>
              {saving ? 'Dodaję...' : 'Dodaj do wyceny'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default function QuoteDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [quote, setQuote] = useState<Quote | null>(null)
  const [showAddItem, setShowAddItem] = useState(false)
  const [editing, setEditing] = useState(false)
  const [statusForm, setStatusForm] = useState('')

  const load = async () => {
    try {
      const q = await getQuote(Number(id))
      setQuote(q)
      setStatusForm(q.status)
    } catch {
      toast.error('Nie znaleziono wyceny')
      navigate('/quotes')
    }
  }

  useEffect(() => { load() }, [id])

  const handleStatusChange = async (status: string) => {
    try {
      await updateQuote(Number(id), { status })
      toast.success('Status zaktualizowany')
      load()
    } catch {
      toast.error('Błąd zmiany statusu')
    }
  }

  const handleRemoveItem = async (itemId: number) => {
    if (!confirm('Usunąć tę pozycję?')) return
    try {
      await deleteQuoteItem(Number(id), itemId)
      toast.success('Pozycja usunięta')
      load()
    } catch {
      toast.error('Błąd usuwania')
    }
  }

  if (!quote) return <div>Ładowanie...</div>

  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <Link to="/quotes" className="btn btn-secondary btn-icon"><ArrowLeft size={16} /></Link>
          <div>
            <h2>Wycena {quote.quote_number}</h2>
            <small style={{ color: 'var(--text-muted)' }}>{quote.customer_name}{quote.customer_company ? ` — ${quote.customer_company}` : ''}</small>
          </div>
        </div>
        <div className="btn-group">
          <select className="form-select" style={{ width: 'auto' }} value={statusForm} onChange={e => { setStatusForm(e.target.value); handleStatusChange(e.target.value) }}>
            {Object.entries(STATUS_LABELS).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
          <button className="btn btn-primary" onClick={() => setShowAddItem(true)}>
            <Plus size={16} /> Dodaj pozycję
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '1.5rem' }}>
        <div>
          <div className="card">
            <div className="card-header">Pozycje wyceny ({quote.items.length})</div>
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Produkt</th>
                    <th>Konfiguracja</th>
                    <th>Ilość</th>
                    <th>Cena jedn.</th>
                    <th>Razem</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {quote.items.map(item => (
                    <tr key={item.id}>
                      <td style={{ fontWeight: 500 }}>ID: {item.product_id}</td>
                      <td>
                        {item.selected_options && Object.entries(item.selected_options).map(([k, v]) => (
                          <span key={k} className="badge badge-secondary" style={{ marginRight: '0.25rem' }}>
                            {k}: {v}
                          </span>
                        ))}
                        {(!item.selected_options || Object.keys(item.selected_options).length === 0) && '—'}
                      </td>
                      <td>{item.quantity}</td>
                      <td>{item.unit_price.toLocaleString()} {quote.currency}</td>
                      <td style={{ fontWeight: 600 }}>{(item.unit_price * item.quantity).toLocaleString()} {quote.currency}</td>
                      <td>
                        <button className="btn btn-danger btn-sm btn-icon" onClick={() => handleRemoveItem(item.id!)}>
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {quote.items.length === 0 && (
                    <tr><td colSpan={6} style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>
                      Brak pozycji. Dodaj produkty do wyceny.
                    </td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div>
          <div className="card">
            <div className="card-header">Podsumowanie</div>
            <div className="card-body">
              <div className="detail-row">
                <span className="label">Suma netto</span>
                <span>{quote.subtotal.toLocaleString()} {quote.currency}</span>
              </div>
              {quote.discount_percent > 0 && (
                <div className="detail-row">
                  <span className="label">Rabat ({quote.discount_percent}%)</span>
                  <span style={{ color: 'var(--success)' }}>-{quote.discount_amount.toLocaleString()} {quote.currency}</span>
                </div>
              )}
              <div className="detail-row">
                <span className="label">Podatek ({quote.tax_percent}%)</span>
                <span>{quote.tax_amount.toLocaleString()} {quote.currency}</span>
              </div>
              <hr style={{ margin: '0.75rem 0', border: 'none', borderTop: '2px solid var(--border)' }} />
              <div className="detail-row" style={{ fontSize: '1.1rem' }}>
                <span style={{ fontWeight: 700 }}>RAZEM</span>
                <span style={{ fontWeight: 700, color: 'var(--primary)' }}>{quote.total.toLocaleString()} {quote.currency}</span>
              </div>
            </div>
          </div>

          <div className="card" style={{ marginTop: '1rem' }}>
            <div className="card-header">Dane klienta</div>
            <div className="card-body">
              <div className="detail-row"><span className="label">Klient</span><span>{quote.customer_name}</span></div>
              {quote.customer_email && <div className="detail-row"><span className="label">Email</span><span>{quote.customer_email}</span></div>}
              {quote.customer_company && <div className="detail-row"><span className="label">Firma</span><span>{quote.customer_company}</span></div>}
              <div className="detail-row"><span className="label">Utworzono</span><span>{new Date(quote.created_at).toLocaleDateString('pl-PL')}</span></div>
              {quote.valid_until && <div className="detail-row"><span className="label">Ważna do</span><span>{new Date(quote.valid_until).toLocaleDateString('pl-PL')}</span></div>}
              {quote.notes && (
                <div style={{ marginTop: '0.75rem', padding: '0.75rem', background: 'var(--bg)', borderRadius: 'var(--radius)', fontSize: '0.9rem' }}>
                  {quote.notes}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {showAddItem && (
        <AddItemModal
          quoteId={quote.id}
          onClose={() => setShowAddItem(false)}
          onAdded={() => { setShowAddItem(false); load() }}
        />
      )}
    </div>
  )
}
