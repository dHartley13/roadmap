import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import ItemDetailPanel from "./ItemDetailPanel";

const FINANCIAL_YEARS = ["2024-2025", "2025-2026", "2026-2027"];
const CURRENT_YEAR = "2025-2026";

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

function typeMeta(v) {
  return ITEM_TYPES.find((t) => t.value === v) || ITEM_TYPES[0];
}
function statusMeta(v) {
  return STATUSES.find((s) => s.value === v) || STATUSES[0];
}

function weekToMonthLabel(week) {
  if (!week) return "—";
  const months = [
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
    "Jan",
    "Feb",
    "Mar",
  ];
  const monthIndex = Math.floor((week - 1) / 4);
  const weekInMonth = ((week - 1) % 4) + 1;
  const month = months[Math.min(monthIndex, 11)];
  return `${month} W${weekInMonth}`;
}

export default function SMTView() {
  const [items, setItems] = useState([]);
  const [pillars, setPillars] = useState([]);
  const [goals, setGoals] = useState([]);
  const [teams, setTeams] = useState([]);
  const [outcomes, setOutcomes] = useState([]);
  const [featureGroups, setFeatureGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);

  // Filters
  const [filterYear, setFilterYear] = useState(CURRENT_YEAR);
  const [filterPillar, setFilterPillar] = useState("");
  const [filterTeam, setFilterTeam] = useState("");
  const [filterMetric, setFilterMetric] = useState("");
  const [filterSMT, setFilterSMT] = useState(false);

  // Collapsed pillars
  const [collapsedPillars, setCollapsedPillars] = useState(new Set());

  useEffect(() => {
    loadAll();
  }, []);

  async function loadAll() {
    const [ir, pr, gr, tr, or, fgr] = await Promise.all([
      supabase.from("roadmap_items").select("*").order("created_at"),
      supabase.from("pillars").select("*").order("sort_order"),
      supabase.from("goals").select("*"),
      supabase.from("teams").select("*").order("sort_order"),
      supabase.from("quarterly_outcomes").select("*"),
      supabase.from("feature_groups").select("*"),
    ]);
    setItems(ir.data || []);
    setPillars(pr.data || []);
    setGoals(gr.data || []);
    setTeams(tr.data || []);
    setOutcomes(or.data || []);
    setFeatureGroups(fgr.data || []);
    setLoading(false);
  }

  async function toggleSMT(item) {
    const newVal = !item.smt_priority;
    await supabase
      .from("roadmap_items")
      .update({ smt_priority: newVal })
      .eq("id", item.id);
    setItems((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, smt_priority: newVal } : i)),
    );
  }

  // All business metrics across all pillars for filter
  const allMetrics = [
    ...new Set(
      pillars.flatMap((p) =>
        (p.success_criteria || []).map((m) => m.metric).filter(Boolean),
      ),
    ),
  ];

  // Filter items
  const filteredItems = items.filter((item) => {
    if (item.financial_year !== filterYear) return false;
    if (filterPillar && item.pillar_id !== filterPillar) return false;
    if (filterTeam && item.team_id !== filterTeam) return false;
    if (filterMetric && item.business_metric !== filterMetric) return false;
    if (filterSMT && !item.smt_priority) return false;
    return true;
  });

  const sel = {
    padding: "6px 10px",
    border: "1px solid var(--border)",
    borderRadius: "6px",
    fontSize: "12px",
    fontFamily: "Inter, sans-serif",
    color: "var(--navy)",
    background: "#fff",
    outline: "none",
    cursor: "pointer",
  };

  if (loading)
    return (
      <div
        style={{
          padding: "40px",
          fontSize: "13px",
          color: "var(--slate-light)",
        }}
      >
        Loading...
      </div>
    );

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: "24px" }}>
        <h1
          className="font-display"
          style={{
            fontSize: "22px",
            color: "var(--navy)",
            marginBottom: "3px",
          }}
        >
          SMT View
        </h1>
        <p style={{ fontSize: "11px", color: "var(--slate)" }}>
          All features grouped by strategic pillar — click a row to open detail,
          toggle ★ to flag for SMT
        </p>
      </div>

      {/* Filter row */}
      <div
        style={{
          display: "flex",
          gap: "8px",
          alignItems: "center",
          marginBottom: "24px",
          flexWrap: "wrap",
        }}
      >
        <span
          style={{
            fontSize: "11px",
            fontWeight: "600",
            color: "var(--slate)",
            whiteSpace: "nowrap",
          }}
        >
          Filter by
        </span>
        <select
          style={{ ...sel, width: "120px" }}
          value={filterYear}
          onChange={(e) => setFilterYear(e.target.value)}
        >
          {FINANCIAL_YEARS.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
        <select
          style={{ ...sel, width: "160px" }}
          value={filterPillar}
          onChange={(e) => setFilterPillar(e.target.value)}
        >
          <option value="">All pillars</option>
          {pillars.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name.length > 22 ? p.name.slice(0, 22) + "…" : p.name}
            </option>
          ))}
        </select>
        <select
          style={{ ...sel, width: "140px" }}
          value={filterTeam}
          onChange={(e) => setFilterTeam(e.target.value)}
        >
          <option value="">All teams</option>
          {teams.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <select
          style={{ ...sel, width: "180px" }}
          value={filterMetric}
          onChange={(e) => setFilterMetric(e.target.value)}
        >
          <option value="">All business metrics</option>
          {allMetrics.map((m) => (
            <option key={m} value={m}>
              {m.length > 28 ? m.slice(0, 28) + "…" : m}
            </option>
          ))}
        </select>
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            fontSize: "12px",
            color: "var(--navy)",
            cursor: "pointer",
          }}
        >
          <input
            type="checkbox"
            checked={filterSMT}
            onChange={(e) => setFilterSMT(e.target.checked)}
            style={{
              width: "14px",
              height: "14px",
              accentColor: "var(--blue)",
              cursor: "pointer",
            }}
          />
          SMT only
        </label>
      </div>

      {/* Pillar groups */}
      <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
        {pillars
          .filter((p) => !filterPillar || p.id === filterPillar)
          .map((pillar) => {
            const pillarItems = filteredItems.filter(
              (i) => i.pillar_id === pillar.id,
            );
            if (pillarItems.length === 0) return null;
            const isCollapsed = collapsedPillars.has(pillar.id);

            return (
              <div
                key={pillar.id}
                style={{
                  border: "1px solid var(--border)",
                  borderRadius: "10px",
                  overflow: "hidden",
                  borderLeft: `4px solid ${pillar.colour || "#1E40AF"}`,
                }}
              >
                {/* Pillar header */}
                <div
                  onClick={() =>
                    setCollapsedPillars((prev) => {
                      const next = new Set(prev);
                      if (next.has(pillar.id)) next.delete(pillar.id);
                      else next.add(pillar.id);
                      return next;
                    })
                  }
                  style={{
                    padding: "12px 16px",
                    background: "#fff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    cursor: "pointer",
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
                        width: "10px",
                        height: "10px",
                        borderRadius: "50%",
                        background: pillar.colour || "#1E40AF",
                      }}
                    />
                    <span
                      className="font-display"
                      style={{
                        fontSize: "14px",
                        fontWeight: "600",
                        color: "var(--navy)",
                      }}
                    >
                      {pillar.name}
                    </span>
                    <span
                      style={{
                        fontSize: "11px",
                        color: "var(--slate-light)",
                        background: "var(--bg)",
                        padding: "2px 8px",
                        borderRadius: "99px",
                        border: "1px solid var(--border)",
                      }}
                    >
                      {pillarItems.length} feature
                      {pillarItems.length !== 1 ? "s" : ""}
                    </span>
                  </div>
                  <span
                    style={{
                      fontSize: "11px",
                      color: "var(--slate-light)",
                      transform: isCollapsed ? "none" : "rotate(180deg)",
                      transition: "transform 0.2s",
                      display: "inline-block",
                    }}
                  >
                    ▾
                  </span>
                </div>

                {/* Table */}
                {!isCollapsed && (
                  <table
                    style={{
                      width: "100%",
                      borderCollapse: "collapse",
                      borderTop: "1px solid var(--border)",
                    }}
                  >
                    <thead>
                      <tr style={{ background: "var(--bg)" }}>
                        {[
                          "★",
                          "Business Metric",
                          "Feature",
                          "Team",
                          "Key Driver",
                          "Outcome",
                          "Start",
                          "End",
                          "Status",
                        ].map((h) => (
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
                              whiteSpace: "nowrap",
                            }}
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {pillarItems.map((item, i) => {
                        const team = teams.find((t) => t.id === item.team_id);
                        const driver = goals.find((g) => g.id === item.goal_id);
                        const outcome = outcomes.find(
                          (o) => o.id === item.outcome_id,
                        );
                        const tm = typeMeta(item.type);
                        const sm = statusMeta(item.status);
                        return (
                          <tr
                            key={item.id}
                            onClick={() => setSelected(item)}
                            style={{
                              borderBottom: "1px solid var(--border)",
                              cursor: "pointer",
                              background: i % 2 === 0 ? "#fff" : "var(--bg)",
                            }}
                            onMouseEnter={(e) =>
                              (e.currentTarget.style.background = "#EFF6FF")
                            }
                            onMouseLeave={(e) =>
                              (e.currentTarget.style.background =
                                i % 2 === 0 ? "#fff" : "var(--bg)")
                            }
                          >
                            {/* SMT toggle */}
                            <td
                              style={{ padding: "10px 12px", width: "36px" }}
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleSMT(item);
                              }}
                            >
                              <span
                                style={{
                                  fontSize: "14px",
                                  cursor: "pointer",
                                  color: item.smt_priority
                                    ? "#F59E0B"
                                    : "var(--border)",
                                }}
                              >
                                ★
                              </span>
                            </td>
                            {/* Business Metric */}
                            <td
                              style={{
                                padding: "10px 12px",
                                maxWidth: "160px",
                              }}
                            >
                              <div
                                style={{
                                  fontSize: "11px",
                                  color: "var(--slate)",
                                }}
                              >
                                {item.business_metric || "—"}
                              </div>
                              {(() => {
                                const pillar = pillars.find(
                                  (p) => p.id === item.pillar_id,
                                );
                                const metric = (
                                  pillar?.success_criteria || []
                                ).find(
                                  (m) => m.metric === item.business_metric,
                                );
                                return metric?.target ? (
                                  <div
                                    style={{
                                      fontSize: "10px",
                                      color: "var(--blue)",
                                      fontWeight: "600",
                                      marginTop: "2px",
                                    }}
                                  >
                                    Target: {metric.target}
                                  </div>
                                ) : null;
                              })()}
                            </td>
                            {/* Feature */}
                            <td
                              style={{
                                padding: "10px 12px",
                                minWidth: "160px",
                              }}
                            >
                              <div
                                style={{
                                  fontSize: "12px",
                                  fontWeight: "600",
                                  color: "var(--navy)",
                                }}
                              >
                                {item.title}
                              </div>
                            </td>
                            {/* Team */}
                            <td
                              style={{
                                padding: "10px 12px",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {team ? (
                                <div
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "5px",
                                  }}
                                >
                                  <div
                                    style={{
                                      width: "6px",
                                      height: "6px",
                                      borderRadius: "50%",
                                      background: team.colour,
                                      flexShrink: 0,
                                    }}
                                  />
                                  <span
                                    style={{
                                      fontSize: "11px",
                                      color: "var(--navy)",
                                    }}
                                  >
                                    {team.name}
                                  </span>
                                </div>
                              ) : (
                                <span
                                  style={{
                                    fontSize: "11px",
                                    color: "var(--slate-light)",
                                  }}
                                >
                                  —
                                </span>
                              )}
                            </td>

                            {/* Key Driver */}
                            <td
                              style={{
                                padding: "10px 12px",
                                maxWidth: "160px",
                              }}
                            >
                              <span
                                style={{
                                  fontSize: "11px",
                                  color: "var(--slate)",
                                }}
                              >
                                {driver?.driver_statement || "—"}
                              </span>
                            </td>
                            {/* Outcome */}
                            <td
                              style={{
                                padding: "10px 12px",
                                maxWidth: "160px",
                              }}
                            >
                              {outcome ? (
                                <div>
                                  <div
                                    style={{
                                      fontSize: "10px",
                                      fontWeight: "700",
                                      color: "var(--blue)",
                                    }}
                                  >
                                    {outcome.quarter}
                                  </div>
                                  <div
                                    style={{
                                      fontSize: "11px",
                                      color: "var(--slate)",
                                    }}
                                  >
                                    {outcome.summary}
                                  </div>
                                </div>
                              ) : (
                                <span
                                  style={{
                                    fontSize: "11px",
                                    color: "var(--slate-light)",
                                  }}
                                >
                                  —
                                </span>
                              )}
                            </td>
                            {/* Start */}
                            <td
                              style={{
                                padding: "10px 12px",
                                whiteSpace: "nowrap",
                              }}
                            >
                              <span
                                style={{
                                  fontSize: "11px",
                                  color: "var(--slate)",
                                }}
                              >
                                {weekToMonthLabel(item.start_week)}
                              </span>
                            </td>
                            {/* End */}
                            <td
                              style={{
                                padding: "10px 12px",
                                whiteSpace: "nowrap",
                              }}
                            >
                              <span
                                style={{
                                  fontSize: "11px",
                                  color: "var(--slate)",
                                }}
                              >
                                {weekToMonthLabel(item.end_week)}
                              </span>
                            </td>
                            {/* Status */}
                            <td style={{ padding: "10px 12px" }}>
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
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            );
          })}
      </div>

      {/* Item detail panel */}
      {selected && (
        <ItemDetailPanel
          item={selected}
          pillars={pillars}
          goals={goals}
          teams={teams}
          outcomes={outcomes}
          featureGroups={featureGroups}
          onClose={() => setSelected(null)}
          onSaved={() => {
            setSelected(null);
            loadAll();
          }}
          onDeleted={() => {
            setSelected(null);
            loadAll();
          }}
        />
      )}
    </div>
  );
}
