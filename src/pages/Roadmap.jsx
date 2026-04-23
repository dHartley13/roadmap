import { useEffect, useState, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'

// ── Config ──────────────────────────────────────────────────────────────────
const MONTHS = ['Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec','Jan','Feb','Mar']
const WEEKS_PER_MONTH = 4
const MONTH_TO_QUARTER = {
  Apr:'Q1',May:'Q1',Jun:'Q1',
  Jul:'Q2',Aug:'Q2',Sep:'Q2',
  Oct:'Q3',Nov:'Q3',Dec:'Q3',
  Jan:'Q4',Feb:'Q4',Mar:'Q4',
}
const QUARTERS = ['Q1','Q2','Q3','Q4']
const QUARTER_MONTHS = {
  Q1:['Apr','May','Jun'],
  Q2:['Jul','Aug','Sep'],
  Q3:['Oct','Nov','Dec'],
  Q4:['Jan','Feb','Mar'],
}
const FINANCIAL_YEARS = ['2024-2025','2025-2026','2026-2027']
const CURRENT_YEAR = '2025-2026'

const MONTH_W = 120
const WEEK_W  = MONTH_W / WEEKS_PER_MONTH
const TOTAL_MONTHS = 12
const TOTAL_WEEKS  = TOTAL_MONTHS * WEEKS_PER_MONTH
const TOTAL_W = TOTAL_MONTHS * MONTH_W

const QUARTER_H  = 32
const MONTH_H    = 24
const WEEK_H     = 20
const HEADER_H   = QUARTER_H + MONTH_H + WEEK_H
const PILLAR_H   = 28
const TEAM_H     = 44
const OUTCOME_H  = 52
const LEFT_W     = 240

const ITEM_TYPES = [
  { value:'dev',         label:'Dev',         color:'#1E40AF', bg:'#DBEAFE' },
  { value:'non_dev',     label:'Non-Dev',      color:'#0F766E', bg:'#CCFBF1' },
  { value:'discovery',   label:'Discovery',    color:'#7C3AED', bg:'#EDE9FE' },
  { value:'operational', label:'Operational',  color:'#B45309', bg:'#FEF3C7' },
]
const STATUSES = [
  { value:'to_do',       label:'To Do',        color:'#475569', bg:'#F1F5F9' },
  { value:'in_progress', label:'In Progress',  color:'#1E40AF', bg:'#DBEAFE' },
  { value:'done',        label:'Done',         color:'#166534', bg:'#DCFCE7' },
  { value:'on_hold',     label:'On Hold',      color:'#92400E', bg:'#FEF3C7' },
  { value:'blocked',     label:'Blocked',      color:'#991B1B', bg:'#FEE2E2' },
]

function typeMeta(v)   { return ITEM_TYPES.find(t=>t.value===v)||ITEM_TYPES[0] }
function statusMeta(v) { return STATUSES.find(s=>s.value===v)||STATUSES[0] }

function confidenceLevel(item) {
  const f = [item.pillar_id,item.goal_id,item.value_statement,item.lead_metric_name].filter(Boolean).length
  return f===4?'high':f>=2?'medium':'low'
}
function confidenceMeta(l) {
  return ({
    high:  {color:'#166534',bg:'#DCFCE7',label:'High'},
    medium:{color:'#92400E',bg:'#FEF3C7',label:'Medium'},
    low:   {color:'#991B1B',bg:'#FEE2E2',label:'Low'},
  })[l]||{color:'#991B1B',bg:'#FEE2E2',label:'Low'}
}

function quarterStartWeek(q) {
  const monthIdx = MONTHS.indexOf(QUARTER_MONTHS[q][0])
  return monthIdx * WEEKS_PER_MONTH
}
function monthStartWeek(monthIdx) { return monthIdx * WEEKS_PER_MONTH }
function weekToX(week) { return week * WEEK_W }
function xToWeek(x)    { return Math.max(0, Math.min(TOTAL_WEEKS-1, Math.round(x/WEEK_W))) }
function weekToMonth(week) { return Math.floor(week/WEEKS_PER_MONTH) }
function weekToQuarter(week) { return MONTH_TO_QUARTER[MONTHS[weekToMonth(week)]] }

function defaultWeeks(quarter) {
  const sw = quarterStartWeek(quarter||'Q1')
  return { start_week: sw, end_week: sw + WEEKS_PER_MONTH }
}

// ── Timeline Item ───────────────────────────────────────────────────────────
function TimelineItem({ item, rowY, onUpdate, onClick }) {
  const dragRef = useRef(null)
  const tm = typeMeta(item.type)
  const cm = confidenceMeta(confidenceLevel(item))

  const sw = item.start_week ?? quarterStartWeek(item.quarter || 'Q1')
  const ew = item.end_week   ?? sw + WEEKS_PER_MONTH
  const x  = weekToX(sw)
  const w  = Math.max(WEEK_W, weekToX(ew) - x)

  function startDrag(e, mode) {
    e.stopPropagation()
    e.preventDefault()
    dragRef.current = {
      mode,
      startX: e.clientX,
      origSW: sw,
      origEW: ew,
      lastSW: sw,
      lastEW: ew,
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  function onMove(e) {
    if (!dragRef.current) return
    const { mode, startX, origSW, origEW } = dragRef.current
    const dw = Math.round((e.clientX - startX) / WEEK_W)
    let ns = origSW, ne = origEW

    if (mode === 'move') {
      ns = Math.max(0, Math.min(TOTAL_WEEKS - 1, origSW + dw))
      ne = Math.max(1, Math.min(TOTAL_WEEKS, origEW + dw))
    } else if (mode === 'left') {
      ns = Math.max(0, Math.min(origEW - 1, origSW + dw))
      ne = origEW
    } else if (mode === 'right') {
      ns = origSW
      ne = Math.max(origSW + 1, Math.min(TOTAL_WEEKS, origEW + dw))
    }

    // Store latest values in ref so onUp can read them
    dragRef.current.lastSW = ns
    dragRef.current.lastEW = ne

    onUpdate(item.id, {
      start_week: ns,
      end_week: ne,
      quarter: weekToQuarter(ns)
    }, false)
  }

  function onUp() {
    window.removeEventListener('mousemove', onMove)
    window.removeEventListener('mouseup', onUp)
    if (!dragRef.current) return

    // Use lastSW/lastEW from ref — not from closure
    const { lastSW, lastEW } = dragRef.current
    onUpdate(item.id, {
      start_week: lastSW,
      end_week: lastEW,
      quarter: weekToQuarter(lastSW)
    }, true)

    dragRef.current = null
  }

  const itemH = TEAM_H - 10

  return (
    <g>
      <rect
        x={x + 2} y={rowY + 5} width={w - 4} height={itemH} rx={4}
        fill={tm.bg} stroke={tm.color} strokeWidth={1.5}
        onMouseDown={e => startDrag(e, 'move')}
        onClick={() => onClick(item)}
        style={{ cursor: 'grab' }}
      />
      <circle cx={x + w - 10} cy={rowY + 12} r={3.5} fill={cm.color} style={{ pointerEvents: 'none' }} />
      <foreignObject x={x + 7} y={rowY + 6} width={Math.max(0, w - 20)} height={itemH - 4} style={{ pointerEvents: 'none' }}>
        <div xmlns="http://www.w3.org/1999/xhtml" style={{
          fontSize: '10px', fontWeight: '600', color: tm.color,
          fontFamily: 'DM Sans, sans-serif', lineHeight: '1.3',
          overflow: 'hidden', display: '-webkit-box',
          WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
          wordBreak: 'break-word',
        }}>{item.title}</div>
      </foreignObject>
      {/* Left resize handle */}
      <rect
        x={x + 2} y={rowY + 5} width={8} height={itemH} rx={2}
        fill="transparent"
        style={{ cursor: 'ew-resize' }}
        onMouseDown={e => startDrag(e, 'left')}
      />
      {/* Right resize handle */}
      <rect
        x={x + w - 10} y={rowY + 5} width={8} height={itemH} rx={2}
        fill="transparent"
        style={{ cursor: 'ew-resize' }}
        onMouseDown={e => startDrag(e, 'right')}
      />
    </g>
  )
}

// ── Outcome Cell ────────────────────────────────────────────────────────────
function OutcomeCell({ outcomes, pillarId, goalId, quarter, year, filterTeam, teams, onReload }) {
  const [adding, setAdding] = useState(false)
  const [text, setText]     = useState('')
  const [teamId, setTeamId] = useState(filterTeam || '')
  const [saving, setSaving] = useState(false)

  const qOutcomes = outcomes.filter(o =>
    o.pillar_id===pillarId && 
    o.goal_id===goalId &&
    o.team_id===teamId &&
    o.quarter===quarter && 
    o.financial_year===year &&
    (filterTeam === '' || o.team_id === filterTeam || o.team_id === null)
  )

  async function save() {
    if (!text.trim()) return
    setSaving(true)
    await supabase.from('quarterly_outcomes').insert({
      pillar_id: pillarId, 
      goal_id: goalId,
      team_id: teamId || null,
      quarter, 
      financial_year: year,
      summary: text.trim(),
    })
    setSaving(false)
    setText('')
    setAdding(false)
    onReload()
  }

  async function deleteOutcome(id) {
    await supabase.from('quarterly_outcomes').delete().eq('id', id)
    onReload()
  }

  return (
    <div style={{ padding:'4px 6px', minHeight: OUTCOME_H, display:'flex', flexDirection:'column', gap:'3px' }}>
      {qOutcomes.map(o => (
        <div key={o.id} style={{
          background:'#fff', border:'1px solid var(--border)',
          borderRadius:'4px', padding:'4px 8px',
          display:'flex', alignItems:'flex-start', gap:'6px'
        }}>
          <span style={{ fontSize:'10px', color:'var(--navy)', lineHeight:'1.4', flex:1 }}>{o.summary}</span>
          <button onClick={() => deleteOutcome(o.id)} style={{
            border:'none', background:'transparent', color:'var(--slate-light)',
            cursor:'pointer', fontSize:'11px', flexShrink:0, padding:0, lineHeight:1
          }}>✕</button>
        </div>
      ))}
      {adding ? (
        <div style={{ display:'flex', flexDirection:'column', gap:'4px' }}>
          <input autoFocus
            value={text} onChange={e=>setText(e.target.value)}
            onKeyDown={e=>{ if(e.key==='Enter') save(); if(e.key==='Escape') setAdding(false) }}
            placeholder="Outcome summary..."
            style={{ fontSize:'10px', padding:'4px 6px', border:'1px solid var(--blue)', borderRadius:'4px', fontFamily:'DM Sans, sans-serif', outline:'none' }}
          />
          <div style={{ display:'flex', gap:'4px', alignItems:'center' }}>
            <span style={{ fontSize:'9px', color:'var(--slate-light)' }}>Team:</span>
              <select value={teamId} onChange={e=>setTeamId(e.target.value)}
                style={{ fontSize:'10px', padding:'2px 4px', border:'1px solid var(--border)', borderRadius:'4px', fontFamily:'DM Sans, sans-serif', flex:1, outline:'none' }}>
                <option value="">— unassigned —</option>
                {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            <button onClick={save} disabled={saving} style={{ fontSize:'10px', padding:'4px 8px', borderRadius:'4px', border:'none', background:'var(--blue)', color:'#fff', cursor:'pointer', fontFamily:'DM Sans, sans-serif' }}>
              {saving?'…':'Add'}
            </button>
            <button onClick={()=>setAdding(false)} style={{ fontSize:'10px', padding:'4px 6px', borderRadius:'4px', border:'1px solid var(--border)', background:'#fff', color:'var(--slate)', cursor:'pointer', fontFamily:'DM Sans, sans-serif' }}>✕</button>
          </div>
        </div>
      ) : (
        <button onClick={()=>{ setTeamId(filterTeam||''); setAdding(true) }} style={{
          fontSize:'9px', color:'var(--slate-light)', background:'transparent',
          border:'1px dashed var(--border)', borderRadius:'4px',
          padding:'2px 6px', cursor:'pointer', fontFamily:'DM Sans, sans-serif',
          alignSelf:'flex-start'
        }}>+ outcome</button>
      )}
    </div>
  )
}

// ── Item Detail Panel ───────────────────────────────────────────────────────
function ItemDetailPanel({ item, pillars, goals, teams, onClose, onSaved, onDeleted }) {
  const [form, setForm]         = useState({...item})
  const [saving, setSaving]     = useState(false)
  const [confirmDelete, setCD]  = useState(false)
  const filteredGoals = goals.filter(g=>g.pillar_id===form.pillar_id)

  async function save() {
    setSaving(true)
    await supabase.from('roadmap_items').update({
      title:form.title, type:form.type, track:form.track,
      status:form.status, quarter:form.quarter,
      financial_year:form.financial_year, owner:form.owner||null,
      pillar_id:form.pillar_id||null, goal_id:form.goal_id||null,
      team_id:form.team_id||null,
      value_statement:form.value_statement||null,
      lead_metric_name:form.lead_metric_name||null,
      jira_ref:form.jira_ref||null, doc_url:form.doc_url||null,
    }).eq('id',item.id)
    setSaving(false)
    onSaved()
  }

  async function del() {
    await supabase.from('roadmap_items').delete().eq('id',item.id)
    onDeleted()
  }

  const inp = { width:'100%',padding:'7px 10px',border:'1px solid var(--border)',borderRadius:'6px',fontSize:'12px',fontFamily:'DM Sans, sans-serif',color:'var(--navy)',background:'#fff',outline:'none' }
  const lbl = { fontSize:'10px',fontWeight:'600',color:'var(--slate)',letterSpacing:'0.06em',textTransform:'uppercase',marginBottom:'4px',display:'block' }
  const cm  = confidenceMeta(confidenceLevel(form))
  const missing = [!form.pillar_id&&'Pillar',!form.goal_id&&'KPI focus',!form.value_statement&&'Value statement',!form.lead_metric_name&&'Lead metric'].filter(Boolean)

  return (
    <div style={{position:'fixed',inset:0,background:'rgba(15,23,42,0.5)',display:'flex',justifyContent:'flex-end',zIndex:100}}
      onClick={e=>{if(e.target===e.currentTarget)onClose()}}>
      <div style={{width:'460px',height:'100vh',background:'#fff',overflow:'auto',display:'flex',flexDirection:'column',boxShadow:'-8px 0 32px rgba(0,0,0,0.15)'}}>

        <div style={{padding:'18px 22px',borderBottom:'1px solid var(--border)',display:'flex',justifyContent:'space-between',alignItems:'center',position:'sticky',top:0,background:'#fff',zIndex:1}}>
          <div>
            <div style={{fontSize:'10px',color:'var(--slate-light)',letterSpacing:'0.06em',textTransform:'uppercase',marginBottom:'2px'}}>Item detail</div>
            <div style={{fontSize:'14px',fontWeight:'700',color:'var(--navy)',lineHeight:'1.3'}}>{form.title}</div>
          </div>
          <button onClick={onClose} style={{width:'28px',height:'28px',borderRadius:'6px',border:'1px solid var(--border)',background:'transparent',color:'var(--slate-light)',cursor:'pointer',fontSize:'14px',display:'flex',alignItems:'center',justifyContent:'center'}}>✕</button>
        </div>

        <div style={{padding:'10px 22px',background:cm.bg,borderBottom:'1px solid var(--border)'}}>
          <div style={{display:'flex',justifyContent:'space-between'}}>
            <span style={{fontSize:'11px',fontWeight:'700',color:cm.color}}>{cm.label} confidence</span>
            <span style={{fontSize:'10px',color:cm.color}}>{4-missing.length}/4 fields</span>
          </div>
          {missing.length>0&&<div style={{fontSize:'10px',color:cm.color,marginTop:'3px'}}>Missing: {missing.join(' · ')}</div>}
        </div>

        <div style={{padding:'18px 22px',display:'flex',flexDirection:'column',gap:'12px',flex:1}}>
          <div><label style={lbl}>Title</label><input style={inp} value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))}/></div>

          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'10px'}}>
            <div><label style={lbl}>Type</label>
              <select style={{...inp,cursor:'pointer'}} value={form.type} onChange={e=>setForm(f=>({...f,type:e.target.value}))}>
                {ITEM_TYPES.map(t=><option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div><label style={lbl}>Status</label>
              <select style={{...inp,cursor:'pointer'}} value={form.status} onChange={e=>setForm(f=>({...f,status:e.target.value}))}>
                {STATUSES.map(s=><option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
          </div>

          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'10px'}}>
            <div><label style={lbl}>Team</label>
              <select style={{...inp,cursor:'pointer'}} value={form.team_id||''} onChange={e=>setForm(f=>({...f,team_id:e.target.value}))}>
                <option value="">— No team —</option>
                {teams.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div><label style={lbl}>Owner</label><input style={inp} value={form.owner||''} onChange={e=>setForm(f=>({...f,owner:e.target.value}))}/></div>
          </div>

          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'10px'}}>
            <div><label style={lbl}>Quarter (from position)</label>
              <input style={{...inp,background:'var(--bg)',color:'var(--slate)'}} value={form.quarter||'—'} readOnly/>
            </div>
            <div><label style={lbl}>Financial year</label>
              <select style={{...inp,cursor:'pointer'}} value={form.financial_year||CURRENT_YEAR} onChange={e=>setForm(f=>({...f,financial_year:e.target.value}))}>
                {FINANCIAL_YEARS.map(y=><option key={y} value={y}>{y}</option>)}
              </select>
            </div>
          </div>

          <div style={{borderTop:'1px solid var(--border)',paddingTop:'12px'}}>
            <div style={{fontSize:'11px',fontWeight:'700',color:'var(--blue)',letterSpacing:'0.06em',textTransform:'uppercase',marginBottom:'10px'}}>Strategic context</div>
            <div style={{display:'flex',flexDirection:'column',gap:'10px'}}>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'10px'}}>
                <div><label style={lbl}>Pillar</label>
                  <select style={{...inp,cursor:'pointer'}} value={form.pillar_id||''} onChange={e=>setForm(f=>({...f,pillar_id:e.target.value,goal_id:''}))}>
                    <option value="">— Select —</option>
                    {pillars.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div><label style={lbl}>KPI focus</label>
                  <select style={{...inp,cursor:'pointer'}} value={form.goal_id||''} onChange={e=>setForm(f=>({...f,goal_id:e.target.value}))} disabled={!form.pillar_id}>
                    <option value="">— Select —</option>
                    {goals.filter(g=>g.pillar_id===form.pillar_id).map(g=><option key={g.id} value={g.id}>{g.kpi_name}</option>)}
                  </select>
                </div>
              </div>
              <div><label style={lbl}>Value statement</label>
                <textarea style={{...inp,minHeight:'56px',resize:'vertical'}} value={form.value_statement||''} onChange={e=>setForm(f=>({...f,value_statement:e.target.value}))} placeholder="Why was this selected?"/>
              </div>
              <div><label style={lbl}>Lead metric</label>
                <input style={inp} value={form.lead_metric_name||''} onChange={e=>setForm(f=>({...f,lead_metric_name:e.target.value}))} placeholder="e.g. Average handling time"/>
              </div>
            </div>
          </div>

          <div style={{borderTop:'1px solid var(--border)',paddingTop:'12px'}}>
            <div style={{fontSize:'11px',fontWeight:'700',color:'var(--blue)',letterSpacing:'0.06em',textTransform:'uppercase',marginBottom:'10px'}}>References</div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'10px'}}>
              <div><label style={lbl}>Jira ref</label><input style={inp} value={form.jira_ref||''} onChange={e=>setForm(f=>({...f,jira_ref:e.target.value}))} placeholder="e.g. SF-1951"/></div>
              <div><label style={lbl}>Doc URL</label>
                <input style={inp} value={form.doc_url||''} onChange={e=>setForm(f=>({...f,doc_url:e.target.value}))} placeholder="https://..."/>
                {form.doc_url&&<a href={form.doc_url} target="_blank" rel="noreferrer" style={{fontSize:'10px',color:'var(--blue)',marginTop:'3px',display:'block'}}>Open ↗</a>}
              </div>
            </div>
          </div>
        </div>

        <div style={{padding:'14px 22px',borderTop:'1px solid var(--border)',display:'flex',justifyContent:'space-between',alignItems:'center',position:'sticky',bottom:0,background:'#fff'}}>
          <button onClick={()=>setCD(true)} style={{padding:'7px 14px',borderRadius:'6px',border:'1px solid var(--border)',background:'transparent',fontSize:'12px',color:'var(--slate-light)',cursor:'pointer',fontFamily:'DM Sans, sans-serif'}}>Delete</button>
          <div style={{display:'flex',gap:'8px'}}>
            <button onClick={onClose} style={{padding:'7px 14px',borderRadius:'6px',border:'1px solid var(--border)',background:'#fff',fontSize:'12px',color:'var(--slate)',cursor:'pointer',fontFamily:'DM Sans, sans-serif'}}>Cancel</button>
            <button onClick={save} disabled={saving} style={{padding:'7px 14px',borderRadius:'6px',border:'none',background:'var(--blue)',fontSize:'12px',fontWeight:'600',color:'#fff',cursor:saving?'not-allowed':'pointer',opacity:saving?0.7:1,fontFamily:'DM Sans, sans-serif'}}>{saving?'Saving…':'Save'}</button>
          </div>
        </div>

        {confirmDelete&&(
          <div style={{position:'fixed',inset:0,background:'rgba(15,23,42,0.6)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:200}}>
            <div style={{background:'#fff',borderRadius:'12px',width:'360px',padding:'28px',boxShadow:'0 24px 48px rgba(0,0,0,0.2)'}}>
              <h3 className="font-display" style={{fontSize:'16px',color:'var(--navy)',marginBottom:'8px'}}>Delete this item?</h3>
              <p style={{fontSize:'12px',color:'var(--slate)',marginBottom:'20px',lineHeight:'1.5'}}><strong>{item.title}</strong> will be permanently removed.</p>
              <div style={{display:'flex',gap:'8px',justifyContent:'flex-end'}}>
                <button onClick={()=>setCD(false)} style={{padding:'8px 16px',borderRadius:'6px',border:'1px solid var(--border)',background:'#fff',fontSize:'12px',color:'var(--slate)',cursor:'pointer',fontFamily:'DM Sans, sans-serif'}}>Cancel</button>
                <button onClick={del} style={{padding:'8px 16px',borderRadius:'6px',border:'none',background:'#991B1B',fontSize:'12px',fontWeight:'600',color:'#fff',cursor:'pointer',fontFamily:'DM Sans, sans-serif'}}>Delete</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Add Item Modal ──────────────────────────────────────────────────────────
function AddItemModal({ pillars, goals, teams, defaultPillarId, defaultGoalId, defaultTeamId, onClose, onSaved }) {
  const [form, setForm] = useState({
    title:'', type:'dev', track:'delivery', status:'to_do',
    quarter:'Q1', financial_year:CURRENT_YEAR, owner:'',
    pillar_id:defaultPillarId||'', goal_id:defaultGoalId||'',
    team_id:defaultTeamId||'',
    value_statement:'', lead_metric_name:'', jira_ref:'', doc_url:'',
    ...defaultWeeks('Q1'),
  })
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState(null)
  const filteredGoals = goals.filter(g=>g.pillar_id===form.pillar_id)

  async function save() {
    if (!form.title.trim()) return setError('Title is required')
    setSaving(true)
    const { error } = await supabase.from('roadmap_items').insert({
      title:form.title.trim(), type:form.type, track:'delivery',
      status:form.status, quarter:form.quarter,
      financial_year:form.financial_year, owner:form.owner||null,
      pillar_id:form.pillar_id||null, goal_id:form.goal_id||null,
      team_id:form.team_id||null,
      value_statement:form.value_statement||null,
      lead_metric_name:form.lead_metric_name||null,
      jira_ref:form.jira_ref||null, doc_url:form.doc_url||null,
      start_week:form.start_week, end_week:form.end_week,
    })
    setSaving(false)
    if (error) return setError(error.message)
    onSaved()
  }

  const inp = {width:'100%',padding:'8px 10px',border:'1px solid var(--border)',borderRadius:'6px',fontSize:'12px',fontFamily:'DM Sans, sans-serif',color:'var(--navy)',background:'#fff',outline:'none'}
  const lbl = {fontSize:'10px',fontWeight:'600',color:'var(--slate)',letterSpacing:'0.06em',textTransform:'uppercase',marginBottom:'4px',display:'block'}
  const cm  = confidenceMeta(confidenceLevel(form))
  const missing = [!form.pillar_id&&'Pillar',!form.goal_id&&'KPI',!form.value_statement&&'Value',!form.lead_metric_name&&'Metric'].filter(Boolean)

  return (
    <div style={{position:'fixed',inset:0,background:'rgba(15,23,42,0.6)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:100}}>
      <div style={{background:'#fff',borderRadius:'12px',width:'540px',maxHeight:'90vh',overflow:'auto',padding:'28px',boxShadow:'0 24px 48px rgba(0,0,0,0.2)'}}>
        <div style={{marginBottom:'16px',display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
          <div>
            <h2 className="font-display" style={{fontSize:'18px',color:'var(--navy)',marginBottom:'3px'}}>Add roadmap item</h2>
            <p style={{fontSize:'12px',color:'var(--slate)'}}>Only title is required.</p>
          </div>
          <div style={{padding:'6px 10px',borderRadius:'6px',background:cm.bg,textAlign:'right',flexShrink:0,marginLeft:'12px'}}>
            <div style={{fontSize:'9px',fontWeight:'700',color:cm.color,letterSpacing:'0.06em',textTransform:'uppercase'}}>{cm.label} confidence</div>
            <div style={{fontSize:'10px',color:cm.color}}>{4-missing.length}/4</div>
          </div>
        </div>

        <div style={{display:'flex',flexDirection:'column',gap:'12px'}}>
          <div><label style={lbl}>Title *</label><input style={inp} placeholder="e.g. Dynamic routing engine" value={form.title} onChange={e=>setForm(f=>({...f,title:e.target.value}))}/></div>

          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:'10px'}}>
            <div><label style={lbl}>Type</label>
              <select style={{...inp,cursor:'pointer'}} value={form.type} onChange={e=>setForm(f=>({...f,type:e.target.value}))}>
                {ITEM_TYPES.map(t=><option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div><label style={lbl}>Quarter</label>
              <select style={{...inp,cursor:'pointer'}} value={form.quarter} onChange={e=>{
                const q=e.target.value
                setForm(f=>({...f,quarter:q,...defaultWeeks(q)}))
              }}>
                {QUARTERS.map(q=><option key={q} value={q}>{q}</option>)}
              </select>
            </div>
            <div><label style={lbl}>Status</label>
              <select style={{...inp,cursor:'pointer'}} value={form.status} onChange={e=>setForm(f=>({...f,status:e.target.value}))}>
                {STATUSES.map(s=><option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
          </div>

          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:'10px'}}>
            <div><label style={lbl}>Team</label>
              <select style={{...inp,cursor:'pointer'}} value={form.team_id} onChange={e=>setForm(f=>({...f,team_id:e.target.value}))}>
                <option value="">— No team —</option>
                {teams.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </div>
            <div><label style={lbl}>Owner</label><input style={inp} placeholder="e.g. Cameron" value={form.owner} onChange={e=>setForm(f=>({...f,owner:e.target.value}))}/></div>
            <div><label style={lbl}>Jira ref</label><input style={inp} placeholder="e.g. SF-1951" value={form.jira_ref} onChange={e=>setForm(f=>({...f,jira_ref:e.target.value}))}/></div>
          </div>

          <div style={{borderTop:'1px solid var(--border)',paddingTop:'12px'}}>
            <div style={{fontSize:'11px',fontWeight:'700',color:'var(--blue)',letterSpacing:'0.06em',textTransform:'uppercase',marginBottom:'10px'}}>Strategic context</div>
            <div style={{display:'flex',flexDirection:'column',gap:'10px'}}>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'10px'}}>
                <div><label style={lbl}>Pillar</label>
                  <select style={{...inp,cursor:'pointer'}} value={form.pillar_id} onChange={e=>setForm(f=>({...f,pillar_id:e.target.value,goal_id:''}))}>
                    <option value="">— Select —</option>
                    {pillars.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div><label style={lbl}>KPI focus</label>
                  <select style={{...inp,cursor:'pointer'}} value={form.goal_id} onChange={e=>setForm(f=>({...f,goal_id:e.target.value}))} disabled={!form.pillar_id}>
                    <option value="">— Select —</option>
                    {filteredGoals.map(g=><option key={g.id} value={g.id}>{g.kpi_name}</option>)}
                  </select>
                </div>
              </div>
              <div><label style={lbl}>Value statement</label>
                <textarea style={{...inp,minHeight:'52px',resize:'vertical'}} placeholder="Why was this selected?" value={form.value_statement} onChange={e=>setForm(f=>({...f,value_statement:e.target.value}))}/>
              </div>
              <div><label style={lbl}>Lead metric</label>
                <input style={inp} placeholder="e.g. Average handling time" value={form.lead_metric_name} onChange={e=>setForm(f=>({...f,lead_metric_name:e.target.value}))}/>
              </div>
            </div>
          </div>

          {error&&<div style={{fontSize:'12px',color:'#991B1B',background:'#FEE2E2',padding:'8px 12px',borderRadius:'4px'}}>{error}</div>}

          <div style={{display:'flex',gap:'8px',justifyContent:'flex-end',paddingTop:'4px'}}>
            <button onClick={onClose} style={{padding:'8px 16px',borderRadius:'6px',border:'1px solid var(--border)',background:'#fff',fontSize:'12px',fontWeight:'500',color:'var(--slate)',cursor:'pointer',fontFamily:'DM Sans, sans-serif'}}>Cancel</button>
            <button onClick={save} disabled={saving} style={{padding:'8px 16px',borderRadius:'6px',border:'none',background:'var(--blue)',fontSize:'12px',fontWeight:'600',color:'#fff',cursor:saving?'not-allowed':'pointer',opacity:saving?0.7:1,fontFamily:'DM Sans, sans-serif'}}>{saving?'Saving…':'Add to roadmap'}</button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Main ────────────────────────────────────────────────────────────────────
export default function Roadmap() {
  const [items,    setItems]    = useState([])
  const [pillars,  setPillars]  = useState([])
  const [goals,    setGoals]    = useState([])
  const [teams,    setTeams]    = useState([])
  const [outcomes, setOutcomes] = useState([])
  const [loading,  setLoading]  = useState(true)
  const [showAdd,  setShowAdd]  = useState(false)
  const [addCtx,   setAddCtx]   = useState({})
  const [selected, setSelected] = useState(null)
  const [filterYear,       setFilterYear]       = useState(CURRENT_YEAR)
  const [filterTeam,       setFilterTeam]       = useState('')
  const [filterConfidence, setFilterConfidence] = useState('all')
  const [collapsedPillars, setCollapsedPillars] = useState({})
  const [collapsedTeams,   setCollapsedTeams]   = useState({})
  const saveTimer = useRef({})

  async function loadAll() {
    const [ir,pr,gr,tr,or] = await Promise.all([
      supabase.from('roadmap_items').select('*').order('created_at'),
      supabase.from('pillars').select('*').order('sort_order'),
      supabase.from('goals').select('*'),
      supabase.from('teams').select('*').order('sort_order'),
      supabase.from('quarterly_outcomes').select('*'),
    ])
    setItems(ir.data||[])
    setPillars(pr.data||[])
    setGoals(gr.data||[])
    setTeams(tr.data||[])
    setOutcomes(or.data||[])
    setLoading(false)
  }

  useEffect(()=>{ loadAll() },[])

  const handleUpdate = useCallback((id, changes, persist) => {
    setItems(prev=>prev.map(i=>i.id===id?{...i,...changes}:i))
    if (persist) {
      clearTimeout(saveTimer.current[id])
      saveTimer.current[id] = setTimeout(async()=>{
        await supabase.from('roadmap_items').update(changes).eq('id',id)
      },300)
    }
  },[])

  // Build row structure
  const rows = []
  pillars.forEach(pillar => {
    const pillarGoals   = goals.filter(g=>g.pillar_id===pillar.id)
    const isCollapsed   = collapsedPillars[pillar.id]
    rows.push({ type:'pillar', pillar, isCollapsed })
    if (!isCollapsed) {
      pillarGoals.forEach(goal => {
        rows.push({ type:'kpi', pillar, goal })
        // Team sub-rows
        const visibleTeams = filterTeam ? teams.filter(t=>t.id===filterTeam) : teams
        visibleTeams.forEach(team => {
          const teamKey = `${goal.id}-${team.id}`
          const isTeamCollapsed = collapsedTeams[teamKey]
          rows.push({ type:'team', pillar, goal, team, isCollapsed:isTeamCollapsed })
        })
        // Outcomes row
        rows.push({ type:'outcome', pillar, goal })
      })
      if (pillarGoals.length===0) {
        rows.push({ type:'empty', pillar })
      }
    }
  })

  // Y positions
  const rowH = r => {
    if (r.type==='pillar') return PILLAR_H
    if (r.type==='kpi')    return 28
    if (r.type==='team')   return r.isCollapsed ? 20 : TEAM_H
    if (r.type==='outcome')return OUTCOME_H
    if (r.type==='empty')  return TEAM_H
    return TEAM_H
  }
  let cy = HEADER_H
  const rowYs = rows.map(r=>{ const y=cy; cy+=rowH(r); return y })
  const totalH = cy

  const sel = { padding:'6px 10px',border:'1px solid var(--border)',borderRadius:'6px',fontSize:'12px',fontFamily:'DM Sans, sans-serif',color:'var(--navy)',background:'#fff',cursor:'pointer',outline:'none' }

  return (
    <div style={{marginLeft:'-48px',marginRight:'-48px',marginTop:'-40px',padding:'20px 24px'}}>
      {/* Header */}
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:'12px'}}>
        <div>
          <h1 className="font-display" style={{fontSize:'22px',color:'var(--navy)',marginBottom:'3px'}}>Unified Roadmap</h1>
          <p style={{fontSize:'11px',color:'var(--slate)'}}>Drag to move · resize edges to adjust duration · quarter inferred from position</p>
        </div>
        <div style={{display:'flex',gap:'8px',alignItems:'center',flexWrap:'wrap'}}>
          <select style={sel} value={filterYear} onChange={e=>setFilterYear(e.target.value)}>
            {FINANCIAL_YEARS.map(y=><option key={y} value={y}>{y}</option>)}
          </select>
          <select style={sel} value={filterTeam} onChange={e=>setFilterTeam(e.target.value)}>
            <option value="">All teams</option>
            {teams.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <select style={sel} value={filterConfidence} onChange={e=>setFilterConfidence(e.target.value)}>
            <option value="all">All confidence</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
          <button onClick={()=>{setAddCtx({});setShowAdd(true)}} style={{padding:'8px 16px',borderRadius:'8px',border:'none',background:'var(--navy)',fontSize:'12px',fontWeight:'600',color:'#fff',cursor:'pointer',fontFamily:'DM Sans, sans-serif'}}>+ Add item</button>
        </div>
      </div>

      {/* Legend */}
      <div style={{display:'flex',gap:'14px',marginBottom:'10px',flexWrap:'wrap'}}>
        {ITEM_TYPES.map(t=>(
          <div key={t.value} style={{display:'flex',alignItems:'center',gap:'4px'}}>
            <div style={{width:'9px',height:'9px',borderRadius:'2px',background:t.bg,border:`1.5px solid ${t.color}`}}/>
            <span style={{fontSize:'10px',color:'var(--slate)'}}>{t.label}</span>
          </div>
        ))}
        <div style={{width:'1px',background:'var(--border)',margin:'0 4px'}}/>
        {[['#166534','High'],['#92400E','Medium'],['#991B1B','Low']].map(([c,l])=>(
          <div key={l} style={{display:'flex',alignItems:'center',gap:'4px'}}>
            <div style={{width:'7px',height:'7px',borderRadius:'50%',background:c}}/>
            <span style={{fontSize:'10px',color:'var(--slate)'}}>{l}</span>
          </div>
        ))}
      </div>

      {loading ? <p style={{fontSize:'13px',color:'var(--slate-light)'}}>Loading...</p> : (
        <div style={{overflowX:'auto',border:'1px solid var(--border)',borderRadius:'10px',background:'#fff'}}>
          <div style={{display:'flex',minWidth:LEFT_W+TOTAL_W}}>

            {/* Left panel */}
            <div style={{width:LEFT_W,flexShrink:0,borderRight:'1px solid var(--border)',position:'sticky',left:0,background:'#fff',zIndex:3}}>
              {/* Header */}
              <div style={{height:HEADER_H,borderBottom:'1px solid var(--border)',display:'flex',alignItems:'flex-end',padding:'0 12px 8px'}}>
                <span style={{fontSize:'10px',fontWeight:'700',color:'var(--slate-light)',letterSpacing:'0.08em',textTransform:'uppercase'}}>Pillar / KPI / Team</span>
              </div>

              {rows.map((row,i)=>{
                const h = rowH(row)
                if (row.type==='pillar') return (
                  <div key={i} style={{height:h,display:'flex',alignItems:'center',padding:'0 12px',background:row.pillar.colour+'18',borderBottom:'1px solid var(--border)',cursor:'pointer',gap:'8px'}}
                    onClick={()=>setCollapsedPillars(p=>({...p,[row.pillar.id]:!p[row.pillar.id]}))}>
                    <div style={{width:'8px',height:'8px',borderRadius:'50%',background:row.pillar.colour,flexShrink:0}}/>
                    <span style={{fontSize:'11px',fontWeight:'700',color:'var(--navy)',flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{row.pillar.name}</span>
                    <span style={{fontSize:'10px',color:'var(--slate-light)'}}>{row.isCollapsed?'▸':'▾'}</span>
                  </div>
                )
                if (row.type==='kpi') return (
                  <div key={i} style={{height:h,display:'flex',alignItems:'center',padding:'0 12px 0 20px',borderBottom:'1px solid var(--border)',borderLeft:`3px solid ${row.pillar.colour}`,background:'var(--bg)',gap:'6px'}}>
                    <div style={{flex:1,overflow:'hidden'}}>
                      <div style={{fontSize:'10px',fontWeight:'700',color:'var(--navy)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{row.goal.kpi_name}</div>
                      {row.goal.driver_statement&&<div style={{fontSize:'9px',color:'var(--slate-light)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',marginTop:'1px'}}>↳ {row.goal.driver_statement}</div>}
                    </div>
                  </div>
                )
                if (row.type==='team') return (
                  <div key={i} style={{height:h,display:'flex',alignItems:'center',padding:'0 10px 0 28px',borderBottom:'1px solid var(--border)',borderLeft:`3px solid ${row.team.colour}`,gap:'6px',cursor:'pointer'}}
                    onClick={()=>{ const k=`${row.goal.id}-${row.team.id}`; setCollapsedTeams(p=>({...p,[k]:!p[k]})) }}>
                    <div style={{width:'6px',height:'6px',borderRadius:'50%',background:row.team.colour,flexShrink:0}}/>
                    <span style={{fontSize:'10px',fontWeight:'600',color:'var(--navy)',flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{row.team.name}</span>
                    <button onClick={e=>{e.stopPropagation();setAddCtx({pillar_id:row.pillar.id,goal_id:row.goal.id,team_id:row.team.id});setShowAdd(true)}}
                      style={{width:'18px',height:'18px',borderRadius:'3px',border:'1px solid var(--border)',background:'transparent',color:'var(--slate-light)',cursor:'pointer',fontSize:'12px',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>+</button>
                    <span style={{fontSize:'9px',color:'var(--slate-light)'}}>{row.isCollapsed?'▸':'▾'}</span>
                  </div>
                )
                if (row.type==='outcome') return (
                  <div key={i} style={{
                    height:h,display:'flex',
                    alignItems:'center',
                    padding:'0 12px 0 20px',
                    borderBottom:'1px solid var(--border)',
                    background:'#F0FDF4',
                    borderLeft:`3px solid ${row.pillar.colour}`
                  }}>
                    <span style={{fontSize:'9px',fontWeight:'700',color:'#166534',letterSpacing:'0.06em',textTransform:'uppercase'}}>Outcomes</span>
                  </div>
                )
                if (row.type==='empty') return (
                  <div key={i} style={{height:h,display:'flex',alignItems:'center',padding:'0 12px 0 20px',borderBottom:'1px solid var(--border)',borderLeft:`3px solid ${row.pillar.colour}`}}>
                    <span style={{fontSize:'10px',color:'var(--slate-light)',fontStyle:'italic'}}>No KPI focus — add one in Pillars & Goals</span>
                  </div>
                )
                return null
              })}
            </div>

            {/* Timeline SVG */}
            <div style={{flex:1}}>
              <svg width={TOTAL_W} height={totalH} style={{display:'block'}}>
                {/* Quarter backgrounds */}
                {QUARTERS.map((q,qi)=>{
                  const sx = MONTHS.indexOf(QUARTER_MONTHS[q][0])*MONTH_W
                  return <rect key={q} x={sx} y={0} width={3*MONTH_W} height={totalH} fill={qi%2===0?'#FAFAFA':'#F3F4F6'}/>
                })}

                {/* Quarter headers */}
                {QUARTERS.map((q,qi)=>{
                  const sx = MONTHS.indexOf(QUARTER_MONTHS[q][0])*MONTH_W
                  const w  = 3*MONTH_W
                  const fills = ['#0F172A','#1E293B','#1E40AF','#2563EB']
                  return (
                    <g key={q}>
                      <rect x={sx} y={0} width={w} height={QUARTER_H} fill={fills[qi]}/>
                      <text x={sx+w/2} y={QUARTER_H/2+5} textAnchor="middle" fill="white" fontSize={12} fontWeight={700} fontFamily="DM Sans, sans-serif">{q}</text>
                    </g>
                  )
                })}

                {/* Month headers */}
                {MONTHS.map((m,mi)=>{
                  const x = mi*MONTH_W
                  return (
                    <g key={m}>
                      <rect x={x} y={QUARTER_H} width={MONTH_W} height={MONTH_H} fill={mi%2===0?'#F8FAFC':'#F1F5F9'}/>
                      <text x={x+MONTH_W/2} y={QUARTER_H+MONTH_H/2+4} textAnchor="middle" fill="#475569" fontSize={10} fontFamily="DM Sans, sans-serif" fontWeight={500}>{m}</text>
                      <line x1={x} y1={QUARTER_H} x2={x} y2={totalH} stroke="#E2E8F0" strokeWidth={0.5}/>
                    </g>
                  )
                })}

                {/* Week headers */}
                {Array.from({length:TOTAL_WEEKS},(_,wi)=>{
                  const x = wi*WEEK_W
                  const wNum = (wi%WEEKS_PER_MONTH)+1
                  return (
                    <g key={`w${wi}`}>
                      <rect x={x} y={QUARTER_H+MONTH_H} width={WEEK_W} height={WEEK_H} fill={wi%2===0?'#FAFAFA':'#F5F5F5'}/>
                      <text x={x+WEEK_W/2} y={QUARTER_H+MONTH_H+WEEK_H/2+3} textAnchor="middle" fill="#94A3B8" fontSize={8} fontFamily="DM Sans, sans-serif">W{wNum}</text>
                      <line x1={x} y1={QUARTER_H+MONTH_H} x2={x} y2={totalH} stroke="#E2E8F0" strokeWidth={0.3}/>
                    </g>
                  )
                })}

                {/* Row backgrounds + lines */}
                {rows.map((row,i)=>{
                  const y = rowYs[i]
                  const h = rowH(row)
                  return (
                    <g key={`rb${i}`}>
                      {row.type==='pillar'  && <rect x={0} y={y} width={TOTAL_W} height={h} fill={row.pillar.colour+'10'}/>}
                      {row.type==='outcome' && <rect x={0} y={y} width={TOTAL_W} height={h} fill="#F0FDF4"/>}
                      {row.type==='kpi'     && <rect x={0} y={y} width={TOTAL_W} height={h} fill="#F8FAFC"/>}
                      <line x1={0} y1={y+h} x2={TOTAL_W} y2={y+h} stroke="#E2E8F0" strokeWidth={0.5}/>
                    </g>
                  )
                })}

                {/* Quarter dividers on outcome rows */}
                {rows.map((row,i)=>{
                  if (row.type!=='outcome') return null
                  const y = rowYs[i]
                  const h = rowH(row)
                  return QUARTERS.map(q=>{
                    const sx = MONTHS.indexOf(QUARTER_MONTHS[q][0])*MONTH_W
                    const w  = 3*MONTH_W
                    return (
                      <rect key={`oq-${i}-${q}`} x={sx+1} y={y+1} width={w-2} height={h-2}
                        fill="none" stroke="#BBF7D0" strokeWidth={1} rx={3}/>
                    )
                  })
                })}

                {/* Roadmap items */}
                {rows.map((row,i)=>{
                  if (row.type!=='team' || row.isCollapsed) return null
                  const rowY = rowYs[i]
                  const rowItems = items.filter(item=>
                    item.goal_id===row.goal.id &&
                    item.team_id===row.team.id &&
                    item.financial_year===filterYear &&
                    (filterConfidence==='all'||confidenceLevel(item)===filterConfidence)
                  )
                  return rowItems.map(item=>(
                    <TimelineItem key={item.id} item={item} rowY={rowY} onUpdate={handleUpdate} onClick={setSelected}/>
                  ))
                })}

                {/* Unassigned items (no team) */}
                {rows.map((row,i)=>{
                  if (row.type!=='kpi') return null
                  const rowY = rowYs[i]
                  const unassigned = items.filter(item=>
                    item.goal_id===row.goal.id &&
                    !item.team_id &&
                    item.financial_year===filterYear
                  )
                  if (unassigned.length===0) return null
                  return unassigned.map(item=>(
                    <TimelineItem key={item.id} item={item} rowY={rowY} onUpdate={handleUpdate} onClick={setSelected}/>
                  ))
                })}

                {/* Outcome cells — rendered as foreignObject per quarter */}
                {rows.map((row,i)=>{
                  if (row.type!=='outcome') return null
                  const y = rowYs[i]
                  const h = rowH(row)
                  return QUARTERS.map(q=>{
                    const sx = MONTHS.indexOf(QUARTER_MONTHS[q][0])*MONTH_W
                    const w  = 3*MONTH_W
                    return (
                      <foreignObject key={`fo-${i}-${q}`} x={sx} y={y} width={w} height={h}>
                        <div xmlns="http://www.w3.org/1999/xhtml" style={{width:'100%',height:'100%',overflow:'auto'}}>
                          <OutcomeCell
                            outcomes={outcomes}
                            pillarId={row.pillar.id}
                            goalId={row.goal.id}
                            quarter={q}
                            year={filterYear}
                            filterTeam={filterTeam}
                            teams={teams}
                            onReload={loadAll}
                          />
                        </div>
                      </foreignObject>
                    )
                  })
                })}
              </svg>
            </div>
          </div>
        </div>
      )}

      {showAdd&&(
        <AddItemModal
          pillars={pillars} goals={goals} teams={teams}
          defaultPillarId={addCtx.pillar_id}
          defaultGoalId={addCtx.goal_id}
          defaultTeamId={addCtx.team_id}
          onClose={()=>setShowAdd(false)}
          onSaved={()=>{setShowAdd(false);loadAll()}}
        />
      )}

      {selected&&(
        <ItemDetailPanel
          item={selected} pillars={pillars} goals={goals} teams={teams}
          onClose={()=>setSelected(null)}
          onSaved={()=>{setSelected(null);loadAll()}}
          onDeleted={()=>{setSelected(null);loadAll()}}
        />
      )}
    </div>
  )
}