import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const TEAM_COLOURS = [
  '#1E40AF', '#0F766E', '#7C3AED', '#B45309',
  '#BE185D', '#0E7490', '#4D7C0F', '#9F1239',
  '#C2410C', '#0369A1', '#7E22CE', '#065F46',
]

function AddTeamModal({ onClose, onSaved }) {
  const [form, setForm] = useState({ name: '', colour: TEAM_COLOURS[0] })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  async function save() {
    if (!form.name.trim()) return setError('Team name is required')
    setSaving(true)
    const { error } = await supabase.from('teams').insert({
      name: form.name.trim(),
      colour: form.colour,
    })
    setSaving(false)
    if (error) return setError(error.message)
    onSaved()
  }

  const inputStyle = {
    width: '100%', padding: '8px 10px',
    border: '1px solid var(--border)', borderRadius: '6px',
    fontSize: '12px', fontFamily: 'DM Sans, sans-serif',
    color: 'var(--navy)', background: '#fff', outline: 'none'
  }
  const labelStyle = {
    fontSize: '10px', fontWeight: '600', color: 'var(--slate)',
    letterSpacing: '0.06em', textTransform: 'uppercase',
    marginBottom: '4px', display: 'block'
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
      <div style={{ background: '#fff', borderRadius: '12px', width: '400px', padding: '28px', boxShadow: '0 24px 48px rgba(0,0,0,0.2)' }}>
        <h2 className="font-display" style={{ fontSize: '18px', color: 'var(--navy)', marginBottom: '4px' }}>Add team</h2>
        <p style={{ fontSize: '12px', color: 'var(--slate)', marginBottom: '20px' }}>Teams appear as sub-rows within each KPI focus on the roadmap.</p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={labelStyle}>Team name *</label>
            <input style={inputStyle} placeholder="e.g. CS Platform"
              value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          </div>
          <div>
            <label style={labelStyle}>Colour</label>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {TEAM_COLOURS.map(c => (
                <button key={c} onClick={() => setForm(f => ({ ...f, colour: c }))}
                  style={{
                    width: '26px', height: '26px', borderRadius: '50%', background: c,
                    border: form.colour === c ? '3px solid var(--navy)' : '2px solid transparent',
                    cursor: 'pointer',
                    outline: form.colour === c ? '2px solid #fff' : 'none',
                    outlineOffset: '-4px'
                  }} />
              ))}
            </div>
          </div>

          {error && <div style={{ fontSize: '12px', color: '#991B1B', background: '#FEE2E2', padding: '8px 12px', borderRadius: '4px' }}>{error}</div>}

          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', paddingTop: '4px' }}>
            <button onClick={onClose} style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid var(--border)', background: '#fff', fontSize: '12px', fontWeight: '500', color: 'var(--slate)', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>Cancel</button>
            <button onClick={save} disabled={saving} style={{ padding: '8px 16px', borderRadius: '6px', border: 'none', background: 'var(--blue)', fontSize: '12px', fontWeight: '600', color: '#fff', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1, fontFamily: 'DM Sans, sans-serif' }}>
              {saving ? 'Saving...' : 'Add team'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function TeamRow({ team, onDeleted }) {
  const [confirmDelete, setConfirmDelete] = useState(false)

  async function deleteTeam() {
    await supabase.from('teams').delete().eq('id', team.id)
    setConfirmDelete(false)
    onDeleted()
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '12px',
      padding: '12px 16px', background: '#fff',
      border: '1px solid var(--border)', borderRadius: '8px',
      borderLeft: `4px solid ${team.colour}`
    }}>
      <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: team.colour, flexShrink: 0 }} />
      <span style={{ fontSize: '13px', fontWeight: '600', color: 'var(--navy)', flex: 1 }}>{team.name}</span>
      <button onClick={() => setConfirmDelete(true)} style={{
        width: '28px', height: '28px', borderRadius: '6px',
        border: '1px solid var(--border)', background: 'transparent',
        color: 'var(--slate-light)', cursor: 'pointer', fontSize: '13px',
        display: 'flex', alignItems: 'center', justifyContent: 'center'
      }}>✕</button>

      {confirmDelete && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
          <div style={{ background: '#fff', borderRadius: '12px', width: '380px', padding: '28px', boxShadow: '0 24px 48px rgba(0,0,0,0.2)' }}>
            <h3 className="font-display" style={{ fontSize: '16px', color: 'var(--navy)', marginBottom: '8px' }}>Delete {team.name}?</h3>
            <p style={{ fontSize: '12px', color: 'var(--slate)', marginBottom: '8px', lineHeight: '1.5' }}>
              This will remove the team from all roadmap items it is assigned to.
            </p>
            <p style={{ fontSize: '12px', color: '#991B1B', background: '#FEE2E2', padding: '8px 12px', borderRadius: '4px', marginBottom: '20px' }}>
              This cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
              <button onClick={() => setConfirmDelete(false)} style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid var(--border)', background: '#fff', fontSize: '12px', color: 'var(--slate)', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>Cancel</button>
              <button onClick={deleteTeam} style={{ padding: '8px 16px', borderRadius: '6px', border: 'none', background: '#991B1B', fontSize: '12px', fontWeight: '600', color: '#fff', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function Settings() {
  const [teams, setTeams] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAddTeam, setShowAddTeam] = useState(false)
  const [activeSection, setActiveSection] = useState('teams')

  async function loadTeams() {
    const { data } = await supabase.from('teams').select('*').order('sort_order')
    setTeams(data || [])
    setLoading(false)
  }

  useEffect(() => { loadTeams() }, [])

  const sections = [
    { id: 'teams', label: 'Teams', icon: '◫' },
    { id: 'financial_year', label: 'Financial year', icon: '◷', soon: true },
    { id: 'confidence', label: 'Confidence weighting', icon: '◎', soon: true },
  ]

  return (
    <div style={{ maxWidth: '860px', display: 'flex', gap: '32px' }}>
      {/* Settings sidebar */}
      <div style={{ width: '180px', flexShrink: 0 }}>
        <h1 className="font-display" style={{ fontSize: '20px', color: 'var(--navy)', marginBottom: '16px' }}>Settings</h1>
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          {sections.map(s => (
            <button key={s.id}
              onClick={() => !s.soon && setActiveSection(s.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px',
                padding: '8px 12px', borderRadius: '6px', border: 'none',
                background: activeSection === s.id ? 'var(--blue-light)' : 'transparent',
                color: activeSection === s.id ? 'var(--blue)' : s.soon ? 'var(--slate-light)' : 'var(--slate)',
                fontSize: '13px', fontWeight: activeSection === s.id ? '600' : '400',
                cursor: s.soon ? 'not-allowed' : 'pointer',
                fontFamily: 'DM Sans, sans-serif', textAlign: 'left',
                opacity: s.soon ? 0.5 : 1,
              }}>
              <span>{s.icon}</span>
              <span style={{ flex: 1 }}>{s.label}</span>
              {s.soon && <span style={{ fontSize: '8px', color: 'var(--slate-light)', letterSpacing: '0.06em' }}>SOON</span>}
            </button>
          ))}
        </nav>
      </div>

      {/* Content area */}
      <div style={{ flex: 1 }}>
        {activeSection === 'teams' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
              <div>
                <h2 className="font-display" style={{ fontSize: '18px', color: 'var(--navy)', marginBottom: '4px' }}>Teams</h2>
                <p style={{ fontSize: '12px', color: 'var(--slate)', lineHeight: '1.6' }}>
                  Teams appear as sub-rows within each KPI focus on the roadmap.<br />
                  Each team's items are shown in their own row for easy cross-team comparison.
                </p>
              </div>
              <button onClick={() => setShowAddTeam(true)} style={{
                padding: '8px 16px', borderRadius: '8px', border: 'none',
                background: 'var(--navy)', fontSize: '12px', fontWeight: '600',
                color: '#fff', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif',
                flexShrink: 0, marginLeft: '16px'
              }}>+ Add team</button>
            </div>

            {loading ? (
              <p style={{ fontSize: '12px', color: 'var(--slate-light)' }}>Loading...</p>
            ) : teams.length === 0 ? (
              <div style={{ padding: '32px', border: '1px dashed var(--border)', borderRadius: '10px', textAlign: 'center' }}>
                <div className="font-display" style={{ fontSize: '16px', color: 'var(--navy)', marginBottom: '6px' }}>No teams yet</div>
                <p style={{ fontSize: '12px', color: 'var(--slate)', marginBottom: '16px', lineHeight: '1.6' }}>
                  Add your teams here — they'll appear as rows on the roadmap.<br />
                  Each team can own roadmap items within any KPI focus.
                </p>
                <button onClick={() => setShowAddTeam(true)} style={{
                  padding: '8px 20px', borderRadius: '8px', border: 'none',
                  background: 'var(--blue)', fontSize: '12px', fontWeight: '600',
                  color: '#fff', cursor: 'pointer', fontFamily: 'DM Sans, sans-serif'
                }}>Add first team</button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {teams.map(team => (
                  <TeamRow key={team.id} team={team} onDeleted={loadTeams} />
                ))}
                <div style={{ marginTop: '8px', fontSize: '12px', color: 'var(--slate-light)' }}>
                  {teams.length} {teams.length === 1 ? 'team' : 'teams'} · teams appear on the roadmap once items are assigned to them
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {showAddTeam && (
        <AddTeamModal
          onClose={() => setShowAddTeam(false)}
          onSaved={() => { setShowAddTeam(false); loadTeams() }}
        />
      )}
    </div>
  )
}