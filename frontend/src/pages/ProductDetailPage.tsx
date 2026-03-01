import { useEffect, useState, useCallback, useMemo, memo } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, Plus, Trash2, Save, Sliders, ChevronDown, ChevronRight, Edit2, X, Download, Eye, EyeOff, Copy, Check } from 'lucide-react'
import toast from 'react-hot-toast'
import { getProduct, updateProduct, deleteProduct, getDeleteInfo, addConfiguration, deleteConfiguration, addElement, updateElement, deleteElement, addPredicate, updatePredicate, deletePredicate, setConfigPredicate, setOptionPredicate, createChoiceOverride, deleteChoiceOverride, addEvent, updateEvent, deleteEvent, getSubProducts, createSubProduct, getPresets, createPreset, saveDefaultConfiguration } from '../api/products'
import type { Product, ProductConfiguration, ConfigurationOption, SectionalElement, ProductPredicate, ProductEvent, ChoiceOverride, ProductListItem } from '../types'

/* ============================================================
   Element key helper — name_elementId to handle duplicates
   ============================================================ */

function elKey(el: SectionalElement): string {
  return `${el.name || 'element'}_${el.element_id}`
}

function elLabel(el: SectionalElement): string {
  return el.display_name || el.name || `Element #${el.element_id}`
}

/* ============================================================
   Override index — O(1) lookup instead of O(N) scan per row
   ============================================================ */

type OverrideIndex = Map<number, ChoiceOverride[]>  // optionId → overrides

function buildOverrideIndex(overrides: ChoiceOverride[]): OverrideIndex {
  const idx: OverrideIndex = new Map()
  for (const ovr of overrides) {
    let arr = idx.get(ovr.option_id)
    if (!arr) { arr = []; idx.set(ovr.option_id, arr) }
    arr.push(ovr)
  }
  return idx
}

function lookupOverride(index: OverrideIndex, optionId: number, elementId: number | undefined, configId: number | undefined): ChoiceOverride | undefined {
  const arr = index.get(optionId)
  if (!arr) return undefined
  // Most specific first: per config in element > per element > per product
  let perElement: ChoiceOverride | undefined
  let perProduct: ChoiceOverride | undefined
  for (const ovr of arr) {
    if (ovr.element_id === elementId && ovr.configuration_id === configId && elementId != null && configId != null) return ovr
    if (ovr.element_id === elementId && ovr.configuration_id == null && ovr.element_id != null && !perElement) perElement = ovr
    if (ovr.element_id == null && ovr.configuration_id == null && !perProduct) perProduct = ovr
  }
  return perElement ?? perProduct
}

/* ============================================================
   ProductTreeEditor — unified tree view of configurations
   ============================================================ */

function ProductTreeEditor({ product, onUpdate }: { product: Product; onUpdate: () => void }) {
  // Compute initial collapsed state: everything starts collapsed
  const [collapsed, setCollapsed] = useState<Set<string>>(() => {
    const initial = new Set<string>()
    for (const cfg of product.configurations) initial.add(`cfg-${cfg.id}`)
    for (const el of product.sectional_elements || []) {
      initial.add(`el-${el.id}`)
      for (const cfg of product.configurations) initial.add(`cfg-${cfg.id}-el-${el.id}`)
    }
    return initial
  })
  const [addingGlobalAttr, setAddingGlobalAttr] = useState(false)
  const [addingLocalAttr, setAddingLocalAttr] = useState<number | null>(null)
  const [addingElement, setAddingElement] = useState(false)
  const [editingElementId, setEditingElementId] = useState<number | null>(null)
  const [allCollapsed, setAllCollapsed] = useState(true)

  const hasElements = (product.sectional_elements?.length ?? 0) > 0

  // Pre-index overrides for O(1) lookup
  const overrideIndex = useMemo(() => buildOverrideIndex(product.choice_overrides || []), [product.choice_overrides])

  const toggle = useCallback((key: string) => {
    setCollapsed(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
    setAllCollapsed(false)
  }, [])

  const collapseAll = useCallback(() => {
    const allKeys = new Set<string>()
    allKeys.add('global')
    for (const el of product.sectional_elements || []) allKeys.add(`el-${el.id}`)
    for (const cfg of product.configurations) {
      allKeys.add(`cfg-${cfg.id}`)
      for (const el of product.sectional_elements || []) allKeys.add(`cfg-${cfg.id}-el-${el.id}`)
    }
    setCollapsed(allKeys)
    setAllCollapsed(true)
  }, [product])

  const expandAll = useCallback(() => {
    setCollapsed(new Set())
    setAllCollapsed(false)
  }, [])

  const downloadJson = useCallback(() => {
    // Strip nulls, undefined, false, 0, empty arrays/objects — keep only truthy or meaningful values
    const strip = (o: Record<string, unknown>): Record<string, unknown> => {
      const r: Record<string, unknown> = {}
      for (const k in o) {
        const v = o[k]
        if (v == null || v === '' || v === false || v === 0) continue
        if (Array.isArray(v) && v.length === 0) continue
        if (typeof v === 'object' && !Array.isArray(v) && Object.keys(v as object).length === 0) continue
        r[k] = v
      }
      return r
    }

    // Normalize tag value to plain string
    const tagStr = (t: unknown): string =>
      typeof t === 'object' && t && 'slug' in t ? (t as {slug: string}).slug : String(t)

    const attributes = product.configurations.map(cfg => {
      const s = cfg.slug || cfg.name
      return strip({
        slug: s,
        name: cfg.display_name || cfg.name,
        config_type: cfg.config_type,
        is_required: cfg.is_required,
        sort_order: cfg.sort_order,
        group: cfg.group,
        attribute_type: cfg.attribute_type,
        variable_group: cfg.variable_group,
        visibility: cfg.visibility,
        always_on: cfg.always_on,
        is_com: cfg.is_com,
        predicate: cfg.predicate,
        display_text: cfg.display_text,
        dynamic_local_menu: cfg.dynamic_local_menu,
        application_methods: cfg.application_methods,
        available_choices_tags: [s],
        search: cfg.search,
        filters: cfg.filters,
        sorting: cfg.sorting,
        default_choice: cfg.default_choice,
        element_id: cfg.element_id,
      })
    })

    // Build predicate "in" tags: predicate_<id> → set of choice slugs
    const inPredicateTags = new Map<string, Set<string>>() // tag → choice slugs
    const predicateTagById = new Map<number, string>()       // predicate id → tag
    for (const pred of product.predicates) {
      if (pred.operator === 'in' && pred.compare_to) {
        const tag = `predicate_${pred.id}`
        const slugs = new Set(pred.compare_to.split(',').map(s => s.trim()).filter(Boolean))
        inPredicateTags.set(tag, slugs)
        predicateTagById.set(pred.id, tag)
      }
    }

    const choices: Record<string, unknown>[] = []
    for (const cfg of product.configurations) {
      const attrTag = cfg.slug || cfg.name
      for (const opt of cfg.options) {
        const choiceSlug = opt.slug || opt.value
        // Merge existing tags with parent attr tag, deduplicated
        const existing = (opt.tags || []).map(tagStr)
        const tags = existing.includes(attrTag) ? existing : [attrTag, ...existing]
        // Add predicate "in" tags where this choice is referenced
        for (const [pTag, slugs] of inPredicateTags) {
          if (slugs.has(choiceSlug) && !tags.includes(pTag)) tags.push(pTag)
        }
        choices.push(strip({
          slug: choiceSlug,
          name: opt.display_name || opt.value,
          price_modifier: opt.price_modifier,
          price_modifier_type: opt.price_modifier_type === 'absolute' ? undefined : opt.price_modifier_type,
          sku_suffix: opt.sku_suffix,
          thumbnail_url: opt.thumbnail_url,
          is_default: opt.is_default,
          sort_order: opt.sort_order,
          icon: opt.icon,
          grade: opt.grade,
          predicate: opt.predicate,
          choice_group: opt.choice_group,
          tags,
          texture_data: opt.texture_data,
          choice_attributes: opt.choice_attributes,
          element_id: opt.element_id,
        }))
      }
    }

    // Map predicates as dict keyed by predicate_key
    const predicatesDict: Record<string, Record<string, unknown>> = {}
    for (const p of product.predicates) {
      const tag = predicateTagById.get(p.id)
      predicatesDict[p.predicate_key] = strip({
        name: p.name,
        type: p.type,
        attribute: p.attribute,
        operator: p.operator,
        compare_to: tag || p.compare_to,
      })
    }

    // Add event condition predicates to the dict
    for (const ev of (product.events || [])) {
      if (ev.predicate_key && ev.condition_attribute) {
        predicatesDict[ev.predicate_key] = strip({
          type: 'variable',
          operator: ev.condition_operator || 'equal',
          attribute: ev.condition_attribute,
          compare_to: ev.condition_compare_to || '',
        })
      }
    }

    // Build events — group actions by trigger_variable
    const eventsOut: Record<string, unknown>[] = []
    if (product.events?.length) {
      const byTrigger = new Map<string, Record<string, unknown>[]>()
      for (const ev of product.events) {
        const trigger = ev.trigger_variable || ''
        if (!byTrigger.has(trigger)) byTrigger.set(trigger, [])
        const action: Record<string, unknown> = {
          source: ev.source_type || 'variable',
          variable: ev.source_variable || '',
          destination: ev.destinations || [],
          type: 'change_variables',
        }
        if (ev.predicate_key) action.predicate = ev.predicate_key
        byTrigger.get(trigger)!.push(action)
      }
      for (const [trigger, actions] of byTrigger) {
        eventsOut.push({
          type: 'variables_change_event',
          variables: [trigger],
          actions,
        })
      }
    }

    // Build element key lookup: element_id → key (name_elementId)
    const elKeyById = new Map<number, string>()
    for (const el of product.sectional_elements || []) {
      if (el.element_id != null) elKeyById.set(el.element_id, elKey(el))
    }

    // Elements with slug/name like attributes and choices
    const elementsOut = (product.sectional_elements || []).map(el => strip({
      slug: elKey(el),
      name: elLabel(el),
      element_id: el.element_id,
      file_id: el.file_id,
    }))

    // Remap default_configuration: replace element_id keys with element names
    const defaultConfig = (product.default_configurations || []).find(dc => dc.config_type === 'default')
    const dcRaw = defaultConfig?.elements as Record<string, unknown> | undefined
    const dcInner = (dcRaw?.configuration ? dcRaw.configuration : dcRaw) as Record<string, unknown> | undefined
    let dcValue: unknown = dcInner
    if (dcInner && Array.isArray(dcInner.elements)) {
      // Remap [{name, variables}] → {name: {variables, name, neighbours}}
      const mapped: Record<string, unknown> = {}
      for (const entry of dcInner.elements as Array<{name?: string; element_id?: number; variables: Record<string, string>}>) {
        const key = entry.name || (entry.element_id != null ? (elKeyById.get(entry.element_id) || String(entry.element_id)) : 'unknown')
        // Find matching element to get neighbours from includes
        const matchEl = (product.sectional_elements || []).find(e =>
          elKey(e) === key || (entry.element_id != null && e.element_id === entry.element_id)
        )
        const nb = (matchEl?.includes as Record<string, unknown>)?.neighbours
        mapped[key] = strip({ variables: entry.variables, name: key, neighbours: nb || undefined })
      }
      dcValue = { elements: mapped }
    }

    // Remap elements_default: replace element_id keys with element names
    const elementsDefault = (product.default_configurations || []).find(dc => dc.config_type === 'elements_default')
    let edValue: unknown = elementsDefault?.elements || null
    if (edValue && typeof edValue === 'object' && 'elements' in (edValue as Record<string, unknown>)) {
      const raw = (edValue as { elements: Record<string, unknown> }).elements
      const mapped: Record<string, unknown> = {}
      for (const [key, val] of Object.entries(raw)) {
        const numKey = Number(key)
        const elKey = !isNaN(numKey) ? (elKeyById.get(numKey) || key) : key
        mapped[elKey] = val
      }
      edValue = { elements: mapped }
    }

    const data = strip({
      attributes,
      choices,
      elements: elementsOut,
      predicates: Object.keys(predicatesDict).length > 0 ? predicatesDict : undefined,
      events: eventsOut.length > 0 ? { events: eventsOut } : undefined,
      choice_overrides: product.choice_overrides || [],
      default_configuration: dcValue || null,
      elements_default: edValue || null,
    })
    // Compact JSON — no whitespace, smaller file
    const blob = new Blob([JSON.stringify(data)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `product_${product.id}_data.json`
    a.click()
    URL.revokeObjectURL(url)
  }, [product])

  const globalConfigs = useMemo(() => product.configurations.filter(c => c.element_id == null), [product.configurations])
  const localConfigsByElement = useMemo(() => {
    const map = new Map<number, ProductConfiguration[]>()
    for (const c of product.configurations) {
      if (c.element_id != null) {
        let arr = map.get(c.element_id)
        if (!arr) { arr = []; map.set(c.element_id, arr) }
        arr.push(c)
      }
    }
    return map
  }, [product.configurations])

  const handleDeleteConfig = useCallback(async (configId: number) => {
    if (!confirm('Usunąć tę konfigurację?')) return
    try {
      await deleteConfiguration(product.id, configId)
      toast.success('Konfiguracja usunięta')
      onUpdate()
    } catch {
      toast.error('Błąd usuwania')
    }
  }, [product.id, onUpdate])

  const handleDeleteElement = useCallback(async (el: SectionalElement) => {
    if (!confirm(`Usunąć element "${elLabel(el)}"?`)) return
    try {
      await deleteElement(product.id, el.id)
      toast.success('Element usunięty')
      onUpdate()
    } catch {
      toast.error('Błąd usuwania elementu')
    }
  }, [product.id, onUpdate])

  return (
    <div>
      {/* Toolbar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h4 style={{ margin: 0 }}>Konfiguracja produktu</h4>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button className="btn btn-secondary btn-sm" onClick={allCollapsed ? expandAll : collapseAll}>
            {allCollapsed ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            {allCollapsed ? ' Rozwiń' : ' Zwiń'}
          </button>
          <button className="btn btn-secondary btn-sm" onClick={downloadJson}>
            <Download size={14} /> Pobierz JSON
          </button>
        </div>
      </div>

      {/* Global attributes section (only shown when elements exist) */}
      {hasElements && (
        <div className="tree-section" style={{ marginBottom: '1rem' }}>
          <div className="tree-node-header" onClick={() => toggle('global')}>
            {collapsed.has('global') ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
            <span style={{ fontWeight: 600 }}>🌐 Atrybuty globalne</span>
            <span className="scope-badge-global">{globalConfigs.length}</span>
          </div>
          {!collapsed.has('global') && (
            <div className="tree-section">
              {globalConfigs.map(cfg => (
                <AttributeNode
                  key={cfg.id}
                  productId={product.id}
                  config={cfg}
                  collapsed={collapsed.has(`cfg-${cfg.id}`)}
                  onToggle={toggle}
                  toggleKey={`cfg-${cfg.id}`}
                  onDelete={handleDeleteConfig}
                  overrideIndex={overrideIndex}
                  isSectional={hasElements}
                  onUpdate={onUpdate}
                />
              ))}
              {!addingGlobalAttr && (
                <button className="btn btn-primary btn-sm" onClick={() => setAddingGlobalAttr(true)} style={{ marginTop: '0.5rem' }}>
                  <Plus size={14} /> Dodaj globalny atrybut
                </button>
              )}
              {addingGlobalAttr && (
                <AddAttributeForm
                  productId={product.id}
                  elementId={undefined}
                  onDone={() => { setAddingGlobalAttr(false); onUpdate() }}
                  onCancel={() => setAddingGlobalAttr(false)}
                />
              )}
            </div>
          )}
        </div>
      )}

      {/* Per-element sections */}
      {(product.sectional_elements || []).map(el => {
        const ek = `el-${el.id}`
        const isElCollapsed = collapsed.has(ek)
        const elLocalConfigs = localConfigsByElement.get(el.element_id!) || []
        const isEditing = editingElementId === el.id
        return (
          <div key={el.id} className="tree-section" style={{ marginBottom: '1rem' }}>
            <div className="tree-node-header" onClick={() => toggle(ek)}>
              {isElCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
              <span style={{ fontWeight: 600 }}>📦 {elLabel(el)}</span>
              <span className="badge badge-secondary" style={{ fontSize: '0.65rem' }}>{elKey(el)}</span>
              <span className="badge badge-info" style={{ fontSize: '0.7rem' }}>ID: {el.element_id}</span>
              <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.25rem' }}>
                <button className="btn btn-secondary btn-sm btn-icon" onClick={(e) => { e.stopPropagation(); setEditingElementId(isEditing ? null : el.id) }} title="Edytuj">
                  <Edit2 size={14} />
                </button>
                <button className="btn btn-danger btn-sm btn-icon" onClick={(e) => { e.stopPropagation(); handleDeleteElement(el) }} title="Usuń">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
            {isEditing && (
              <EditElementForm
                productId={product.id}
                element={el}
                allElements={product.sectional_elements || []}
                onDone={() => { setEditingElementId(null); onUpdate() }}
                onCancel={() => setEditingElementId(null)}
              />
            )}
            {!isElCollapsed && !isEditing && (
              <div className="tree-section">
                {globalConfigs.map(cfg => (
                  <AttributeNode
                    key={`${el.id}-${cfg.id}`}
                    productId={product.id}
                    config={cfg}
                    collapsed={collapsed.has(`cfg-${cfg.id}-el-${el.id}`)}
                    onToggle={toggle}
                    toggleKey={`cfg-${cfg.id}-el-${el.id}`}
                    overrideIndex={overrideIndex}
                    elementId={el.element_id!}
                    isSectional={true}
                    isGlobalInElement={true}
                    onUpdate={onUpdate}
                  />
                ))}
                {elLocalConfigs.map(cfg => (
                  <AttributeNode
                    key={cfg.id}
                    productId={product.id}
                    config={cfg}
                    collapsed={collapsed.has(`cfg-${cfg.id}`)}
                    onToggle={toggle}
                    toggleKey={`cfg-${cfg.id}`}
                    onDelete={handleDeleteConfig}
                    overrideIndex={overrideIndex}
                    elementId={el.element_id!}
                    isSectional={true}
                    onUpdate={onUpdate}
                  />
                ))}
                {addingLocalAttr !== el.element_id && (
                  <button className="btn btn-primary btn-sm" onClick={() => setAddingLocalAttr(el.element_id!)} style={{ marginTop: '0.5rem' }}>
                    <Plus size={14} /> Dodaj atrybut
                  </button>
                )}
                {addingLocalAttr === el.element_id && (
                  <AddAttributeForm
                    productId={product.id}
                    elementId={el.element_id!}
                    onDone={() => { setAddingLocalAttr(null); onUpdate() }}
                    onCancel={() => setAddingLocalAttr(null)}
                  />
                )}
              </div>
            )}
          </div>
        )
      })}

      {/* Add element button — always visible */}
      {!addingElement && (
        <button className="btn btn-primary btn-sm" onClick={() => setAddingElement(true)} style={{ marginTop: '0.5rem' }}>
          <Plus size={14} /> Dodaj element
        </button>
      )}
      {addingElement && (
        <AddElementForm
          productId={product.id}
          elements={product.sectional_elements || []}
          onDone={() => { setAddingElement(false); onUpdate() }}
          onCancel={() => setAddingElement(false)}
        />
      )}

      {!hasElements && (
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '0.5rem' }}>
          Brak elementów. Dodaj pierwszy element, aby móc tworzyć atrybuty i opcje.
        </p>
      )}
    </div>
  )
}

/* ============================================================
   AttributeNode — one configuration (collapsible) with choices
   Memoized: only re-renders when its own props change
   ============================================================ */

const AttributeNode = memo(function AttributeNode({
  productId,
  config,
  collapsed,
  onToggle,
  toggleKey,
  onDelete,
  overrideIndex,
  elementId,
  isSectional,
  isGlobalInElement,
  onUpdate,
}: {
  productId: number
  config: ProductConfiguration
  collapsed: boolean
  onToggle: (key: string) => void
  toggleKey: string
  onDelete?: (configId: number) => void
  overrideIndex: OverrideIndex
  elementId?: number
  isSectional: boolean
  isGlobalInElement?: boolean
  onUpdate: () => void
}) {
  const isLocal = config.element_id != null
  const label = isGlobalInElement ? 'globalny' : isLocal ? 'lokalny' : undefined

  const handleToggle = useCallback(() => onToggle(toggleKey), [onToggle, toggleKey])
  const handleDelete = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    if (onDelete && config.id != null) onDelete(config.id)
  }, [onDelete, config.id])

  return (
    <div style={{ marginBottom: '0.5rem' }}>
      <div className="tree-node-header" onClick={handleToggle}>
        {collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
        <span>📋 {config.display_name || config.name}</span>
        <span className="badge badge-secondary" style={{ fontSize: '0.7rem' }}>{config.config_type}</span>
        {label && (
          <span className={label === 'globalny' ? 'scope-badge-global' : 'scope-badge-local'}>{label}</span>
        )}
        {config.is_required && <span className="badge badge-warning" style={{ fontSize: '0.7rem' }}>Wymagane</span>}
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>({config.options.length})</span>
        {onDelete && (
          <button className="btn btn-danger btn-sm btn-icon" onClick={handleDelete} style={{ marginLeft: 'auto' }}>
            <Trash2 size={14} />
          </button>
        )}
      </div>
      {!collapsed && (
        <div style={{ paddingLeft: '1.5rem' }}>
          {config.options.map(opt => (
            <ChoiceRow
              key={opt.id}
              productId={productId}
              option={opt}
              configId={config.id}
              overrideIndex={overrideIndex}
              elementId={elementId}
              isSectional={isSectional}
              onUpdate={onUpdate}
            />
          ))}
          {config.options.length === 0 && (
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', padding: '0.25rem 0' }}>Brak opcji</div>
          )}
        </div>
      )}
    </div>
  )
})

/* ============================================================
   ChoiceRow — single choice with deactivation toggle
   Memoized: uses pre-indexed override lookup
   ============================================================ */

const ChoiceRow = memo(function ChoiceRow({
  productId,
  option,
  configId,
  overrideIndex,
  elementId,
  isSectional,
  onUpdate,
}: {
  productId: number
  option: ConfigurationOption
  configId?: number
  overrideIndex: OverrideIndex
  elementId?: number
  isSectional: boolean
  onUpdate: () => void
}) {
  const [scopeOpen, setScopeOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  const override = option.id ? lookupOverride(overrideIndex, option.id, elementId, configId) : undefined
  const isDisabled = override && !override.active

  const handleDisable = useCallback(async (scope: 'product' | 'element' | 'config') => {
    if (!option.id) return
    setLoading(true)
    try {
      await createChoiceOverride(productId, {
        option_id: option.id,
        element_id: scope === 'product' ? undefined : elementId,
        configuration_id: scope === 'config' ? configId : undefined,
        active: false,
      })
      toast.success('Choice wyłączony')
      onUpdate()
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string } } }
      const detail = error.response?.data?.detail
      if (detail) {
        toast.error(detail, { duration: 8000 })
      } else {
        toast.error('Błąd wyłączania choice')
      }
    } finally {
      setLoading(false)
      setScopeOpen(false)
    }
  }, [option.id, productId, elementId, configId, onUpdate])

  const handleEnable = useCallback(async () => {
    if (!override) return
    setLoading(true)
    try {
      await deleteChoiceOverride(productId, override.id)
      toast.success('Choice włączony')
      onUpdate()
    } catch {
      toast.error('Błąd')
    } finally {
      setLoading(false)
    }
  }, [override, productId, onUpdate])

  const scopeLabel = override
    ? override.configuration_id != null ? 'per atrybut' : override.element_id != null ? 'per element' : 'per produkt'
    : ''

  return (
    <div className={`choice-row-tree ${isDisabled ? 'choice-deactivated' : ''}`}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1 }}>
        <span style={{ fontSize: '0.85rem' }}>
          {isDisabled ? '☐' : '☑'} {option.display_name || option.value}
        </span>
        {option.price_modifier !== 0 && (
          <span style={{ fontSize: '0.75rem', color: option.price_modifier > 0 ? 'var(--danger)' : 'var(--success)' }}>
            {option.price_modifier > 0 ? '+' : ''}{option.price_modifier}
            {option.price_modifier_type === 'percentage' ? '%' : ' USD'}
          </span>
        )}
        {isDisabled && (
          <span className="badge badge-danger" style={{ fontSize: '0.65rem' }}>{scopeLabel}</span>
        )}
      </div>
      <div style={{ display: 'flex', gap: '0.25rem', position: 'relative' }}>
        {isDisabled ? (
          <button className="btn btn-success btn-sm" onClick={handleEnable} disabled={loading} style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}>
            włącz
          </button>
        ) : (
          <div style={{ position: 'relative' }}>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => setScopeOpen(!scopeOpen)}
              disabled={loading}
              style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}
            >
              wyłącz ▼
            </button>
            {scopeOpen && (
              <div className="scope-dropdown">
                <button onClick={() => handleDisable('product')}>Per produkt</button>
                {isSectional && elementId != null && (
                  <>
                    <button onClick={() => handleDisable('element')}>Per element</button>
                    <button onClick={() => handleDisable('config')}>Tylko tutaj</button>
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
})

/* ============================================================
   AddAttributeForm — add a new configuration (attribute)
   ============================================================ */

function AddAttributeForm({
  productId,
  elementId,
  onDone,
  onCancel,
}: {
  productId: number
  elementId?: number
  onDone: () => void
  onCancel: () => void
}) {
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
      await addConfiguration(productId, { ...form, element_id: elementId ?? null })
      toast.success('Konfiguracja dodana')
      onDone()
    } catch {
      toast.error('Błąd zapisu konfiguracji')
    }
  }

  return (
    <div className="config-item" style={{ borderColor: 'var(--primary)', marginTop: '0.5rem' }}>
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
        <button className="btn btn-secondary" onClick={onCancel}>Anuluj</button>
        <button className="btn btn-primary" onClick={handleSave}>
          <Save size={14} /> Zapisz konfigurację
        </button>
      </div>
    </div>
  )
}

/* ============================================================
   AddElementForm — add a new sectional element
   ============================================================ */

function AddElementForm({
  productId,
  elements,
  onDone,
  onCancel,
}: {
  productId: number
  elements: SectionalElement[]
  onDone: () => void
  onCancel: () => void
}) {
  const [form, setForm] = useState({ element_id: 0, name: '', display_name: '', file_id: '' })

  const handleAdd = async () => {
    if (!form.name) {
      toast.error('Nazwa (klucz) elementu jest wymagana')
      return
    }
    try {
      const nextId = elements.length > 0
        ? Math.max(...elements.map(e => e.element_id ?? 0)) + 1
        : 1
      await addElement(productId, {
        element_id: form.element_id || nextId,
        name: form.name,
        display_name: form.display_name || undefined,
        file_id: form.file_id || undefined,
      })
      toast.success('Element dodany')
      onDone()
    } catch {
      toast.error('Błąd dodawania elementu')
    }
  }

  return (
    <div className="config-item" style={{ borderColor: 'var(--primary)', marginTop: '0.5rem' }}>
      <div className="form-row">
        <div className="form-group">
          <label className="form-label">Nazwa (klucz) *</label>
          <input className="form-input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="np. left_chair" />
        </div>
        <div className="form-group">
          <label className="form-label">Nazwa wyświetlana</label>
          <input className="form-input" value={form.display_name} onChange={e => setForm(f => ({ ...f, display_name: e.target.value }))} placeholder="np. Fotel lewy" />
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
        <button className="btn btn-secondary" onClick={onCancel}>Anuluj</button>
        <button className="btn btn-primary" onClick={handleAdd}>
          <Save size={14} /> Dodaj element
        </button>
      </div>
    </div>
  )
}

/* ============================================================
   EditElementForm — edit element fields + neighbours
   ============================================================ */

const DIRECTIONS = ['front', 'back', 'left', 'right'] as const

function EditElementForm({
  productId,
  element,
  allElements,
  onDone,
  onCancel,
}: {
  productId: number
  element: SectionalElement
  allElements: SectionalElement[]
  onDone: () => void
  onCancel: () => void
}) {
  const [form, setForm] = useState({
    name: element.name || '',
    display_name: element.display_name || '',
    file_id: element.file_id || '',
  })
  const [neighbours, setNeighbours] = useState<Record<string, string>>(() => {
    const inc = element.includes as Record<string, unknown> | undefined
    const nb = (inc?.neighbours || {}) as Record<string, string>
    return { front: nb.front || '', back: nb.back || '', left: nb.left || '', right: nb.right || '' }
  })
  const [saving, setSaving] = useState(false)

  const otherElements = allElements.filter(e => e.id !== element.id)

  const handleSave = async () => {
    if (!form.name) {
      toast.error('Nazwa (klucz) jest wymagana')
      return
    }
    setSaving(true)
    try {
      // Build neighbours, strip empty
      const nb: Record<string, string> = {}
      for (const dir of DIRECTIONS) {
        if (neighbours[dir]) nb[dir] = neighbours[dir]
      }
      const includes = { ...(element.includes as Record<string, unknown> || {}), neighbours: Object.keys(nb).length > 0 ? nb : undefined }
      await updateElement(productId, element.id, {
        name: form.name,
        display_name: form.display_name || undefined,
        file_id: form.file_id || undefined,
        includes,
      })
      toast.success('Element zaktualizowany')
      onDone()
    } catch {
      toast.error('Błąd zapisu')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="config-item" style={{ borderColor: 'var(--primary)', marginTop: '0.25rem' }}>
      <div className="form-row">
        <div className="form-group">
          <label className="form-label">Nazwa (klucz) *</label>
          <input className="form-input" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
        </div>
        <div className="form-group">
          <label className="form-label">Nazwa wyświetlana</label>
          <input className="form-input" value={form.display_name} onChange={e => setForm(f => ({ ...f, display_name: e.target.value }))} />
        </div>
        <div className="form-group">
          <label className="form-label">File ID</label>
          <input className="form-input" value={form.file_id} onChange={e => setForm(f => ({ ...f, file_id: e.target.value }))} />
        </div>
      </div>

      {/* Neighbours editor */}
      <div style={{ marginTop: '0.75rem' }}>
        <div style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.5rem' }}>Sąsiedzi (neighbours)</div>
        <div className="form-row">
          {DIRECTIONS.map(dir => (
            <div className="form-group" key={dir} style={{ flex: '1 1 0' }}>
              <label className="form-label" style={{ textTransform: 'capitalize' }}>{dir}</label>
              <select className="form-select" value={neighbours[dir]} onChange={e => setNeighbours(prev => ({ ...prev, [dir]: e.target.value }))}>
                <option value="">— brak —</option>
                {otherElements.map(oe => (
                  <option key={oe.id} value={elKey(oe)}>{elLabel(oe)} ({elKey(oe)})</option>
                ))}
              </select>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem', justifyContent: 'flex-end' }}>
        <button className="btn btn-secondary" onClick={onCancel}>Anuluj</button>
        <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
          <Save size={14} /> {saving ? 'Zapisuję...' : 'Zapisz'}
        </button>
      </div>
    </div>
  )
}

/* ============================================================
   PredicateEditor — kept as separate component (unchanged)
   ============================================================ */

function PredicateEditor({
  productId,
  predicates,
  configurations,
  onUpdate,
}: {
  productId: number
  predicates: ProductPredicate[]
  configurations: ProductConfiguration[]
  onUpdate: () => void
}) {
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [showJson, setShowJson] = useState(false)
  const [copiedKey, setCopiedKey] = useState<string | null>(null)

  const [form, setForm] = useState({
    targetAttr: '',
    targetChoice: '',
    sourceAttr: '',
    operator: 'equal',
    compareTo: '',
  })

  const OPERATORS: Record<string, string> = {
    equal: 'jest równy',
    not_equal: 'nie jest równy',
    in: 'jest jednym z',
    not_in: 'nie jest jednym z',
  }

  const getConfig = (slug: string) => configurations.find(c => (c.slug || c.name) === slug)
  const getChoices = (slug: string) => getConfig(slug)?.options.map(o => o.slug || o.value) || []
  const getConfigLabel = (slug: string) => {
    const cfg = getConfig(slug)
    return cfg?.display_name || cfg?.name || slug
  }

  const sourceChoices = getChoices(form.sourceAttr)
  const targetChoices = form.targetAttr
    ? getChoices(form.targetAttr)
    : [...new Set(configurations.flatMap(c => c.options.map(o => o.slug || o.value)))]
  const compareValues = form.compareTo ? form.compareTo.split(',').map(s => s.trim()).filter(Boolean) : []

  const toggleCompareValue = (val: string) => {
    setForm(f => {
      const current = f.compareTo ? f.compareTo.split(',').map(s => s.trim()).filter(Boolean) : []
      const next = current.includes(val) ? current.filter(v => v !== val) : [...current, val]
      return { ...f, compareTo: next.join(',') }
    })
  }

  const handleTargetAttrChange = (val: string) => {
    setForm(f => {
      const next = { ...f, targetAttr: val, targetChoice: '' }
      if (f.sourceAttr === val && !f.targetChoice) {
        next.sourceAttr = ''
        next.compareTo = ''
      }
      return next
    })
  }

  const handleSourceAttrChange = (val: string) => {
    setForm(f => ({ ...f, sourceAttr: val, compareTo: '' }))
  }

  const handleOperatorChange = (val: string) => {
    setForm(f => ({ ...f, operator: val, compareTo: '' }))
  }

  const availableSourceAttrs = configurations.filter(cfg => {
    const slug = cfg.slug || cfg.name
    if (!form.targetChoice && slug === form.targetAttr) return false
    return true
  })

  const getFilteredSourceChoices = () => {
    if (form.sourceAttr !== form.targetAttr || !form.targetChoice) return sourceChoices
    return sourceChoices.filter(v => v !== form.targetChoice)
  }
  const filteredSourceChoices = getFilteredSourceChoices()

  const isGlobalPredicate = form.sourceAttr === '__product__'

  const getValidationError = (): string | null => {
    if (!form.targetAttr && !form.targetChoice) return 'Wybierz atrybut lub opcję docelową (co ma się wyszarzyć)'
    if (!form.sourceAttr) return 'Wybierz atrybut warunku (kiedy)'
    // Global predicate = no condition needed, always disabled
    if (isGlobalPredicate) return null
    if (!form.compareTo) return 'Wybierz wartość do porównania'

    if (!form.targetChoice && form.sourceAttr === form.targetAttr) {
      return 'Nie można wyszarzyć całego atrybutu warunkiem na ten sam atrybut — powstanie blokada (nie da się zmienić wartości ukrytego atrybutu)'
    }

    if (form.targetChoice && form.sourceAttr === form.targetAttr) {
      const vals = form.compareTo.split(',').map(s => s.trim())
      if (vals.includes(form.targetChoice)) {
        if (form.operator === 'equal' || form.operator === 'in') {
          return `Opcja "${form.targetChoice}" nie może zależeć od siebie z operatorem "${OPERATORS[form.operator]}" — byłaby dostępna tylko gdy jest już wybrana`
        }
        if (form.operator === 'not_equal' || form.operator === 'not_in') {
          return `Opcja "${form.targetChoice}" nie może zależeć od siebie z operatorem "${OPERATORS[form.operator]}" — wybranie jej natychmiast ją wyłączy`
        }
      }
    }

    return null
  }

  const validationError = getValidationError()

  const findConfigId = (slug: string): number | null => {
    const cfg = configurations.find(c => (c.slug || c.name) === slug)
    return cfg?.id ?? null
  }

  const findOptionId = (configSlug: string, optionValue: string): number | null => {
    const cfg = configurations.find(c => (c.slug || c.name) === configSlug)
    if (!cfg) return null
    const opt = cfg.options.find(o => (o.slug || o.value) === optionValue)
    return opt?.id ?? null
  }

  const assignToTarget = async (key: string, targetAttr: string, targetChoice: string) => {
    if (targetChoice && targetAttr) {
      // Choice within a specific attribute
      const optId = findOptionId(targetAttr, targetChoice)
      if (optId != null) await setOptionPredicate(productId, optId, key)
    } else if (targetChoice && !targetAttr) {
      // Choice without attribute — assign to ALL matching options across all configs
      for (const cfg of configurations) {
        for (const opt of cfg.options) {
          if ((opt.slug || opt.value) === targetChoice && opt.id != null) {
            await setOptionPredicate(productId, opt.id, key)
          }
        }
      }
    } else if (targetAttr) {
      const cfgId = findConfigId(targetAttr)
      if (cfgId != null) await setConfigPredicate(productId, cfgId, key)
    }
  }

  const clearOldAssignment = async (key: string) => {
    for (const cfg of configurations) {
      if (cfg.predicate === key && cfg.id != null) {
        await setConfigPredicate(productId, cfg.id, null)
      }
      for (const opt of cfg.options) {
        if (opt.predicate === key && opt.id != null) {
          await setOptionPredicate(productId, opt.id, null)
        }
      }
    }
  }

  const getUsage = (key: string) => {
    const refs: { label: string; type: 'option' | 'attribute' }[] = []
    for (const cfg of configurations) {
      if (cfg.predicate === key) {
        refs.push({ label: cfg.display_name || cfg.name, type: 'attribute' })
      }
      for (const opt of cfg.options) {
        if (opt.predicate === key) {
          refs.push({ label: `${opt.display_name || opt.value} (${cfg.display_name || cfg.name})`, type: 'option' })
        }
      }
    }
    return refs
  }

  const genKey = () => {
    const target = form.targetChoice || form.targetAttr
    if (!target || !form.sourceAttr) return `pred_${Date.now()}`
    if (isGlobalPredicate) return `pred_${target}_always`.replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase()
    return `pred_${target}_${form.sourceAttr}_${form.operator}`.replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase()
  }

  const genName = () => {
    const targetLabel = form.targetChoice
      ? form.targetAttr
        ? `"${form.targetChoice}" w "${getConfigLabel(form.targetAttr)}"`
        : `"${form.targetChoice}" (wszystkie atrybuty)`
      : `atrybut "${getConfigLabel(form.targetAttr)}"`
    if (isGlobalPredicate) return `Wyszarz ${targetLabel} — zawsze (cały produkt)`
    const op = OPERATORS[form.operator] || form.operator
    const vals = form.compareTo || '?'
    return `Wyszarz ${targetLabel} gdy "${getConfigLabel(form.sourceAttr)}" ${op} "${vals}"`
  }

  const resetForm = () => setForm({ targetAttr: '', targetChoice: '', sourceAttr: '', operator: 'equal', compareTo: '' })

  const startAdd = () => {
    setAdding(true)
    setEditingId(null)
    resetForm()
  }

  const startEdit = (pred: ProductPredicate) => {
    setEditingId(pred.id)
    setAdding(false)
    let targetAttr = ''
    let targetChoice = ''
    for (const cfg of configurations) {
      if (cfg.predicate === pred.predicate_key) {
        targetAttr = cfg.slug || cfg.name
        break
      }
      for (const opt of cfg.options) {
        if (opt.predicate === pred.predicate_key) {
          targetAttr = cfg.slug || cfg.name
          targetChoice = opt.slug || opt.value
          break
        }
      }
      if (targetAttr) break
    }
    if (!targetAttr && pred.predicate_key.startsWith('pred_')) {
      const parts = pred.predicate_key.replace('pred_', '').split('_')
      if (parts.length >= 1) {
        const candidate = parts[0]
        const match = configurations.find(c => (c.slug || c.name) === candidate)
        if (match) targetAttr = candidate
        // If no match, check if it's a choice slug
        if (!match) {
          const isChoice = configurations.some(c => c.options.some(o => (o.slug || o.value) === candidate))
          if (isChoice) targetChoice = candidate
        }
      }
    }
    const isAlways = !pred.attribute || pred.type === 'always'
    setForm({
      targetAttr,
      targetChoice,
      sourceAttr: isAlways ? '__product__' : (pred.attribute || ''),
      operator: isAlways ? 'equal' : (pred.operator || 'equal'),
      compareTo: isAlways ? '' : (pred.compare_to || ''),
    })
  }

  const cancel = () => {
    setAdding(false)
    setEditingId(null)
    resetForm()
  }

  const handleSave = async () => {
    if (validationError) {
      toast.error(validationError)
      return
    }
    try {
      const key = editingId != null
        ? (predicates.find(p => p.id === editingId)?.predicate_key || genKey())
        : genKey()
      const payload = {
        predicate_key: key,
        name: genName(),
        type: isGlobalPredicate ? 'always' : 'variable',
        attribute: isGlobalPredicate ? '' : form.sourceAttr,
        operator: isGlobalPredicate ? '' : form.operator,
        compare_to: isGlobalPredicate ? '' : form.compareTo,
      }
      if (editingId != null) {
        await clearOldAssignment(key)
        await updatePredicate(productId, editingId, payload)
        toast.success('Reguła zaktualizowana')
      } else {
        await addPredicate(productId, payload)
        toast.success('Reguła dodana')
      }
      if (form.targetAttr || form.targetChoice) {
        await assignToTarget(key, form.targetAttr, form.targetChoice)
      }
      cancel()
      onUpdate()
    } catch {
      toast.error('Błąd zapisu reguły')
    }
  }

  const handleDelete = async (pred: ProductPredicate) => {
    if (!confirm(`Usunąć regułę "${pred.predicate_key}"?`)) return
    try {
      await deletePredicate(productId, pred.id)
      toast.success('Reguła usunięta')
      onUpdate()
    } catch {
      toast.error('Błąd usuwania reguły')
    }
  }

  const copyKey = (key: string) => {
    navigator.clipboard.writeText(key)
    setCopiedKey(key)
    setTimeout(() => setCopiedKey(null), 2000)
    toast.success('Klucz skopiowany')
  }

  const predicatesDict = useMemo(() => {
    const dict: Record<string, Record<string, unknown>> = {}
    for (const p of predicates) {
      const entry: Record<string, unknown> = {}
      if (p.name) entry.name = p.name
      if (p.type) entry.type = p.type
      if (p.attribute) entry.attribute = p.attribute
      if (p.operator) entry.operator = p.operator
      if (p.compare_to) entry.compare_to = p.compare_to
      dict[p.predicate_key] = entry
    }
    return dict
  }, [predicates])

  const downloadJson = () => {
    const blob = new Blob([JSON.stringify(predicatesDict, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `predicates_product_${productId}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const showForm = adding || editingId != null

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h4 style={{ margin: 0 }}>Reguły wyszarzania ({predicates.length})</h4>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {predicates.length > 0 && (
            <>
              <button className="btn btn-secondary btn-sm" onClick={() => setShowJson(v => !v)}>
                {showJson ? <EyeOff size={14} /> : <Eye size={14} />}
                {showJson ? ' Ukryj JSON' : ' Podgląd JSON'}
              </button>
              <button className="btn btn-secondary btn-sm" onClick={downloadJson}>
                <Download size={14} /> Pobierz JSON
              </button>
            </>
          )}
          {!showForm && (
            <button className="btn btn-primary btn-sm" onClick={startAdd}>
              <Plus size={14} /> Dodaj regułę
            </button>
          )}
        </div>
      </div>

      {(() => {
        const formJSX = showForm ? (
          <div className="config-item" style={{ borderColor: 'var(--primary)' }}>
            <div style={{ fontWeight: 600, fontSize: '1rem', marginBottom: '1rem' }}>
              {adding ? 'Nowa reguła wyszarzania' : 'Edytuj regułę'}
            </div>

            <div style={{ marginBottom: '1.25rem' }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                1. Co ma się wyszarzyć?
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Atrybut (opcjonalnie)</label>
                  <select className="form-select" value={form.targetAttr} onChange={e => handleTargetAttrChange(e.target.value)}>
                    <option value="">— wszystkie atrybuty —</option>
                    {configurations.map(cfg => (
                      <option key={cfg.id ?? (cfg.slug || cfg.name)} value={cfg.slug || cfg.name}>
                        {cfg.display_name || cfg.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Opcja {form.targetAttr ? '(opcjonalnie)' : '*'}</label>
                  <select className="form-select" value={form.targetChoice} onChange={e => setForm(f => ({ ...f, targetChoice: e.target.value, compareTo: f.sourceAttr === f.targetAttr ? '' : f.compareTo }))}>
                    <option value="">{form.targetAttr ? 'Cały atrybut' : '— wybierz opcję —'}</option>
                    {targetChoices.map(v => (
                      <option key={v} value={v}>{v}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {(form.targetAttr || form.targetChoice) && (
              <div style={{ marginBottom: '0.75rem' }}>
                <div style={{ fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                  2. Kiedy ma się wyszarzyć?
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Gdy atrybut *</label>
                    <select className="form-select" value={form.sourceAttr} onChange={e => handleSourceAttrChange(e.target.value)}>
                      <option value="">— wybierz atrybut —</option>
                      <option value="__product__">Cały produkt (zawsze wyszarzony)</option>
                      {availableSourceAttrs.map(cfg => (
                        <option key={cfg.id ?? (cfg.slug || cfg.name)} value={cfg.slug || cfg.name}>
                          {cfg.display_name || cfg.name}
                          {(cfg.slug || cfg.name) === form.targetAttr ? ' (ten sam)' : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                  {!isGlobalPredicate && (
                    <div className="form-group">
                      <label className="form-label">Warunek</label>
                      <select className="form-select" value={form.operator} onChange={e => handleOperatorChange(e.target.value)}>
                        {Object.entries(OPERATORS).map(([val, label]) => (
                          <option key={val} value={val}>{label}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                {isGlobalPredicate && (
                  <div style={{ padding: '0.5rem 0.75rem', background: 'rgba(255,152,0,0.08)', border: '1px solid rgba(255,152,0,0.25)', borderRadius: '6px', fontSize: '0.85rem', color: 'var(--warning)', marginTop: '0.5rem' }}>
                    Brak warunku — choice będzie zawsze wyszarzony na całym produkcie.
                  </div>
                )}

                {form.sourceAttr && !isGlobalPredicate && (
                  <div style={{ marginTop: '0.5rem' }}>
                    <label className="form-label">
                      {form.operator === 'in' || form.operator === 'not_in' ? 'Ma jedną z wartości: *' : 'Ma wartość: *'}
                    </label>

                    {(form.operator === 'equal' || form.operator === 'not_equal') && filteredSourceChoices.length > 0 ? (
                      <select className="form-select" value={form.compareTo} onChange={e => setForm(f => ({ ...f, compareTo: e.target.value }))}>
                        <option value="">— wybierz wartość —</option>
                        {filteredSourceChoices.map(v => (
                          <option key={v} value={v}>{v}</option>
                        ))}
                      </select>
                    ) : (form.operator === 'in' || form.operator === 'not_in') && filteredSourceChoices.length > 0 ? (
                      <div style={{ maxHeight: 160, overflow: 'auto', border: '1px solid var(--border)', borderRadius: '6px', padding: '0.5rem' }}>
                        {filteredSourceChoices.map(v => (
                          <label key={v} className="checkbox-label" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.2rem 0', fontSize: '0.85rem' }}>
                            <input type="checkbox" checked={compareValues.includes(v)} onChange={() => toggleCompareValue(v)} />
                            {v}
                          </label>
                        ))}
                      </div>
                    ) : (
                      <input
                        className="form-input"
                        value={form.compareTo}
                        onChange={e => setForm(f => ({ ...f, compareTo: e.target.value }))}
                        placeholder={form.operator === 'in' || form.operator === 'not_in' ? 'wartość1, wartość2, ...' : 'wartość'}
                      />
                    )}
                  </div>
                )}
              </div>
            )}

            {validationError && form.sourceAttr && (
              <div style={{ padding: '0.5rem 0.75rem', background: 'rgba(220,53,69,0.08)', border: '1px solid rgba(220,53,69,0.25)', borderRadius: '6px', fontSize: '0.85rem', color: 'var(--danger)', marginBottom: '0.75rem' }}>
                {validationError}
              </div>
            )}

            {!validationError && form.sourceAttr && (form.compareTo || isGlobalPredicate) && (form.targetAttr || form.targetChoice) && (
              <div style={{ padding: '0.6rem 0.85rem', background: 'var(--bg-hover)', borderRadius: '6px', fontSize: '0.85rem', marginBottom: '0.75rem' }}>
                <div><strong>Podgląd:</strong> {genName()}</div>
                <div style={{ color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                  Klucz: <code>{editingId != null ? predicates.find(p => p.id === editingId)?.predicate_key : genKey()}</code>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={cancel}>Anuluj</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={!!validationError}>
                <Save size={14} /> {editingId != null ? 'Zapisz zmiany' : 'Dodaj regułę'}
              </button>
            </div>
          </div>
        ) : null

        return (
          <>
            {predicates.map(pred => {
              const usage = getUsage(pred.predicate_key)
              const op = OPERATORS[pred.operator || ''] || pred.operator || '?'
              return (
                <div key={pred.id}>
                  <div className="config-item" style={editingId === pred.id ? { borderColor: 'var(--primary)', opacity: 0.5 } : {}}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '0.95rem', marginBottom: '0.4rem' }}>
                          {pred.name || pred.predicate_key}
                        </div>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>
                          {pred.type === 'always' && !pred.attribute
                            ? <>Warunek: <strong>zawsze wyszarzony</strong> (cały produkt)</>
                            : pred.attribute && pred.compare_to
                              ? <>Warunek: gdy <strong>{getConfigLabel(pred.attribute)}</strong> {op} <strong>{pred.compare_to}</strong></>
                              : <span style={{ color: 'var(--warning)' }}>Bez warunku — wymaga uzupełnienia</span>
                          }
                        </div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                          Klucz: <code style={{ background: 'var(--bg-hover)', padding: '0.1rem 0.35rem', borderRadius: '3px' }}>{pred.predicate_key}</code>
                          <button
                            onClick={() => copyKey(pred.predicate_key)}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '0.1rem', color: 'var(--text-muted)', display: 'inline-flex' }}
                            title="Kopiuj klucz"
                          >
                            {copiedKey === pred.predicate_key ? <Check size={12} /> : <Copy size={12} />}
                          </button>
                        </div>
                        {usage.length > 0 ? (
                          <div style={{ fontSize: '0.8rem', marginTop: '0.3rem', color: 'var(--success)' }}>
                            Przypisany do: {usage.map(u => u.label).join(', ')}
                          </div>
                        ) : (
                          <div style={{ fontSize: '0.8rem', marginTop: '0.3rem', color: 'var(--warning)' }}>
                            Nieprzypisany — ustaw klucz w opcji lub atrybucie
                          </div>
                        )}
                      </div>
                      <div style={{ display: 'flex', gap: '0.25rem', marginLeft: '0.5rem' }}>
                        <button className="btn btn-secondary btn-sm btn-icon" onClick={() => startEdit(pred)} title="Edytuj">
                          <Edit2 size={14} />
                        </button>
                        <button className="btn btn-danger btn-sm btn-icon" onClick={() => handleDelete(pred)} title="Usuń">
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  </div>
                  {editingId === pred.id && formJSX}
                </div>
              )
            })}
            {adding && formJSX}
          </>
        )
      })()}

      {showJson && predicates.length > 0 && (
        <div style={{ marginTop: '1rem' }}>
          <pre style={{ fontSize: '0.8rem', overflow: 'auto', maxHeight: 350, background: 'var(--bg-hover)', padding: '1rem', borderRadius: '6px', margin: 0 }}>
            {JSON.stringify(predicatesDict, null, 2)}
          </pre>
        </div>
      )}

      {predicates.length === 0 && !showForm && (
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
          Brak reguł. Dodaj regułę, aby kontrolować widoczność opcji w konfiguratorze.
        </p>
      )}
    </div>
  )
}

/* ============================================================
   EventEditor — manage event rules (change variable → copy value)
   ============================================================ */

function EventEditor({
  productId,
  events,
  configurations,
  onUpdate,
}: {
  productId: number
  events: ProductEvent[]
  configurations: ProductConfiguration[]
  onUpdate: () => void
}) {
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState({
    triggerVariable: '',
    sourceType: 'variable' as 'variable' | 'value',
    sourceVariable: '',
    destinations: [] as string[],
    conditionAttribute: '',
    conditionOperator: 'equal',
    conditionCompareTo: '',
  })

  const allSlugs = useMemo(() => {
    const s: string[] = []
    for (const cfg of configurations) {
      const slug = cfg.slug || cfg.name
      if (slug && !s.includes(slug)) s.push(slug)
    }
    return s
  }, [configurations])

  const allChoices = useMemo(() => {
    const s: string[] = []
    for (const cfg of configurations) {
      for (const opt of cfg.options) {
        const slug = opt.slug || opt.value
        if (slug && !s.includes(slug)) s.push(slug)
      }
    }
    return s
  }, [configurations])

  const getConfigLabel = (slug: string) => {
    const cfg = configurations.find(c => (c.slug || c.name) === slug)
    return cfg?.display_name || cfg?.name || slug
  }

  const getChoices = (slug: string) => {
    const cfg = configurations.find(c => (c.slug || c.name) === slug)
    return cfg?.options.map(o => o.slug || o.value).filter(Boolean) || []
  }

  const getChoiceLabel = (slug: string) => {
    for (const cfg of configurations) {
      const opt = cfg.options.find(o => (o.slug || o.value) === slug)
      if (opt) return opt.display_name || opt.slug || opt.value
    }
    return slug
  }

  const OPERATORS: Record<string, string> = {
    equal: 'jest równy',
    not_equal: 'nie jest równy',
    in: 'jest jednym z',
    not_in: 'nie jest jednym z',
  }

  const toggleDestination = (slug: string) => {
    setForm(f => ({
      ...f,
      destinations: f.destinations.includes(slug)
        ? f.destinations.filter(d => d !== slug)
        : [...f.destinations, slug],
    }))
  }

  const resetForm = () => {
    setForm({
      triggerVariable: '',
      sourceType: 'variable',
      sourceVariable: '',
      destinations: [],
      conditionAttribute: '',
      conditionOperator: 'equal',
      conditionCompareTo: '',
    })
    setAdding(false)
    setEditingId(null)
  }

  const startAdd = () => {
    resetForm()
    setAdding(true)
    setEditingId(null)
  }

  const startEdit = (ev: ProductEvent) => {
    setForm({
      triggerVariable: ev.trigger_variable || '',
      sourceType: (ev.source_type as 'variable' | 'value') || 'variable',
      sourceVariable: ev.source_variable || '',
      destinations: ev.destinations || [],
      conditionAttribute: ev.condition_attribute || '',
      conditionOperator: ev.condition_operator || 'equal',
      conditionCompareTo: ev.condition_compare_to || '',
    })
    setEditingId(ev.id)
    setAdding(false)
  }

  const handleSave = async () => {
    if (!form.triggerVariable || !form.sourceVariable || form.destinations.length === 0) {
      toast.error('Wypełnij wymagane pola: wyzwalacz, źródło i cel(e)')
      return
    }
    const payload = {
      trigger_variable: form.triggerVariable,
      source_type: form.sourceType,
      source_variable: form.sourceVariable,
      destinations: form.destinations,
      condition_attribute: form.conditionAttribute || null,
      condition_operator: form.conditionAttribute ? form.conditionOperator : null,
      condition_compare_to: form.conditionAttribute ? form.conditionCompareTo : null,
    }
    try {
      if (editingId) {
        await updateEvent(productId, editingId, payload)
        toast.success('Reguła zaktualizowana')
      } else {
        await addEvent(productId, payload)
        toast.success('Reguła dodana')
      }
      resetForm()
      onUpdate()
    } catch {
      toast.error('Błąd zapisu')
    }
  }

  const handleDelete = async (ev: ProductEvent) => {
    if (!confirm(`Usunąć regułę?`)) return
    try {
      await deleteEvent(productId, ev.id)
      toast.success('Reguła usunięta')
      onUpdate()
    } catch {
      toast.error('Błąd usuwania')
    }
  }

  const showForm = adding || editingId !== null

  const formJSX = (
    <div style={{ background: 'var(--bg-hover, #f8f9fa)', padding: '1rem', borderRadius: '8px', marginTop: '0.5rem', marginBottom: '0.5rem' }}>
      <h5 style={{ marginBottom: '0.75rem' }}>{editingId ? 'Edycja reguły' : 'Nowa reguła zmiany wartości'}</h5>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
        {/* Trigger */}
        <div>
          <label className="form-label">Po zmianie atrybutu *</label>
          <select className="form-select" value={form.triggerVariable} onChange={e => setForm(f => ({ ...f, triggerVariable: e.target.value }))}>
            <option value="">— wybierz —</option>
            {allSlugs.map(s => <option key={s} value={s}>{getConfigLabel(s)}</option>)}
          </select>
        </div>

        {/* Source type */}
        <div>
          <label className="form-label">Typ źródła</label>
          <select className="form-select" value={form.sourceType} onChange={e => setForm(f => ({ ...f, sourceType: e.target.value as 'variable' | 'value', sourceVariable: '' }))}>
            <option value="variable">Wartość z atrybutu (variable)</option>
            <option value="value">Stała wartość (value)</option>
          </select>
        </div>

        {/* Source variable / value */}
        <div>
          <label className="form-label">{form.sourceType === 'variable' ? 'Źródłowy atrybut *' : 'Stała wartość (choice) *'}</label>
          {form.sourceType === 'variable' ? (
            <select className="form-select" value={form.sourceVariable} onChange={e => setForm(f => ({ ...f, sourceVariable: e.target.value }))}>
              <option value="">— wybierz atrybut —</option>
              {allSlugs.map(s => <option key={s} value={s}>{getConfigLabel(s)}</option>)}
            </select>
          ) : (
            <select className="form-select" value={form.sourceVariable} onChange={e => setForm(f => ({ ...f, sourceVariable: e.target.value }))}>
              <option value="">— wybierz wartość —</option>
              {allChoices.map(c => <option key={c} value={c}>{getChoiceLabel(c)}</option>)}
            </select>
          )}
        </div>

        {/* Destinations — multiselect checkboxes */}
        <div>
          <label className="form-label">Cel(e) — atrybuty docelowe * ({form.destinations.length} wybrano)</label>
          <div style={{ maxHeight: 160, overflow: 'auto', border: '1px solid var(--border-color, #dee2e6)', borderRadius: '6px', padding: '0.25rem 0' }}>
            {allSlugs.map(s => (
              <label key={s} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.25rem 0.75rem', cursor: 'pointer', fontSize: '0.9rem' }}>
                <input
                  type="checkbox"
                  checked={form.destinations.includes(s)}
                  onChange={() => toggleDestination(s)}
                />
                {getConfigLabel(s)}
                <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>{s}</span>
              </label>
            ))}
          </div>
        </div>
      </div>

      {/* Condition (optional) */}
      <div style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-color, #dee2e6)' }}>
        <label className="form-label" style={{ fontWeight: 600 }}>Warunek (opcjonalnie)</label>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: '0.5rem', alignItems: 'end' }}>
          <div>
            <label className="form-label" style={{ fontSize: '0.8rem' }}>Gdy atrybut</label>
            <select className="form-select" value={form.conditionAttribute} onChange={e => setForm(f => ({ ...f, conditionAttribute: e.target.value, conditionCompareTo: '' }))}>
              <option value="">— zawsze (bez warunku) —</option>
              {allSlugs.map(s => <option key={s} value={s}>{getConfigLabel(s)}</option>)}
            </select>
          </div>
          {form.conditionAttribute && (
            <>
              <div>
                <label className="form-label" style={{ fontSize: '0.8rem' }}>Operator</label>
                <select className="form-select" value={form.conditionOperator} onChange={e => setForm(f => ({ ...f, conditionOperator: e.target.value }))}>
                  {Object.entries(OPERATORS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div>
                <label className="form-label" style={{ fontSize: '0.8rem' }}>Wartość</label>
                <select className="form-select" value={form.conditionCompareTo} onChange={e => setForm(f => ({ ...f, conditionCompareTo: e.target.value }))}>
                  <option value="">— wybierz —</option>
                  {getChoices(form.conditionAttribute).map(c => <option key={c} value={c}>{getChoiceLabel(c)}</option>)}
                </select>
              </div>
            </>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
        <button className="btn btn-primary btn-sm" onClick={handleSave}><Save size={14} /> Zapisz</button>
        <button className="btn btn-secondary btn-sm" onClick={resetForm}>Anuluj</button>
      </div>
    </div>
  )

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h4 style={{ margin: 0 }}>Reguły zmiany wartości ({events.length})</h4>
        {!showForm && (
          <button className="btn btn-primary btn-sm" onClick={startAdd}><Plus size={14} /> Dodaj</button>
        )}
      </div>

      {events.map(ev => {
        const triggerLabel = getConfigLabel(ev.trigger_variable || '')
        const sourceLabel = ev.source_type === 'value' ? `"${ev.source_variable}"` : getConfigLabel(ev.source_variable || '')
        const destLabels = (ev.destinations || []).map(d => getConfigLabel(d)).join(', ')
        const hasCond = ev.condition_attribute && ev.condition_compare_to
        const condLabel = hasCond
          ? `gdy "${getConfigLabel(ev.condition_attribute!)}" ${OPERATORS[ev.condition_operator || 'equal'] || ev.condition_operator} "${ev.condition_compare_to}"`
          : ''

        return (
          <div key={ev.id}>
            <div
              style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '0.5rem 0.75rem', borderBottom: '1px solid var(--border-color, #dee2e6)',
                background: editingId === ev.id ? 'var(--bg-hover, #f8f9fa)' : undefined,
              }}
            >
              <div style={{ fontSize: '0.9rem' }}>
                <span style={{ color: 'var(--text-muted)', marginRight: '0.5rem' }}>Po zmianie</span>
                <strong>{triggerLabel}</strong>
                <span style={{ color: 'var(--text-muted)', margin: '0 0.5rem' }}>→ kopiuj {ev.source_type === 'value' ? 'wartość' : 'z'}</span>
                <strong>{sourceLabel}</strong>
                <span style={{ color: 'var(--text-muted)', margin: '0 0.5rem' }}>→ do</span>
                <strong>{destLabels}</strong>
                {condLabel && (
                  <span style={{ color: 'var(--primary, #4361ee)', marginLeft: '0.5rem', fontSize: '0.85rem' }}>{condLabel}</span>
                )}
              </div>
              <div className="btn-group">
                <button className="btn btn-secondary btn-sm btn-icon" onClick={() => startEdit(ev)} title="Edytuj"><Edit2 size={14} /></button>
                <button className="btn btn-danger btn-sm btn-icon" onClick={() => handleDelete(ev)} title="Usuń"><Trash2 size={14} /></button>
              </div>
            </div>
            {editingId === ev.id && formJSX}
          </div>
        )
      })}

      {adding && formJSX}

      {events.length === 0 && !showForm && (
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
          Brak reguł. Dodaj regułę, aby automatycznie kopiować wartości między atrybutami.
        </p>
      )}
    </div>
  )
}


/* ============================================================
   ProductDetailPage — main page component
   ============================================================ */

/* ============================================================
   SubProductFormModal — create a sub-product
   ============================================================ */

function SubProductFormModal({ parentId, parentManufacturer, parentBrand, onClose, onSaved }: {
  parentId: number
  parentManufacturer?: string
  parentBrand?: string
  onClose: () => void
  onSaved: () => void
}) {
  const [form, setForm] = useState({ sku: '', name: '', manufacturer: '', brand: '' })
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      await createSubProduct(parentId, {
        sku: form.sku,
        name: form.name,
        manufacturer: form.manufacturer || undefined,
        brand: form.brand || undefined,
      })
      toast.success('Sub-produkt dodany')
      onSaved()
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string } } }
      toast.error(error.response?.data?.detail || 'Blad zapisu')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Nowy sub-produkt</h3>
          <button className="btn btn-icon" onClick={onClose}>&times;</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-group">
              <label className="form-label">SKU *</label>
              <input className="form-input" required value={form.sku} onChange={e => setForm(f => ({ ...f, sku: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Nazwa *</label>
              <input className="form-input" required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Producent</label>
                <input className="form-input" value={form.manufacturer} onChange={e => setForm(f => ({ ...f, manufacturer: e.target.value }))} placeholder={parentManufacturer || 'Z rodzica'} />
              </div>
              <div className="form-group">
                <label className="form-label">Brand</label>
                <input className="form-input" value={form.brand} onChange={e => setForm(f => ({ ...f, brand: e.target.value }))} placeholder={parentBrand || parentManufacturer || 'Z rodzica'} />
              </div>
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Anuluj</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Zapisuje...' : 'Zapisz sub-produkt'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

/* ============================================================
   SubProductsSection — list + create sub-products
   ============================================================ */

function SubProductsSection({ productId, parentManufacturer, parentBrand }: { productId: number; parentManufacturer?: string; parentBrand?: string }) {
  const [subs, setSubs] = useState<ProductListItem[]>([])
  const [showModal, setShowModal] = useState(false)

  const loadSubs = useCallback(async () => {
    try {
      const data = await getSubProducts(productId)
      setSubs(data)
    } catch { /* ignore */ }
  }, [productId])

  useEffect(() => { loadSubs() }, [loadSubs])

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h4 style={{ margin: 0 }}>Sub-produkty ({subs.length})</h4>
        <button className="btn btn-primary btn-sm" onClick={() => setShowModal(true)}>
          <Plus size={14} /> Dodaj sub-produkt
        </button>
      </div>
      {subs.length === 0 && (
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Brak sub-produktow.</p>
      )}
      {subs.length > 0 && (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>SKU</th>
                <th>Nazwa</th>
                <th>Brand</th>
                <th>Presety</th>
                <th style={{ width: 80 }}>Akcje</th>
              </tr>
            </thead>
            <tbody>
              {subs.map(sub => (
                <tr key={sub.id}>
                  <td><code style={{ fontSize: '0.85rem' }}>{sub.sku}</code></td>
                  <td><Link to={`/products/${sub.id}`} style={{ fontWeight: 500 }}>{sub.name}</Link></td>
                  <td>{sub.brand || sub.manufacturer || '—'}</td>
                  <td>{sub.sub_products_count || 0}</td>
                  <td>
                    <Link to={`/products/${sub.id}`} className="btn btn-secondary btn-sm btn-icon" title="Szczegoly">
                      <Eye size={14} />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {showModal && (
        <SubProductFormModal
          parentId={productId}
          parentManufacturer={parentManufacturer}
          parentBrand={parentBrand}
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); loadSubs() }}
        />
      )}
    </div>
  )
}

/* ============================================================
   PresetFormModal — create a preset
   ============================================================ */

function PresetFormModal({ subProductId, onClose, onSaved }: {
  subProductId: number
  onClose: () => void
  onSaved: () => void
}) {
  const [form, setForm] = useState({ sku: '', name: '' })
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      await createPreset(subProductId, { sku: form.sku, name: form.name })
      toast.success('Preset dodany')
      onSaved()
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string } } }
      toast.error(error.response?.data?.detail || 'Blad zapisu')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Nowy preset</h3>
          <button className="btn btn-icon" onClick={onClose}>&times;</button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="form-group">
              <label className="form-label">SKU *</label>
              <input className="form-input" required value={form.sku} onChange={e => setForm(f => ({ ...f, sku: e.target.value }))} />
            </div>
            <div className="form-group">
              <label className="form-label">Nazwa *</label>
              <input className="form-input" required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose}>Anuluj</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Zapisuje...' : 'Zapisz preset'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

/* ============================================================
   PresetsSection — list + create presets (for sub-products)
   ============================================================ */

function PresetsSection({ subProductId }: { subProductId: number }) {
  const [presets, setPresets] = useState<ProductListItem[]>([])
  const [showModal, setShowModal] = useState(false)

  const loadPresets = useCallback(async () => {
    try {
      const data = await getPresets(subProductId)
      setPresets(data)
    } catch { /* ignore */ }
  }, [subProductId])

  useEffect(() => { loadPresets() }, [loadPresets])

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h4 style={{ margin: 0 }}>Presety ({presets.length})</h4>
        <button className="btn btn-primary btn-sm" onClick={() => setShowModal(true)}>
          <Plus size={14} /> Dodaj preset
        </button>
      </div>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '0.5rem' }}>
        Presety dziedzicza konfiguracje i choice overrides z sub-produktu. Maja wlasna nazwe, SKU i default_configuration.
      </p>
      {presets.length === 0 && (
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Brak presetow.</p>
      )}
      {presets.length > 0 && (
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>SKU</th>
                <th>Nazwa</th>
                <th style={{ width: 80 }}>Akcje</th>
              </tr>
            </thead>
            <tbody>
              {presets.map(p => (
                <tr key={p.id}>
                  <td><code style={{ fontSize: '0.85rem' }}>{p.sku}</code></td>
                  <td><Link to={`/products/${p.id}`} style={{ fontWeight: 500 }}>{p.name}</Link></td>
                  <td>
                    <Link to={`/products/${p.id}`} className="btn btn-secondary btn-sm btn-icon" title="Szczegoly">
                      <Eye size={14} />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {showModal && (
        <PresetFormModal
          subProductId={subProductId}
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); loadPresets() }}
        />
      )}
    </div>
  )
}

/* ============================================================
   DefaultConfigEditor — for presets: edit default_configuration + neighbours
   ============================================================ */

function DefaultConfigEditor({ product, onUpdate }: { product: Product; onUpdate: () => void }) {
  const hasElements = (product.sectional_elements?.length ?? 0) > 0

  // Parse existing default config
  const existingDC = product.default_configurations?.find(dc => dc.config_type === 'default') ||
                     product.default_configurations?.[0]
  const dcElements = existingDC?.elements as Record<string, unknown> | undefined
  const dcInner = (dcElements?.configuration ? dcElements.configuration : dcElements) as Record<string, unknown> | undefined

  // For sectional: per-element variables + neighbours
  const [elementConfigs, setElementConfigs] = useState<Record<string, {
    variables: Record<string, string>
    neighbours: Record<string, string>
  }>>(() => {
    const result: Record<string, { variables: Record<string, string>; neighbours: Record<string, string> }> = {}
    if (!hasElements) return result

    // Parse existing DC elements
    let parsedElements: Record<string, { variables?: Record<string, string>; neighbours?: Record<string, string> }> = {}
    if (dcInner && typeof dcInner === 'object') {
      if ('elements' in dcInner && typeof dcInner.elements === 'object') {
        // {elements: {key: {variables, neighbours}}} or [{name, variables}]
        const els = dcInner.elements
        if (Array.isArray(els)) {
          for (const entry of els as Array<{ name?: string; element_id?: number; variables?: Record<string, string>; neighbours?: Record<string, string> }>) {
            const matchEl = product.sectional_elements.find(e =>
              elKey(e) === entry.name || (entry.element_id != null && e.element_id === entry.element_id)
            )
            const key = matchEl ? elKey(matchEl) : (entry.name || String(entry.element_id))
            parsedElements[key] = { variables: entry.variables || {}, neighbours: entry.neighbours || {} }
          }
        } else {
          parsedElements = els as typeof parsedElements
        }
      }
    }

    for (const el of product.sectional_elements) {
      const key = elKey(el)
      const dcEl = parsedElements[key]
      result[key] = {
        variables: dcEl?.variables || {},
        neighbours: { front: '', back: '', left: '', right: '', ...(dcEl?.neighbours || {}) },
      }
    }
    return result
  })

  // For non-sectional: global variables
  const [globalVars, setGlobalVars] = useState<Record<string, string>>(() => {
    if (!hasElements && dcInner && typeof dcInner === 'object' && 'variables' in dcInner) {
      return (dcInner.variables || {}) as Record<string, string>
    }
    return {}
  })

  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    try {
      const configType = 'default'
      let elements: unknown

      if (hasElements) {
        const elArr = product.sectional_elements.map(el => {
          const key = elKey(el)
          const cfg = elementConfigs[key]
          const nb: Record<string, string> = {}
          for (const dir of DIRECTIONS) {
            if (cfg?.neighbours[dir]) nb[dir] = cfg.neighbours[dir]
          }
          return {
            name: key,
            element_id: el.element_id,
            variables: cfg?.variables || {},
            ...(Object.keys(nb).length > 0 ? { neighbours: nb } : {}),
          }
        })
        elements = { configuration: { elements: elArr } }
      } else {
        elements = { configuration: { variables: globalVars } }
      }

      await saveDefaultConfiguration(product.id, configType, elements)
      toast.success('Zapisano default configuration')
      onUpdate()
    } catch {
      toast.error('Blad zapisu default configuration')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h4 style={{ margin: 0 }}>Default Configuration & Neighbours</h4>
        <button className="btn btn-primary btn-sm" onClick={handleSave} disabled={saving}>
          <Save size={14} /> {saving ? 'Zapisuje...' : 'Zapisz'}
        </button>
      </div>

      {hasElements ? (
        product.sectional_elements.map(el => {
          const key = elKey(el)
          const cfg = elementConfigs[key] || { variables: {}, neighbours: { front: '', back: '', left: '', right: '' } }
          const otherElements = product.sectional_elements.filter(e => e.id !== el.id)

          return (
            <div key={el.id} style={{ marginBottom: '1.5rem', padding: '1rem', border: '1px solid var(--border)', borderRadius: '8px' }}>
              <h5 style={{ margin: '0 0 0.75rem 0' }}>{elLabel(el)}</h5>

              {/* Variable defaults */}
              <div style={{ marginBottom: '0.75rem' }}>
                <div style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.5rem' }}>Domyslne wartosci</div>
                <div className="form-row" style={{ flexWrap: 'wrap' }}>
                  {product.configurations
                    .filter(c => c.element_id == null || c.element_id === el.element_id)
                    .map(c => (
                      <div className="form-group" key={c.id} style={{ flex: '1 1 0', minWidth: '150px' }}>
                        <label className="form-label" style={{ fontSize: '0.8rem' }}>{c.display_name || c.name}</label>
                        <select
                          className="form-select"
                          value={cfg.variables[c.slug || c.name] || ''}
                          onChange={e => {
                            setElementConfigs(prev => ({
                              ...prev,
                              [key]: {
                                ...prev[key],
                                variables: { ...prev[key].variables, [c.slug || c.name]: e.target.value }
                              }
                            }))
                          }}
                        >
                          <option value="">— domyslny —</option>
                          {c.options.map(opt => (
                            <option key={opt.id || opt.value} value={opt.slug || opt.value}>
                              {opt.display_name || opt.value}
                            </option>
                          ))}
                        </select>
                      </div>
                    ))
                  }
                </div>
              </div>

              {/* Neighbours */}
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.5rem' }}>Sasiedzi (neighbours)</div>
                <div className="form-row">
                  {DIRECTIONS.map(dir => (
                    <div className="form-group" key={dir} style={{ flex: '1 1 0' }}>
                      <label className="form-label" style={{ textTransform: 'capitalize', fontSize: '0.8rem' }}>{dir}</label>
                      <select
                        className="form-select"
                        value={cfg.neighbours[dir] || ''}
                        onChange={e => {
                          setElementConfigs(prev => ({
                            ...prev,
                            [key]: {
                              ...prev[key],
                              neighbours: { ...prev[key].neighbours, [dir]: e.target.value }
                            }
                          }))
                        }}
                      >
                        <option value="">— brak —</option>
                        {otherElements.map(oe => (
                          <option key={oe.id} value={elKey(oe)}>{elLabel(oe)}</option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )
        })
      ) : (
        <div>
          <div style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.5rem' }}>Domyslne wartosci</div>
          <div className="form-row" style={{ flexWrap: 'wrap' }}>
            {product.configurations.map(c => (
              <div className="form-group" key={c.id} style={{ flex: '1 1 0', minWidth: '150px' }}>
                <label className="form-label" style={{ fontSize: '0.8rem' }}>{c.display_name || c.name}</label>
                <select
                  className="form-select"
                  value={globalVars[c.slug || c.name] || ''}
                  onChange={e => setGlobalVars(prev => ({ ...prev, [c.slug || c.name]: e.target.value }))}
                >
                  <option value="">— domyslny —</option>
                  {c.options.map(opt => (
                    <option key={opt.id || opt.value} value={opt.slug || opt.value}>
                      {opt.display_name || opt.value}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </div>
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
        name: p.name, sku: p.sku, manufacturer: p.manufacturer, brand: p.brand || '',
        collection: p.collection, description: p.description, base_price: p.base_price,
        currency: p.currency, product_type: p.product_type, is_active: p.is_active,
        width: p.width, height: p.height, depth: p.depth, weight: p.weight,
        model_intiaro_id: p.model_intiaro_id ?? '',
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
    try {
      const info = await getDeleteInfo(Number(id))
      const parts: string[] = []
      if (info.sub_products_count > 0) parts.push(`${info.sub_products_count} sub-produkt(ów)`)
      if (info.presets_count > 0) parts.push(`${info.presets_count} preset(ów)`)
      const extra = parts.length > 0
        ? `\n\nZostanie również usunięte: ${parts.join(', ')}.`
        : ''
      if (!confirm(`Czy na pewno chcesz usunąć ten produkt? Tej operacji nie można cofnąć.${extra}`)) return
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <h2 style={{ margin: 0 }}>{product.name}</h2>
              {product.product_kind === 'sub_product' && (
                <span className="badge badge-info">Sub-produkt</span>
              )}
              {product.product_kind === 'preset' && (
                <span className="badge badge-warning">Preset</span>
              )}
            </div>
            <small style={{ color: 'var(--text-muted)' }}>
              SKU: {product.sku}
              {product.brand && <> | Brand: {product.brand}</>}
              {product.parent_product_id && (
                <> | Rodzic: <Link to={`/products/${product.parent_product_id}`}>#{product.parent_product_id}</Link></>
              )}
            </small>
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
                      <label className="form-label">Brand</label>
                      <input className="form-input" value={(form.brand as string) || ''} onChange={e => set('brand', e.target.value)} placeholder={product.manufacturer || ''} />
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
                  <div className="form-row">
                    <div className="form-group">
                      <label className="form-label">Model Intiaro ID</label>
                      <input className="form-input" type="number" value={form.model_intiaro_id as number | string} onChange={e => set('model_intiaro_id', e.target.value ? Number(e.target.value) : null)} />
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
                  <div className="detail-row"><span className="label">Brand</span><span>{product.brand || product.manufacturer || '—'}</span></div>
                  <div className="detail-row"><span className="label">Kolekcja</span><span>{product.collection || '—'}</span></div>
                  <div className="detail-row"><span className="label">Typ</span><span>{product.product_type || '—'}</span></div>
                  <div className="detail-row"><span className="label">Cena bazowa</span><span style={{ fontWeight: 600 }}>{product.base_price.toLocaleString()} {product.currency}</span></div>
                  <div className="detail-row"><span className="label">Status</span><span className={`badge ${product.is_active ? 'badge-success' : 'badge-danger'}`}>{product.is_active ? 'Aktywny' : 'Nieaktywny'}</span></div>
                  {product.model_intiaro_id != null && (
                    <div className="detail-row"><span className="label">Model Intiaro ID</span><span>{product.model_intiaro_id}</span></div>
                  )}
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
          {/* For presets: only show DefaultConfigEditor (no tree/predicates editing) */}
          {product.product_kind === 'preset' ? (
            <div className="card">
              <div className="card-body">
                <DefaultConfigEditor product={product} onUpdate={load} />
              </div>
            </div>
          ) : (
            <>
              {/* ProductTreeEditor replaces ConfigurationEditor + ElementEditor */}
              <div className="card">
                <div className="card-body">
                  <ProductTreeEditor product={product} onUpdate={load} />
                </div>
              </div>

              {/* PredicateEditor kept as separate section */}
              <div className="card" style={{ marginTop: '1rem' }}>
                <div className="card-body">
                  <PredicateEditor
                    productId={product.id}
                    predicates={product.predicates || []}
                    configurations={product.configurations}
                    onUpdate={load}
                  />
                </div>
              </div>

              {/* EventEditor — event rules for copying values between attributes */}
              <div className="card" style={{ marginTop: '1rem' }}>
                <div className="card-body">
                  <EventEditor
                    productId={product.id}
                    events={product.events || []}
                    configurations={product.configurations}
                    onUpdate={load}
                  />
                </div>
              </div>
            </>
          )}

          {/* Sub-products section — only for root products */}
          {(!product.product_kind || product.product_kind === 'product') && (
            <div className="card" style={{ marginTop: '1rem' }}>
              <div className="card-body">
                <SubProductsSection productId={product.id} parentManufacturer={product.manufacturer} parentBrand={product.brand} />
              </div>
            </div>
          )}

          {/* Presets section — only for sub-products */}
          {product.product_kind === 'sub_product' && (
            <div className="card" style={{ marginTop: '1rem' }}>
              <div className="card-body">
                <PresetsSection subProductId={product.id} />
              </div>
            </div>
          )}

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
