import { useEffect, useState, useMemo, useCallback } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import { ArrowLeft, Copy, Check, RotateCcw } from 'lucide-react'
import toast from 'react-hot-toast'
import { getProduct, generateConfiguration } from '../api/products'
import type { Product, ProductConfiguration, ConfigurationOption, ProductPredicate, SectionalElement } from '../types'

export default function ConfiguratorPage() {
  const [searchParams] = useSearchParams()
  const productId = searchParams.get('product')

  const [product, setProduct] = useState<Product | null>(null)
  const [globalSelections, setGlobalSelections] = useState<Record<string, string>>({})
  const [elementOverrides, setElementOverrides] = useState<Record<number, Record<string, string>>>({})
  const [activeTab, setActiveTab] = useState<'global' | number>('global')
  const [copied, setCopied] = useState(false)

  const isSectional = product?.sectional_builder && (product?.sectional_elements?.length ?? 0) > 0

  useEffect(() => {
    if (!productId) return
    getProduct(Number(productId)).then(p => {
      setProduct(p)
      // Initialize defaults
      const defaults: Record<string, string> = {}
      for (const cfg of p.configurations) {
        const key = cfg.slug || cfg.name
        if (cfg.default_choice) {
          defaults[key] = cfg.default_choice
        } else {
          const defaultOpt = cfg.options.find(o => o.is_default)
          if (defaultOpt) defaults[key] = defaultOpt.slug || defaultOpt.value
        }
      }
      setGlobalSelections(defaults)

      // Initialize element overrides from default_variables
      if (p.sectional_builder && p.sectional_elements?.length > 0) {
        const overrides: Record<number, Record<string, string>> = {}
        for (const el of p.sectional_elements) {
          if (el.element_id != null && el.default_variables) {
            const elOverrides: Record<string, string> = {}
            for (const [key, val] of Object.entries(el.default_variables)) {
              if (typeof val === 'string' && val !== defaults[key]) {
                elOverrides[key] = val
              }
            }
            if (Object.keys(elOverrides).length > 0) {
              overrides[el.element_id] = elOverrides
            }
          }
        }
        setElementOverrides(overrides)
      }
    }).catch(() => toast.error('Nie znaleziono produktu'))
  }, [productId])

  const applyEventsAndMappings = useCallback((next: Record<string, string>, product: Product) => {
    for (const evt of product.events) {
      const srcKey = evt.source_variable
      if (srcKey && next[srcKey] !== undefined && evt.destinations) {
        for (const dest of evt.destinations) {
          if (typeof dest === 'string') {
            next[dest] = next[srcKey]
          }
        }
      }
    }
    for (const mapping of product.attribute_mappings) {
      const srcKey = mapping.source_attribute
      if (srcKey && next[srcKey] !== undefined && mapping.target_attributes) {
        for (const target of mapping.target_attributes) {
          next[target] = next[srcKey]
        }
      }
    }
    return next
  }, [])

  const setGlobalSelection = useCallback((attrKey: string, value: string) => {
    setGlobalSelections(prev => {
      const next = { ...prev, [attrKey]: value }
      if (!product) return next
      return applyEventsAndMappings(next, product)
    })
  }, [product, applyEventsAndMappings])

  const setElementSelection = useCallback((elementId: number, attrKey: string, value: string) => {
    setElementOverrides(prev => {
      const elPrev = prev[elementId] || {}
      const next = { ...elPrev, [attrKey]: value }
      return { ...prev, [elementId]: next }
    })
  }, [])

  const resetElementAttribute = useCallback((elementId: number, attrKey: string) => {
    setElementOverrides(prev => {
      const elPrev = { ...(prev[elementId] || {}) }
      delete elPrev[attrKey]
      if (Object.keys(elPrev).length === 0) {
        const { [elementId]: _, ...rest } = prev
        return rest
      }
      return { ...prev, [elementId]: elPrev }
    })
  }, [])

  const evaluatePredicate = useCallback((pred: ProductPredicate, selections: Record<string, string>): boolean => {
    const attrKey = pred.attribute
    if (!attrKey) return true
    const currentVal = selections[attrKey]
    if (currentVal === undefined) return true

    switch (pred.operator) {
      case 'eq':
      case '==':
      case 'equals':
        return currentVal === pred.compare_to
      case 'neq':
      case '!=':
      case 'not_equals':
        return currentVal !== pred.compare_to
      case 'in':
        return pred.compare_to ? pred.compare_to.split(',').map(s => s.trim()).includes(currentVal) : true
      case 'not_in':
        return pred.compare_to ? !pred.compare_to.split(',').map(s => s.trim()).includes(currentVal) : true
      default:
        return true
    }
  }, [])

  const isConfigVisible = useCallback((cfg: ProductConfiguration, selections: Record<string, string>): boolean => {
    if (!cfg.predicate || !product) return true
    const predDef = product.predicates.find(p => p.predicate_key === cfg.predicate)
    if (!predDef) return true
    return evaluatePredicate(predDef, selections)
  }, [product, evaluatePredicate])

  // Get effective selections for a given element (or global)
  const getEffectiveSelections = useCallback((elementId?: number): Record<string, string> => {
    if (elementId == null) return globalSelections
    return { ...globalSelections, ...(elementOverrides[elementId] || {}) }
  }, [globalSelections, elementOverrides])

  // Group configurations by variable_group
  const getGrouped = useCallback((selections: Record<string, string>) => {
    if (!product) return []
    const groups = new Map<string, ProductConfiguration[]>()
    for (const cfg of product.configurations) {
      if (!isConfigVisible(cfg, selections)) continue
      const groupKey = cfg.variable_group || '__ungrouped__'
      if (!groups.has(groupKey)) groups.set(groupKey, [])
      groups.get(groupKey)!.push(cfg)
    }

    const vgOrder = new Map<string, number>()
    for (const vg of product.variable_groups) {
      vgOrder.set(vg.slug || vg.name, vg.index)
    }

    return Array.from(groups.entries()).sort((a, b) => {
      const oa = vgOrder.get(a[0]) ?? 999
      const ob = vgOrder.get(b[0]) ?? 999
      return oa - ob
    })
  }, [product, isConfigVisible])

  const grouped = useMemo(() => {
    const selections = activeTab === 'global' ? globalSelections : getEffectiveSelections(activeTab as number)
    return getGrouped(selections)
  }, [activeTab, globalSelections, elementOverrides, getGrouped, getEffectiveSelections])

  const output = useMemo(() => {
    if (!product) return null
    const visibleSelections: Record<string, string> = {}
    for (const cfg of product.configurations) {
      if (!isConfigVisible(cfg, globalSelections)) continue
      const key = cfg.slug || cfg.name
      if (globalSelections[key]) visibleSelections[key] = globalSelections[key]
    }
    return generateConfiguration(product, visibleSelections, elementOverrides)
  }, [product, globalSelections, elementOverrides, isConfigVisible])

  const handleCopy = () => {
    if (!output) return
    navigator.clipboard.writeText(JSON.stringify(output, null, 2))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
    toast.success('Skopiowano do schowka')
  }

  if (!productId) {
    return (
      <div>
        <h2>Konfigurator</h2>
        <p style={{ color: 'var(--text-muted)', marginTop: '1rem' }}>
          Wybierz produkt z listy produktów, aby otworzyć konfigurator.
        </p>
        <Link to="/products" className="btn btn-primary" style={{ marginTop: '1rem' }}>
          Lista produktów
        </Link>
      </div>
    )
  }

  if (!product) return <div>Ładowanie...</div>

  const getGroupLabel = (key: string) => {
    if (key === '__ungrouped__') return 'Inne'
    const vg = product.variable_groups.find(g => (g.slug || g.name) === key)
    return vg?.name || key
  }

  const getElementLabel = (el: SectionalElement) => {
    return el.name || `Element #${el.element_id}`
  }

  const currentElementId = activeTab === 'global' ? undefined : (activeTab as number)
  const currentSelections = getEffectiveSelections(currentElementId)

  const handleSelect = (attrKey: string, value: string) => {
    if (activeTab === 'global' || !isSectional) {
      setGlobalSelection(attrKey, value)
    } else {
      setElementSelection(activeTab as number, attrKey, value)
    }
  }

  const isOverridden = (elementId: number, attrKey: string): boolean => {
    return elementOverrides[elementId]?.[attrKey] !== undefined
  }

  return (
    <div>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <Link to={`/products/${product.id}`} className="btn btn-secondary btn-icon">
            <ArrowLeft size={16} />
          </Link>
          <div>
            <h2>Konfigurator: {product.name}</h2>
            <small style={{ color: 'var(--text-muted)' }}>
              SKU: {product.sku}
              {isSectional && <span className="badge badge-info" style={{ marginLeft: '0.5rem' }}>Sectional</span>}
            </small>
          </div>
        </div>
      </div>

      {/* Element tabs for sectional products */}
      {isSectional && (
        <div className="element-tabs">
          <button
            className={`element-tab ${activeTab === 'global' ? 'active' : ''}`}
            onClick={() => setActiveTab('global')}
          >
            Wszystkie elementy
          </button>
          {product.sectional_elements.map(el => {
            const elId = el.element_id!
            const overrideCount = Object.keys(elementOverrides[elId] || {}).length
            return (
              <button
                key={elId}
                className={`element-tab ${activeTab === elId ? 'active' : ''}`}
                onClick={() => setActiveTab(elId)}
              >
                {getElementLabel(el)}
                {overrideCount > 0 && (
                  <span className="local-override-count">{overrideCount}</span>
                )}
              </button>
            )
          })}
        </div>
      )}

      <div className="configurator-layout">
        {/* Left panel: Attribute selectors */}
        <div className="configurator-left">
          {activeTab === 'global' && isSectional && (
            <div className="global-hint">
              Zmiany w tej zakładce dotyczą wszystkich elementów.
            </div>
          )}
          {activeTab !== 'global' && isSectional && (
            <div className="element-hint">
              Zmienione atrybuty będą dotyczyły tylko tego elementu. Pozostałe dziedziczą wartości globalne.
            </div>
          )}

          {grouped.map(([groupKey, cfgs]) => (
            <div key={groupKey} className="attribute-group">
              <h3 className="attribute-group-title">{getGroupLabel(groupKey)}</h3>
              {cfgs.map(cfg => {
                const attrKey = cfg.slug || cfg.name
                const selected = currentSelections[attrKey] || ''
                const showOverride = activeTab !== 'global' && isSectional && isOverridden(activeTab as number, attrKey)
                return (
                  <div key={cfg.id ?? attrKey} style={{ marginBottom: '1.5rem' }}>
                    <div style={{ marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>
                        {cfg.display_name || cfg.name}
                      </span>
                      {cfg.predicate && (
                        <span className="badge badge-warning" style={{ fontSize: '0.7rem' }}>
                          {cfg.predicate}
                        </span>
                      )}
                      {showOverride && (
                        <>
                          <span className="local-override-badge">Lokalny</span>
                          <button
                            className="btn-reset-local"
                            onClick={() => resetElementAttribute(activeTab as number, attrKey)}
                            title="Przywróć wartość globalną"
                          >
                            <RotateCcw size={12} />
                          </button>
                        </>
                      )}
                    </div>
                    <div className="choice-grid">
                      {cfg.options.map(opt => (
                        <ChoiceCard
                          key={opt.id ?? (opt.slug || opt.value)}
                          option={opt}
                          selected={selected === (opt.slug || opt.value)}
                          onClick={() => handleSelect(attrKey, opt.slug || opt.value)}
                        />
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          ))}
        </div>

        {/* Right panel: JSON output */}
        <div className="configurator-right">
          <div className="output-panel">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <strong>Configuration Output</strong>
              <button className="btn btn-secondary btn-sm" onClick={handleCopy}>
                {copied ? <Check size={14} /> : <Copy size={14} />}
                {copied ? 'Skopiowano' : 'Kopiuj'}
              </button>
            </div>
            <pre className="output-json">
              {output ? JSON.stringify(output, null, 2) : '{}'}
            </pre>
          </div>
        </div>
      </div>
    </div>
  )
}

function ChoiceCard({
  option,
  selected,
  onClick,
}: {
  option: ConfigurationOption
  selected: boolean
  onClick: () => void
}) {
  return (
    <div className={`choice-card ${selected ? 'selected' : ''}`} onClick={onClick}>
      {option.icon && (
        <img src={option.icon} alt="" className="choice-card-icon" />
      )}
      {option.thumbnail_url && !option.icon && (
        <img src={option.thumbnail_url} alt="" className="choice-card-icon" />
      )}
      <div className="choice-card-label">{option.display_name || option.value}</div>
      {option.grade && (
        <div className="choice-card-grade">{option.grade}</div>
      )}
    </div>
  )
}
