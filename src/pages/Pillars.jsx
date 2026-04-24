import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

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

function KPIFocusCard({ goal, onDelete, onReload }) {
  const [mode, setMode] = useState("read");
  const [form, setForm] = useState({ ...goal });
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    await supabase
      .from("goals")
      .update({
        kpi_name: form.kpi_name?.trim() || null,
        kpi_baseline: form.kpi_baseline?.trim() || null,
        kpi_target: form.kpi_target?.trim() || null,
        driver_statement: form.driver_statement?.trim() || null,
        driver_rationale: form.driver_rationale?.trim() || null,
        lead_metric_name: form.lead_metric_name?.trim() || null,
        lead_metric_baseline: form.lead_metric_baseline?.trim() || null,
        lead_metric_target: form.lead_metric_target?.trim() || null,
      })
      .eq("id", goal.id);
    setSaving(false);
    setMode("read");
    onReload();
  }

  const inp = {
    width: "100%",
    padding: "7px 10px",
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
        background: "var(--white)",
        border: "1px solid var(--border)",
        borderRadius: "8px",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "14px 16px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          background: "var(--bg)",
        }}
      >
        <div style={{ flex: 1 }}>
          <div
            style={{
              fontSize: "9px",
              fontWeight: "600",
              color: "var(--slate-light)",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              marginBottom: "4px",
            }}
          >
            Product Focus
          </div>
          {mode === "edit" ? (
            <input
              style={inp}
              value={form.kpi_name || ""}
              onChange={(e) =>
                setForm((f) => ({ ...f, kpi_name: e.target.value }))
              }
              placeholder="e.g. CS cost as % of revenue"
            />
          ) : (
            <div
              style={{
                fontSize: "14px",
                fontWeight: "700",
                color: "var(--navy)",
              }}
            >
              {goal.kpi_name || (
                <span
                  style={{
                    color: "var(--slate-light)",
                    fontWeight: "400",
                    fontStyle: "italic",
                  }}
                >
                  No KPI selected
                </span>
              )}
            </div>
          )}
          {mode === "edit" ? (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: "8px",
                marginTop: "8px",
              }}
            >
              <div>
                <label style={lbl}>Baseline</label>
                <input
                  style={inp}
                  value={form.kpi_baseline || ""}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, kpi_baseline: e.target.value }))
                  }
                  placeholder="e.g. 6.2%"
                />
              </div>
              <div>
                <label style={lbl}>Target</label>
                <input
                  style={inp}
                  value={form.kpi_target || ""}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, kpi_target: e.target.value }))
                  }
                  placeholder="e.g. 5.31%"
                />
              </div>
            </div>
          ) : (
            goal.kpi_baseline &&
            goal.kpi_target && (
              <div style={{ display: "flex", gap: "16px", marginTop: "4px" }}>
                <span style={{ fontSize: "11px", color: "var(--slate)" }}>
                  Baseline: <strong>{goal.kpi_baseline}</strong>
                </span>
                <span style={{ fontSize: "11px", color: "var(--green)" }}>
                  Target: <strong>{goal.kpi_target}</strong>
                </span>
              </div>
            )
          )}
        </div>
        <div
          style={{
            display: "flex",
            gap: "6px",
            flexShrink: 0,
            marginLeft: "12px",
          }}
        >
          {mode === "read" ? (
            <>
              <button
                onClick={() => setMode("edit")}
                style={{
                  fontSize: "11px",
                  padding: "4px 10px",
                  borderRadius: "4px",
                  border: "1px solid var(--border)",
                  background: "#fff",
                  color: "var(--slate)",
                  cursor: "pointer",
                  fontFamily: "DM Sans, sans-serif",
                }}
              >
                Edit
              </button>
              <button
                onClick={onDelete}
                style={{
                  width: "26px",
                  height: "26px",
                  borderRadius: "4px",
                  border: "1px solid var(--border)",
                  background: "transparent",
                  color: "var(--slate-light)",
                  cursor: "pointer",
                  fontSize: "12px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                ✕
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => {
                  setMode("read");
                  setForm({ ...goal });
                }}
                style={{
                  fontSize: "11px",
                  padding: "4px 10px",
                  borderRadius: "4px",
                  border: "1px solid var(--border)",
                  background: "#fff",
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
                  fontSize: "11px",
                  padding: "4px 10px",
                  borderRadius: "4px",
                  border: "none",
                  background: "var(--blue)",
                  color: "#fff",
                  cursor: saving ? "not-allowed" : "pointer",
                  opacity: saving ? 0.7 : 1,
                  fontFamily: "DM Sans, sans-serif",
                  fontWeight: "600",
                }}
              >
                {saving ? "Saving…" : "Save"}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Steps */}
      <div style={{ borderTop: "1px solid var(--border)" }}>
        {/* Step 1 — Driver */}
        <div
          style={{
            padding: "12px 16px",
            borderBottom: "1px solid var(--border)",
            display: "flex",
            gap: "12px",
            alignItems: "flex-start",
          }}
        >
          <div
            style={{
              width: "20px",
              height: "20px",
              borderRadius: "50%",
              flexShrink: 0,
              background: goal.driver_statement
                ? "var(--blue)"
                : "var(--border)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "10px",
              fontWeight: "700",
              color: "white",
              marginTop: "1px",
            }}
          >
            1
          </div>
          <div style={{ flex: 1 }}>
            <div
              style={{
                fontSize: "10px",
                fontWeight: "600",
                color: "var(--slate)",
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                marginBottom: "4px",
              }}
            >
              Driver
            </div>
            {mode === "edit" ? (
              <div
                style={{ display: "flex", flexDirection: "column", gap: "8px" }}
              >
                <input
                  style={inp}
                  placeholder="What will your team focus on to move this metric?"
                  value={form.driver_statement || ""}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, driver_statement: e.target.value }))
                  }
                />
                <textarea
                  style={{ ...inp, minHeight: "56px", resize: "vertical" }}
                  placeholder="Why do you believe this will move the metric?"
                  value={form.driver_rationale || ""}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, driver_rationale: e.target.value }))
                  }
                />
              </div>
            ) : goal.driver_statement ? (
              <div style={{ fontSize: "13px", color: "var(--navy)" }}>
                {goal.driver_statement}
              </div>
            ) : (
              <div
                style={{
                  fontSize: "12px",
                  color: "var(--slate-light)",
                  fontStyle: "italic",
                }}
              >
                What will your team focus on to move this metric?
              </div>
            )}
            {mode === "read" && goal.driver_rationale && (
              <div
                style={{
                  fontSize: "11px",
                  color: "var(--slate)",
                  marginTop: "3px",
                }}
              >
                {goal.driver_rationale}
              </div>
            )}
          </div>
        </div>

        {/* Discovery framework CTA */}
        <div
          style={{
            margin: "0",
            padding: "10px 16px",
            borderBottom: "1px solid var(--border)",
            background: "#F0F9FF",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "12px",
          }}
        >
          <div style={{ flex: 1 }}>
            <div
              style={{
                fontSize: "11px",
                fontWeight: "600",
                color: "#0369A1",
                marginBottom: "2px",
              }}
            >
              Not sure what to focus on?
            </div>
            <div
              style={{ fontSize: "11px", color: "#0284C7", lineHeight: "1.5" }}
            >
              Build a causal model to decompose your business KPI into
              actionable focus areas.
            </div>
          </div>
          <span
            style={{
              fontSize: "10px",
              fontWeight: "700",
              padding: "3px 10px",
              borderRadius: "99px",
              background: "var(--border)",
              color: "var(--slate-light)",
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              flexShrink: 0,
            }}
          >
            Coming soon
          </span>
        </div>

        {/* Step 3 — How will you measure progress? */}
        <div
          style={{
            padding: "12px 16px",
            borderBottom: "1px solid var(--border)",
            display: "flex",
            gap: "12px",
            alignItems: "flex-start",
          }}
        >
          <div
            style={{
              width: "20px",
              height: "20px",
              borderRadius: "50%",
              flexShrink: 0,
              background: goal.lead_metric_name
                ? "var(--blue)"
                : "var(--border)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "10px",
              fontWeight: "700",
              color: "white",
              marginTop: "1px",
            }}
          >
            3
          </div>
          <div style={{ flex: 1 }}>
            <div
              style={{
                fontSize: "10px",
                fontWeight: "600",
                color: "var(--slate)",
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                marginBottom: "4px",
              }}
            >
              How will you measure progress?
            </div>
            {mode === "edit" ? (
              <div
                style={{ display: "flex", flexDirection: "column", gap: "8px" }}
              >
                <input
                  style={inp}
                  placeholder="What will you measure to know it's working?"
                  value={form.lead_metric_name || ""}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, lead_metric_name: e.target.value }))
                  }
                />
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "8px",
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
            ) : goal.lead_metric_name ? (
              <div>
                <div style={{ fontSize: "13px", color: "var(--navy)" }}>
                  {goal.lead_metric_name}
                </div>
                <div style={{ display: "flex", gap: "16px", marginTop: "3px" }}>
                  {goal.lead_metric_baseline && (
                    <span style={{ fontSize: "11px", color: "var(--slate)" }}>
                      Baseline: <strong>{goal.lead_metric_baseline}</strong>
                    </span>
                  )}
                  {goal.lead_metric_target && (
                    <span style={{ fontSize: "11px", color: "var(--green)" }}>
                      Target: <strong>{goal.lead_metric_target}</strong>
                    </span>
                  )}
                </div>
              </div>
            ) : (
              <div
                style={{
                  fontSize: "12px",
                  color: "var(--slate-light)",
                  fontStyle: "italic",
                }}
              >
                What will you measure to know it's working?
              </div>
            )}
          </div>
        </div>

        {/* Strategy narrative */}
        <div style={{ padding: "12px 16px" }}>
          <NarrativeBar goal={mode === "read" ? goal : form} />
          {!(goal.kpi_name && goal.driver_statement && goal.lead_metric_name) &&
            mode === "read" && (
              <div
                style={{
                  fontSize: "11px",
                  color: "var(--slate-light)",
                  fontStyle: "italic",
                }}
              >
                Complete product focus, key drivers and how will you measure
                progress? to generate your strategy narrative.
              </div>
            )}
        </div>
      </div>
    </div>
  );
}

function AddKPIFocusModal({ pillarId, pillarKPIs, onClose, onSaved }) {
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
    const { error } = await supabase.from("goals").insert({
      pillar_id: pillarId,
      kpi_name: form.kpi_name.trim(),
      kpi_baseline: form.kpi_baseline.trim() || null,
      kpi_target: form.kpi_target.trim() || null,
      driver_statement: form.driver_statement.trim() || null,
      driver_rationale: form.driver_rationale.trim() || null,
      lead_metric_name: form.lead_metric_name.trim() || null,
      lead_metric_baseline: form.lead_metric_baseline.trim() || null,
      lead_metric_target: form.lead_metric_target.trim() || null,
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
    fontFamily: "DM Sans, sans-serif",
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
            business strategy. Select the business KPI you've been assigned or
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
                      fontFamily: "DM Sans, sans-serif",
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
                fontFamily: "DM Sans, sans-serif",
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
                fontFamily: "DM Sans, sans-serif",
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
    fontFamily: "DM Sans, sans-serif",
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
                Success criteria
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
                fontFamily: "DM Sans, sans-serif",
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
                fontFamily: "DM Sans, sans-serif",
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
                fontFamily: "DM Sans, sans-serif",
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

function PillarRow({ pillar, onReload }) {
  const [expanded, setExpanded] = useState(true);
  const [goals, setGoals] = useState([]);
  const [loadingGoals, setLoadingGoals] = useState(false);
  const [showAddKPI, setShowAddKPI] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  async function loadGoals() {
    setLoadingGoals(true);
    const { data } = await supabase
      .from("goals")
      .select("*")
      .eq("pillar_id", pillar.id)
      .order("sort_order");
    setGoals(data || []);
    setLoadingGoals(false);
  }

  async function deletePillar() {
    await supabase.from("pillars").delete().eq("id", pillar.id);
    setConfirmDelete(false);
    onReload?.();
  }

  async function deleteGoal(goalId) {
    await supabase.from("goals").delete().eq("id", goalId);
    loadGoals();
  }

  useEffect(() => {
    loadGoals();
  }, [pillar.id]);

  return (
    <div
      style={{
        background: "var(--white)",
        border: "1px solid var(--border)",
        borderRadius: "10px",
        overflow: "hidden",
        borderLeft: `4px solid ${pillar.colour || "#1E40AF"}`,
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "20px 24px",
          display: "flex",
          alignItems: "center",
          gap: "16px",
        }}
      >
        <div
          onClick={() => setExpanded((e) => !e)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "16px",
            flex: 1,
            cursor: "pointer",
            userSelect: "none",
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
          <div style={{ flex: 1 }}>
            <h2
              className="font-display"
              style={{
                fontSize: "16px",
                color: "var(--navy)",
                fontWeight: "600",
                lineHeight: "1.3",
              }}
            >
              {pillar.name}
            </h2>
            {pillar.description && (
              <p
                style={{
                  fontSize: "12px",
                  color: "var(--slate)",
                  marginTop: "3px",
                }}
              >
                {pillar.description}
              </p>
            )}
            {pillar.success_criteria && pillar.success_criteria.length > 0 && (
              <div
                style={{
                  marginTop: "10px",
                  display: "grid",
                  gridTemplateColumns: "1fr 100px 100px",
                  gap: "4px",
                }}
              >
                {["Metric", "Baseline", "Target"].map((h) => (
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
                ))}
                {pillar.success_criteria.map((row, i) => (
                  <>
                    <div
                      key={`m-${i}`}
                      style={{
                        fontSize: "12px",
                        fontWeight: "500",
                        color: "var(--navy)",
                        padding: "3px 0",
                        borderTop: "1px solid var(--border)",
                      }}
                    >
                      {row.metric}
                    </div>
                    <div
                      key={`b-${i}`}
                      style={{
                        fontSize: "12px",
                        color: "var(--slate)",
                        padding: "3px 0",
                        borderTop: "1px solid var(--border)",
                      }}
                    >
                      {row.baseline || "—"}
                    </div>
                    <div
                      key={`t-${i}`}
                      style={{
                        fontSize: "12px",
                        fontWeight: "600",
                        color: "var(--green)",
                        padding: "3px 0",
                        borderTop: "1px solid var(--border)",
                      }}
                    >
                      {row.target || "—"}
                    </div>
                  </>
                ))}
              </div>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <span
              style={{
                fontSize: "11px",
                color: "var(--slate-light)",
                background: "var(--bg)",
                padding: "3px 10px",
                borderRadius: "99px",
                border: "1px solid var(--border)",
              }}
            >
              {goals.length} KPI {goals.length === 1 ? "focus" : "focuses"}
            </span>
            <span
              style={{
                fontSize: "16px",
                color: "var(--slate-light)",
                transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
                transition: "transform 0.2s",
              }}
            >
              ▾
            </span>
          </div>
        </div>
        <button
          onClick={() => setConfirmDelete(true)}
          style={{
            width: "30px",
            height: "30px",
            borderRadius: "6px",
            border: "1px solid var(--border)",
            background: "transparent",
            color: "var(--slate-light)",
            cursor: "pointer",
            fontSize: "14px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
          title="Delete pillar"
        >
          ✕
        </button>
      </div>

      {/* Product focuses */}
      {expanded && (
        <div
          style={{
            borderTop: "1px solid var(--border)",
            padding: "16px 24px 20px",
            background: "var(--bg)",
          }}
        >
          {loadingGoals ? (
            <p
              style={{
                fontSize: "12px",
                color: "var(--slate-light)",
                padding: "8px 0",
              }}
            >
              Loading...
            </p>
          ) : goals.length === 0 ? (
            <div
              style={{
                padding: "20px",
                border: "1px dashed var(--border)",
                borderRadius: "8px",
                textAlign: "center",
              }}
            >
              <p
                style={{
                  fontSize: "12px",
                  color: "var(--slate-light)",
                  marginBottom: "12px",
                }}
              >
                No Product focus yet — select a metric to start building your
                product strategy
              </p>
              <button
                onClick={() => setShowAddKPI(true)}
                style={{
                  padding: "7px 16px",
                  borderRadius: "6px",
                  border: "1px solid var(--blue)",
                  background: "transparent",
                  fontSize: "12px",
                  fontWeight: "600",
                  color: "var(--blue)",
                  cursor: "pointer",
                  fontFamily: "DM Sans, sans-serif",
                }}
              >
                + Add Product focus
              </button>
            </div>
          ) : (
            <div
              style={{ display: "flex", flexDirection: "column", gap: "12px" }}
            >
              {goals.map((goal) => (
                <KPIFocusCard
                  key={goal.id}
                  goal={goal}
                  onDelete={() => deleteGoal(goal.id)}
                  onReload={loadGoals}
                />
              ))}
              <button
                onClick={() => setShowAddKPI(true)}
                style={{
                  padding: "8px",
                  borderRadius: "6px",
                  border: "1px dashed var(--border)",
                  background: "transparent",
                  fontSize: "12px",
                  fontWeight: "500",
                  color: "var(--slate-light)",
                  cursor: "pointer",
                  fontFamily: "DM Sans, sans-serif",
                  marginTop: "4px",
                }}
              >
                + Add another product focus
              </button>
            </div>
          )}
        </div>
      )}

      {showAddKPI && (
        <AddKPIFocusModal
          pillarId={pillar.id}
          pillarKPIs={pillar.success_criteria || []}
          onClose={() => setShowAddKPI(false)}
          onSaved={() => {
            setShowAddKPI(false);
            loadGoals();
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
              background: "var(--white)",
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
              This will also delete all product focuses and roadmap items within
              this pillar. This cannot be undone.
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
                  background: "var(--white)",
                  fontSize: "13px",
                  fontWeight: "500",
                  color: "var(--slate)",
                  cursor: "pointer",
                  fontFamily: "DM Sans, sans-serif",
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
                  color: "var(--white)",
                  cursor: "pointer",
                  fontFamily: "DM Sans, sans-serif",
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

  async function loadPillars() {
    const { data } = await supabase
      .from("pillars")
      .select("*")
      .order("sort_order");
    setPillars(data || []);
    setLoading(false);
  }

  useEffect(() => {
    loadPillars();
  }, []);

  return (
    <div style={{ maxWidth: "860px" }}>
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
        <button
          onClick={() => setShowAddPillar(true)}
          style={{
            padding: "10px 20px",
            borderRadius: "8px",
            border: "none",
            background: "var(--navy)",
            fontSize: "13px",
            fontWeight: "600",
            color: "var(--white)",
            cursor: "pointer",
            fontFamily: "DM Sans, sans-serif",
            flexShrink: 0,
            marginLeft: "24px",
          }}
        >
          + New pillar
        </button>
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
              fontFamily: "DM Sans, sans-serif",
            }}
          >
            Create first pillar
          </button>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {pillars.map((pillar) => (
            <PillarRow key={pillar.id} pillar={pillar} onReload={loadPillars} />
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
