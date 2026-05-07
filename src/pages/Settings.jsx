import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";


const TEAM_COLOURS = [
  "#1E40AF",
  "#0F766E",
  "#7C3AED",
  "#B45309",
  "#BE185D",
  "#0E7490",
  "#4D7C0F",
  "#9F1239",
  "#C2410C",
  "#0369A1",
  "#7E22CE",
  "#065F46",
];

function AddTeamModal({ onClose, onSaved }) {
  const [form, setForm] = useState({ name: "", colour: TEAM_COLOURS[0] });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  async function save() {
    if (!form.name.trim()) return setError("Team name is required");
    setSaving(true);
    const { error } = await supabase.from("teams").insert({
      name: form.name.trim(),
      colour: form.colour,
    });
    setSaving(false);
    if (error) return setError(error.message);
    onSaved();
  }

  const inputStyle = {
    width: "100%",
    padding: "8px 10px",
    border: "1px solid var(--border)",
    borderRadius: "6px",
    fontSize: "12px",
    fontFamily: "Inter, sans-serif",
    color: "var(--navy)",
    background: "#fff",
    outline: "none",
  };
  const labelStyle = {
    fontSize: "10px",
    fontWeight: "600",
    color: "var(--slate)",
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    marginBottom: "4px",
    display: "block",
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15,23,42,0.6)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 100,
      }}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: "12px",
          width: "400px",
          padding: "28px",
          boxShadow: "0 24px 48px rgba(0,0,0,0.2)",
        }}
      >
        <h2
          className="font-display"
          style={{
            fontSize: "18px",
            color: "var(--navy)",
            marginBottom: "4px",
          }}
        >
          Add team
        </h2>
        <p
          style={{
            fontSize: "12px",
            color: "var(--slate)",
            marginBottom: "20px",
          }}
        >
          Teams appear as sub-rows within each KPI focus on the roadmap.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <div>
            <label style={labelStyle}>Team name *</label>
            <input
              style={inputStyle}
              placeholder="e.g. CS Platform"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </div>
          <div>
            <label style={labelStyle}>Colour</label>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              {TEAM_COLOURS.map((c) => (
                <button
                  key={c}
                  onClick={() => setForm((f) => ({ ...f, colour: c }))}
                  style={{
                    width: "26px",
                    height: "26px",
                    borderRadius: "50%",
                    background: c,
                    border:
                      form.colour === c
                        ? "3px solid var(--navy)"
                        : "2px solid transparent",
                    cursor: "pointer",
                    outline: form.colour === c ? "2px solid #fff" : "none",
                    outlineOffset: "-4px",
                  }}
                />
              ))}
            </div>
          </div>

          {error && (
            <div
              style={{
                fontSize: "12px",
                color: "#991B1B",
                background: "#FEE2E2",
                padding: "8px 12px",
                borderRadius: "4px",
              }}
            >
              {error}
            </div>
          )}

          <div
            style={{
              display: "flex",
              gap: "8px",
              justifyContent: "flex-end",
              paddingTop: "4px",
            }}
          >
            <button
              onClick={onClose}
              style={{
                padding: "8px 16px",
                borderRadius: "6px",
                border: "1px solid var(--border)",
                background: "#fff",
                fontSize: "12px",
                fontWeight: "500",
                color: "var(--slate)",
                cursor: "pointer",
                fontFamily: "Inter, sans-serif",
              }}
            >
              Cancel
            </button>
            <button
              onClick={save}
              disabled={saving}
              style={{
                padding: "8px 16px",
                borderRadius: "6px",
                border: "none",
                background: "var(--blue)",
                fontSize: "12px",
                fontWeight: "600",
                color: "#fff",
                cursor: saving ? "not-allowed" : "pointer",
                opacity: saving ? 0.7 : 1,
                fontFamily: "Inter, sans-serif",
              }}
            >
              {saving ? "Saving..." : "Add team"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
function EditTeamModal({ team, onClose, onSaved }) {
  const [form, setForm] = useState({ name: team.name, colour: team.colour });
  const [saving, setSaving] = useState(false);

  const TEAM_COLOURS = [
    "#1E40AF",
    "#0F766E",
    "#7C3AED",
    "#B45309",
    "#BE185D",
    "#0E7490",
    "#4D7C0F",
    "#9F1239",
    "#C2410C",
    "#0369A1",
    "#7E22CE",
    "#065F46",
  ];

  async function save() {
    setSaving(true);
    await supabase
      .from("teams")
      .update({
        name: form.name.trim(),
        colour: form.colour,
      })
      .eq("id", team.id);
    setSaving(false);
    onSaved();
  }

  const inp = {
    width: "100%",
    padding: "8px 10px",
    border: "1px solid var(--border)",
    borderRadius: "6px",
    fontSize: "12px",
    fontFamily: "DM Sans, sans-serif",
    color: "var(--navy)",
    background: "#fff",
    outline: "none",
  };
  const lbl = {
    fontSize: "10px",
    fontWeight: "600",
    color: "var(--slate)",
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    marginBottom: "4px",
    display: "block",
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15,23,42,0.6)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 100,
      }}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: "12px",
          width: "400px",
          padding: "28px",
          boxShadow: "0 24px 48px rgba(0,0,0,0.2)",
        }}
      >
        <h2
          className="font-display"
          style={{
            fontSize: "18px",
            color: "var(--navy)",
            marginBottom: "4px",
          }}
        >
          Edit team
        </h2>
        <p
          style={{
            fontSize: "12px",
            color: "var(--slate)",
            marginBottom: "20px",
          }}
        >
          Changes will reflect immediately on the roadmap.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <div>
            <label style={lbl}>Team name</label>
            <input
              style={inp}
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </div>
          <div>
            <label style={lbl}>Colour</label>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              {TEAM_COLOURS.map((c) => (
                <button
                  key={c}
                  onClick={() => setForm((f) => ({ ...f, colour: c }))}
                  style={{
                    width: "26px",
                    height: "26px",
                    borderRadius: "50%",
                    background: c,
                    border:
                      form.colour === c
                        ? "3px solid var(--navy)"
                        : "2px solid transparent",
                    cursor: "pointer",
                    outline: form.colour === c ? "2px solid #fff" : "none",
                    outlineOffset: "-4px",
                  }}
                />
              ))}
            </div>
          </div>

          <div
            style={{
              display: "flex",
              gap: "8px",
              justifyContent: "flex-end",
              paddingTop: "4px",
            }}
          >
            <button
              onClick={onClose}
              style={{
                padding: "8px 16px",
                borderRadius: "6px",
                border: "1px solid var(--border)",
                background: "#fff",
                fontSize: "12px",
                color: "var(--slate)",
                cursor: "pointer",
                fontFamily: "DM Sans, sans-serif",
              }}
            >
              Cancel
            </button>
            <button
              onClick={save}
              disabled={saving}
              style={{
                padding: "8px 16px",
                borderRadius: "6px",
                border: "none",
                background: "var(--blue)",
                fontSize: "12px",
                fontWeight: "600",
                color: "#fff",
                cursor: saving ? "not-allowed" : "pointer",
                opacity: saving ? 0.7 : 1,
                fontFamily: "DM Sans, sans-serif",
              }}
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function TeamRow({ team, onDeleted, onReload }) {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [editing, setEditing] = useState(false);

  async function deleteTeam() {
    await supabase.from("teams").delete().eq("id", team.id);
    setConfirmDelete(false);
    onDeleted();
  }

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "12px",
        padding: "12px 16px",
        background: "#fff",
        border: "1px solid var(--border)",
        borderRadius: "8px",
        borderLeft: `4px solid ${team.colour}`,
      }}
    >
      <div
        style={{
          width: "10px",
          height: "10px",
          borderRadius: "50%",
          background: team.colour,
          flexShrink: 0,
        }}
      />
      <span
        style={{
          fontSize: "13px",
          fontWeight: "600",
          color: "var(--navy)",
          flex: 1,
        }}
      >
        {team.name}
      </span>
      <button
        onClick={() => setEditing(true)}
        style={{
          padding: "5px 12px",
          borderRadius: "6px",
          border: "1px solid var(--border)",
          background: "transparent",
          fontSize: "12px",
          color: "var(--slate)",
          cursor: "pointer",
          fontFamily: "DM Sans, sans-serif",
        }}
      >
        Edit
      </button>
      <button
        onClick={() => setConfirmDelete(true)}
        style={{
          width: "28px",
          height: "28px",
          borderRadius: "6px",
          border: "1px solid #FEE2E2",
          background: "#FEE2E2",
          color: "#991B1B",
          cursor: "pointer",
          fontSize: "13px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        🗑
      </button>

      {editing && (
        <EditTeamModal
          team={team}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            onReload();
          }}
        />
      )}

      {confirmDelete && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15,23,42,0.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
          }}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: "12px",
              width: "380px",
              padding: "28px",
              boxShadow: "0 24px 48px rgba(0,0,0,0.2)",
            }}
          >
            <h3
              className="font-display"
              style={{
                fontSize: "16px",
                color: "var(--navy)",
                marginBottom: "8px",
              }}
            >
              Delete {team.name}?
            </h3>
            <p
              style={{
                fontSize: "12px",
                color: "var(--slate)",
                marginBottom: "8px",
                lineHeight: "1.5",
              }}
            >
              This will remove the team from all roadmap items it is assigned
              to.
            </p>
            <p
              style={{
                fontSize: "12px",
                color: "#991B1B",
                background: "#FEE2E2",
                padding: "8px 12px",
                borderRadius: "4px",
                marginBottom: "20px",
              }}
            >
              This cannot be undone.
            </p>
            <div
              style={{
                display: "flex",
                gap: "8px",
                justifyContent: "flex-end",
              }}
            >
              <button
                onClick={() => setConfirmDelete(false)}
                style={{
                  padding: "8px 16px",
                  borderRadius: "6px",
                  border: "1px solid var(--border)",
                  background: "#fff",
                  fontSize: "12px",
                  color: "var(--slate)",
                  cursor: "pointer",
                  fontFamily: "DM Sans, sans-serif",
                }}
              >
                Cancel
              </button>
              <button
                onClick={deleteTeam}
                style={{
                  padding: "8px 16px",
                  borderRadius: "6px",
                  border: "none",
                  background: "#991B1B",
                  fontSize: "12px",
                  fontWeight: "600",
                  color: "#fff",
                  cursor: "pointer",
                  fontFamily: "DM Sans, sans-serif",
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function UserRow({ profile, teams, onReload }) {
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    full_name: profile.full_name || "",
    role: profile.role || "",
    team_id: profile.team_id || "",
  });

  useEffect(() => {
    setForm({
      full_name: profile.full_name || "",
      role: profile.role || "",
      team_id: profile.team_id || "",
    });
  }, [profile]);
  const team = teams.find((t) => t.id === profile.team_id);

  const inp = {
    width: "100%",
    padding: "7px 10px",
    border: "1px solid var(--border)",
    borderRadius: "6px",
    fontSize: "12px",
    fontFamily: "Inter, sans-serif",
    color: "var(--navy)",
    background: "#fff",
    outline: "none",
    boxSizing: "border-box",
  };
  const lbl = {
    fontSize: "10px",
    fontWeight: "600",
    color: "var(--slate)",
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    marginBottom: "4px",
    display: "block",
  };

  async function saveProfile() {
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        full_name: form.full_name.trim() || null,
        role: form.role.trim() || null,
        team_id: form.team_id || null,
      })
      .eq("id", profile.id);
    console.log("save error:", error);
    setSaving(false);
    setEditing(false);
    onReload();
  }

  async function deleteUser() {
    await supabase.from("profiles").delete().eq("id", profile.id);
    setConfirmDelete(false);
    onReload();
  }

  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid var(--border)",
        borderRadius: "8px",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "12px",
          padding: "12px 16px",
        }}
      >
        <div
          style={{
            width: "32px",
            height: "32px",
            borderRadius: "50%",
            background: "var(--navy)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: "12px", fontWeight: "700", color: "#fff" }}>
            {(profile.full_name || "?")[0].toUpperCase()}
          </span>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: "13px",
              fontWeight: "600",
              color: "var(--navy)",
            }}
          >
            {profile.full_name || "No name"}
          </div>
          <div style={{ display: "flex", gap: "8px", marginTop: "2px" }}>
            {profile.email && (
              <span style={{ fontSize: "11px", color: "var(--slate-light)" }}>
                {profile.email}
              </span>
            )}
            {profile.role && (
              <span style={{ fontSize: "11px", color: "var(--slate)" }}>
                {profile.role}
              </span>
            )}
            {team && (
              <>
                <span style={{ fontSize: "11px", color: "var(--slate-light)" }}>
                  ·
                </span>
                <div
                  style={{ display: "flex", alignItems: "center", gap: "4px" }}
                >
                  <div
                    style={{
                      width: "6px",
                      height: "6px",
                      borderRadius: "50%",
                      background: team.colour,
                    }}
                  />
                  <span style={{ fontSize: "11px", color: "var(--slate)" }}>
                    {team.name}
                  </span>
                </div>
              </>
            )}
          </div>
        </div>
        <button
          onClick={() => setEditing(!editing)}
          style={{
            padding: "5px 12px",
            borderRadius: "6px",
            border: "1px solid var(--border)",
            background: "transparent",
            fontSize: "12px",
            color: "var(--slate)",
            cursor: "pointer",
            fontFamily: "Inter, sans-serif",
          }}
        >
          {editing ? "Cancel" : "Edit"}
        </button>
        <button
          onClick={() => setConfirmDelete(true)}
          style={{
            width: "28px",
            height: "28px",
            borderRadius: "6px",
            border: "1px solid #FEE2E2",
            background: "#FEE2E2",
            color: "#991B1B",
            cursor: "pointer",
            fontSize: "13px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          🗑
        </button>
      </div>

      {editing && (
        <div
          style={{
            padding: "12px 16px",
            borderTop: "1px solid var(--border)",
            background: "var(--bg)",
            display: "flex",
            flexDirection: "column",
            gap: "10px",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "10px",
            }}
          >
            <div>
              <label style={lbl}>Full name</label>
              <input
                style={inp}
                value={form.full_name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, full_name: e.target.value }))
                }
              />
            </div>
            <div>
              <label style={lbl}>Role title</label>
              <input
                style={inp}
                placeholder="e.g. Head of Product"
                value={form.role}
                onChange={(e) =>
                  setForm((f) => ({ ...f, role: e.target.value }))
                }
              />
            </div>
          </div>
          <div>
            <label style={lbl}>Team</label>
            <select
              style={{ ...inp, cursor: "pointer" }}
              value={form.team_id}
              onChange={(e) =>
                setForm((f) => ({ ...f, team_id: e.target.value }))
              }
            >
              <option value="">— No team —</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button
              onClick={saveProfile}
              disabled={saving}
              style={{
                padding: "7px 16px",
                borderRadius: "6px",
                border: "none",
                background: "var(--blue)",
                fontSize: "12px",
                fontWeight: "600",
                color: "#fff",
                cursor: saving ? "not-allowed" : "pointer",
                opacity: saving ? 0.7 : 1,
                fontFamily: "Inter, sans-serif",
              }}
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      )}

      {confirmDelete && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15,23,42,0.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
          }}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: "12px",
              width: "360px",
              padding: "28px",
              boxShadow: "0 24px 48px rgba(0,0,0,0.2)",
            }}
          >
            <h3
              className="font-display"
              style={{
                fontSize: "16px",
                color: "var(--navy)",
                marginBottom: "8px",
              }}
            >
              Remove this user?
            </h3>
            <p
              style={{
                fontSize: "12px",
                color: "var(--slate)",
                marginBottom: "20px",
                lineHeight: "1.5",
              }}
            >
              This will remove <strong>{profile.full_name}</strong> from the
              system. They will no longer be able to log in.
            </p>
            <div
              style={{
                display: "flex",
                gap: "8px",
                justifyContent: "flex-end",
              }}
            >
              <button
                onClick={() => setConfirmDelete(false)}
                style={{
                  padding: "8px 16px",
                  borderRadius: "6px",
                  border: "1px solid var(--border)",
                  background: "#fff",
                  fontSize: "12px",
                  color: "var(--slate)",
                  cursor: "pointer",
                  fontFamily: "Inter, sans-serif",
                }}
              >
                Cancel
              </button>
              <button
                onClick={deleteUser}
                style={{
                  padding: "8px 16px",
                  borderRadius: "6px",
                  border: "none",
                  background: "#991B1B",
                  fontSize: "12px",
                  fontWeight: "600",
                  color: "#fff",
                  cursor: "pointer",
                  fontFamily: "Inter, sans-serif",
                }}
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AddUserModal({ teams, onClose, onSaved }) {
  const [form, setForm] = useState({
    email: "",
    full_name: "",
    role: "",
    team_id: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const inp = {
    width: "100%",
    padding: "8px 10px",
    border: "1px solid var(--border)",
    borderRadius: "6px",
    fontSize: "12px",
    fontFamily: "Inter, sans-serif",
    color: "var(--navy)",
    background: "#fff",
    outline: "none",
    boxSizing: "border-box",
  };
  const lbl = {
    fontSize: "10px",
    fontWeight: "600",
    color: "var(--slate)",
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    marginBottom: "4px",
    display: "block",
  };

  async function save() {
    if (!form.full_name.trim()) return setError("Full name is required");
    setSaving(true);
    setError(null);

    await supabase.from("profiles").insert({
      full_name: form.full_name.trim() || null,
      role: form.role.trim() || null,
      team_id: form.team_id || null,
    });

    setSaving(false);
    onSaved();
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15,23,42,0.6)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 100,
      }}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: "12px",
          width: "440px",
          padding: "28px",
          boxShadow: "0 24px 48px rgba(0,0,0,0.2)",
        }}
      >
        <h2
          className="font-display"
          style={{
            fontSize: "18px",
            color: "var(--navy)",
            marginBottom: "4px",
          }}
        >
          Invite user
        </h2>
        <p
          style={{
            fontSize: "12px",
            color: "var(--slate)",
            marginBottom: "20px",
            lineHeight: "1.5",
          }}
        >
          Create a profile for this user. Then create their login in the{" "}
          <a
            href="https://supabase.com/dashboard"
            target="_blank"
            rel="noreferrer"
            style={{ color: "var(--blue)" }}
          >
            Supabase dashboard
          </a>{" "}
          under Authentication → Users, and link the profile to their user ID.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "10px",
            }}
          >
            <div>
              <label style={lbl}>Full name</label>
              <input
                style={inp}
                placeholder="e.g. Jane Smith"
                value={form.full_name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, full_name: e.target.value }))
                }
              />
            </div>
            <div>
              <label style={lbl}>Role title</label>
              <input
                style={inp}
                placeholder="e.g. Product Manager"
                value={form.role}
                onChange={(e) =>
                  setForm((f) => ({ ...f, role: e.target.value }))
                }
              />
            </div>
          </div>
          <div>
            <label style={lbl}>Team</label>
            <select
              style={{ ...inp, cursor: "pointer" }}
              value={form.team_id}
              onChange={(e) =>
                setForm((f) => ({ ...f, team_id: e.target.value }))
              }
            >
              <option value="">— No team —</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          {error && (
            <div
              style={{
                fontSize: "12px",
                color: "#991B1B",
                background: "#FEE2E2",
                padding: "8px 12px",
                borderRadius: "4px",
              }}
            >
              {error}
            </div>
          )}

          <div
            style={{
              display: "flex",
              gap: "8px",
              justifyContent: "flex-end",
              paddingTop: "4px",
            }}
          >
            <button
              onClick={onClose}
              style={{
                padding: "8px 16px",
                borderRadius: "6px",
                border: "1px solid var(--border)",
                background: "#fff",
                fontSize: "12px",
                color: "var(--slate)",
                cursor: "pointer",
                fontFamily: "Inter, sans-serif",
              }}
            >
              Cancel
            </button>
            <button
              onClick={save}
              disabled={saving}
              style={{
                padding: "8px 16px",
                borderRadius: "6px",
                border: "none",
                background: "var(--blue)",
                fontSize: "12px",
                fontWeight: "600",
                color: "#fff",
                cursor: saving ? "not-allowed" : "pointer",
                opacity: saving ? 0.7 : 1,
                fontFamily: "Inter, sans-serif",
              }}
            >
              {saving ? "Saving…" : "Create profile"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Settings() {
  const [teams, setTeams] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddTeam, setShowAddTeam] = useState(false);
  const [showAddUser, setShowAddUser] = useState(false);
  const [activeSection, setActiveSection] = useState("teams");

  async function loadTeams() {
    const [{ data: teamsData }, { data: profilesData }] = await Promise.all([
      supabase.from('teams').select('*').order('sort_order'),
      supabase.from('user_profiles').select('*'),
    ])
    console.log('profiles after reload:', JSON.stringify(profilesData))
    setTeams(teamsData || [])
    setProfiles(profilesData || [])
    setLoading(false)
  }

  useEffect(() => {
    loadTeams();
  }, []);

  const sections = [
    { id: "teams", label: "Teams", icon: "◫" },
    { id: "users", label: "Users", icon: "◉" },
    { id: "financial_year", label: "Financial year", icon: "◷", soon: true },
  ];

  return (
    <div style={{ maxWidth: "860px", display: "flex", gap: "32px" }}>
      {/* Settings sidebar */}
      <div style={{ width: "180px", flexShrink: 0 }}>
        <h1
          className="font-display"
          style={{
            fontSize: "20px",
            color: "var(--navy)",
            marginBottom: "16px",
          }}
        >
          Settings
        </h1>
        <nav style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
          {sections.map((s) => (
            <button
              key={s.id}
              onClick={() => !s.soon && setActiveSection(s.id)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "8px 12px",
                borderRadius: "6px",
                border: "none",
                background:
                  activeSection === s.id ? "var(--blue-light)" : "transparent",
                color:
                  activeSection === s.id
                    ? "var(--blue)"
                    : s.soon
                      ? "var(--slate-light)"
                      : "var(--slate)",
                fontSize: "13px",
                fontWeight: activeSection === s.id ? "600" : "400",
                cursor: s.soon ? "not-allowed" : "pointer",
                fontFamily: "Inter, sans-serif",
                textAlign: "left",
                opacity: s.soon ? 0.5 : 1,
              }}
            >
              <span>{s.icon}</span>
              <span style={{ flex: 1 }}>{s.label}</span>
              {s.soon && (
                <span
                  style={{
                    fontSize: "8px",
                    color: "var(--slate-light)",
                    letterSpacing: "0.06em",
                  }}
                >
                  SOON
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Content area */}
      <div style={{ flex: 1 }}>
        {activeSection === "users" && (
          <div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                marginBottom: "20px",
              }}
            >
              <div>
                <h2
                  className="font-display"
                  style={{
                    fontSize: "18px",
                    color: "var(--navy)",
                    marginBottom: "4px",
                  }}
                >
                  Users
                </h2>
                <p
                  style={{
                    fontSize: "12px",
                    color: "var(--slate)",
                    lineHeight: "1.6",
                  }}
                >
                  Manage who has access to the roadmap and their team
                  assignment.
                </p>
              </div>
              <button
                onClick={() => setShowAddUser(true)}
                style={{
                  padding: "8px 16px",
                  borderRadius: "8px",
                  border: "none",
                  background: "var(--navy)",
                  fontSize: "12px",
                  fontWeight: "600",
                  color: "#fff",
                  cursor: "pointer",
                  fontFamily: "Inter, sans-serif",
                  flexShrink: 0,
                  marginLeft: "16px",
                }}
              >
                + Invite user
              </button>
            </div>

            {loading ? (
              <p style={{ fontSize: "12px", color: "var(--slate-light)" }}>
                Loading...
              </p>
            ) : profiles.length === 0 ? (
              <div
                style={{
                  padding: "32px",
                  border: "1px dashed var(--border)",
                  borderRadius: "10px",
                  textAlign: "center",
                }}
              >
                <p style={{ fontSize: "12px", color: "var(--slate)" }}>
                  No users yet — invite someone to get started.
                </p>
              </div>
            ) : (
              <div
                style={{ display: "flex", flexDirection: "column", gap: "8px" }}
              >
                {profiles.map((profile) => (
                  <UserRow
                    key={profile.id}
                    profile={profile}
                    teams={teams}
                    onReload={loadTeams}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {activeSection === "teams" && (
          <div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                marginBottom: "20px",
              }}
            >
              <div>
                <h2
                  className="font-display"
                  style={{
                    fontSize: "18px",
                    color: "var(--navy)",
                    marginBottom: "4px",
                  }}
                >
                  Teams
                </h2>
                <p
                  style={{
                    fontSize: "12px",
                    color: "var(--slate)",
                    lineHeight: "1.6",
                  }}
                >
                  Teams appear as sub-rows within each KPI focus on the roadmap.
                  <br />
                  Each team's items are shown in their own row for easy
                  cross-team comparison.
                </p>
              </div>
              <button
                onClick={() => setShowAddTeam(true)}
                style={{
                  padding: "8px 16px",
                  borderRadius: "8px",
                  border: "none",
                  background: "var(--navy)",
                  fontSize: "12px",
                  fontWeight: "600",
                  color: "#fff",
                  cursor: "pointer",
                  fontFamily: "Inter, sans-serif",
                  flexShrink: 0,
                  marginLeft: "16px",
                }}
              >
                + Add team
              </button>
            </div>

            {loading ? (
              <p style={{ fontSize: "12px", color: "var(--slate-light)" }}>
                Loading...
              </p>
            ) : teams.length === 0 ? (
              <div
                style={{
                  padding: "32px",
                  border: "1px dashed var(--border)",
                  borderRadius: "10px",
                  textAlign: "center",
                }}
              >
                <div
                  className="font-display"
                  style={{
                    fontSize: "16px",
                    color: "var(--navy)",
                    marginBottom: "6px",
                  }}
                >
                  No teams yet
                </div>
                <p
                  style={{
                    fontSize: "12px",
                    color: "var(--slate)",
                    marginBottom: "16px",
                    lineHeight: "1.6",
                  }}
                >
                  Add your teams here — they'll appear as rows on the roadmap.
                  <br />
                  Each team can own roadmap items within any KPI focus.
                </p>
                <button
                  onClick={() => setShowAddTeam(true)}
                  style={{
                    padding: "8px 20px",
                    borderRadius: "8px",
                    border: "none",
                    background: "var(--blue)",
                    fontSize: "12px",
                    fontWeight: "600",
                    color: "#fff",
                    cursor: "pointer",
                    fontFamily: "Inter, sans-serif",
                  }}
                >
                  Add first team
                </button>
              </div>
            ) : (
              <div
                style={{ display: "flex", flexDirection: "column", gap: "8px" }}
              >
                {teams.map((team) => (
                  <TeamRow
                    key={team.id}
                    team={team}
                    onDeleted={loadTeams}
                    onReload={loadTeams}
                  />
                ))}
                <div
                  style={{
                    marginTop: "8px",
                    fontSize: "12px",
                    color: "var(--slate-light)",
                  }}
                >
                  {teams.length} {teams.length === 1 ? "team" : "teams"} · teams
                  appear on the roadmap once items are assigned to them
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {showAddUser && (
        <AddUserModal
          teams={teams}
          onClose={() => setShowAddUser(false)}
          onSaved={() => {
            setShowAddUser(false);
            loadTeams();
          }}
        />
      )}

      {showAddTeam && (
        <AddTeamModal
          onClose={() => setShowAddTeam(false)}
          onSaved={() => {
            setShowAddTeam(false);
            loadTeams();
          }}
        />
      )}
    </div>
  );
}
