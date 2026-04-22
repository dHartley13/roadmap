import { useEffect, useState, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'

// ── Financial year config ──────────────────────────────────────────────────
const FY_START_MONTH = 3 // April (0-indexed)
const MONTHS = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar']
const MONTH_TO_QUARTER = {
  'Apr': 'Q1', 'May': 'Q1', 'Jun': 'Q1',
  'Jul': 'Q2', 'Aug': 'Q2', 'Sep': 'Q2',
  'Oct': 'Q3', 'Nov': 'Q3', 'Dec': 'Q3',
  'Jan': 'Q4', 'Feb': 'Q4', 'Mar': 'Q4',
}
const QUARTERS = ['Q1', 'Q2', 'Q3', 'Q4']
const QUARTER_MONTHS = {
  Q1: ['Apr', 'May', 'Jun'],
  Q2: ['Jul', 'Aug', 'Sep'],
  Q3: ['Oct', 'Nov', 'Dec'],
  Q4: ['Jan', 'Feb', 'Mar'],
}
const FINANCIAL_YEARS = ['2024-2025', '2025-2026', '2026-2027']
const CURRENT_YEAR = '2025-2026'
const COL_WIDTH = 80 // px per month
const ROW_HEIGHT = 48
const HEADER_HEIGHT = 56
const SUBHEADER_HEIGHT = 28
const LEFT_PANEL = 220

const ITEM_TYPES = [
  { value: 'dev',         label: 'Dev',         color: '#1E40AF', bg: '#DBEAFE' },
  { value: 'non_dev',     label: 'Non-Dev',      color: '#0F766E', bg: '#CCFBF1' },
  { value: 'discovery',   label: 'Discovery',    color: '#7C3AED', bg: '#EDE9FE' },
  { value: 'operational', label: 'Operational',  color: '#B45309', bg: '#FEF3C7' },
]

const STATUSES = [
  { value: 'to_do',       label: 'To Do',        color: '#475569', bg: '#F1F5F9' },
  { value: 'in_progress', label: 'In Progress',  color: '#1E40AF', bg: '#DBEAFE' },
  { value: 'done',        label: 'Done',         color: '#166534', bg: '#DCFCE7' },
  { value: 'on_hold',     label: 'On Hold',      color: '#92400E', bg: '#FEF3C7' },
  { value: 'blocked',     label: 'Blocked',      color: '#991B1B', bg: '#FEE2E2' },
]

function typeMeta(v) { return ITEM_TYPES.find(t => t.value === v) || ITEM_TYPES[0] }
function statusMeta(v) { return STATUSES.find(s => s.value === v) || STATUSES[0] }

function confidenceLevel(item) {
  const fields = [item.pillar_id, item.goal_id, item.value_statement, item.lead_metric_name]
  const filled = fields.filter(Boolean).length
  return filled === 4 ? 'high' : filled >= 2 ? 'medium' : 'low'
}

function confidenceMeta(level) {
  return {
    high:   { color: '#166534', bg: '#DCFCE7', label: 'High' },
    medium: { color: '#92400E', bg: '#FEF3C7', label: 'Medium' },
    low:    { color: '#991B1B', bg: '#FEE2E2', label: 'Low' },
  }[level] || { color: '#991B1B', bg: '#FEE2E2', label: 'Low' }
}

// Convert month index (0=Apr) to pixel x position
function monthToX(monthIndex) { return monthIndex * COL_WIDTH }

// Convert pixel x to month index
function xToMonth(x) { return Math.max(0, Math.min(11, Math.round(x / COL_WIDTH))) }

// Get quarter from month name
function quarterFromMonth(month) { return MONTH_TO_QUARTER[month] || 'Q1' }

// Get start month index for a quarter
function quarterStartIndex(q) {
  return MONTHS.indexOf(QUARTER_MONTHS[q]?.[0]) ?? 0
}

// Default span for new items — 1 month wide
function defaultSpan(quarter) {
  const startIdx = quarterStartIndex(quarter || 'Q1')
  return { startMonth: startIdx, endMonth: startIdx + 1 }
}

// ── Timeline Item (draggable box) ───────────────────────────────────────────
function TimelineItem({ item, rowY, onUpdate, onClick }) {
  const dragRef = useRef(null)
  const tm = typeMeta(item.type)
  const level = confidenceLevel(item)
  const cm = confidenceMeta(level)

  const startIdx = item.start_month ?? quarterStartIndex(item.quarter || 'Q1')
  const endIdx   = item.end_month   ?? startIdx + 1

  const x      = startIdx * COL_WIDTH
  const width  = Math.max(COL_WIDTH, (endIdx - startIdx) * COL_WIDTH)

  function onDragStart(e, mode) {
    e.stopPropagation()
    dragRef.current = {
      mode,
      startX: e.clientX,
      origStart: startIdx,
      origEnd: endIdx,
    }
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
  }

  function onMouseMove(e) {
    if (!dragRef.current) return
    const dx = e.clientX - dragRef.current.startX
    const deltaMonths = Math.round(dx / COL_WIDTH)
    const { mode, origStart, origEnd } = dragRef.current

    let newStart = origStart
    let newEnd   = origEnd

    if (mode === 'move') {
      newStart = Math.max(0, Math.min(11, origStart + deltaMonths))
      newEnd   = Math.max(1, Math.min(12, origEnd   + deltaMonths))
    } else if (mode === 'resize-left') {
      newStart = Math.max(0, Math.min(origEnd - 1, origStart + deltaMonths))
    } else if (mode === 'resize-right') {
      newEnd = Math.max(origStart + 1, Math.min(12, origEnd + deltaMonths))
    }

    const quarter = quarterFromMonth(MONTHS[newStart])
    onUpdate(item.id, { start_month: newStart, end_month: newEnd, quarter }, false)
  }

  function onMouseUp() {
    window.removeEventListener('mousemove', onMouseMove)
    window.removeEventListener('mouseup',  onMouseUp)
    if (!dragRef.current) return
    // Persist final position
    const current = { start_month: item.start_month, end_month: item.end_month, quarter: item.quarter }
    onUpdate(item.id, current, true)
    dragRef.current = null
  }

  return (
    <g style={{ cursor: 'grab' }}>
      {/* Main box */}
      <rect
        x={x + 2} y={rowY + 6}
        width={width - 4} height={ROW_HEIGHT - 12}
        rx={4}
        fill={item.track === 'discovery' ? '#EDE9FE' : tm.bg}
        stroke={item.track === 'discovery' ? '#7C3AED' : tm.color}
        strokeWidth={1.5}
        onMouseDown={e => onDragStart(e, 'move')}
        onClick={() => onClick(item)}
        style={{ cursor: 'grab' }}
      />

      {/* Confidence dot */}
      <circle
        cx={x + width - 10} cy={rowY + 14}
        r={4}
        fill={cm.color}
        style={{ pointerEvents: 'none' }}
      />

      {/* Title text */}
      <foreignObject
        x={x + 8} y={rowY + 8}
        width={Math.max(0, width - 24)} height={ROW_HEIGHT - 16}
        style={{ pointerEvents: 'none' }}
      >
        <div xmlns="http://www.w3.org/1999/xhtml" style={{
          fontSize: '11px', fontWeight: '600',
          color: item.track === 'discovery' ? '#5B21B6' : tm.color,
          fontFamily: 'DM Sans, sans-serif',
          lineHeight: '1.3', overflow: 'hidden',
          display: '-webkit-box', WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          whiteSpace: 'normal', wordBreak: 'break-word',
        }}>
          {item.title}
        </div>
      </foreignObject>

      {/* Resize handles */}
      <rect
        x={x + 2} y={rowY + 6}
        width={8} height={ROW_HEIGHT - 12}
        rx={4} fill="transparent"
        style={{ cursor: 'ew-resize' }}
        onMouseDown={e => onDragStart(e, 'resize-left')}
      />
      <rect
        x={x + width - 10} y={rowY + 6}
        width={8} height={ROW_HEIGHT - 12}
        rx={4} fill="transparent"
        style={{ cursor: 'ew-resize' }}
        onMouseDown={e => onDragStart(e, 'resize-right')}
      />
    </g>
  )
}

// ── Item Detail Panel ───────────────────────────────────────────────────────
function ItemDetailPanel({ item, pillars, goals, onClose, onSaved, onDeleted }) {
  const [form, setForm] = useState({ ...item })
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const filteredGoals = goals.filter(g => g.pillar_id === form.pillar_id)

  async function save() {
    setSaving(true)
    await supabase.from('roadmap_items').update({
      title: form.title, type: form.type, track: form.track,
      status: form.status, quarter: form.quarter,
      financial_year: form.financial_year, owner: form.owner || null,
      pillar_id: form.pillar_id || null, goal_id: form.goal_id || null,
      value_statement: form.value_statement || null,
      lead_metric_name: form.lead_metric_name || null,
      jira_ref: form.jira_ref || null, doc_url: form.doc_url || null,
    }).eq('id', item.id)
    setSaving(false)
    onSaved()
  }

  async function deleteItem() {
    await supabase.from('roadmap_items').delete().eq('id', item.id)
    onDeleted()
  }

  const inp = {
    width: '100%', padding: '7px 10px',
    border: '1px solid var(--border)', borderRadius: '6px',
    fontSize: '12px', fontFamily: 'DM Sans, sans-serif',
    color: 'var(--navy)', background: '#fff', outline: 'none'
  }
  const lbl = {
    fontSize: '10px', fontWeight: '600', color: 'var(--slate)',
    letterSpacing: '0.06em', textTransform: 'uppercase',
    marginBottom: '4px', display: 'block'
  }

  const level = confidenceLevel(form)
  const cm = confidenceMeta(level)
  const missing = [
    !form.pillar_id && 'Pillar', !form.goal_id && 'KPI focus',
    !form.value_statement && 'Value statement', !form.lead_metric_name && 'Lead metric',
  ].filter(Boolean)

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', display: 'flex', justifyContent: 'flex-end', zIndex: 100 }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div style={{ width: '460px', height: '100vh', background: '#fff', overflow: 'auto', display: 'flex', flexDirection: 'column', boxShadow: '-8px 0 32px rgba(0,0,0,0.15)' }}>
        {/* Header */}
        <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, background: '#fff', zIndex: 1 }}>
          <div>
            <div style={{ fontSize: '10px', color: 'var(--slate-light)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '2px' }}>Item detail</div>
            <div style={{ fontSize: '14px', fontWeight: '700', color: 'var(--navy)', lineHeight: '1.3' }}>{form.title}</div>
          </div>
          <button onClick={onClose} style={{ width: '28px', height: '28px', borderRadius: '6px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--slate-light)', cursor: 'pointer', fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
        </div>

        {/* Confidence */}
        <div style={{ padding: '10px 22px', background: cm.bg, borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '11px', fontWeight: '700', color: cm.color }}>{cm.label} confidence</span>
            <span style={{ fontSize: '10px', color: cm.color }}>{4 - missing.length}/4 fields</span>
          </div>
          {missing.length > 0 && <div style={{ fontSize: '10px', color: cm.color, marginTop: '3px' }}>Missing: {missing.join(' · ')}</div>}
        </div>

        {/* Form */}
        <div style={{ padding: '18px 22px', display: 'flex', flexDirection: 'column', gap: '12px', flex: 1 }}>
          <div><label style={lbl}>Title</label><input style={inp} value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} /></div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div><label style={lbl}>Type</label>
              <select style={{ ...inp, cursor: 'pointer' }} value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                {ITEM_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div><label style={lbl}>Track</label>
              <select style={{ ...inp, cursor: 'pointer' }} value={form.track} onChange={e => setForm(f => ({ ...f, track: e.target.value }))}>
                <option value="delivery">Delivery</option>
                <option value="discovery">Discovery</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div><label style={lbl}>Status</label>
              <select style={{ ...inp, cursor: 'pointer' }} value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
            <div><label style={lbl}>Owner</label><input style={inp} value={form.owner || ''} onChange={e => setForm(f => ({ ...f, owner: e.target.value }))} /></div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div><label style={lbl}>Quarter (inferred from position)</label>
              <input style={{ ...inp, background: 'var(--bg)', color: 'var(--slate)' }} value={form.quarter || '—'} readOnly />
            </div>
            <div><label style={lbl}>Financial year</label>
              <select style={{ ...inp, cursor: 'pointer' }} value={form.financial_year || CURRENT_YEAR} onChange={e => setForm(f => ({ ...f, financial_year: e.target.value }))}>
                {FINANCIAL_YEARS.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          </div>

          <div style={{ borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
            <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--blue)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '10px' }}>Strategic context</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div><label style={lbl}>Pillar</label>
                <select style={{ ...inp, cursor: 'pointer' }} value={form.pillar_id || ''} onChange={e => setForm(f => ({ ...f, pillar_id: e.target.value, goal_id: '' }))}>
                  <option value="">— Select pillar —</option>
                  {pillars.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div><label style={lbl}>KPI focus</label>
                <select style={{ ...inp, cursor: 'pointer' }} value={form.goal_id || ''} onChange={e => setForm(f => ({ ...f, goal_id: e.target.value }))} disabled={!form.pillar_id}>
                  <option value="">— Select KPI focus —</option>
                  {filteredGoals.map(g => <option key={g.id} value={g.id}>{g.kpi_name}</option>)}
                </select>
              </div>
              <div><label style={lbl}>Value statement</label>
                <textarea style={{ ...inp, minHeight: '60px', resize: 'vertical' }} placeholder="Why was this selected?" value={form.value_statement || ''} onChange={e => setForm(f => ({ ...f, value_statement: e.target.value }))} />
              </div>
              <div><label style={lbl}>Lead metric</label>
                <input style={inp} placeholder="e.g. Average handling time" value={form.lead_metric_name || ''} onChange={e => setForm(f => ({ ...f, lead_metric_name: e.target.value }))} />
              </div>
            </div>
          </div>

          <div style={{ borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
            <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--blue)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '10px' }}>References</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div><label style={lbl}>Jira ref</label><input style={inp} placeholder="e.g. SF-1951" value={form.jira_ref || ''} onChange={e => setForm(f => ({ ...f, jira_ref: e.target.value }))} /></div>
              <div><label style={lbl}>Doc URL</label><input style={inp} placeholder="https://..." value={form.doc_url || ''} onChange={e => setForm(f => ({ ...f, doc_url: e.target.value }))} />
                {form.doc_url && <a href={form.doc_url} target="_blank" rel="noreferrer" style={{ fontSize: '10px', color: 'var(--blue)', marginTop: '3px', display: 'block' }}>Open ↗</a>}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 22px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', bottom: 0, background: '#fff' }}>
          <button onClick={() => setConfirmDelete(true)} style={{ padding: '7px 14px', borderRadius: '6px', border: '1px solid var(--border)', background: 'transparent', fontSize: '12px', color: 'var(--slate-light)', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>Delete</button>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={onClose} style={{ padding: '7px 14px', borderRadius: '6px', border: '1px solid var(--border)', background: '#fff', fontSize: '12px', color: 'var(--slate)', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>Cancel</button>
            <button onClick={save} disabled={saving} style={{ padding: '7px 14px', borderRadius: '6px', border: 'none', background: 'var(--blue)', fontSize: '12px', fontWeight: '600', color: '#fff', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1, fontFamily: 'DM Sans, sans-serif' }}>{saving ? 'Saving...' : 'Save'}</button>
          </div>
        </div>

        {confirmDelete && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }}>
            <div style={{ background: '#fff', borderRadius: '12px', width: '360px', padding: '28px', boxShadow: '0 24px 48px rgba(0,0,0,0.2)' }}>
              <h3 className="font-display" style={{ fontSize: '16px', color: 'var(--navy)', marginBottom: '8px' }}>Delete this item?</h3>
              <p style={{ fontSize: '12px', color: 'var(--slate)', marginBottom: '20px', lineHeight: '1.5' }}><strong>{item.title}</strong> will be permanently removed.</p>
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                <button onClick={() => setConfirmDelete(false)} style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid var(--border)', background: '#fff', fontSize: '12px', color: 'var(--slate)', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>Cancel</button>
                <button onClick={deleteItem} style={{ padding: '8px 16px', borderRadius: '6px', border: 'none', background: '#991B1B', fontSize: '12px', fontWeight: '600', color: '#fff', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>Delete</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Add Item Modal ──────────────────────────────────────────────────────────
function AddItemModal({ pillars, goals, defaultPillarId, defaultGoalId, onClose, onSaved }) {
  const [form, setForm] = useState({
    title: '', type: 'dev', track: 'delivery', status: 'to_do',
    quarter: 'Q1', financial_year: CURRENT_YEAR, owner: '',
    pillar_id: defaultPillarId || '', goal_id: defaultGoalId || '',
    value_statement: '', lead_metric_name: '', jira_ref: '', doc_url: '',
    start_month: quarterStartIndex('Q1'), end_month: quarterStartIndex('Q1') + 1,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const filteredGoals = goals.filter(g => g.pillar_id === form.pillar_id)

  async function save() {
    if (!form.title.trim()) return setError('Title is required')
    setSaving(true)
    const { error } = await supabase.from('roadmap_items').insert({
      title: form.title.trim(), type: form.type, track: form.track,
      status: form.status, quarter: form.quarter,
      financial_year: form.financial_year, owner: form.owner || null,
      pillar_id: form.pillar_id || null, goal_id: form.goal_id || null,
      value_statement: form.value_statement || null,
      lead_metric_name: form.lead_metric_name || null,
      jira_ref: form.jira_ref || null, doc_url: form.doc_url || null,
      start_month: form.start_month, end_month: form.end_month,
    })
    setSaving(false)
    if (error) return setError(error.message)
    onSaved()
  }

  const inp = { width: '100%', padding: '8px 10px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '12px', fontFamily: 'DM Sans, sans-serif', color: 'var(--navy)', background: '#fff', outline: 'none' }
  const lbl = { fontSize: '10px', fontWeight: '600', color: 'var(--slate)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '4px', display: 'block' }
  const level = confidenceLevel(form)
  const cm = confidenceMeta(level)
  const missing = [!form.pillar_id && 'Pillar', !form.goal_id && 'KPI focus', !form.value_statement && 'Value statement', !form.lead_metric_name && 'Lead metric'].filter(Boolean)

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
      <div style={{ background: '#fff', borderRadius: '12px', width: '560px', maxHeight: '90vh', overflow: 'auto', padding: '28px', boxShadow: '0 24px 48px rgba(0,0,0,0.2)' }}>
        <div style={{ marginBottom: '18px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <h2 className="font-display" style={{ fontSize: '18px', color: 'var(--navy)', marginBottom: '3px' }}>Add roadmap item</h2>
            <p style={{ fontSize: '12px', color: 'var(--slate)' }}>Only title is required. Fill strategic context to increase confidence.</p>
          </div>
          <div style={{ padding: '6px 10px', borderRadius: '6px', background: cm.bg, textAlign: 'right', flexShrink: 0, marginLeft: '12px' }}>
            <div style={{ fontSize: '9px', fontWeight: '700', color: cm.color, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{cm.label} confidence</div>
            <div style={{ fontSize: '10px', color: cm.color }}>{4 - missing.length}/4</div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div><label style={lbl}>Title *</label><input style={inp} placeholder="e.g. Dynamic routing engine" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} /></div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
            <div><label style={lbl}>Type</label>
              <select style={{ ...inp, cursor: 'pointer' }} value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
                {ITEM_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div><label style={lbl}>Track</label>
              <select style={{ ...inp, cursor: 'pointer' }} value={form.track} onChange={e => setForm(f => ({ ...f, track: e.target.value }))}>
                <option value="delivery">Delivery</option>
                <option value="discovery">Discovery</option>
              </select>
            </div>
            <div><label style={lbl}>Quarter</label>
              <select style={{ ...inp, cursor: 'pointer' }} value={form.quarter} onChange={e => {
                const q = e.target.value
                const startIdx = quarterStartIndex(q)
                setForm(f => ({ ...f, quarter: q, start_month: startIdx, end_month: startIdx + 1 }))
              }}>
                {QUARTERS.map(q => <option key={q} value={q}>{q}</option>)}
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div><label style={lbl}>Owner</label><input style={inp} placeholder="e.g. Cameron" value={form.owner} onChange={e => setForm(f => ({ ...f, owner: e.target.value }))} /></div>
            <div><label style={lbl}>Financial year</label>
              <select style={{ ...inp, cursor: 'pointer' }} value={form.financial_year} onChange={e => setForm(f => ({ ...f, financial_year: e.target.value }))}>
                {FINANCIAL_YEARS.map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div><label style={lbl}>Status</label>
              <select style={{ ...inp, cursor: 'pointer' }} value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                {STATUSES.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
            <div><label style={lbl}>Jira ref</label><input style={inp} placeholder="e.g. SF-1951" value={form.jira_ref} onChange={e => setForm(f => ({ ...f, jira_ref: e.target.value }))} /></div>
          </div>

          <div style={{ borderTop: '1px solid var(--border)', paddingTop: '12px' }}>
            <div style={{ fontSize: '11px', fontWeight: '700', color: 'var(--blue)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: '10px' }}>Strategic context</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div><label style={lbl}>Pillar</label>
                  <select style={{ ...inp, cursor: 'pointer' }} value={form.pillar_id} onChange={e => setForm(f => ({ ...f, pillar_id: e.target.value, goal_id: '' }))}>
                    <option value="">— Select —</option>
                    {pillars.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div><label style={lbl}>KPI focus</label>
                  <select style={{ ...inp, cursor: 'pointer' }} value={form.goal_id} onChange={e => setForm(f => ({ ...f, goal_id: e.target.value }))} disabled={!form.pillar_id}>
                    <option value="">— Select —</option>
                    {filteredGoals.map(g => <option key={g.id} value={g.id}>{g.kpi_name}</option>)}
                  </select>
                </div>
              </div>
              <div><label style={lbl}>Value statement</label><textarea style={{ ...inp, minHeight: '56px', resize: 'vertical' }} placeholder="Why was this selected?" value={form.value_statement} onChange={e => setForm(f => ({ ...f, value_statement: e.target.value }))} /></div>
              <div><label style={lbl}>Lead metric</label><input style={inp} placeholder="e.g. Average handling time" value={form.lead_metric_name} onChange={e => setForm(f => ({ ...f, lead_metric_name: e.target.value }))} /></div>
            </div>
          </div>

          {error && <div style={{ fontSize: '12px', color: '#991B1B', background: '#FEE2E2', padding: '8px 12px', borderRadius: '4px' }}>{error}</div>}

          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', paddingTop: '4px' }}>
            <button onClick={onClose} style={{ padding: '8px 18px', borderRadius: '6px', border: '1px solid var(--border)', background: '#fff', fontSize: '13px', fontWeight: '500', color: 'var(--slate)', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>Cancel</button>
            <button onClick={save} disabled={saving} style={{ padding: '8px 18px', borderRadius: '6px', border: 'none', background: 'var(--blue)', fontSize: '13px', fontWeight: '600', color: '#fff', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1, fontFamily: 'DM Sans, sans-serif' }}>{saving ? 'Saving...' : 'Add to roadmap'}</button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Main Roadmap Component ──────────────────────────────────────────────────
export default function Roadmap() {
  const [items, setItems]       = useState([])
  const [pillars, setPillars]   = useState([])
  const [goals, setGoals]       = useState([])
  const [loading, setLoading]   = useState(true)
  const [showAdd, setShowAdd]   = useState(false)
  const [addContext, setAddContext] = useState({})
  const [selected, setSelected] = useState(null)
  const [filterYear, setFilterYear]           = useState(CURRENT_YEAR)
  const [filterConfidence, setFilterConfidence] = useState('all')
  const [filterTrack, setFilterTrack]         = useState('all')
  const [collapsedPillars, setCollapsedPillars] = useState({})
  const saveTimer = useRef({})

  async function loadAll() {
    const [ir, pr, gr] = await Promise.all([
      supabase.from('roadmap_items').select('*').order('created_at'),
      supabase.from('pillars').select('*').order('sort_order'),
      supabase.from('goals').select('*'),
    ])
    setItems(ir.data || [])
    setPillars(pr.data || [])
    setGoals(gr.data || [])
    setLoading(false)
  }

  useEffect(() => { loadAll() }, [])

  // Optimistic update + debounced persist
  const handleItemUpdate = useCallback((id, changes, persist) => {
    setItems(prev => prev.map(i => i.id === id ? { ...i, ...changes } : i))
    if (persist) {
      clearTimeout(saveTimer.current[id])
      saveTimer.current[id] = setTimeout(async () => {
        await supabase.from('roadmap_items').update(changes).eq('id', id)
      }, 300)
    }
  }, [])

  const totalWidth = MONTHS.length * COL_WIDTH

  // Build rows: one row per goal per pillar
  const rows = []
  pillars.forEach(pillar => {
    const pillarGoals = goals.filter(g => g.pillar_id === pillar.id)
    const collapsed = collapsedPillars[pillar.id]

    // Pillar header row
    rows.push({ type: 'pillar', pillar, collapsed })

    if (!collapsed) {
      if (pillarGoals.length === 0) {
        rows.push({ type: 'goal', pillar, goal: null, label: 'No KPI focus yet' })
      } else {
        pillarGoals.forEach(goal => {
          rows.push({ type: 'goal', pillar, goal })
          // Discovery sub-row
          rows.push({ type: 'discovery', pillar, goal })
        })
      }
    }
  })

  // Unlinked items row
  const unlinked = items.filter(i => !i.pillar_id && i.financial_year === filterYear)
  if (unlinked.length > 0) {
    rows.push({ type: 'unlinked' })
  }

  // Calculate total SVG height
  const rowHeights = rows.map(r => {
    if (r.type === 'pillar') return 32
    return ROW_HEIGHT
  })
  const totalHeight = HEADER_HEIGHT + SUBHEADER_HEIGHT + rowHeights.reduce((a, b) => a + b, 0)

  // Y positions
  let currentY = HEADER_HEIGHT + SUBHEADER_HEIGHT
  const rowYMap = rows.map(r => {
    const y = currentY
    currentY += r.type === 'pillar' ? 32 : ROW_HEIGHT
    return y
  })

  const selectStyle = { padding: '6px 10px', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '12px', fontFamily: 'DM Sans, sans-serif', color: 'var(--navy)', background: '#fff', cursor: 'pointer', outline: 'none' }

  return (
    <div style={{ marginLeft: '-48px', marginRight: '-48px', marginTop: '-40px', padding: '24px 32px' }}>
      {/* Page header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
        <div>
          <h1 className="font-display" style={{ fontSize: '24px', color: 'var(--navy)', marginBottom: '4px' }}>Unified Roadmap</h1>
          <p style={{ fontSize: '12px', color: 'var(--slate)' }}>Financial year {filterYear} · drag items to reposition · resize edges to adjust duration</p>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <select style={selectStyle} value={filterYear} onChange={e => setFilterYear(e.target.value)}>
            {FINANCIAL_YEARS.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <select style={selectStyle} value={filterTrack} onChange={e => setFilterTrack(e.target.value)}>
            <option value="all">All tracks</option>
            <option value="delivery">Delivery</option>
            <option value="discovery">Discovery</option>
          </select>
          <select style={selectStyle} value={filterConfidence} onChange={e => setFilterConfidence(e.target.value)}>
            <option value="all">All confidence</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
          <button onClick={() => { setAddContext({}); setShowAdd(true) }} style={{ padding: '8px 18px', borderRadius: '8px', border: 'none', background: 'var(--navy)', fontSize: '13px', fontWeight: '600', color: '#fff', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>+ Add item</button>
        </div>
      </div>

      {/* Legend */}
      <div style={{ display: 'flex', gap: '16px', marginBottom: '12px', flexWrap: 'wrap' }}>
        {ITEM_TYPES.map(t => (
          <div key={t.value} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <div style={{ width: '10px', height: '10px', borderRadius: '2px', background: t.bg, border: `1.5px solid ${t.color}` }} />
            <span style={{ fontSize: '11px', color: 'var(--slate)' }}>{t.label}</span>
          </div>
        ))}
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginLeft: '8px' }}>
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#166534' }} />
          <span style={{ fontSize: '11px', color: 'var(--slate)' }}>High</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#92400E' }} />
          <span style={{ fontSize: '11px', color: 'var(--slate)' }}>Medium</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#991B1B' }} />
          <span style={{ fontSize: '11px', color: 'var(--slate)' }}>Low confidence</span>
        </div>
      </div>

      {loading ? (
        <p style={{ fontSize: '13px', color: 'var(--slate-light)' }}>Loading...</p>
      ) : (
        <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: '10px', background: '#fff' }}>
          <div style={{ display: 'flex', minWidth: LEFT_PANEL + totalWidth }}>

            {/* Left panel — row labels */}
            <div style={{ width: LEFT_PANEL, flexShrink: 0, borderRight: '1px solid var(--border)', position: 'sticky', left: 0, background: '#fff', zIndex: 3 }}>
              {/* Header spacer */}
              <div style={{ height: HEADER_HEIGHT + SUBHEADER_HEIGHT, borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'flex-end', padding: '0 14px 8px' }}>
                <span style={{ fontSize: '10px', fontWeight: '700', color: 'var(--slate-light)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>Pillar / KPI Focus</span>
              </div>

              {rows.map((row, i) => {
                const y = rowYMap[i] - HEADER_HEIGHT - SUBHEADER_HEIGHT
                if (row.type === 'pillar') {
                  return (
                    <div key={`pl-${i}`} style={{ height: 32, display: 'flex', alignItems: 'center', padding: '0 14px', background: row.pillar.colour + '18', borderBottom: '1px solid var(--border)', cursor: 'pointer', gap: '8px' }}
                      onClick={() => setCollapsedPillars(p => ({ ...p, [row.pillar.id]: !p[row.pillar.id] }))}>
                      <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: row.pillar.colour, flexShrink: 0 }} />
                      <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--navy)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.pillar.name}</span>
                      <span style={{ fontSize: '10px', color: 'var(--slate-light)' }}>{row.collapsed ? '▸' : '▾'}</span>
                    </div>
                  )
                }
                if (row.type === 'goal') {
                  return (
                    <div key={`gl-${i}`} style={{ height: ROW_HEIGHT, display: 'flex', alignItems: 'center', padding: '0 14px 0 22px', borderBottom: '1px solid var(--border)', gap: '6px', borderLeft: `3px solid ${row.pillar.colour}` }}>
                      <div style={{ flex: 1, overflow: 'hidden' }}>
                        <div style={{ fontSize: '10px', fontWeight: '600', color: 'var(--navy)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {row.goal ? row.goal.kpi_name : <span style={{ color: 'var(--slate-light)', fontStyle: 'italic' }}>No KPI focus</span>}
                        </div>
                        {row.goal?.driver_statement && (
                          <div style={{ fontSize: '9px', color: 'var(--slate-light)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: '1px' }}>
                            ↳ {row.goal.driver_statement}
                          </div>
                        )}
                        <div style={{ fontSize: '9px', color: 'var(--blue)', marginTop: '2px', letterSpacing: '0.04em' }}>▸ DELIVERY</div>
                      </div>
                      <button
                        onClick={() => { setAddContext({ pillar_id: row.pillar.id, goal_id: row.goal?.id }); setShowAdd(true) }}
                        style={{ width: '20px', height: '20px', borderRadius: '4px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--slate-light)', cursor: 'pointer', fontSize: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                        title="Add item">+</button>
                    </div>
                  )
                }
                if (row.type === 'discovery') {
                  return (
                    <div key={`dl-${i}`} style={{ height: ROW_HEIGHT, display: 'flex', alignItems: 'center', padding: '0 14px 0 22px', borderBottom: '1px solid var(--border)', background: '#FAFAFA', borderLeft: `3px solid ${row.pillar.colour}` }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '9px', color: '#7C3AED', letterSpacing: '0.04em', fontWeight: '600' }}>◈ DISCOVERY</div>
                      </div>
                    </div>
                  )
                }
                if (row.type === 'unlinked') {
                  return (
                    <div key={`ul-${i}`} style={{ height: ROW_HEIGHT, display: 'flex', alignItems: 'center', padding: '0 14px', borderBottom: '1px solid var(--border)', background: '#FFF7ED' }}>
                      <span style={{ fontSize: '10px', fontWeight: '600', color: '#92400E' }}>⚠ Unlinked items</span>
                    </div>
                  )
                }
                return null
              })}
            </div>

            {/* Timeline SVG */}
            <div style={{ flex: 1, overflowX: 'auto' }}>
              <svg width={totalWidth} height={totalHeight} style={{ display: 'block' }}>
                {/* Quarter backgrounds */}
                {QUARTERS.map((q, qi) => {
                  const startMonth = quarterStartIndex(q)
                  const x = startMonth * COL_WIDTH
                  const w = 3 * COL_WIDTH
                  return (
                    <rect key={q} x={x} y={0} width={w} height={totalHeight}
                      fill={qi % 2 === 0 ? '#FAFAFA' : '#F3F4F6'} />
                  )
                })}

                {/* Quarter headers */}
                {QUARTERS.map(q => {
                  const startMonth = quarterStartIndex(q)
                  const x = startMonth * COL_WIDTH
                  const w = 3 * COL_WIDTH
                  return (
                    <g key={`qh-${q}`}>
                      <rect x={x} y={0} width={w} height={HEADER_HEIGHT}
                        fill={q === 'Q1' ? 'var(--navy)' : q === 'Q2' ? '#1E3A8A' : q === 'Q3' ? '#1E40AF' : '#2563EB'} />
                      <text x={x + w / 2} y={HEADER_HEIGHT / 2 + 5}
                        textAnchor="middle" fill="white"
                        fontSize={13} fontWeight={700} fontFamily="DM Sans, sans-serif">
                        {q}
                      </text>
                    </g>
                  )
                })}

                {/* Month sub-headers */}
                {MONTHS.map((m, mi) => {
                  const x = mi * COL_WIDTH
                  return (
                    <g key={`mh-${m}`}>
                      <rect x={x} y={HEADER_HEIGHT} width={COL_WIDTH} height={SUBHEADER_HEIGHT}
                        fill={mi % 2 === 0 ? '#F8FAFC' : '#F1F5F9'} />
                      <text x={x + COL_WIDTH / 2} y={HEADER_HEIGHT + SUBHEADER_HEIGHT / 2 + 4}
                        textAnchor="middle" fill="#64748B"
                        fontSize={10} fontFamily="DM Sans, sans-serif" fontWeight={500}>
                        {m}
                      </text>
                      {/* Vertical grid line */}
                      <line x1={x} y1={HEADER_HEIGHT} x2={x} y2={totalHeight} stroke="#E2E8F0" strokeWidth={0.5} />
                    </g>
                  )
                })}

                {/* Row backgrounds and horizontal lines */}
                {rows.map((row, i) => {
                  const y = rowYMap[i]
                  const h = row.type === 'pillar' ? 32 : ROW_HEIGHT
                  return (
                    <g key={`rbg-${i}`}>
                      {row.type === 'pillar' && (
                        <rect x={0} y={y} width={totalWidth} height={h}
                          fill={row.pillar.colour + '12'} />
                      )}
                      {row.type === 'discovery' && (
                        <rect x={0} y={y} width={totalWidth} height={h} fill="#FAFAFA" />
                      )}
                      {row.type === 'unlinked' && (
                        <rect x={0} y={y} width={totalWidth} height={h} fill="#FFF7ED" />
                      )}
                      <line x1={0} y1={y + h} x2={totalWidth} y2={y + h} stroke="#E2E8F0" strokeWidth={0.5} />
                    </g>
                  )
                })}

                {/* Roadmap items */}
                {rows.map((row, i) => {
                  if (row.type === 'pillar' || row.type === 'unlinked' && false) return null
                  const rowY = rowYMap[i]

                  let rowItems = []
                  if (row.type === 'goal' && row.goal) {
                    rowItems = items.filter(item =>
                      item.goal_id === row.goal.id &&
                      item.track === 'delivery' &&
                      item.financial_year === filterYear &&
                      (filterConfidence === 'all' || confidenceLevel(item) === filterConfidence) &&
                      (filterTrack === 'all' || filterTrack === 'delivery')
                    )
                  } else if (row.type === 'discovery' && row.goal) {
                    rowItems = items.filter(item =>
                      item.goal_id === row.goal.id &&
                      item.track === 'discovery' &&
                      item.financial_year === filterYear &&
                      (filterConfidence === 'all' || confidenceLevel(item) === filterConfidence) &&
                      (filterTrack === 'all' || filterTrack === 'discovery')
                    )
                  } else if (row.type === 'unlinked') {
                    rowItems = items.filter(item =>
                      !item.pillar_id &&
                      item.financial_year === filterYear
                    )
                  }

                  return rowItems.map(item => (
                    <TimelineItem
                      key={item.id}
                      item={item}
                      rowY={rowY}
                      onUpdate={handleItemUpdate}
                      onClick={setSelected}
                    />
                  ))
                })}
              </svg>
            </div>
          </div>
        </div>
      )}

      {showAdd && (
        <AddItemModal
          pillars={pillars}
          goals={goals}
          defaultPillarId={addContext.pillar_id}
          defaultGoalId={addContext.goal_id}
          onClose={() => setShowAdd(false)}
          onSaved={() => { setShowAdd(false); loadAll() }}
        />
      )}

      {selected && (
        <ItemDetailPanel
          item={selected}
          pillars={pillars}
          goals={goals}
          onClose={() => setSelected(null)}
          onSaved={() => { setSelected(null); loadAll() }}
          onDeleted={() => { setSelected(null); loadAll() }}
        />
      )}
    </div>
  )
}