import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { logEvent } from "../lib/audit";

const ITEM_TYPES = [
  { value: "dev", label: "Dev", color: "#1E40AF", bg: "#DBEAFE" },
  { value: "non_dev", label: "Non-Dev", color: "#0F766E", bg: "#CCFBF1" },
  { value: "discovery", label: "Discovery", color: "#7C3AED", bg: "#EDE9FE" },
  {
    value: "operational",
    label: "Operational",
    color: "#B45309",
    bg: "#FEF3C7",
  },
];
const STATUSES = [
  { value: "to_do", label: "To Do", color: "#475569", bg: "#F1F5F9" },
  {
    value: "in_progress",
    label: "In Progress",
    color: "#1E40AF",
    bg: "#DBEAFE",
  },
  { value: "done", label: "Done", color: "#166534", bg: "#DCFCE7" },
  { value: "on_hold", label: "On Hold", color: "#92400E", bg: "#FEF3C7" },
  { value: "blocked", label: "Blocked", color: "#991B1B", bg: "#FEE2E2" },
];
const FINANCIAL_YEARS = ["2024-2025", "2025-2026", "2026-2027"];
const CURRENT_YEAR = "2025-2026";

function typeMeta(v) {
  return ITEM_TYPES.find((t) => t.value === v) || ITEM_TYPES[0];
}
function statusMeta(v) {
  return STATUSES.find((s) => s.value === v) || STATUSES[0];
}

export default function ItemDetailPanel({
  item,
  pillars,
  goals,
  teams,
  outcomes,
  featureGroups = [],
  onClose,
  onSaved,
  onDeleted,
}) {
  // ── Item Detail Panel ───────────────────────────────────────────────────────
  const [navHistory, setNavHistory] = useState([]);
  const [currentItem, setCurrentItem] = useState(item);
  const [confirmDelete, setCD] = useState(false);
  const [itemLinks, setItemLinks] = useState([]);
  const [loadingLinks, setLoading] = useState(true);
  const [deps, setDeps] = useState([]);
  const [loadingDeps, setLoadingDeps] = useState(true);
  const [depSearch, setDepSearch] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [allItems, setAllItems] = useState([]);
  const [form, setForm] = useState({ ...currentItem });
  const filteredGoals = goals.filter(
    (g) => g.pillar_id && form.pillar_id && g.pillar_id === form.pillar_id,
  );
  const selectedPillar = pillars.find((p) => p.id === form.pillar_id);
  const businessMetrics = (selectedPillar?.success_criteria || []).filter((m) =>
    m.metric?.trim(),
  );
  const filteredDrivers = filteredGoals.filter(
    (g) => g.kpi_name === form.business_metric && g.driver_statement,
  );
  const containerGroup = featureGroups.find(
    (g) => g.id === currentItem.group_id,
  );

  const [tab, setTab] = useState("strategy");
  const [savedFlash, setSavedFlash] = useState(false);

  // Save
  async function saveField(key, value) {
    await supabase
      .from("roadmap_items")
      .update({ [key]: value || null })
      .eq("id", currentItem.id);
    onSaved();
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 2000);
  }

  //dependencies --------------
  async function loadDeps() {
    const [depsRes, itemsRes] = await Promise.all([
      supabase
        .from("dependencies")
        .select(
          "*, from:from_item_id(id, title, team_id), to:to_item_id(id, title, team_id)",
        )
        .or(
          `from_item_id.eq.${currentItem.id},to_item_id.eq.${currentItem.id}`,
        ),
      supabase
        .from("roadmap_items")
        .select("id, title, team_id, quarter, pillar_id")
        .neq("id", currentItem.id),
    ]);
    setDeps(depsRes.data || []);
    setAllItems(itemsRes.data || []);
    setLoadingDeps(false);
  }

  async function addDep(targetId) {
    await supabase.from("dependencies").insert({
      from_item_id: currentItem.id,
      to_item_id: targetId,
    });

    const targetItem = allItems.find((i) => i.id === targetId);
    await logEvent({
      eventType: "dependency_created",
      entityType: "dependency",
      entityId: currentItem.id,
      entityName: form.title,
      pillarId: currentItem.pillar_id || null,
      teamId: currentItem.team_id || null,
      newValue: {
        from: form.title,
        to: targetItem?.title || "Unknown",
      },
    });

    setDepSearch("");
    setSearchResults([]);
    loadDeps();
  }

  async function removeDep(depId) {
    const dep = deps.find((d) => d.id === depId);
    const other = dep?.from_item_id === currentItem.id ? dep?.to : dep?.from;

    await logEvent({
      eventType: "dependency_removed",
      entityType: "dependency",
      entityId: currentItem.id,
      entityName: form.title,
      pillarId: currentItem.pillar_id || null,
      teamId: currentItem.team_id || null,
      oldValue: {
        from: form.title,
        to: other?.title || "Unknown",
      },
    });

    await supabase.from("dependencies").delete().eq("id", depId);
    loadDeps();
  }

  useEffect(() => {
    loadDeps();
  }, [currentItem.id]);

  function fuzzySearch(query, items) {
    if (!query.trim()) return [];
    const words = query.toLowerCase().split(" ").filter(Boolean);
    return items
      .filter((item) => {
        const title = item.title.toLowerCase();
        return words.every((word) => title.includes(word));
      })
      .slice(0, 8);
  }

  useEffect(() => {
    setSearchResults(fuzzySearch(depSearch, allItems));
  }, [depSearch, allItems]);

  //Navigation ----------
  function navigateTo(targetItem) {
    setNavHistory((h) => [...h, currentItem]);
    setCurrentItem(targetItem);
  }

  function navigateBack() {
    const prev = navHistory[navHistory.length - 1];
    setNavHistory((h) => h.slice(0, -1));
    setCurrentItem(prev);
  }

  //Item links ----------
  async function loadItemLinks() {
    const { data } = await supabase
      .from("outcome_items")
      .select("*, quarterly_outcomes(*)")
      .eq("roadmap_item_id", currentItem.id);
    setItemLinks(data || []);
    setLoading(false);
  }

  async function removeItemLink(linkId) {
    await supabase.from("outcome_items").delete().eq("id", linkId);
    loadItemLinks();
  }

  useEffect(() => {
    loadItemLinks();
    setForm({ ...currentItem });
  }, [currentItem.id]);

  async function del() {
    //Audit log
    await logEvent({
      eventType: "item_deleted",
      entityType: "roadmap_item",
      entityId: currentItem.id,
      entityName: currentItem.title,
      pillarId: currentItem.pillar_id || null,
      teamId: currentItem.team_id || null,
      oldValue: {
        type: currentItem.type,
        quarter: currentItem.quarter,
        status: currentItem.status,
      },
    });

    await supabase.from("roadmap_items").delete().eq("id", currentItem.id);
    onDeleted();
  }

  const tm = typeMeta(form.type);
  const sm = statusMeta(form.status);
  const team = teams.find((t) => t.id === form.team_id);

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
        background: "rgba(15,23,42,0.5)",
        display: "flex",
        justifyContent: "flex-end",
        zIndex: 100,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: "440px",
          height: "100vh",
          background: "#fff",
          overflow: "auto",
          display: "flex",
          flexDirection: "column",
          boxShadow: "-8px 0 32px rgba(0,0,0,0.15)",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "18px 22px",
            borderBottom: "1px solid var(--border)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            position: "sticky",
            top: 0,
            background: "#fff",
            zIndex: 1,
          }}
        >
          <div style={{ flex: 1, paddingRight: "12px" }}>
            {navHistory.length > 0 && (
              <button
                onClick={navigateBack}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                  border: "none",
                  background: "transparent",
                  cursor: "pointer",
                  padding: "0 0 8px 0",
                  fontFamily: "Inter, sans-serif",
                  fontSize: "11px",
                  color: "var(--blue)",
                }}
              >
                ← {navHistory[navHistory.length - 1].title}
              </button>
            )}
            <input
              style={{ ...inp, fontSize: "14px", fontWeight: "700" }}
              defaultValue={form.title}
              onBlur={(e) => saveField("title", e.target.value)}
            />
            <div
              style={{
                display: "flex",
                gap: "6px",
                marginTop: "8px",
                flexWrap: "wrap",
                alignItems: "center",
              }}
            >
              <span
                style={{
                  fontSize: "9px",
                  fontWeight: "700",
                  padding: "2px 7px",
                  borderRadius: "3px",
                  background: tm.bg,
                  color: tm.color,
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                }}
              >
                {tm.label}
              </span>
              <span
                style={{
                  fontSize: "9px",
                  fontWeight: "600",
                  padding: "2px 7px",
                  borderRadius: "3px",
                  background: sm.bg,
                  color: sm.color,
                }}
              >
                {sm.label}
              </span>
              {team && (
                <span
                  style={{
                    fontSize: "10px",
                    color: "var(--slate)",
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                  }}
                >
                  <span
                    style={{
                      width: "6px",
                      height: "6px",
                      borderRadius: "50%",
                      background: team.colour,
                      display: "inline-block",
                    }}
                  />
                  {team.name}
                </span>
              )}
              {form.quarter && (
                <span style={{ fontSize: "10px", color: "var(--slate-light)" }}>
                  {form.quarter}
                </span>
              )}
            </div>
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
              flexShrink: 0,
            }}
          >
            ✕
          </button>
        </div>

        {/* Tab bar */}
        <div
          style={{
            display: "flex",
            borderBottom: "1px solid var(--border)",
            padding: "0 20px",
          }}
        >
          {[
            { id: "strategy", label: "Strategic Context" },
            { id: "details", label: "Details" },
            { id: "deps", label: "Dependencies" },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                padding: "10px 14px",
                fontSize: "11px",
                fontWeight: tab === t.id ? "700" : "500",
                color: tab === t.id ? "var(--blue)" : "var(--slate)",
                borderBottom:
                  tab === t.id
                    ? "2px solid var(--blue)"
                    : "2px solid transparent",
                background: "none",
                border: "none",
                borderBottom:
                  tab === t.id
                    ? "2px solid var(--blue)"
                    : "2px solid transparent",
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Body */}
        <div
          style={{
            padding: "18px 22px",
            flex: 1,
            display: "flex",
            flexDirection: "column",
            gap: "16px",
          }}
        >
          {tab === "strategy" && (
            <div
              style={{ display: "flex", flexDirection: "column", gap: "16px" }}
            >
              {/* Description */}
              <div>
                <label style={lbl}>Description</label>
                <textarea
                  style={{ ...inp, minHeight: "64px", resize: "vertical" }}
                  placeholder="Plain English — what does this feature do?"
                  defaultValue={form.description || ""}
                  onBlur={(e) => saveField("description", e.target.value)}
                />
              </div>

              {/* Pillar */}
              <div>
                <label style={lbl}>Pillar</label>
                <select
                  style={{ ...inp, cursor: "pointer" }}
                  value={form.pillar_id || ""}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      pillar_id: e.target.value,
                      goal_id: null,
                    }))
                  }
                  onBlur={(e) => saveField("pillar_id", e.target.value)}
                >
                  <option value="">— Unassigned —</option>
                  {pillars.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Business Metric */}
              <div>
                <label style={lbl}>Business Metric</label>
                <select
                  style={{ ...inp, cursor: "pointer" }}
                  value={form.business_metric || ""}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, business_metric: e.target.value }))
                  }
                  onBlur={(e) => saveField("business_metric", e.target.value)}
                  disabled={!form.pillar_id}
                >
                  <option value="">— Select —</option>
                  {(
                    pillars.find((p) => p.id === form.pillar_id)
                      ?.success_criteria || []
                  )
                    .filter((m) => m.metric?.trim())
                    .map((m, i) => (
                      <option key={i} value={m.metric}>
                        {m.metric}
                        {m.baseline && m.target
                          ? ` (${m.baseline} → ${m.target})`
                          : ""}
                      </option>
                    ))}
                </select>
              </div>

              {/* Key Driver */}
              <div>
                <label style={lbl}>Key Driver</label>
                {!form.business_metric ? (
                  <div
                    style={{
                      fontSize: "12px",
                      color: "var(--slate-light)",
                      fontStyle: "italic",
                      padding: "8px 10px",
                      background: "var(--bg)",
                      borderRadius: "6px",
                      border: "1px solid var(--border)",
                    }}
                  >
                    Select a Business Metric first
                  </div>
                ) : filteredDrivers.length === 0 ? (
                  <div
                    style={{
                      fontSize: "12px",
                      color: "var(--slate-light)",
                      fontStyle: "italic",
                      padding: "8px 10px",
                      background: "var(--bg)",
                      borderRadius: "6px",
                      border: "1px solid var(--border)",
                    }}
                  >
                    No key drivers for this metric yet —{" "}
                    <a
                      href="/pillars"
                      style={{ color: "var(--blue)", textDecoration: "none" }}
                    >
                      add one on the Pillars page
                    </a>
                  </div>
                ) : (
                  <select
                    style={{ ...inp, cursor: "pointer" }}
                    value={form.goal_id || ""}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, goal_id: e.target.value }))
                    }
                    onBlur={(e) => saveField("goal_id", e.target.value)}
                  >
                    <option value="">— Select key driver —</option>
                    {filteredDrivers.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.driver_statement}
                        {g.lead_metric_name ? ` · ${g.lead_metric_name}` : ""}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Hypothesis */}
              <div>
                <label style={lbl}>Hypothesis</label>
                <textarea
                  style={{ ...inp, minHeight: "80px", resize: "vertical" }}
                  placeholder="We believe that [this feature] will [move this driver] because [reasoning]"
                  defaultValue={form.hypothesis || ""}
                  onBlur={(e) => saveField("hypothesis", e.target.value)}
                />
              </div>
              {/* Outcome */}
              <div>
                <label style={lbl}>Outcome</label>
                {!form.goal_id ? (
                  <div
                    style={{
                      fontSize: "12px",
                      color: "var(--slate-light)",
                      fontStyle: "italic",
                      padding: "8px 10px",
                      background: "var(--bg)",
                      borderRadius: "6px",
                      border: "1px solid var(--border)",
                    }}
                  >
                    Select a Key Driver first
                  </div>
                ) : (
                  <select
                    style={{ ...inp, cursor: "pointer" }}
                    value={form.outcome_id || ""}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, outcome_id: e.target.value }))
                    }
                    onBlur={(e) => saveField("outcome_id", e.target.value)}
                  >
                    <option value="">— No outcome linked —</option>
                    {outcomes
                      .filter((o) => o.goal_id === form.goal_id)
                      .map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.quarter}: {o.summary}
                        </option>
                      ))}
                  </select>
                )}
                {form.outcome_id &&
                  (() => {
                    const o = outcomes.find((o) => o.id === form.outcome_id);
                    return o ? (
                      <div
                        style={{
                          marginTop: "6px",
                          padding: "8px 10px",
                          background: "#F0FDF4",
                          border: "1px solid #BBF7D0",
                          borderRadius: "6px",
                        }}
                      >
                        <div
                          style={{
                            fontSize: "11px",
                            fontWeight: "700",
                            color: "#166534",
                            marginBottom: "2px",
                          }}
                        >
                          {o.quarter} · {o.financial_year}
                        </div>
                        <div
                          style={{
                            fontSize: "12px",
                            color: "var(--navy)",
                            lineHeight: "1.4",
                          }}
                        >
                          {o.summary}
                        </div>
                      </div>
                    ) : null;
                  })()}
              </div>
            </div>
          )}
          {tab === "details" && (
            <div
              style={{ display: "flex", flexDirection: "column", gap: "16px" }}
            >
              {/* Type / Status */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "10px",
                }}
              >
                <div>
                  <label style={lbl}>Type</label>
                  <select
                    style={{ ...inp, cursor: "pointer" }}
                    value={form.type}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, type: e.target.value }))
                    }
                    onBlur={(e) => saveField("type", e.target.value)}
                  >
                    {ITEM_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={lbl}>Status</label>
                  <select
                    style={{ ...inp, cursor: "pointer" }}
                    value={form.status}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, status: e.target.value }))
                    }
                    onBlur={(e) => saveField("status", e.target.value)}
                  >
                    {STATUSES.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Team */}
              <div>
                <label style={lbl}>Team</label>
                <select
                  style={{ ...inp, cursor: "pointer" }}
                  value={form.team_id || ""}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, team_id: e.target.value }))
                  }
                  onBlur={(e) => saveField("team_id", e.target.value)}
                >
                  <option value="">— No team —</option>
                  {teams.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Financial year — locked */}
              <div>
                <label style={lbl}>Financial Year</label>
                <div
                  style={{
                    ...inp,
                    background: "var(--bg)",
                    color: "var(--slate)",
                    cursor: "not-allowed",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <span>{form.financial_year || CURRENT_YEAR}</span>
                  <span
                    style={{ fontSize: "10px", color: "var(--slate-light)" }}
                  >
                    Set by timeline
                  </span>
                </div>
              </div>

              {/* SMT Priority */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  padding: "8px 10px",
                  background: "var(--bg)",
                  borderRadius: "6px",
                  border: "1px solid var(--border)",
                }}
              >
                <input
                  type="checkbox"
                  id="smt_priority"
                  checked={form.smt_priority || false}
                  onChange={(e) => {
                    setForm((f) => ({ ...f, smt_priority: e.target.checked }));
                    saveField("smt_priority", e.target.checked);
                  }}
                  style={{ width: "16px", height: "16px", cursor: "pointer" }}
                />
                <label
                  htmlFor="smt_priority"
                  style={{
                    fontSize: "12px",
                    fontWeight: "600",
                    color: "var(--navy)",
                    cursor: "pointer",
                    userSelect: "none",
                  }}
                >
                  ★ SMT priority
                </label>
                <span style={{ fontSize: "11px", color: "var(--slate-light)" }}>
                  Flag for SMT snapshot report
                </span>
              </div>

              {/* References */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "10px",
                }}
              >
                <div>
                  <label style={lbl}>Jira ref</label>
                  <input
                    style={inp}
                    placeholder="e.g. SF-1951"
                    defaultValue={form.jira_ref || ""}
                    onBlur={(e) => saveField("jira_ref", e.target.value)}
                  />
                </div>
                <div>
                  <label style={lbl}>Doc URL</label>
                  <input
                    style={inp}
                    placeholder="https://..."
                    defaultValue={form.doc_url || ""}
                    onBlur={(e) => saveField("doc_url", e.target.value)}
                  />
                </div>
              </div>
              {/* Container */}
              {currentItem.group_id && (
                <div>
                  <label style={lbl}>Container</label>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "8px 12px",
                      background: "var(--bg)",
                      border: "1px solid var(--border)",
                      borderRadius: "6px",
                    }}
                  >
                    <span
                      style={{
                        fontSize: "12px",
                        color: "var(--navy)",
                        fontWeight: "500",
                      }}
                    >
                      {containerGroup?.title || "Unknown container"}
                    </span>
                    <button
                      onClick={async () => {
                        await supabase
                          .from("roadmap_items")
                          .update({ group_id: null })
                          .eq("id", currentItem.id);
                        onSaved();
                      }}
                      style={{
                        fontSize: "11px",
                        color: "#991B1B",
                        background: "#FEE2E2",
                        border: "none",
                        borderRadius: "4px",
                        padding: "3px 8px",
                        cursor: "pointer",
                        fontFamily: "Inter, sans-serif",
                      }}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
          {tab === "deps" && (
            <div
              style={{ display: "flex", flexDirection: "column", gap: "16px" }}
            >
              {/* Dependencies */}
              <div
                style={{
                  borderTop: "1px solid var(--border)",
                  paddingTop: "12px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginBottom: "8px",
                  }}
                >
                  <div
                    style={{
                      fontSize: "10px",
                      fontWeight: "700",
                      color: "var(--blue)",
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                    }}
                  >
                    Dependencies
                  </div>
                  {deps.length > 0 && (
                    <span
                      style={{
                        fontSize: "10px",
                        color: "var(--slate-light)",
                      }}
                    >
                      {deps.length} linked
                    </span>
                  )}
                </div>

                {loadingDeps ? (
                  <p
                    style={{
                      fontSize: "11px",
                      color: "var(--slate-light)",
                    }}
                  >
                    Loading...
                  </p>
                ) : (
                  <>
                    {deps.length > 0 && (
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: "6px",
                          marginBottom: "10px",
                        }}
                      >
                        {deps.map((dep) => {
                          const other =
                            dep.from_item_id === currentItem.id
                              ? dep.to
                              : dep.from;
                          const isBlocking =
                            dep.from_item_id === currentItem.id;
                          const otherTeam = teams.find(
                            (t) => t.id === other?.team_id,
                          );
                          return (
                            <div
                              key={dep.id}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "8px",
                                padding: "8px 10px",
                                background: "var(--bg)",
                                border: "1px solid var(--border)",
                                borderRadius: "6px",
                              }}
                            >
                              <span
                                style={{
                                  fontSize: "9px",
                                  fontWeight: "700",
                                  padding: "2px 6px",
                                  borderRadius: "3px",
                                  flexShrink: 0,
                                  background: isBlocking
                                    ? "#FEF3C7"
                                    : "#DBEAFE",
                                  color: isBlocking ? "#92400E" : "#1E40AF",
                                }}
                              >
                                {isBlocking ? "BLOCKS" : "NEEDS"}
                              </span>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div
                                  style={{
                                    fontSize: "12px",
                                    fontWeight: "600",
                                    color: "var(--navy)",
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap",
                                  }}
                                >
                                  {other?.title || "Unknown"}
                                </div>
                                {otherTeam && (
                                  <div
                                    style={{
                                      display: "flex",
                                      alignItems: "center",
                                      gap: "4px",
                                      marginTop: "2px",
                                    }}
                                  >
                                    <div
                                      style={{
                                        width: "6px",
                                        height: "6px",
                                        borderRadius: "50%",
                                        background: otherTeam.colour,
                                      }}
                                    />
                                    <span
                                      style={{
                                        fontSize: "10px",
                                        color: "var(--slate-light)",
                                      }}
                                    >
                                      {otherTeam.name}
                                    </span>
                                  </div>
                                )}
                              </div>
                              <button
                                onClick={async () => {
                                  const { data } = await supabase
                                    .from("roadmap_items")
                                    .select("*")
                                    .eq("id", other?.id)
                                    .single();
                                  if (data)
                                    navigateTo({
                                      ...data,
                                      team_colour:
                                        teams.find((t) => t.id === data.team_id)
                                          ?.colour || null,
                                    });
                                }}
                                style={{
                                  fontSize: "11px",
                                  color: "var(--blue)",
                                  background: "transparent",
                                  border: "1px solid var(--blue)",
                                  borderRadius: "4px",
                                  padding: "3px 8px",
                                  cursor: "pointer",
                                  fontFamily: "Inter, sans-serif",
                                  flexShrink: 0,
                                  whiteSpace: "nowrap",
                                }}
                              >
                                Go to →
                              </button>
                              <button
                                onClick={() => removeDep(dep.id)}
                                style={{
                                  border: "none",
                                  background: "transparent",
                                  color: "var(--slate-light)",
                                  cursor: "pointer",
                                  fontSize: "12px",
                                  flexShrink: 0,
                                  padding: 0,
                                }}
                              >
                                ✕
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Search to add */}
                    <div style={{ position: "relative" }}>
                      <input
                        placeholder="Search features to link..."
                        value={depSearch}
                        onChange={(e) => setDepSearch(e.target.value)}
                        style={{
                          width: "100%",
                          padding: "7px 10px",
                          border: "1px solid var(--border)",
                          borderRadius: "6px",
                          fontSize: "12px",
                          fontFamily: "Inter, sans-serif",
                          color: "var(--navy)",
                          background: "#fff",
                          outline: "none",
                        }}
                      />
                      {searchResults.length > 0 && (
                        <div
                          style={{
                            position: "absolute",
                            top: "100%",
                            left: 0,
                            right: 0,
                            background: "#fff",
                            border: "1px solid var(--border)",
                            borderRadius: "6px",
                            boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
                            zIndex: 10,
                            marginTop: "4px",
                            overflow: "hidden",
                          }}
                        >
                          {searchResults.map((result) => {
                            const resultTeam = teams.find(
                              (t) => t.id === result.team_id,
                            );
                            const alreadyLinked = deps.some(
                              (d) =>
                                d.from_item_id === result.id ||
                                d.to_item_id === result.id,
                            );
                            return (
                              <div
                                key={result.id}
                                onClick={() =>
                                  !alreadyLinked && addDep(result.id)
                                }
                                style={{
                                  padding: "8px 12px",
                                  cursor: alreadyLinked ? "default" : "pointer",
                                  opacity: alreadyLinked ? 0.4 : 1,
                                  borderBottom: "1px solid var(--border)",
                                }}
                                onMouseEnter={(e) => {
                                  if (!alreadyLinked)
                                    e.currentTarget.style.background =
                                      "var(--bg)";
                                }}
                                onMouseLeave={(e) =>
                                  (e.currentTarget.style.background = "#fff")
                                }
                              >
                                <div
                                  style={{
                                    fontSize: "12px",
                                    fontWeight: "600",
                                    color: "var(--navy)",
                                  }}
                                >
                                  {result.title}
                                </div>
                                <div
                                  style={{
                                    display: "flex",
                                    gap: "8px",
                                    marginTop: "2px",
                                  }}
                                >
                                  {resultTeam && (
                                    <div
                                      style={{
                                        display: "flex",
                                        alignItems: "center",
                                        gap: "3px",
                                      }}
                                    >
                                      <div
                                        style={{
                                          width: "5px",
                                          height: "5px",
                                          borderRadius: "50%",
                                          background: resultTeam.colour,
                                        }}
                                      />
                                      <span
                                        style={{
                                          fontSize: "10px",
                                          color: "var(--slate-light)",
                                        }}
                                      >
                                        {resultTeam.name}
                                      </span>
                                    </div>
                                  )}
                                  {result.quarter && (
                                    <span
                                      style={{
                                        fontSize: "10px",
                                        color: "var(--slate-light)",
                                      }}
                                    >
                                      {result.quarter}
                                    </span>
                                  )}
                                  {alreadyLinked && (
                                    <span
                                      style={{
                                        fontSize: "10px",
                                        color: "var(--slate-light)",
                                      }}
                                    >
                                      Already linked
                                    </span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {deps.length === 0 && !depSearch && (
                      <p
                        style={{
                          fontSize: "11px",
                          color: "var(--slate-light)",
                          fontStyle: "italic",
                          marginTop: "4px",
                        }}
                      >
                        No dependencies registered — search above to link
                        features.
                      </p>
                    )}
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: "14px 22px",
            borderTop: "1px solid var(--border)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            position: "sticky",
            bottom: 0,
            background: "#fff",
          }}
        >
          {savedFlash && (
            <span
              style={{
                fontSize: "11px",
                color: "#166534",
                background: "#F0FDF4",
                padding: "4px 10px",
                borderRadius: "6px",
                border: "1px solid #BBF7D0",
              }}
            >
              ✓ Saved
            </span>
          )}
          <button
            onClick={() => setCD(true)}
            style={{
              padding: "7px 14px",
              borderRadius: "6px",
              border: "1px solid var(--border)",
              background: "transparent",
              fontSize: "12px",
              color: "var(--slate-light)",
              cursor: "pointer",
              fontFamily: "Inter, sans-serif",
            }}
          >
            Delete
          </button>
        </div>

        {confirmDelete && (
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
                Delete this item?
              </h3>
              <p
                style={{
                  fontSize: "12px",
                  color: "var(--slate)",
                  marginBottom: "20px",
                  lineHeight: "1.5",
                }}
              >
                <strong>{currentItem.title}</strong> will be permanently
                removed.
              </p>
              <div
                style={{
                  display: "flex",
                  gap: "8px",
                  justifyContent: "flex-end",
                }}
              >
                <button
                  onClick={() => setCD(false)}
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
                  onClick={del}
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
    </div>
  );
}
