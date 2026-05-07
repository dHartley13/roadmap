import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { logEvent } from "../lib/audit";

const PILLAR_COLOURS = [
  "#1E40AF",
  "#0F766E",
  "#7C3AED",
  "#B45309",
  "#BE185D",
  "#0E7490",
  "#4D7C0F",
  "#9F1239",
];

function NarrativeBar({ goal }) {
  const parts = [goal.kpi_name, goal.driver_statement, goal.lead_metric_name];
  const filled = parts.filter(Boolean).length;
  const complete = filled === 3;

  if (!complete) return null;

  return (
    <div
      style={{
        background: "var(--navy)",
        borderRadius: "6px",
        padding: "10px 14px",
        fontSize: "12px",
        color: "#BFDBFE",
        lineHeight: "1.6",
      }}
    >
      <span
        style={{
          color: "var(--slate-light)",
          fontSize: "10px",
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          display: "block",
          marginBottom: "4px",
        }}
      >
        Strategy narrative
      </span>
      We are focusing on{" "}
      <strong style={{ color: "white" }}>{goal.driver_statement}</strong> as the
      primary driver of{" "}
      <strong style={{ color: "white" }}>{goal.kpi_name}</strong>, measuring
      progress through{" "}
      <strong style={{ color: "white" }}>{goal.lead_metric_name}</strong>.
    </div>
  );
}
function EditFocusModal({ goal, teams, onClose, onSaved, onDelete }) {
  const [form, setForm] = useState({ ...goal });
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function save() {
    setSaving(true);
    await supabase
      .from("goals")
      .update({
        driver_statement: form.driver_statement?.trim() || null,
        driver_rationale: form.driver_rationale?.trim() || null,
        lead_metric_name: form.lead_metric_name?.trim() || null,
        lead_metric_baseline: form.lead_metric_baseline?.trim() || null,
        lead_metric_target: form.lead_metric_target?.trim() || null,
        team_id: form.team_id || null,
      })
      .eq("id", goal.id);

    await logEvent({
      eventType: "kpi_updated",
      entityType: "goal",
      entityId: goal.id,
      entityName: form.driver_statement,
      oldValue: {
        driver_statement: goal.driver_statement,
        lead_metric_name: goal.lead_metric_name,
      },
      newValue: {
        driver_statement: form.driver_statement,
        lead_metric_name: form.lead_metric_name,
      },
    });

    setSaving(false);
    onSaved();
  }

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
        zIndex: 200,
      }}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: "12px",
          width: "520px",
          maxHeight: "90vh",
          overflow: "auto",
          padding: "28px",
          boxShadow: "0 24px 48px rgba(0,0,0,0.2)",
        }}
      >
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
              Edit product focus
            </h2>
            <p style={{ fontSize: "12px", color: "var(--slate)" }}>
              Changes will update the roadmap view immediately.
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              width: "28px",
              height: "28px",
              borderRadius: "6px",
              border: "1px solid var(--border)",
              background: "transparent",
              color: "var(--slate-light)",
              cursor: "pointer",
              fontSize: "14px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            ✕
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <div>
            <label style={lbl}>Focus area</label>
            <input
              style={inp}
              placeholder="What will your team focus on to move this metric?"
              value={form.driver_statement || ""}
              onChange={(e) =>
                setForm((f) => ({ ...f, driver_statement: e.target.value }))
              }
            />
          </div>
          <div>
            <label style={lbl}>
              Why do you believe this will move the KPI?
            </label>
            <textarea
              style={{ ...inp, minHeight: "64px", resize: "vertical" }}
              placeholder="e.g. Agent handling time is the single largest component of CS cost"
              value={form.driver_rationale || ""}
              onChange={(e) =>
                setForm((f) => ({ ...f, driver_rationale: e.target.value }))
              }
            />
          </div>
          <div>
            <label style={lbl}>Team</label>
            <select
              style={{ ...inp, cursor: "pointer" }}
              value={form.team_id || ""}
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

          <div
            style={{ borderTop: "1px solid var(--border)", paddingTop: "14px" }}
          >
            <div
              style={{
                fontSize: "11px",
                fontWeight: "700",
                color: "var(--blue)",
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                marginBottom: "10px",
              }}
            >
              How will you measure progress?
            </div>
            <div
              style={{ display: "flex", flexDirection: "column", gap: "10px" }}
            >
              <div>
                <label style={lbl}>Success measure</label>
                <input
                  style={inp}
                  placeholder="What will you measure to know it's working?"
                  value={form.lead_metric_name || ""}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, lead_metric_name: e.target.value }))
                  }
                />
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "10px",
                }}
              >
                <div>
                  <label style={lbl}>Baseline</label>
                  <input
                    style={inp}
                    placeholder="e.g. 11 mins"
                    value={form.lead_metric_baseline || ""}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        lead_metric_baseline: e.target.value,
                      }))
                    }
                  />
                </div>
                <div>
                  <label style={lbl}>Target</label>
                  <input
                    style={inp}
                    placeholder="e.g. 9 mins"
                    value={form.lead_metric_target || ""}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        lead_metric_target: e.target.value,
                      }))
                    }
                  />
                </div>
              </div>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              paddingTop: "8px",
            }}
          >
            <button
              onClick={() => setConfirmDelete(true)}
              style={{
                padding: "8px 14px",
                borderRadius: "6px",
                border: "1px solid #FEE2E2",
                background: "#FEE2E2",
                fontSize: "12px",
                color: "#991B1B",
                cursor: "pointer",
                fontFamily: "Inter, sans-serif",
              }}
            >
              🗑 Delete focus
            </button>
            <div style={{ display: "flex", gap: "8px" }}>
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
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {confirmDelete && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(15,23,42,0.7)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 300,
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
              Delete this focus?
            </h3>
            <p
              style={{
                fontSize: "12px",
                color: "var(--slate)",
                marginBottom: "20px",
                lineHeight: "1.5",
              }}
            >
              This will remove{" "}
              <strong>{goal.driver_statement || "this focus"}</strong>{" "}
              permanently.
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
                onClick={onDelete}
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
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function KPIFocusCard({ goal, teams, onDelete, onReload }) {
  const [editing, setEditing] = useState(false);
  const team = teams?.find((t) => t.id === goal.team_id);

  return (
    <>
      <tr
        onClick={() => setEditing(true)}
        style={{ cursor: "pointer" }}
        onMouseEnter={(e) => (e.currentTarget.style.background = "#F8FAFC")}
        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
      >
        <td
          style={{
            padding: "10px 12px",
            fontSize: "12px",
            fontWeight: "600",
            color: "var(--navy)",
            borderBottom: "1px solid var(--border)",
          }}
        >
          {goal.driver_statement || (
            <span
              style={{
                color: "var(--slate-light)",
                fontStyle: "italic",
                fontWeight: "400",
              }}
            >
              No focus defined
            </span>
          )}
          {goal.driver_rationale && (
            <div
              style={{
                fontSize: "10px",
                color: "var(--slate)",
                fontWeight: "400",
                marginTop: "2px",
                lineHeight: "1.4",
              }}
            >
              {goal.driver_rationale}
            </div>
          )}
        </td>
        <td
          style={{
            padding: "10px 12px",
            borderBottom: "1px solid var(--border)",
          }}
        >
          {team ? (
            <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
              <div
                style={{
                  width: "7px",
                  height: "7px",
                  borderRadius: "50%",
                  background: team.colour,
                  flexShrink: 0,
                }}
              />
              <span style={{ fontSize: "11px", color: "var(--navy)" }}>
                {team.name}
              </span>
            </div>
          ) : (
            <span
              style={{
                fontSize: "11px",
                color: "var(--slate-light)",
                fontStyle: "italic",
              }}
            >
              —
            </span>
          )}
        </td>
        <td
          style={{
            padding: "10px 12px",
            fontSize: "11px",
            color: "var(--navy)",
            borderBottom: "1px solid var(--border)",
          }}
        >
          {goal.lead_metric_name || (
            <span style={{ color: "var(--slate-light)", fontStyle: "italic" }}>
              —
            </span>
          )}
        </td>
        <td
          style={{
            padding: "10px 12px",
            fontSize: "11px",
            color: "var(--slate)",
            borderBottom: "1px solid var(--border)",
          }}
        >
          {goal.lead_metric_baseline || "—"}
        </td>
        <td
          style={{
            padding: "10px 12px",
            fontSize: "11px",
            fontWeight: "600",
            color: "var(--green)",
            borderBottom: "1px solid var(--border)",
          }}
        >
          {goal.lead_metric_target || "—"}
        </td>
        <td
          style={{
            padding: "10px 12px",
            borderBottom: "1px solid var(--border)",
            textAlign: "right",
          }}
        >
          <span style={{ fontSize: "10px", color: "var(--blue)" }}>Edit ›</span>
        </td>
      </tr>

      {editing && (
        <EditFocusModal
          goal={goal}
          teams={teams}
          onClose={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            onReload();
          }}
          onDelete={() => {
            onDelete();
            setEditing(false);
          }}
        />
      )}
    </>
  );
}

function AddKPIFocusModal({ pillarId, pillarKPIs, teams, onClose, onSaved }) {
  const [form, setForm] = useState({
    kpi_name: pillarKPIs.length > 0 ? pillarKPIs[0].metric : "",
    kpi_baseline: pillarKPIs.length > 0 ? pillarKPIs[0].baseline : "",
    kpi_target: pillarKPIs.length > 0 ? pillarKPIs[0].target : "",
    driver_statement: "",
    driver_rationale: "",
    lead_metric_name: "",
    lead_metric_baseline: "",
    lead_metric_target: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  function selectKPI(kpi) {
    setForm((f) => ({
      ...f,
      kpi_name: kpi.metric,
      kpi_baseline: kpi.baseline,
      kpi_target: kpi.target,
    }));
  }

  async function save() {
    if (!form.kpi_name.trim()) return setError("Please select or enter a KPI");
    setSaving(true);
    const { data, error } = await supabase
      .from("goals")
      .insert({
        pillar_id: pillarId,
        kpi_name: form.kpi_name.trim(),
        kpi_baseline: form.kpi_baseline.trim() || null,
        kpi_target: form.kpi_target.trim() || null,
        driver_statement: form.driver_statement.trim() || null,
        driver_rationale: form.driver_rationale.trim() || null,
        lead_metric_name: form.lead_metric_name.trim() || null,
        lead_metric_baseline: form.lead_metric_baseline.trim() || null,
        lead_metric_target: form.lead_metric_target.trim() || null,
        team_id: form.team_id || null,
      })
      .select()
      .single();
    setSaving(false);
    if (error) return setError(error.message);

    //Adit log
    await logEvent({
      eventType: "kpi_created",
      entityType: "goal",
      entityId: data?.id || "unknown",
      entityName: form.kpi_name,
      pillarId: pillarId,
      newValue: {
        kpi_name: form.kpi_name,
        kpi_target: form.kpi_target,
        driver_statement: form.driver_statement,
        lead_metric_name: form.lead_metric_name,
      },
    });

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
    background: "var(--white)",
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

  const sectionStyle = {
    borderTop: "1px solid var(--border)",
    paddingTop: "16px",
  };

  const sectionHeadStyle = {
    fontSize: "11px",
    fontWeight: "700",
    color: "var(--blue)",
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    marginBottom: "12px",
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
          background: "var(--white)",
          borderRadius: "12px",
          width: "560px",
          maxHeight: "90vh",
          overflow: "auto",
          padding: "32px",
          boxShadow: "0 24px 48px rgba(0,0,0,0.2)",
        }}
      >
        <div style={{ marginBottom: "24px" }}>
          <h2
            className="font-display"
            style={{
              fontSize: "20px",
              color: "var(--navy)",
              marginBottom: "4px",
            }}
          >
            Add Product Focus
          </h2>
          <p style={{ fontSize: "12px", color: "var(--slate)" }}>
            Your product focus describes how your team will contribute to the
            business strategy. Select the business metric you've been assigned or
            believe you can most influence, then describe what you'll focus on
            and how you'll measure progress.
          </p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {/* KPI selection */}
          <div>
            <div style={sectionHeadStyle}>Step 1 — Select a KPI</div>
            {pillarKPIs.length > 0 && (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "6px",
                  marginBottom: "10px",
                }}
              >
                {pillarKPIs.map((kpi, i) => (
                  <button
                    key={i}
                    onClick={() => selectKPI(kpi)}
                    style={{
                      padding: "8px 12px",
                      borderRadius: "6px",
                      textAlign: "left",
                      border:
                        form.kpi_name === kpi.metric
                          ? "2px solid var(--blue)"
                          : "1px solid var(--border)",
                      background:
                        form.kpi_name === kpi.metric
                          ? "var(--blue-light)"
                          : "var(--bg)",
                      cursor: "pointer",
                      fontFamily: "Inter, sans-serif",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "12px",
                        fontWeight: "600",
                        color: "var(--navy)",
                      }}
                    >
                      {kpi.metric}
                    </div>
                    {(kpi.baseline || kpi.target) && (
                      <div
                        style={{
                          fontSize: "10px",
                          color: "var(--slate)",
                          marginTop: "2px",
                        }}
                      >
                        {kpi.baseline && `Baseline: ${kpi.baseline}`}
                        {kpi.baseline && kpi.target && "  ·  "}
                        {kpi.target && `Target: ${kpi.target}`}
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
          {/* Driver */}
          <div style={sectionStyle}>
            <div style={sectionHeadStyle}>
              Step 2 — State your driver{" "}
              <span
                style={{
                  color: "var(--slate-light)",
                  fontWeight: "400",
                  textTransform: "none",
                  letterSpacing: 0,
                }}
              >
                (optional)
              </span>
            </div>
            <div style={{ marginBottom: "8px" }}>
              <label style={labelStyle}>Driver statement</label>
              <input
                style={inputStyle}
                placeholder="e.g. Reducing email handling time per agent"
                value={form.driver_statement}
                onChange={(e) =>
                  setForm((f) => ({ ...f, driver_statement: e.target.value }))
                }
              />
            </div>
            <div>
              <label style={labelStyle}>
                Why do you believe this drives the KPI?
              </label>
              <textarea
                style={{ ...inputStyle, minHeight: "64px", resize: "vertical" }}
                placeholder="e.g. Agent handling time is the single largest component of CS cost per contact"
                value={form.driver_rationale}
                onChange={(e) =>
                  setForm((f) => ({ ...f, driver_rationale: e.target.value }))
                }
              />
            </div>
            <div>
              <label style={labelStyle}>
                Team{" "}
                <span
                  style={{
                    color: "var(--slate-light)",
                    fontWeight: "400",
                    textTransform: "none",
                    letterSpacing: 0,
                  }}
                >
                  (optional)
                </span>
              </label>
              <select
                style={inputStyle}
                value={form.team_id || ""}
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
            <div
              style={{
                marginTop: "8px",
                padding: "8px 10px",
                background: "var(--bg)",
                borderRadius: "6px",
                border: "1px dashed var(--border)",
              }}
            >
              <div
                style={{
                  fontSize: "10px",
                  fontWeight: "600",
                  color: "var(--slate-light)",
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  marginBottom: "2px",
                }}
              >
                Discovery framework
              </div>
              <div
                style={{
                  fontSize: "11px",
                  color: "var(--slate-light)",
                  lineHeight: "1.5",
                }}
              >
                Coming soon — you'll be able to decompose this driver into T1/T2
                contributors and map candidate solutions before committing to
                the roadmap.
              </div>
            </div>
          </div>

          {/* How will you measure progress? */}
          <div style={sectionStyle}>
            <div style={sectionHeadStyle}>
              Step 3 — Define your metric{" "}
              <span
                style={{
                  color: "var(--slate-light)",
                  fontWeight: "400",
                  textTransform: "none",
                  letterSpacing: 0,
                }}
              >
                (optional)
              </span>
            </div>
            <div style={{ marginBottom: "8px" }}>
              <label style={labelStyle}>metric name</label>
              <input
                style={inputStyle}
                placeholder="e.g. Average email handling time"
                value={form.lead_metric_name}
                onChange={(e) =>
                  setForm((f) => ({ ...f, lead_metric_name: e.target.value }))
                }
              />
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "8px",
              }}
            >
              <div>
                <label style={labelStyle}>Baseline</label>
                <input
                  style={inputStyle}
                  placeholder="e.g. 11 mins"
                  value={form.lead_metric_baseline}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      lead_metric_baseline: e.target.value,
                    }))
                  }
                />
              </div>
              <div>
                <label style={labelStyle}>Target</label>
                <input
                  style={inputStyle}
                  placeholder="e.g. 9 mins"
                  value={form.lead_metric_target}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      lead_metric_target: e.target.value,
                    }))
                  }
                />
              </div>
            </div>
          </div>

          {error && (
            <div
              style={{
                fontSize: "12px",
                color: "var(--red)",
                background: "var(--red-bg)",
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
              gap: "10px",
              justifyContent: "flex-end",
              paddingTop: "4px",
            }}
          >
            <button
              onClick={onClose}
              style={{
                padding: "9px 18px",
                borderRadius: "6px",
                border: "1px solid var(--border)",
                background: "var(--white)",
                fontSize: "13px",
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
                padding: "9px 18px",
                borderRadius: "6px",
                border: "none",
                background: "var(--blue)",
                fontSize: "13px",
                fontWeight: "600",
                color: "var(--white)",
                cursor: saving ? "not-allowed" : "pointer",
                opacity: saving ? 0.7 : 1,
                fontFamily: "Inter, sans-serif",
              }}
            >
              {saving ? "Saving..." : "Save Product Focus"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function AddPillarModal({ onClose, onSaved }) {
  const [form, setForm] = useState({
    name: "",
    description: "",
    colour: PILLAR_COLOURS[0],
    success_criteria: [{ metric: "", baseline: "", target: "" }],
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  function updateCriteria(index, field, value) {
    setForm((f) => ({
      ...f,
      success_criteria: f.success_criteria.map((row, i) =>
        i === index ? { ...row, [field]: value } : row,
      ),
    }));
  }

  function addCriteriaRow() {
    setForm((f) => ({
      ...f,
      success_criteria: [
        ...f.success_criteria,
        { metric: "", baseline: "", target: "" },
      ],
    }));
  }

  function removeCriteriaRow(index) {
    setForm((f) => ({
      ...f,
      success_criteria: f.success_criteria.filter((_, i) => i !== index),
    }));
  }

  async function save() {
    if (!form.name.trim()) return setError("Pillar name is required");
    setSaving(true);
    const cleanCriteria = form.success_criteria.filter((r) => r.metric.trim());
    const { error } = await supabase.from("pillars").insert({
      name: form.name.trim(),
      description: form.description.trim() || null,
      colour: form.colour,
      success_criteria: cleanCriteria,
    });
    setSaving(false);
    if (error) return setError(error.message);
    onSaved();
  }

  const inputStyle = {
    width: "100%",
    padding: "7px 10px",
    border: "1px solid var(--border)",
    borderRadius: "6px",
    fontSize: "12px",
    fontFamily: "Inter, sans-serif",
    color: "var(--navy)",
    background: "var(--white)",
    outline: "none",
  };

  const labelStyle = {
    fontSize: "11px",
    fontWeight: "600",
    color: "var(--slate)",
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    marginBottom: "5px",
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
          background: "var(--white)",
          borderRadius: "12px",
          width: "560px",
          maxHeight: "90vh",
          overflow: "auto",
          padding: "32px",
          boxShadow: "0 24px 48px rgba(0,0,0,0.2)",
        }}
      >
        <div style={{ marginBottom: "24px" }}>
          <h2
            className="font-display"
            style={{
              fontSize: "20px",
              color: "var(--navy)",
              marginBottom: "4px",
            }}
          >
            New strategic pillar
          </h2>
          <p style={{ fontSize: "12px", color: "var(--slate)" }}>
            Pillars represent your business strategy. They change rarely.
          </p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
          <div>
            <label style={labelStyle}>Pillar name *</label>
            <input
              style={inputStyle}
              placeholder="e.g. Evolve brands that earn enduring trust"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </div>
          <div>
            <label style={labelStyle}>Description</label>
            <textarea
              style={{
                ...inputStyle,
                minHeight: "72px",
                resize: "vertical",
                padding: "9px 12px",
              }}
              placeholder="What does this pillar mean for the business?"
              value={form.description}
              onChange={(e) =>
                setForm((f) => ({ ...f, description: e.target.value }))
              }
            />
          </div>
          <div>
            <label style={labelStyle}>Colour</label>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              {PILLAR_COLOURS.map((c) => (
                <button
                  key={c}
                  onClick={() => setForm((f) => ({ ...f, colour: c }))}
                  style={{
                    width: "28px",
                    height: "28px",
                    borderRadius: "50%",
                    background: c,
                    border:
                      form.colour === c
                        ? "3px solid var(--navy)"
                        : "2px solid transparent",
                    cursor: "pointer",
                    outline:
                      form.colour === c ? "2px solid var(--white)" : "none",
                    outlineOffset: "-4px",
                  }}
                />
              ))}
            </div>
          </div>

          <div
            style={{ borderTop: "1px solid var(--border)", paddingTop: "18px" }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "10px",
              }}
            >
              <label style={{ ...labelStyle, marginBottom: 0 }}>
                Business Metrics
              </label>
              <span style={{ fontSize: "11px", color: "var(--slate-light)" }}>
                These become your lagging KPIs
              </span>
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 100px 100px 28px",
                gap: "6px",
                marginBottom: "6px",
                padding: "0 2px",
              }}
            >
              {["Metric name", "Baseline", "Target", ""].map((h, i) => (
                <div
                  key={i}
                  style={{
                    fontSize: "10px",
                    fontWeight: "600",
                    color: "var(--slate-light)",
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                  }}
                >
                  {h}
                </div>
              ))}
            </div>
            <div
              style={{ display: "flex", flexDirection: "column", gap: "6px" }}
            >
              {form.success_criteria.map((row, i) => (
                <div
                  key={i}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 100px 100px 28px",
                    gap: "6px",
                    alignItems: "center",
                  }}
                >
                  <input
                    style={inputStyle}
                    placeholder="e.g. Bookings per property"
                    value={row.metric}
                    onChange={(e) =>
                      updateCriteria(i, "metric", e.target.value)
                    }
                  />
                  <input
                    style={inputStyle}
                    placeholder="e.g. 4.2"
                    value={row.baseline}
                    onChange={(e) =>
                      updateCriteria(i, "baseline", e.target.value)
                    }
                  />
                  <input
                    style={inputStyle}
                    placeholder="e.g. 5.0"
                    value={row.target}
                    onChange={(e) =>
                      updateCriteria(i, "target", e.target.value)
                    }
                  />
                  <button
                    onClick={() => removeCriteriaRow(i)}
                    disabled={form.success_criteria.length === 1}
                    style={{
                      width: "28px",
                      height: "28px",
                      borderRadius: "4px",
                      border: "1px solid var(--border)",
                      background: "transparent",
                      color: "var(--slate-light)",
                      cursor:
                        form.success_criteria.length === 1
                          ? "not-allowed"
                          : "pointer",
                      fontSize: "14px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      opacity: form.success_criteria.length === 1 ? 0.3 : 1,
                    }}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
            <button
              onClick={addCriteriaRow}
              style={{
                marginTop: "8px",
                padding: "6px 12px",
                border: "1px dashed var(--border)",
                borderRadius: "6px",
                background: "transparent",
                fontSize: "12px",
                color: "var(--slate)",
                cursor: "pointer",
                fontFamily: "Inter, sans-serif",
                width: "100%",
              }}
            >
              + Add metric
            </button>
          </div>

          {error && (
            <div
              style={{
                fontSize: "12px",
                color: "var(--red)",
                background: "var(--red-bg)",
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
              gap: "10px",
              justifyContent: "flex-end",
              paddingTop: "8px",
            }}
          >
            <button
              onClick={onClose}
              style={{
                padding: "9px 18px",
                borderRadius: "6px",
                border: "1px solid var(--border)",
                background: "var(--white)",
                fontSize: "13px",
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
                padding: "9px 18px",
                borderRadius: "6px",
                border: "none",
                background: "var(--blue)",
                fontSize: "13px",
                fontWeight: "600",
                color: "var(--white)",
                cursor: saving ? "not-allowed" : "pointer",
                opacity: saving ? 0.7 : 1,
                fontFamily: "Inter, sans-serif",
              }}
            >
              {saving ? "Saving..." : "Create pillar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
function EditPillarModal({ pillar, onClose, onSaved }) {
  const [form, setForm] = useState({
    name: pillar.name,
    description: pillar.description || "",
    colour: pillar.colour || PILLAR_COLOURS[0],
    success_criteria:
      pillar.success_criteria?.length > 0
        ? pillar.success_criteria
        : [{ metric: "", baseline: "", target: "" }],
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  function updateCriteria(index, field, value) {
    setForm((f) => ({
      ...f,
      success_criteria: f.success_criteria.map((row, i) =>
        i === index ? { ...row, [field]: value } : row,
      ),
    }));
  }

  function addCriteriaRow() {
    setForm((f) => ({
      ...f,
      success_criteria: [
        ...f.success_criteria,
        { metric: "", baseline: "", target: "" },
      ],
    }));
  }

  function removeCriteriaRow(index) {
    setForm((f) => ({
      ...f,
      success_criteria: f.success_criteria.filter((_, i) => i !== index),
    }));
  }

  async function save() {
    if (!form.name.trim()) return setError("Pillar name is required");
    setSaving(true);
    const cleanCriteria = form.success_criteria.filter((r) => r.metric.trim());
    await supabase
      .from("pillars")
      .update({
        name: form.name.trim(),
        description: form.description.trim() || null,
        colour: form.colour,
        success_criteria: cleanCriteria,
      })
      .eq("id", pillar.id);
    setSaving(false);
    onSaved();
  }

  const inputStyle = {
    width: "100%",
    padding: "7px 10px",
    border: "1px solid var(--border)",
    borderRadius: "6px",
    fontSize: "12px",
    fontFamily: "Inter, sans-serif",
    color: "var(--navy)",
    background: "#fff",
    outline: "none",
  };
  const labelStyle = {
    fontSize: "11px",
    fontWeight: "600",
    color: "var(--slate)",
    letterSpacing: "0.06em",
    textTransform: "uppercase",
    marginBottom: "5px",
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
          width: "560px",
          maxHeight: "90vh",
          overflow: "auto",
          padding: "32px",
          boxShadow: "0 24px 48px rgba(0,0,0,0.2)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            marginBottom: "24px",
          }}
        >
          <div>
            <h2
              className="font-display"
              style={{
                fontSize: "20px",
                color: "var(--navy)",
                marginBottom: "4px",
              }}
            >
              Edit pillar
            </h2>
            <p style={{ fontSize: "12px", color: "var(--slate)" }}>
              Changes will reflect immediately across the tool.
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              width: "28px",
              height: "28px",
              borderRadius: "6px",
              border: "1px solid var(--border)",
              background: "transparent",
              color: "var(--slate-light)",
              cursor: "pointer",
              fontSize: "14px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            ✕
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
          <div>
            <label style={labelStyle}>Pillar name *</label>
            <input
              style={inputStyle}
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </div>
          <div>
            <label style={labelStyle}>Description</label>
            <textarea
              style={{
                ...inputStyle,
                minHeight: "72px",
                resize: "vertical",
                padding: "9px 12px",
              }}
              value={form.description}
              onChange={(e) =>
                setForm((f) => ({ ...f, description: e.target.value }))
              }
            />
          </div>
          <div>
            <label style={labelStyle}>Colour</label>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              {PILLAR_COLOURS.map((c) => (
                <button
                  key={c}
                  onClick={() => setForm((f) => ({ ...f, colour: c }))}
                  style={{
                    width: "28px",
                    height: "28px",
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
            style={{ borderTop: "1px solid var(--border)", paddingTop: "18px" }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "10px",
              }}
            >
              <label style={{ ...labelStyle, marginBottom: 0 }}>
                Business Metrics
              </label>
              <span style={{ fontSize: "11px", color: "var(--slate-light)" }}>
                These are your lagging KPIs
              </span>
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 100px 100px 28px",
                gap: "6px",
                marginBottom: "6px",
              }}
            >
              {["Metric name", "Baseline", "Target", ""].map((h, i) => (
                <div
                  key={i}
                  style={{
                    fontSize: "10px",
                    fontWeight: "600",
                    color: "var(--slate-light)",
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                  }}
                >
                  {h}
                </div>
              ))}
            </div>
            <div
              style={{ display: "flex", flexDirection: "column", gap: "6px" }}
            >
              {form.success_criteria.map((row, i) => (
                <div
                  key={i}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 100px 100px 28px",
                    gap: "6px",
                    alignItems: "center",
                  }}
                >
                  <input
                    style={inputStyle}
                    placeholder="e.g. Bookings per property"
                    value={row.metric}
                    onChange={(e) =>
                      updateCriteria(i, "metric", e.target.value)
                    }
                  />
                  <input
                    style={inputStyle}
                    placeholder="e.g. 4.2"
                    value={row.baseline}
                    onChange={(e) =>
                      updateCriteria(i, "baseline", e.target.value)
                    }
                  />
                  <input
                    style={inputStyle}
                    placeholder="e.g. 5.0"
                    value={row.target}
                    onChange={(e) =>
                      updateCriteria(i, "target", e.target.value)
                    }
                  />
                  <button
                    onClick={() => removeCriteriaRow(i)}
                    disabled={form.success_criteria.length === 1}
                    style={{
                      width: "28px",
                      height: "28px",
                      borderRadius: "4px",
                      border: "1px solid var(--border)",
                      background: "transparent",
                      color: "var(--slate-light)",
                      cursor:
                        form.success_criteria.length === 1
                          ? "not-allowed"
                          : "pointer",
                      fontSize: "14px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      opacity: form.success_criteria.length === 1 ? 0.3 : 1,
                    }}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
            <button
              onClick={addCriteriaRow}
              style={{
                marginTop: "8px",
                padding: "6px 12px",
                border: "1px dashed var(--border)",
                borderRadius: "6px",
                background: "transparent",
                fontSize: "12px",
                color: "var(--slate)",
                cursor: "pointer",
                fontFamily: "Inter, sans-serif",
                width: "100%",
              }}
            >
              + Add metric
            </button>
          </div>

          {error && (
            <div
              style={{
                fontSize: "12px",
                color: "var(--red)",
                background: "var(--red-bg)",
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
              gap: "10px",
              justifyContent: "flex-end",
              paddingTop: "8px",
            }}
          >
            <button
              onClick={onClose}
              style={{
                padding: "9px 18px",
                borderRadius: "6px",
                border: "1px solid var(--border)",
                background: "#fff",
                fontSize: "13px",
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
                padding: "9px 18px",
                borderRadius: "6px",
                border: "none",
                background: "var(--blue)",
                fontSize: "13px",
                fontWeight: "600",
                color: "#fff",
                cursor: saving ? "not-allowed" : "pointer",
                opacity: saving ? 0.7 : 1,
                fontFamily: "Inter, sans-serif",
              }}
            >
              {saving ? "Saving…" : "Save changes"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function PillarRow({ pillar, goals, teams, items, onReload }) {
  const [expanded, setExpanded] = useState(false);
  const [showAddKPI, setShowAddKPI] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [selectedKPI, setSelectedKPI] = useState(null);
  const [editing, setEditing] = useState(false);

  const pillarGoals = goals.filter((g) => g.pillar_id === pillar.id);
  const pillarItems = items.filter((i) => i.pillar_id === pillar.id);

  // Teams contributing — union of teams with goals or items on this pillar
  const teamIdsFromGoals = goals
    .filter((g) => g.pillar_id === pillar.id)
    .flatMap((g) =>
      teams
        .filter(
          (t) => goals.some((goal) => goal.pillar_id === pillar.id), // has focus
        )
        .map((t) => t.id),
    );

  const teamIdsFromItems = pillarItems
    .filter((i) => i.team_id)
    .map((i) => i.team_id);

  const teamIdsFromFocuses = goals
    .filter((g) => g.pillar_id === pillar.id && g.team_id)
    .map((g) => g.team_id);

  // All unique team IDs contributing to this pillar
  const contributingTeamIds = [
    ...new Set([...teamIdsFromItems, ...teamIdsFromFocuses]),
  ];

  // Group goals by KPI name
  const kpiGroups = pillarGoals.reduce((acc, goal) => {
    const key = goal.kpi_name || "No KPI";
    if (!acc[key]) acc[key] = [];
    acc[key].push(goal);
    return acc;
  }, {});

  async function deleteGoal(goalId) {
    const goal = goals.find((g) => g.id === goalId);
    if (goal) {
      await logEvent({
        eventType: "kpi_deleted",
        entityType: "goal",
        entityId: goalId,
        entityName: goal.kpi_name,
        pillarId: pillar.id,
        oldValue: {
          kpi_name: goal.kpi_name,
          driver_statement: goal.driver_statement,
          lead_metric_name: goal.lead_metric_name,
        },
      });
    }
    await supabase.from("goals").delete().eq("id", goalId);
    onReload();
  }

  async function deletePillar() {
    await supabase.from("pillars").delete().eq("id", pillar.id);
    setConfirmDelete(false);
    onReload();
  }

  const uniqueKPIs = Object.keys(kpiGroups).length;
  const totalFocuses = pillarGoals.length;

  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid var(--border)",
        borderRadius: "10px",
        overflow: "hidden",
        borderLeft: `4px solid ${pillar.colour || "#1E40AF"}`,
      }}
    >
      {/* Pillar header — always visible */}
      <div style={{ padding: "16px 20px" }}>
        {/* Top row — name + delete */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: "12px",
            marginBottom: "10px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              flex: 1,
            }}
          >
            <div
              style={{
                width: "10px",
                height: "10px",
                borderRadius: "50%",
                background: pillar.colour || "#1E40AF",
                flexShrink: 0,
              }}
            />
            <h2
              className="font-display"
              style={{
                fontSize: "15px",
                color: "var(--navy)",
                fontWeight: "600",
                lineHeight: "1.3",
              }}
            >
              {pillar.name}
            </h2>
          </div>
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
              fontFamily: "Inter, sans-serif",
              marginRight: "4px",
              flexShrink: 0,
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
              fontSize: "14px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            🗑
          </button>
        </div>

        {/* Description */}
        {pillar.description && (
          <p
            style={{
              fontSize: "12px",
              color: "var(--slate)",
              marginBottom: "10px",
              lineHeight: "1.5",
            }}
          >
            {pillar.description}
          </p>
        )}

        {/* Stats + expand row */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginTop: "10px",
          }}
        >
          <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
            {[
              pillar.success_criteria?.length > 0 &&
                `${pillar.success_criteria.length} KPI${pillar.success_criteria.length !== 1 ? "s" : ""}`,
              totalFocuses > 0 &&
                `${totalFocuses} ${totalFocuses === 1 ? "focus" : "focuses"}`,
              contributingTeamIds.length > 0 &&
                `${contributingTeamIds.length} ${contributingTeamIds.length === 1 ? "team" : "teams"}`,
            ]
              .filter(Boolean)
              .map((stat, i) => (
                <span
                  key={i}
                  style={{
                    fontSize: "10px",
                    color: "var(--slate-light)",
                    background: "var(--bg)",
                    padding: "2px 8px",
                    borderRadius: "99px",
                    border: "1px solid var(--border)",
                    whiteSpace: "nowrap",
                  }}
                >
                  {stat}
                </span>
              ))}
          </div>
          <button
            onClick={() => setExpanded((e) => !e)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              border: "none",
              background: "transparent",
              cursor: "pointer",
              padding: 0,
              fontFamily: "Inter, sans-serif",
              flexShrink: 0,
            }}
          >
            <span style={{ fontSize: "11px", color: "var(--slate-light)" }}>
              {expanded ? "Collapse" : "Expand"}
            </span>
            <span
              style={{
                fontSize: "11px",
                color: "var(--slate-light)",
                transform: expanded ? "rotate(180deg)" : "none",
                transition: "transform 0.2s",
                display: "inline-block",
              }}
            >
              ▾
            </span>
          </button>
        </div>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div
          style={{
            borderTop: "1px solid var(--border)",
            background: "var(--bg)",
          }}
        >
          {/* Description + success criteria */}
          {(pillar.description ||
            (pillar.success_criteria &&
              pillar.success_criteria.length > 0)) && (
            <div
              style={{
                padding: "14px 20px",
                borderBottom: "1px solid var(--border)",
                background: "#fff",
              }}
            >
              {pillar.description && (
                <p
                  style={{
                    fontSize: "12px",
                    color: "var(--slate)",
                    marginBottom:
                      pillar.success_criteria?.length > 0 ? "10px" : 0,
                  }}
                >
                  {pillar.description}
                </p>
              )}
              {pillar.success_criteria &&
                pillar.success_criteria.length > 0 && (
                  <div>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 100px 100px 80px 80px",
                        gap: "4px",
                      }}
                    >
                      {["Metric", "Baseline", "Target", "Focuses", "Teams"].map(
                        (h) => (
                          <div
                            key={h}
                            style={{
                              fontSize: "9px",
                              fontWeight: "600",
                              color: "var(--slate-light)",
                              letterSpacing: "0.08em",
                              textTransform: "uppercase",
                              paddingBottom: "3px",
                            }}
                          >
                            {h}
                          </div>
                        ),
                      )}
                      {pillar.success_criteria.map((row, i) => {
                        const focusesForKPI = pillarGoals.filter(
                          (g) => g.kpi_name === row.metric,
                        );
                        const teamsForKPI = [
                          ...new Set([
                            ...items
                              .filter(
                                (item) =>
                                  focusesForKPI.some(
                                    (g) => g.id === item.goal_id,
                                  ) && item.team_id,
                              )
                              .map((i) => i.team_id),
                            ...focusesForKPI
                              .filter((g) => g.team_id)
                              .map((g) => g.team_id),
                          ]),
                        ];
                        const isSelected = selectedKPI === row.metric;
                        const cellStyle = {
                          fontSize: "12px",
                          color: "var(--navy)",
                          padding: "5px 6px",
                          borderTop: "1px solid var(--border)",
                          cursor: "pointer",
                          background: isSelected
                            ? "var(--blue-light)"
                            : "transparent",
                        };
                        const toggle = () =>
                          setSelectedKPI(isSelected ? null : row.metric);
                        return (
                          <>
                            <div
                              key={`m-${i}`}
                              onClick={toggle}
                              style={{
                                ...cellStyle,
                                fontWeight: "500",
                                color: isSelected
                                  ? "var(--blue)"
                                  : "var(--navy)",
                                borderRadius: "4px 0 0 4px",
                              }}
                            >
                              {row.metric}
                            </div>
                            <div
                              key={`b-${i}`}
                              onClick={toggle}
                              style={{ ...cellStyle, color: "var(--slate)" }}
                            >
                              {row.baseline || "—"}
                            </div>
                            <div
                              key={`t-${i}`}
                              onClick={toggle}
                              style={{
                                ...cellStyle,
                                fontWeight: "600",
                                color: isSelected
                                  ? "var(--blue)"
                                  : "var(--green)",
                              }}
                            >
                              {row.target || "—"}
                            </div>
                            <div
                              key={`f-${i}`}
                              onClick={toggle}
                              style={{
                                ...cellStyle,
                                color:
                                  focusesForKPI.length > 0
                                    ? "var(--blue)"
                                    : "var(--slate-light)",
                                fontWeight:
                                  focusesForKPI.length > 0 ? "600" : "400",
                              }}
                            >
                              {focusesForKPI.length || "—"}
                            </div>
                            <div
                              key={`tm-${i}`}
                              onClick={toggle}
                              style={{
                                ...cellStyle,
                                color:
                                  teamsForKPI.length > 0
                                    ? "var(--navy)"
                                    : "var(--slate-light)",
                                fontWeight:
                                  teamsForKPI.length > 0 ? "600" : "400",
                                borderRadius: "0 4px 4px 0",
                              }}
                            >
                              {teamsForKPI.length || "—"}
                            </div>
                          </>
                        );
                      })}
                    </div>

                    {/* Selected KPI detail */}
                    {selectedKPI && (
                      <div
                        style={{
                          marginTop: "16px",
                          border: "1px solid var(--blue-light)",
                          borderRadius: "8px",
                          overflow: "hidden",
                        }}
                      >
                        <div
                          style={{
                            padding: "10px 14px",
                            background: "var(--navy)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "10px",
                            }}
                          >
                            <div
                              style={{
                                fontSize: "10px",
                                fontWeight: "700",
                                color: "var(--slate-light)",
                                letterSpacing: "0.06em",
                                textTransform: "uppercase",
                              }}
                            >
                              KPI
                            </div>
                            <div
                              style={{
                                fontSize: "13px",
                                fontWeight: "700",
                                color: "#fff",
                              }}
                            >
                              {selectedKPI}
                            </div>
                          </div>
                          <button
                            onClick={() => setSelectedKPI(null)}
                            style={{
                              width: "22px",
                              height: "22px",
                              borderRadius: "4px",
                              border: "none",
                              background: "rgba(255,255,255,0.1)",
                              color: "#fff",
                              cursor: "pointer",
                              fontSize: "12px",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            ✕
                          </button>
                        </div>
                        <div style={{ background: "var(--bg)" }}>
                          {kpiGroups[selectedKPI]?.length > 0 ? (
                            <table
                              style={{
                                width: "100%",
                                borderCollapse: "collapse",
                              }}
                            >
                              <thead>
                                <tr style={{ background: "var(--bg)" }}>
                                  {[
                                    "Focus area",
                                    "Team",
                                    "Measuring",
                                    "Baseline",
                                    "Target",
                                    "",
                                  ].map((h, i) => (
                                    <th
                                      key={h}
                                      style={{
                                        padding: "8px 12px",
                                        fontSize: "9px",
                                        fontWeight: "700",
                                        color: "var(--slate-light)",
                                        letterSpacing: "0.08em",
                                        textTransform: "uppercase",
                                        textAlign: "left",
                                        borderBottom: "1px solid var(--border)",
                                        width: i === 5 ? "60px" : "auto",
                                      }}
                                    >
                                      {h}
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {kpiGroups[selectedKPI].map((goal) => (
                                  <KPIFocusCard
                                    key={goal.id}
                                    goal={goal}
                                    teams={teams}
                                    onDelete={() => deleteGoal(goal.id)}
                                    onReload={onReload}
                                  />
                                ))}
                              </tbody>
                            </table>
                          ) : (
                            <p
                              style={{
                                padding: "12px 14px",
                                fontSize: "12px",
                                color: "var(--slate-light)",
                                fontStyle: "italic",
                              }}
                            >
                              No product focuses for this KPI yet.
                            </p>
                          )}
                          <div
                            style={{
                              padding: "10px 14px",
                              borderTop: "1px solid var(--border)",
                            }}
                          >
                            <button
                              onClick={() => setShowAddKPI(true)}
                              style={{
                                padding: "6px 14px",
                                borderRadius: "6px",
                                border: "1px solid var(--blue)",
                                background: "transparent",
                                fontSize: "11px",
                                fontWeight: "600",
                                color: "var(--blue)",
                                cursor: "pointer",
                                fontFamily: "Inter, sans-serif",
                              }}
                            >
                              + Add key driver
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

              {/* Empty state */}
              {pillarGoals.length === 0 && (
                <div style={{ marginTop: "12px", textAlign: "center" }}>
                  <p
                    style={{
                      fontSize: "12px",
                      color: "var(--slate-light)",
                      marginBottom: "10px",
                    }}
                  >
                    No product focus yet — select a KPI above to add one
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {showAddKPI && (
        <AddKPIFocusModal
          pillarId={pillar.id}
          pillarKPIs={pillar.success_criteria || []}
          teams={teams}
          onClose={() => setShowAddKPI(false)}
          onSaved={() => {
            setShowAddKPI(false);
            onReload();
          }}
        />
      )}

      {editing && (
        <EditPillarModal
          pillar={pillar}
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
              width: "400px",
              padding: "32px",
              boxShadow: "0 24px 48px rgba(0,0,0,0.2)",
            }}
          >
            <h2
              className="font-display"
              style={{
                fontSize: "18px",
                color: "var(--navy)",
                marginBottom: "8px",
              }}
            >
              Delete this pillar?
            </h2>
            <p
              style={{
                fontSize: "13px",
                color: "var(--slate)",
                lineHeight: "1.6",
                marginBottom: "8px",
              }}
            >
              You're about to delete <strong>{pillar.name}</strong>.
            </p>
            <p
              style={{
                fontSize: "12px",
                color: "var(--red)",
                background: "var(--red-bg)",
                padding: "8px 12px",
                borderRadius: "4px",
                marginBottom: "24px",
              }}
            >
              This will also delete all product focuses and roadmap items
              within this pillar. This cannot be undone.
            </p>
            <div
              style={{
                display: "flex",
                gap: "10px",
                justifyContent: "flex-end",
              }}
            >
              <button
                onClick={() => setConfirmDelete(false)}
                style={{
                  padding: "9px 18px",
                  borderRadius: "6px",
                  border: "1px solid var(--border)",
                  background: "#fff",
                  fontSize: "13px",
                  fontWeight: "500",
                  color: "var(--slate)",
                  cursor: "pointer",
                  fontFamily: "Inter, sans-serif",
                }}
              >
                Cancel
              </button>
              <button
                onClick={deletePillar}
                style={{
                  padding: "9px 18px",
                  borderRadius: "6px",
                  border: "none",
                  background: "var(--red)",
                  fontSize: "13px",
                  fontWeight: "600",
                  color: "#fff",
                  cursor: "pointer",
                  fontFamily: "Inter, sans-serif",
                }}
              >
                Delete pillar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Pillars() {
  const [pillars, setPillars] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddPillar, setShowAddPillar] = useState(false);
  const [teams, setTeams] = useState([]);
  const [items, setItems] = useState([]);
  const [goals, setGoals] = useState([]);

  async function loadPillars() {
    const [pr, gr, tr, ir] = await Promise.all([
      supabase.from("pillars").select("*").order("sort_order"),
      supabase.from("goals").select("*"),
      supabase.from("teams").select("*"),
      supabase.from("roadmap_items").select("id, pillar_id, goal_id, team_id"),
    ]);
    setPillars(pr.data || []);
    setGoals(gr.data || []);
    setTeams(tr.data || []);
    setItems(ir.data || []);
    setLoading(false);
  }

  useEffect(() => {
    loadPillars();
  }, []);

  return (
    <div style={{ maxWidth: "1200px" }}>
      <div
        style={{
          marginBottom: "32px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
        }}
      >
        <div>
          <h1
            className="font-display"
            style={{
              fontSize: "28px",
              color: "var(--navy)",
              marginBottom: "6px",
            }}
          >
            Pillars & Strategy
          </h1>
          <p
            style={{
              fontSize: "13px",
              color: "var(--slate)",
              lineHeight: "1.6",
            }}
          >
            Define your strategic pillars, select a product focus for each, and
            state the driver you believe will move it.
          </p>
        </div>
        <div
          style={{
            display: "flex",
            gap: "8px",
            alignItems: "center",
            marginLeft: "24px",
            flexShrink: 0,
          }}
        >
          <button
            onClick={() => setShowAddPillar(true)}
            style={{
              padding: "10px 20px",
              borderRadius: "8px",
              border: "none",
              background: "var(--navy)",
              fontSize: "13px",
              fontWeight: "600",
              color: "#fff",
              cursor: "pointer",
              fontFamily: "Inter, sans-serif",
            }}
          >
            + New pillar
          </button>
        </div>
      </div>

      {loading ? (
        <p style={{ fontSize: "13px", color: "var(--slate-light)" }}>
          Loading...
        </p>
      ) : pillars.length === 0 ? (
        <div
          style={{
            padding: "48px",
            border: "1px dashed var(--border)",
            borderRadius: "10px",
            textAlign: "center",
          }}
        >
          <div
            className="font-display"
            style={{
              fontSize: "18px",
              color: "var(--navy)",
              marginBottom: "8px",
            }}
          >
            No pillars yet
          </div>
          <p
            style={{
              fontSize: "13px",
              color: "var(--slate)",
              marginBottom: "20px",
              lineHeight: "1.6",
            }}
          >
            Start by creating your first strategic pillar.
            <br />
            Each pillar holds your product focus, driver, and roadmap.
          </p>
          <button
            onClick={() => setShowAddPillar(true)}
            style={{
              padding: "10px 24px",
              borderRadius: "8px",
              border: "none",
              background: "var(--blue)",
              fontSize: "13px",
              fontWeight: "600",
              color: "var(--white)",
              cursor: "pointer",
              fontFamily: "Inter, sans-serif",
            }}
          >
            Create first pillar
          </button>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {pillars.map((pillar) => (
            <PillarRow
              key={pillar.id}
              pillar={pillar}
              goals={goals}
              teams={teams}
              items={items}
              onReload={loadPillars}
            />
          ))}
        </div>
      )}

      {showAddPillar && (
        <AddPillarModal
          onClose={() => setShowAddPillar(false)}
          onSaved={() => {
            setShowAddPillar(false);
            loadPillars();
          }}
        />
      )}
    </div>
  );
}
