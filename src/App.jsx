import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom'
import Pillars from './pages/Pillars'
import Roadmap from './pages/Roadmap'
import Settings from './pages/Settings'
import AuditLog from './pages/AuditLog'

function Sidebar() {
  return (
    <div style={{
      width: '220px',
      minHeight: '100vh',
      background: 'var(--navy)',
      display: 'flex',
      flexDirection: 'column',
      position: 'fixed',
      top: 0,
      left: 0,
      zIndex: 10
    }}>
      <div style={{ padding: '28px 24px 20px', borderBottom: '1px solid #1E293B' }}>
        <div className="font-display" style={{
          fontSize: '15px',
          color: '#F8FAFC',
          lineHeight: '1.3',
          letterSpacing: '-0.01em'
        }}>
          Outcome<br/>Roadmap
        </div>
        <div style={{ fontSize: '10px', color: 'var(--slate-light)', marginTop: '4px', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
          Head of Product
        </div>
      </div>

      <nav style={{ padding: '16px 12px', flex: 1 }}>
        {[
          { to: '/', label: 'Pillars & Goals', icon: '◈' },
          { to: '/roadmap', label: 'Unified Roadmap', icon: '⊞' },
          { to: '/replan', label: 'Replan', icon: '⟳', soon: true },
          { to: '/smt', label: 'SMT View', icon: '↗', soon: true },
          { to: '/audit', label: 'Audit Log', icon: '◷' },
          { to: '/settings', label: 'Settings', icon: '⚙' }

        ].map(({ to, label, icon, soon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            style={({ isActive }) => ({
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '9px 12px',
              borderRadius: '6px',
              marginBottom: '2px',
              textDecoration: 'none',
              fontSize: '13px',
              fontWeight: '500',
              color: isActive ? '#F8FAFC' : 'var(--slate-light)',
              background: isActive ? 'var(--navy-mid)' : 'transparent',
              opacity: soon ? 0.4 : 1,
              pointerEvents: soon ? 'none' : 'auto',
            })}
          >
            <span style={{ fontSize: '14px' }}>{icon}</span>
            <span>{label}</span>
            {soon && <span style={{ fontSize: '9px', marginLeft: 'auto', letterSpacing: '0.06em', color: 'var(--slate-light)' }}>SOON</span>}
          </NavLink>
        ))}
      </nav>

      <div style={{ padding: '16px 24px', borderTop: '1px solid #1E293B' }}>
        <div style={{ fontSize: '10px', color: 'var(--slate-light)', letterSpacing: '0.06em' }}>
          PHASE 1 · STEP 2.1
        </div>
      </div>
    </div>
  )
}
// Routes 
export default function App() {
  return (
    <BrowserRouter>
      <div style={{ display: 'flex' }}>
        <Sidebar />
        <main style={{ marginLeft: '220px', flex: 1, minHeight: '100vh', padding: '40px 48px' }}>
          <Routes>
            <Route path="/" element={<Pillars />} />
            <Route path="/roadmap" element={<Roadmap />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/audit" element={<AuditLog />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  )
}