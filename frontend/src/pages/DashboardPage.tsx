import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Package, FileText, TrendingUp, DollarSign } from 'lucide-react'
import { getProducts } from '../api/products'
import { getQuotes } from '../api/quotes'

export default function DashboardPage() {
  const [stats, setStats] = useState({ products: 0, quotes: 0, totalValue: 0, activeQuotes: 0 })

  useEffect(() => {
    Promise.all([
      getProducts({ page: 1, page_size: 1 }),
      getQuotes({ page: 1, page_size: 100 }),
    ]).then(([prodRes, quoteRes]) => {
      const totalValue = quoteRes.items.reduce((sum, q) => sum + q.total, 0)
      const activeQuotes = quoteRes.items.filter(q => q.status === 'sent' || q.status === 'draft').length
      setStats({
        products: prodRes.total,
        quotes: quoteRes.total,
        totalValue,
        activeQuotes,
      })
    }).catch(() => {})
  }, [])

  return (
    <div>
      <div className="page-header">
        <h2>Dashboard</h2>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div className="stat-label">Produkty</div>
              <div className="stat-value">{stats.products}</div>
            </div>
            <Package size={32} color="var(--primary)" />
          </div>
        </div>

        <div className="stat-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div className="stat-label">Wyceny</div>
              <div className="stat-value">{stats.quotes}</div>
            </div>
            <FileText size={32} color="var(--info)" />
          </div>
        </div>

        <div className="stat-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div className="stat-label">Aktywne wyceny</div>
              <div className="stat-value">{stats.activeQuotes}</div>
            </div>
            <TrendingUp size={32} color="var(--success)" />
          </div>
        </div>

        <div className="stat-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div className="stat-label">Wartość wycen</div>
              <div className="stat-value">${stats.totalValue.toLocaleString()}</div>
            </div>
            <DollarSign size={32} color="var(--warning)" />
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
        <div className="card">
          <div className="card-header">Szybkie akcje</div>
          <div className="card-body">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <Link to="/products" className="btn btn-primary" style={{ justifyContent: 'center' }}>
                <Package size={16} /> Zarządzaj produktami
              </Link>
              <Link to="/quotes" className="btn btn-secondary" style={{ justifyContent: 'center' }}>
                <FileText size={16} /> Utwórz wycenę
              </Link>
              <Link to="/import" className="btn btn-secondary" style={{ justifyContent: 'center' }}>
                Importuj dane produktów
              </Link>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">Informacje o systemie</div>
          <div className="card-body">
            <div className="detail-row">
              <span className="label">Wersja</span>
              <span>1.0.0</span>
            </div>
            <div className="detail-row">
              <span className="label">Backend</span>
              <span>FastAPI</span>
            </div>
            <div className="detail-row">
              <span className="label">Frontend</span>
              <span>React + TypeScript</span>
            </div>
            <div className="detail-row">
              <span className="label">Import formatów</span>
              <span>CSV, JSON, API</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
