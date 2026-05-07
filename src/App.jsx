import { BrowserRouter, Routes, Route, NavLink } from "react-router-dom";
import Pillars from "./pages/Pillars";
import Roadmap from "./pages/Roadmap";
import Settings from "./pages/Settings";
import AuditLog from "./pages/AuditLog";
import Dependencies from "./pages/Dependencies";
import ItemDetailPanel from "./pages/ItemDetailPanel";
import SMTView from "./pages/SMTView";
import { useAuth } from "./hooks/useAuth";
import Login from "./pages/Login";
import { supabase } from './lib/supabase';

function Sidebar({ profile }) {
  return (
    <div
      style={{
        width: "220px",
        minHeight: "100vh",
        background: "var(--navy)",
        display: "flex",
        flexDirection: "column",
        position: "fixed",
        top: 0,
        left: 0,
        zIndex: 10,
      }}
    >
      <div
        style={{ padding: "28px 24px 20px", borderBottom: "1px solid #1E293B" }}
      >
        <div
          className="font-display"
          style={{
            fontSize: "15px",
            color: "#F8FAFC",
            lineHeight: "1.3",
            letterSpacing: "-0.01em",
          }}
        >
          Outcome
          <br />
          Roadmap
        </div>
        <div
          style={{
            fontSize: "10px",
            color: "var(--slate-light)",
            marginTop: "4px",
            letterSpacing: "0.08em",
            textTransform: "uppercase",
          }}
        >
          Head of Product
        </div>
      </div>

      <nav style={{ padding: "16px 12px", flex: 1 }}>
        {[
          { to: "/", label: "Pillars & Goals", icon: "◈" },
          { to: "/roadmap", label: "Roadmap", icon: "⊞" },
          { to: "/dependencies", label: "Dependencies", icon: "⟳" },
          { to: "/SMTView", label: "SMT View", icon: "↗" },
          { to: "/audit", label: "Audit Log", icon: "◷" },
          { to: "/settings", label: "Settings", icon: "⚙" },
        ].map(({ to, label, icon, soon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            style={({ isActive }) => ({
              display: "flex",
              alignItems: "center",
              gap: "10px",
              padding: "9px 12px",
              borderRadius: "6px",
              marginBottom: "2px",
              textDecoration: "none",
              fontSize: "13px",
              fontWeight: "500",
              color: isActive ? "#F8FAFC" : "var(--slate-light)",
              background: isActive ? "var(--navy-mid)" : "transparent",
              opacity: soon ? 0.4 : 1,
              pointerEvents: soon ? "none" : "auto",
            })}
          >
            <span style={{ fontSize: "14px" }}>{icon}</span>
            <span>{label}</span>
            {soon && (
              <span
                style={{
                  fontSize: "9px",
                  marginLeft: "auto",
                  letterSpacing: "0.06em",
                  color: "var(--slate-light)",
                }}
              >
                SOON
              </span>
            )}
          </NavLink>
        ))}
      </nav>
      <div style={{ padding: "16px 24px", borderTop: "1px solid #1E293B" }}>
        {profile && (
          <div style={{ marginBottom: "10px" }}>
            <div
              style={{ fontSize: "11px", color: "#F8FAFC", fontWeight: "600" }}
            >
              {profile.full_name || "No name set"}
            </div>
            <div
              style={{
                fontSize: "10px",
                color: "var(--slate-light)",
                marginTop: "2px",
              }}
            >
              {profile.teams?.name || "No team"}
            </div>
          </div>
        )}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div
            style={{
              fontSize: "10px",
              color: "var(--slate-light)",
              letterSpacing: "0.06em",
            }}
          >
            PHASE 1 · STEP 2.1
          </div>
          <button
            onClick={() => supabase.auth.signOut()}
            style={{
              fontSize: "10px",
              color: "var(--slate-light)",
              background: "transparent",
              border: "none",
              cursor: "pointer",
              fontFamily: "Inter, sans-serif",
            }}
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
// Routes
export default function App() {
  const { user, profile, loading } = useAuth();

  if (loading)
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "var--(bg)",
          fontSize: "13px",
          color: "var(--slate-light)",
        }}
      >
        Loading...
      </div>
    );

  if (!user) return <Login />;

  return (
    <BrowserRouter>
      <div style={{ display: "flex" }}>
        <Sidebar profile={profile} />
        <main
          style={{
            marginLeft: "220px",
            flex: 1,
            minHeight: "100vh",
            padding: "40px 48px",
          }}
        >
          <Routes>
            <Route path="/" element={<Pillars />} />
            <Route path="/roadmap" element={<Roadmap />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/audit" element={<AuditLog />} />
            <Route path="/dependencies" element={<Dependencies />} />
            <Route path="/ItemDetailPanel" element={<ItemDetailPanel />} />
            <Route path="/SMTView" element={<SMTView />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}
