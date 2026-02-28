import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Search, Trash2, Eye, ChevronLeft, ChevronRight } from 'lucide-react'
import toast from 'react-hot-toast'
import { getQuotes, createQuote, deleteQuote } from '../api/quotes'
import type { QuoteListItem, PaginatedResponse } from '../types'

const STATUS_BADGES: Record<string, string> = {
  draft: 'badge-secondary',
  sent: 'badge-info',
  accepted: 'badge-success',
  rejected: 'badge-danger',
  expired: 'badge-warning',
}

const STATUS_LABELS: Record<string, string> = {
  draft: 'Szkic',
  sent: 'Wysłana',
  accepted: 'Zaakceptowana',
  rejected: 'Odrzucona',
  expired: 'Wygasła',
}

function NewQuoteModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    customer_name: '',
    customer_email: '',
    customer_company: '',
    notes: '',
    discount_percent: 0,
    tax_percent: 23,
    currency: 'PLN',
  })
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      await createQuote({
        ...form,
        discount_percent: Number(form.discount_percent),
        tax_percent: Number(form.tax_percent),
      })
      toast.success('Wycena utworzona')
      onSaved()
    } catch {
      toast.error('Błąd tworzenia wyceny')
    } finally {
      setSaving(false)
    }
  }

  const set = (key: string, val: string | number) => setForm(f => ({ ...f, [key]: val }))

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Nowa wycena</h3>
          <button className="btn btn-icon" onClick={onClose}>&times;</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-group">
              <label className="form-label">Nazwa klienta *</label>
              <input className="form-input" required value={form.customer_name} onChange={e => set('customer_name', e.target.value)} />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Email klienta</label>
                <input className="form-input" type="email" value={form.customer_email} onChange={e => set('customer_email', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Firma</label>
                <input className="form-input" value={form.customer_company} onChange={e => set('customer_company', e.target.value)} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Rabat (%)</label>
                <input className="form-input" type="number" step="0.1" value={form.discount_percent} onChange={e => set('discount_percent', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Podatek (%)</label>
                <input className="form-input" type="number" step="0.1" value={form.tax_percent} onChange={e => set('tax_percent', e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label">Waluta</label>
                <select className="form-select" value={form.currency} onChange={e => set('currency', e.target.value)}>
                  <option value="PLN">PLN</option>
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                  <option value="GBP">GBP</option>
                </select>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Notatki</label>
              <textarea className="form-textarea" value={form.notes} onChange={e => set('notes', e.target.value)} />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Anuluj</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Tworzę...' : 'Utwórz wycenę'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function QuotesPage() {
  const [data, setData] = useState<PaginatedResponse<QuoteListItem> | null>(null)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getQuotes({ page, page_size: 25, search, status: statusFilter })
      setData(res)
    } catch {
      toast.error('Błąd ładowania wycen')
    } finally {
      setLoading(false)
    }
  }, [page, search, statusFilter])

  useEffect(() => { load() }, [load])

  const handleDelete = async (id: number) => {
    if (!confirm('Usunąć tę wycenę?')) return
    try {
      await deleteQuote(id)
      toast.success('Wycena usunięta')
      load()
    } catch {
      toast.error('Błąd usuwania')
    }
  }

  return (
    <div>
      <div className="page-header">
        <h2>Wyceny</h2>
        <button className="btn btn-primary" onClick={() => setShowForm(true)}>
          <Plus size={16} /> Nowa wycena
        </button>
      </div>

      <div className="toolbar">
        <div className="search-input">
          <input
            className="form-input"
            placeholder="Szukaj po kliencie lub numerze..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
          />
        </div>
        <select className="form-select" style={{ width: 'auto' }} value={statusFilter} onChange={e => { setStatusFilter(e.target.value); setPage(1) }}>
          <option value="">Wszystkie statusy</option>
          <option value="draft">Szkic</option>
          <option value="sent">Wysłana</option>
          <option value="accepted">Zaakceptowana</option>
          <option value="rejected">Odrzucona</option>
          <option value="expired">Wygasła</option>
        </select>
      </div>

      <div className="card">
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Numer</th>
                <th>Klient</th>
                <th>Firma</th>
                <th>Status</th>
                <th>Suma</th>
                <th>Razem</th>
                <th>Data</th>
                <th style={{ width: 100 }}>Akcje</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={8} style={{ textAlign: 'center', padding: '2rem' }}>Ładowanie...</td></tr>
              )}
              {!loading && data?.items.length === 0 && (
                <tr><td colSpan={8} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                  Brak wycen. Utwórz pierwszą wycenę.
                </td></tr>
              )}
              {!loading && data?.items.map(q => (
                <tr key={q.id}>
                  <td><code>{q.quote_number}</code></td>
                  <td style={{ fontWeight: 500 }}>{q.customer_name}</td>
                  <td>{q.customer_company || '—'}</td>
                  <td><span className={`badge ${STATUS_BADGES[q.status] || 'badge-secondary'}`}>{STATUS_LABELS[q.status] || q.status}</span></td>
                  <td>{q.subtotal.toLocaleString()} {q.currency}</td>
                  <td style={{ fontWeight: 600 }}>{q.total.toLocaleString()} {q.currency}</td>
                  <td>{new Date(q.created_at).toLocaleDateString('pl-PL')}</td>
                  <td>
                    <div className="btn-group">
                      <Link to={`/quotes/${q.id}`} className="btn btn-secondary btn-sm btn-icon" title="Szczegóły">
                        <Eye size={14} />
                      </Link>
                      <button className="btn btn-danger btn-sm btn-icon" onClick={() => handleDelete(q.id)} title="Usuń">
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
              Strona {data.page} z {data.total_pages} ({data.total} wycen)
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

      {showForm && <NewQuoteModal onClose={() => setShowForm(false)} onSaved={() => { setShowForm(false); load() }} />}
    </div>
  )
}
