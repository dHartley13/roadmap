import { useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { logEvent } from '../lib/audit'

// ── Config ──────────────────────────────────────────────────────────────────
const MONTHS = [
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
const WEEKS_PER_MONTH = 4;
const MONTH_TO_QUARTER = {
  Apr: "Q1",
  May: "Q1",
  Jun: "Q1",
  Jul: "Q2",
  Aug: "Q2",
  Sep: "Q2",
  Oct: "Q3",
  Nov: "Q3",
  Dec: "Q3",
  Jan: "Q4",
  Feb: "Q4",
  Mar: "Q4",
};
const QUARTERS = ["Q1", "Q2", "Q3", "Q4"];
const QUARTER_MONTHS = {
  Q1: ["Apr", "May", "Jun"],
  Q2: ["Jul", "Aug", "Sep"],
  Q3: ["Oct", "Nov", "Dec"],
  Q4: ["Jan", "Feb", "Mar"],
};
const FINANCIAL_YEARS = ["2024-2025", "2025-2026", "2026-2027"];
const CURRENT_YEAR = "2025-2026";

const MONTH_W = 120;
const WEEK_W = MONTH_W / WEEKS_PER_MONTH;
const TOTAL_MONTHS = 12;
const TOTAL_WEEKS = TOTAL_MONTHS * WEEKS_PER_MONTH;
const TOTAL_W = TOTAL_MONTHS * MONTH_W;

const QUARTER_H = 32;
const MONTH_H = 24;
const WEEK_H = 20;
const HEADER_H = QUARTER_H + MONTH_H + WEEK_H;
const PILLAR_H = 28;
const TEAM_H = 44;
const OUTCOME_H = 52;
const LEFT_W = 240;

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

// Helper functions ──────────────────────────────────────────────────────────────────
function typeMeta(v) {
  return ITEM_TYPES.find((t) => t.value === v) || ITEM_TYPES[0];
}
function statusMeta(v) {
  return STATUSES.find((s) => s.value === v) || STATUSES[0];
}

function confidenceLevel(item) {
  const f = [
    item.pillar_id,
    item.goal_id,
    item.value_statement,
    item.lead_metric_name,
  ].filter(Boolean).length;
  return f === 4 ? "high" : f >= 2 ? "medium" : "low";
}
function confidenceMeta(l) {
  return (
    {
      high: { color: "#166534", bg: "#DCFCE7", label: "High" },
      medium: { color: "#92400E", bg: "#FEF3C7", label: "Medium" },
      low: { color: "#991B1B", bg: "#FEE2E2", label: "Low" },
    }[l] || { color: "#991B1B", bg: "#FEE2E2", label: "Low" }
  );
}

function assignLanes(rowItems) {
  const sorted = [...rowItems].sort(
    (a, b) => (a.start_week ?? 0) - (b.start_week ?? 0),
  );
  const lanes = []; // each lane is array of items

  sorted.forEach((item) => {
    const sw = item.start_week ?? 0;
    const ew = item.end_week ?? sw + 4;
    // Find first lane where this item doesn't overlap
    let placed = false;
    for (let i = 0; i < lanes.length; i++) {
      const lastItem = lanes[i][lanes[i].length - 1];
      const lastEW = lastItem.end_week ?? (lastItem.start_week ?? 0) + 4;
      if (sw >= lastEW) {
        lanes[i].push(item);
        placed = true;
        break;
      }
    }
    if (!placed) lanes.push([item]);
  });

  // Return map of item id → lane index
  const laneMap = {};
  lanes.forEach((lane, li) => {
    lane.forEach((item) => {
      laneMap[item.id] = li;
    });
  });
  return { laneMap, laneCount: lanes.length };
}

function quarterStartWeek(q) {
  const monthIdx = MONTHS.indexOf(QUARTER_MONTHS[q][0]);
  return monthIdx * WEEKS_PER_MONTH;
}
function monthStartWeek(monthIdx) {
  return monthIdx * WEEKS_PER_MONTH;
}
function weekToX(week) {
  return week * WEEK_W;
}
function xToWeek(x) {
  return Math.max(0, Math.min(TOTAL_WEEKS - 1, Math.round(x / WEEK_W)));
}
function weekToMonth(week) {
  return Math.floor(week / WEEKS_PER_MONTH);
}
function weekToQuarter(week) {
  return MONTH_TO_QUARTER[MONTHS[weekToMonth(week)]];
}

function defaultWeeks(quarter) {
  const sw = quarterStartWeek(quarter || "Q1");
  return { start_week: sw, end_week: sw + WEEKS_PER_MONTH };
}

// ── Timeline Item ───────────────────────────────────────────────────────────
function TimelineItem({ item, rowY, lane = 0, onUpdate, onClick }) {
  const dragRef = useRef(null);
  const tm = typeMeta(item.type);
  const cm = confidenceMeta(confidenceLevel(item));

  const sw = item.start_week ?? quarterStartWeek(item.quarter || "Q1");
  const ew = item.end_week ?? sw + WEEKS_PER_MONTH;
  const x = weekToX(sw);
  const w = Math.max(WEEK_W, weekToX(ew) - x);

  const ITEM_H = TEAM_H - 10;
  const laneOffsetY = lane * (ITEM_H + 4); // stack with 4px gap

  const didDragRef = useRef(false)

  function startDrag(e, mode) {
    e.stopPropagation();
    e.preventDefault();
    didDragRef.current = false
    dragRef.current = {
      mode,
      startX: e.clientX,
      origSW: sw,
      origEW: ew,
      lastSW: sw,
      lastEW: ew,
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  function onMove(e) {
    if (!dragRef.current) return;
    didDragRef.current = true
    const { mode, startX, origSW, origEW } = dragRef.current;
    const dw = Math.round((e.clientX - startX) / WEEK_W);
    let ns = origSW,
      ne = origEW;

    if (mode === "move") {
      ns = Math.max(0, Math.min(TOTAL_WEEKS - 1, origSW + dw));
      ne = Math.max(1, Math.min(TOTAL_WEEKS, origEW + dw));
    } else if (mode === "left") {
      ns = Math.max(0, Math.min(origEW - 1, origSW + dw));
      ne = origEW;
    } else if (mode === "right") {
      ns = origSW;
      ne = Math.max(origSW + 1, Math.min(TOTAL_WEEKS, origEW + dw));
    }

    // Store latest values in ref so onUp can read them
    dragRef.current.lastSW = ns;
    dragRef.current.lastEW = ne;

    onUpdate(
      item.id,
      {
        start_week: ns,
        end_week: ne,
        quarter: weekToQuarter(ns),
      },
      false,
    );
  }

  function onUp() {
    window.removeEventListener("mousemove", onMove);
    window.removeEventListener("mouseup", onUp);
    if (!dragRef.current) return;

    // Use lastSW/lastEW from ref — not from closure
    const { lastSW, lastEW } = dragRef.current;
    onUpdate(
      item.id,
      {
        start_week: lastSW,
        end_week: lastEW,
        quarter: weekToQuarter(lastSW),
      },
      true,
    );

    dragRef.current = null;
  }

  const itemH = TEAM_H - 10;

  return (
    <g>
      <rect
        x={x + 2}
        y={rowY + laneOffsetY + 5}
        width={w - 4}
        height={itemH}
        rx={4}
        fill={tm.bg}
        stroke={tm.color}
        strokeWidth={1.5}
        onMouseDown={(e) => startDrag(e, "move")}
        onClick={() => {if (!didDragRef.current) onClick(item) }}
        style={{ cursor: "grab" }}
      />
      <circle
        cx={x + w - 10}
        cy={rowY + laneOffsetY + 12}
        r={3.5}
        fill={cm.color}
        style={{ pointerEvents: "none" }}
      />
      <foreignObject
        x={x + 7}
        y={rowY + laneOffsetY + 6}
        width={Math.max(0, w - 20)}
        height={itemH - 4}
        style={{ pointerEvents: "none" }}
      >
        <div
          xmlns="http://www.w3.org/1999/xhtml"
          style={{
            fontSize: "10px",
            fontWeight: "600",
            color: tm.color,
            fontFamily: "DM Sans, sans-serif",
            lineHeight: "1.3",
            overflow: "hidden",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            wordBreak: "break-word",
          }}
        >
          {item.title}
        </div>
      </foreignObject>
      {/* Left resize handle */}
      <rect
        x={x + 2}
        y={rowY + laneOffsetY + 5}
        width={8}
        height={itemH}
        rx={2}
        fill="transparent"
        style={{ cursor: "ew-resize" }}
        onMouseDown={(e) => startDrag(e, "left")}
      />
      {/* Right resize handle */}
      <rect
        x={x + w - 10}
        y={rowY + laneOffsetY + 5}
        width={8}
        height={itemH}
        rx={2}
        fill="transparent"
        style={{ cursor: "ew-resize" }}
        onMouseDown={(e) => startDrag(e, "right")}
      />
    </g>
  );
}

//Outcome mapping modal ───────────────────────────────────────────────────────────
function OutcomeMappingModal({ outcome, items, onClose, onSaved }) {
  const [links, setLinks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [editingSummary, setEditingSummary] = useState(false);
  const [summaryText, setSummaryText] = useState(outcome.summary);

  async function loadLinks() {
    const { data } = await supabase
      .from("outcome_items")
      .select("*")
      .eq("outcome_id", outcome.id);
    setLinks(data || []);
    setLoading(false);
  }

  async function saveSummary() {
    if (!summaryText.trim()) return;
    await supabase
      .from("quarterly_outcomes")
      .update({ summary: summaryText.trim() })
      .eq("id", outcome.id);
    setEditingSummary(false);
    onSaved();
  }

  useEffect(() => {
    loadLinks();
  }, [outcome.id]);

  async function addLink(itemId) {
    await supabase.from("outcome_items").insert({
      outcome_id: outcome.id,
      roadmap_item_id: itemId,
      contribution_note: "",
    });
    loadLinks();
  }

  async function removeLink(linkId) {
    await supabase.from("outcome_items").delete().eq("id", linkId);
    loadLinks();
  }

  async function updateNote(linkId, note) {
    await supabase
      .from("outcome_items")
      .update({ contribution_note: note })
      .eq("id", linkId);
  }

  const linkedItemIds = links.map((l) => l.roadmap_item_id);

  // Items in same goal, filtered by search
  const eligibleItems = items.filter(
    (i) =>
      i.goal_id === outcome.goal_id &&
      (search === "" || i.title.toLowerCase().includes(search.toLowerCase())),
  );

  const linkedItems = eligibleItems.filter((i) => linkedItemIds.includes(i.id));
  const unlinkedItems = eligibleItems.filter(
    (i) => !linkedItemIds.includes(i.id),
  );

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
          width: "580px",
          maxHeight: "85vh",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 24px 48px rgba(0,0,0,0.2)",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "20px 24px",
            borderBottom: "1px solid var(--border)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
          }}
        >
          <div>
            <div
              style={{
                fontSize: "10px",
                fontWeight: "600",
                color: "var(--slate-light)",
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                marginBottom: "3px",
              }}
            >
              {outcome.quarter} · {outcome.financial_year}
            </div>
            <h2
              className="font-display"
              style={{
                fontSize: "16px",
                color: "var(--navy)",
                marginBottom: "4px",
              }}
            >
              Outcomes
            </h2>
            {editingSummary ? (
              <div style={{ display: "flex", gap: "6px", marginTop: "4px" }}>
                <input
                  autoFocus
                  value={summaryText}
                  onChange={(e) => setSummaryText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") saveSummary();
                    if (e.key === "Escape") setEditingSummary(false);
                  }}
                  style={{
                    flex: 1,
                    fontSize: "12px",
                    padding: "5px 8px",
                    border: "1px solid var(--blue)",
                    borderRadius: "4px",
                    fontFamily: "DM Sans, sans-serif",
                    outline: "none",
                  }}
                />
                <button
                  onClick={saveSummary}
                  style={{
                    fontSize: "11px",
                    padding: "4px 10px",
                    borderRadius: "4px",
                    border: "none",
                    background: "var(--blue)",
                    color: "#fff",
                    cursor: "pointer",
                    fontFamily: "DM Sans, sans-serif",
                  }}
                >
                  Save
                </button>
                <button
                  onClick={() => setEditingSummary(false)}
                  style={{
                    fontSize: "11px",
                    padding: "4px 8px",
                    borderRadius: "4px",
                    border: "1px solid var(--border)",
                    background: "#fff",
                    color: "var(--slate)",
                    cursor: "pointer",
                    fontFamily: "DM Sans, sans-serif",
                  }}
                >
                  ✕
                </button>
              </div>
            ) : (
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "8px",
                  marginTop: "4px",
                }}
              >
                <p
                  style={{
                    fontSize: "12px",
                    color: "var(--slate)",
                    lineHeight: "1.5",
                    flex: 1,
                    margin: 0,
                  }}
                >
                  {outcome.summary}
                </p>
                <button
                  onClick={() => {
                    setSummaryText(outcome.summary);
                    setEditingSummary(true);
                  }}
                  style={{
                    fontSize: "11px",
                    color: "var(--slate-light)",
                    background: "transparent",
                    border: "1px solid var(--border)",
                    borderRadius: "4px",
                    padding: "2px 8px",
                    cursor: "pointer",
                    fontFamily: "DM Sans, sans-serif",
                    flexShrink: 0,
                    whiteSpace: "nowrap",
                  }}
                >
                  Edit
                </button>
              </div>
            )}
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

        <div
          style={{
            flex: 1,
            overflow: "auto",
            padding: "20px 24px",
            display: "flex",
            flexDirection: "column",
            gap: "16px",
          }}
        >
          {/* Linked features */}
          {loading ? (
            <p style={{ fontSize: "12px", color: "var(--slate-light)" }}>
              Loading...
            </p>
          ) : (
            <>
              {linkedItems.length > 0 && (
                <div>
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
                    Contributing features ({linkedItems.length})
                  </div>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "8px",
                    }}
                  >
                    {linkedItems.map((item) => {
                      const link = links.find(
                        (l) => l.roadmap_item_id === item.id,
                      );
                      const tm = typeMeta(item.type);
                      return (
                        <div
                          key={item.id}
                          style={{
                            border: "1px solid var(--border)",
                            borderRadius: "8px",
                            overflow: "hidden",
                            borderLeft: `3px solid ${tm.color}`,
                          }}
                        >
                          <div
                            style={{
                              padding: "10px 12px",
                              display: "flex",
                              alignItems: "center",
                              gap: "10px",
                              background: "var(--bg)",
                            }}
                          >
                            <div style={{ flex: 1 }}>
                              <div
                                style={{
                                  fontSize: "12px",
                                  fontWeight: "600",
                                  color: "var(--navy)",
                                }}
                              >
                                {item.title}
                              </div>
                              <div
                                style={{
                                  display: "flex",
                                  gap: "6px",
                                  marginTop: "3px",
                                }}
                              >
                                <span
                                  style={{
                                    fontSize: "9px",
                                    fontWeight: "700",
                                    padding: "1px 5px",
                                    borderRadius: "3px",
                                    background: tm.bg,
                                    color: tm.color,
                                  }}
                                >
                                  {tm.label}
                                </span>
                                {item.owner && (
                                  <span
                                    style={{
                                      fontSize: "10px",
                                      color: "var(--slate-light)",
                                    }}
                                  >
                                    {item.owner}
                                  </span>
                                )}
                                {item.quarter && (
                                  <span
                                    style={{
                                      fontSize: "10px",
                                      color: "var(--slate-light)",
                                    }}
                                  >
                                    {item.quarter}
                                  </span>
                                )}
                              </div>
                            </div>
                            <button
                              onClick={() => removeLink(link.id)}
                              style={{
                                fontSize: "11px",
                                color: "var(--slate-light)",
                                background: "transparent",
                                border: "1px solid var(--border)",
                                borderRadius: "4px",
                                padding: "3px 8px",
                                cursor: "pointer",
                                fontFamily: "DM Sans, sans-serif",
                                flexShrink: 0,
                              }}
                            >
                              Remove
                            </button>
                          </div>
                          <div
                            style={{
                              padding: "8px 12px",
                              borderTop: "1px solid var(--border)",
                            }}
                          >
                            <input
                              style={{
                                ...inp,
                                fontSize: "11px",
                                padding: "5px 8px",
                              }}
                              placeholder="Contribution note — e.g. reduced handling time by 2 mins"
                              defaultValue={link.contribution_note || ""}
                              onBlur={(e) =>
                                updateNote(link.id, e.target.value)
                              }
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Add features */}
              <div>
                <div
                  style={{
                    fontSize: "11px",
                    fontWeight: "700",
                    color: "var(--slate)",
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    marginBottom: "10px",
                  }}
                >
                  Add features
                </div>
                <input
                  style={{ ...inp, marginBottom: "8px" }}
                  placeholder="Search features..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                {unlinkedItems.length === 0 ? (
                  <p
                    style={{
                      fontSize: "12px",
                      color: "var(--slate-light)",
                      fontStyle: "italic",
                    }}
                  >
                    {search
                      ? "No matching features"
                      : "All features in this product focus are already linked"}
                  </p>
                ) : (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "6px",
                    }}
                  >
                    {unlinkedItems.map((item) => {
                      const tm = typeMeta(item.type);
                      return (
                        <div
                          key={item.id}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "10px",
                            padding: "9px 12px",
                            border: "1px solid var(--border)",
                            borderRadius: "7px",
                            borderLeft: `3px solid ${tm.color}`,
                          }}
                        >
                          <div style={{ flex: 1 }}>
                            <div
                              style={{
                                fontSize: "12px",
                                fontWeight: "600",
                                color: "var(--navy)",
                              }}
                            >
                              {item.title}
                            </div>
                            <div
                              style={{
                                display: "flex",
                                gap: "6px",
                                marginTop: "3px",
                              }}
                            >
                              <span
                                style={{
                                  fontSize: "9px",
                                  fontWeight: "700",
                                  padding: "1px 5px",
                                  borderRadius: "3px",
                                  background: tm.bg,
                                  color: tm.color,
                                }}
                              >
                                {tm.label}
                              </span>
                              {item.owner && (
                                <span
                                  style={{
                                    fontSize: "10px",
                                    color: "var(--slate-light)",
                                  }}
                                >
                                  {item.owner}
                                </span>
                              )}
                              {item.quarter && (
                                <span
                                  style={{
                                    fontSize: "10px",
                                    color: "var(--slate-light)",
                                  }}
                                >
                                  {item.quarter}
                                </span>
                              )}
                            </div>
                          </div>
                          <button
                            onClick={() => addLink(item.id)}
                            style={{
                              fontSize: "11px",
                              color: "var(--blue)",
                              background: "var(--blue-light)",
                              border: "none",
                              borderRadius: "4px",
                              padding: "4px 10px",
                              cursor: "pointer",
                              fontFamily: "DM Sans, sans-serif",
                              fontWeight: "600",
                              flexShrink: 0,
                            }}
                          >
                            + Link
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        <div
          style={{
            padding: "14px 24px",
            borderTop: "1px solid var(--border)",
            display: "flex",
            justifyContent: "flex-end",
          }}
        >
          <button
            onClick={onClose}
            style={{
              padding: "8px 18px",
              borderRadius: "6px",
              border: "none",
              background: "var(--navy)",
              fontSize: "13px",
              fontWeight: "600",
              color: "#fff",
              cursor: "pointer",
              fontFamily: "DM Sans, sans-serif",
            }}
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

// Outcome modal ────────────────────────────────────────────────────────────
function AddOutcomeModal({
  pillarId,
  goalId,
  goal,
  year,
  filterTeam,
  teams,
  onClose,
  onSaved,
}) {
  const [text, setText] = useState("");
  const [teamId, setTeamId] = useState(filterTeam || "");
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!text.trim()) return;
    setSaving(true);
    await supabase.from("quarterly_outcomes").insert({
      pillar_id: pillarId,
      goal_id: goalId,
      team_id: teamId || null,
      quarter: goal.quarter,
      financial_year: year,
      summary: text.trim(),
    });

    //Audit log
    await logEvent({
      eventType: 'outcome_added',
      entityType: 'quarterly_outcome',
      entityId: goalId,
      entityName: text.trim(),
      pillarId,
      teamId: teamId || null,
      newValue: { quarter: goal.quarter, summary: text.trim() },
    })
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
        zIndex: 200,
      }}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: "12px",
          width: "520px",
          padding: "28px",
          boxShadow: "0 24px 48px rgba(0,0,0,0.2)",
        }}
      >
        {/* Header */}
        <div style={{ marginBottom: "20px" }}>
          <div
            style={{
              fontSize: "10px",
              fontWeight: "600",
              color: "var(--slate-light)",
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              marginBottom: "4px",
            }}
          >
            Add outcome · {goal.quarter} · {year}
          </div>
          <h2
            className="font-display"
            style={{
              fontSize: "18px",
              color: "var(--navy)",
              marginBottom: "12px",
            }}
          >
            What did your team achieve?
          </h2>

          {/* Product focus reminder */}
          {(goal.kpi_name ||
            goal.driver_statement ||
            goal.lead_metric_name) && (
            <div
              style={{
                background: "#F0FDF4",
                border: "1px solid #BBF7D0",
                borderRadius: "8px",
                padding: "12px 14px",
              }}
            >
              <div
                style={{
                  fontSize: "9px",
                  fontWeight: "700",
                  color: "#166534",
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  marginBottom: "6px",
                }}
              >
                Product focus context
              </div>
              {goal.kpi_name && (
                <div
                  style={{
                    fontSize: "11px",
                    color: "var(--navy)",
                    marginBottom: "3px",
                  }}
                >
                  <span style={{ color: "var(--slate-light)" }}>KPI: </span>
                  {goal.kpi_name}
                  {goal.kpi_target && (
                    <span style={{ color: "var(--slate-light)" }}>
                      {" "}
                      → {goal.kpi_target}
                    </span>
                  )}
                </div>
              )}
              {goal.driver_statement && (
                <div
                  style={{
                    fontSize: "11px",
                    color: "var(--navy)",
                    marginBottom: "3px",
                  }}
                >
                  <span style={{ color: "var(--slate-light)" }}>Focus: </span>
                  {goal.driver_statement}
                </div>
              )}
              {goal.lead_metric_name && (
                <div style={{ fontSize: "11px", color: "var(--navy)" }}>
                  <span style={{ color: "var(--slate-light)" }}>
                    Measuring:{" "}
                  </span>
                  {goal.lead_metric_name}
                  {goal.lead_metric_baseline && goal.lead_metric_target && (
                    <span style={{ color: "var(--slate-light)" }}>
                      {" "}
                      ({goal.lead_metric_baseline} → {goal.lead_metric_target})
                    </span>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <div>
            <label style={lbl}>Outcome summary</label>
            <textarea
              autoFocus
              style={{ ...inp, minHeight: "80px", resize: "vertical" }}
              placeholder="How are you expecting to contribute to the metrics and product focus above"
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
          </div>

          <div>
            <label style={lbl}>Team</label>
            <select
              style={{ ...inp, cursor: "pointer" }}
              value={teamId}
              onChange={(e) => setTeamId(e.target.value)}
            >
              <option value="">— Unassigned —</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
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
              {saving ? "Saving…" : "Add outcome"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Outcome Cell ────────────────────────────────────────────────────────────
function OutcomeCell({
  outcomes,
  pillarId,
  goalId,
  quarter,
  year,
  filterTeam,
  teams,
  items,
  onReload,
  onOpenMapping,
  onAddOutcome ,
}) {
  const [editingOutcome, setEditingOutcome] = useState(null);
  const [editingText, setEditingText] = useState("");

  const qOutcomes = outcomes.filter(
    (o) =>
      o.pillar_id === pillarId &&
      o.goal_id === goalId &&
      o.quarter === quarter &&
      o.financial_year === year &&
      (filterTeam === "" || o.team_id === filterTeam || o.team_id === null),
  );

  async function save() {
    if (!text.trim()) return;
    setSaving(true);
    await supabase.from("quarterly_outcomes").insert({
      pillar_id: pillarId,
      goal_id: goalId,
      team_id: teamId || null,
      quarter,
      financial_year: year,
      summary: text.trim(),
    });
    setSaving(false);
    setText("");
    setAdding(false);
    onReload();
  }

  async function saveEdit(id) {
    if (!editingText.trim()) return;
    await supabase
      .from("quarterly_outcomes")
      .update({ summary: editingText.trim() })
      .eq("id", id);
    setEditingOutcome(null);
    onReload();
  }

  async function deleteOutcome(id) {

    //Audit log
    const outcome = outcomes.find(o => o.id === id)
    if (outcome) {
      await logEvent({
        eventType: 'outcome_deleted',
        entityType: 'quarterly_outcome',
        entityId: id,
        entityName: outcome.summary,
        pillarId: outcome.pillar_id || null,
        teamId: outcome.team_id || null,
        oldValue: { quarter: outcome.quarter, summary: outcome.summary },
      })
    }

    await supabase.from("quarterly_outcomes").delete().eq("id", id);
    onReload();
  }

  return (
    <div
      style={{
        padding: "4px 6px",
        minHeight: OUTCOME_H,
        display: "flex",
        flexDirection: "column",
        gap: "3px",
      }}
    >
      {qOutcomes.map((o) => (
        <div
          key={o.id}
          style={{
            background: "#fff",
            border: "1px solid var(--border)",
            borderRadius: "4px",
            padding: "4px 8px",
            display: "flex",
            alignItems: "flex-start",
            gap: "6px",
          }}
        >
          {editingOutcome?.id === o.id ? (
            <input
              autoFocus
              value={editingText}
              onChange={(e) => setEditingText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") saveEdit(o.id);
                if (e.key === "Escape") setEditingOutcome(null);
              }}
              onBlur={() => saveEdit(o.id)}
              style={{
                flex: 1,
                fontSize: "10px",
                padding: "2px 4px",
                border: "1px solid var(--blue)",
                borderRadius: "3px",
                fontFamily: "DM Sans, sans-serif",
                outline: "none",
              }}
            />
          ) : (
            <span
              onClick={() => onOpenMapping(o)}
              style={{
                fontSize: "10px",
                color: "var(--navy)",
                lineHeight: "1.4",
                flex: 1,
                cursor: "pointer",
              }}
              title="Click to map contributing features"
            >
              {o.summary}
            </span>
          )}
          <button
            onClick={() => {
              setEditingOutcome(o);
              setEditingText(o.summary);
            }}
            style={{
              border: "none",
              background: "transparent",
              color: "var(--slate-light)",
              cursor: "pointer",
              fontSize: "10px",
              flexShrink: 0,
              padding: 0,
              lineHeight: 1,
            }}
            title="Edit outcome"
          >
            ✎
          </button>
          <button
            onClick={() => deleteOutcome(o.id)}
            style={{
              border: "none",
              background: "transparent",
              color: "var(--slate-light)",
              cursor: "pointer",
              fontSize: "11px",
              flexShrink: 0,
              padding: 0,
              lineHeight: 1,
            }}
          >
            ✕
          </button>
        </div>
      ))}

        <button
          onClick={() => onAddOutcome()}
          style={{
            fontSize: "9px",
            color: "var(--slate-light)",
            background: "transparent",
            border: "1px dashed var(--border)",
            borderRadius: "4px",
            padding: "2px 6px",
            cursor: "pointer",
            fontFamily: "DM Sans, sans-serif",
            alignSelf: "flex-start",
          }}
        >
          + outcome
        </button>
    </div>
  );
}

// ── Item Detail Panel ───────────────────────────────────────────────────────
function ItemDetailPanel({
  item,
  pillars,
  goals,
  teams,
  onClose,
  onSaved,
  onDeleted,
}) {
  const [mode, setMode] = useState("read"); // 'read' | 'edit'
  const [form, setForm] = useState({ ...item });
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setCD] = useState(false);
  const [itemLinks, setItemLinks] = useState([]);
  const [loadingLinks, setLoading] = useState(true);
  const filteredGoals = goals.filter((g) => g.pillar_id === form.pillar_id);

  async function loadItemLinks() {
    const { data } = await supabase
      .from("outcome_items")
      .select("*, quarterly_outcomes(*)")
      .eq("roadmap_item_id", item.id);
    setItemLinks(data || []);
    setLoading(false);
  }

  async function removeItemLink(linkId) {
    await supabase.from("outcome_items").delete().eq("id", linkId);
    loadItemLinks();
  }

  useEffect(() => {
    loadItemLinks();
  }, [item.id]);

  async function save() {
    setSaving(true);
    await supabase
      .from("roadmap_items")
      .update({
        title: form.title,
        type: form.type,
        status: form.status,
        quarter: form.quarter,
        financial_year: form.financial_year,
        team_id: form.team_id || null,
        pillar_id: form.pillar_id || null,
        goal_id: form.goal_id || null,
        hypothesis: form.hypothesis || null,
        lead_metric_name: form.lead_metric_name || null,
        jira_ref: form.jira_ref || null,
        doc_url: form.doc_url || null,
        description: form.description || null,
      })
      .eq("id", item.id);
    setSaving(false);
    setMode("read");
    onSaved();
  }

  async function del() {

    //Audit log
    await logEvent({
      eventType: 'item_deleted',
      entityType: 'roadmap_item',
      entityId: item.id,
      entityName: item.title,
      pillarId: item.pillar_id || null,
      teamId: item.team_id || null,
      oldValue: {
        type: item.type,
        quarter: item.quarter,
        status: item.status,
      },
    })

    await supabase.from("roadmap_items").delete().eq("id", item.id);
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
            {mode === "edit" ? (
              <input
                style={{ ...inp, fontSize: "14px", fontWeight: "700" }}
                value={form.title}
                onChange={(e) =>
                  setForm((f) => ({ ...f, title: e.target.value }))
                }
              />
            ) : (
              <div
                style={{
                  fontSize: "14px",
                  fontWeight: "700",
                  color: "var(--navy)",
                  lineHeight: "1.4",
                }}
              >
                {form.title}
              </div>
            )}
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
          {mode === "read" ? (
            <>
              {/* Description */}
              {form.description && (
                <div>
                  <div
                    style={{
                      fontSize: "10px",
                      fontWeight: "700",
                      color: "var(--blue)",
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                      marginBottom: "6px",
                    }}
                  >
                    Description
                  </div>
                  <div
                    style={{
                      fontSize: "13px",
                      color: "var(--navy)",
                      lineHeight: "1.6",
                    }}
                  >
                    {form.description}
                  </div>
                </div>
              )}
              {/* Hypothesis */}
              {form.hypothesis ? (
                <div>
                  <div
                    style={{
                      fontSize: "10px",
                      fontWeight: "700",
                      color: "var(--blue)",
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                      marginBottom: "6px",
                    }}
                  >
                    Hypothesis
                  </div>
                  <div
                    style={{
                      fontSize: "13px",
                      color: "var(--navy)",
                      lineHeight: "1.6",
                      background: "var(--bg)",
                      padding: "10px 14px",
                      borderRadius: "6px",
                      borderLeft: "3px solid var(--blue)",
                    }}
                  >
                    {form.hypothesis}
                  </div>
                </div>
              ) : (
                <div
                  style={{
                    padding: "10px 14px",
                    border: "1px dashed var(--border)",
                    borderRadius: "6px",
                  }}
                >
                  <span
                    style={{
                      fontSize: "12px",
                      color: "var(--slate-light)",
                      fontStyle: "italic",
                    }}
                  >
                    No hypothesis set —{" "}
                  </span>
                  <button
                    onClick={() => setMode("edit")}
                    style={{
                      fontSize: "12px",
                      color: "var(--blue)",
                      background: "transparent",
                      border: "none",
                      cursor: "pointer",
                      fontFamily: "DM Sans, sans-serif",
                      padding: 0,
                      fontStyle: "italic",
                    }}
                  >
                    add one
                  </button>
                </div>
              )}

              {/* Outcome links */}
              <div>
                <div
                  style={{
                    fontSize: "10px",
                    fontWeight: "700",
                    color: "var(--blue)",
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    marginBottom: "6px",
                  }}
                >
                  Outcomes contributing to
                </div>
                {loadingLinks ? (
                  <p style={{ fontSize: "12px", color: "var(--slate-light)" }}>
                    Loading...
                  </p>
                ) : itemLinks.length === 0 ? (
                  <div
                    style={{
                      padding: "10px 14px",
                      border: "1px dashed var(--border)",
                      borderRadius: "6px",
                    }}
                  >
                    <span
                      style={{
                        fontSize: "12px",
                        color: "var(--slate-light)",
                        fontStyle: "italic",
                      }}
                    >
                      Not linked to any outcomes yet — click an outcome on the
                      roadmap to link this feature.
                    </span>
                  </div>
                ) : (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "6px",
                    }}
                  >
                    {itemLinks.map((link) => (
                      <div
                        key={link.id}
                        style={{
                          padding: "10px 14px",
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
                          {link.quarterly_outcomes?.quarter} ·{" "}
                          {link.quarterly_outcomes?.financial_year}
                        </div>
                        <div
                          style={{
                            fontSize: "12px",
                            color: "var(--navy)",
                            lineHeight: "1.4",
                          }}
                        >
                          {link.quarterly_outcomes?.summary}
                        </div>
                        {link.contribution_note && (
                          <div
                            style={{
                              fontSize: "11px",
                              color: "#166534",
                              marginTop: "4px",
                              fontStyle: "italic",
                            }}
                          >
                            "{link.contribution_note}"
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Doc link */}
              {form.doc_url && (
                <div>
                  <div
                    style={{
                      fontSize: "10px",
                      fontWeight: "700",
                      color: "var(--blue)",
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                      marginBottom: "6px",
                    }}
                  >
                    Discovery document
                  </div>
                  <a
                    href={form.doc_url}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      fontSize: "12px",
                      color: "var(--blue)",
                      display: "flex",
                      alignItems: "center",
                      gap: "4px",
                      textDecoration: "none",
                    }}
                  >
                    <span
                      style={{
                        flex: 1,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {form.doc_url}
                    </span>
                    <span>↗</span>
                  </a>
                </div>
              )}

              {/* Jira ref */}
              {form.jira_ref && (
                <div>
                  <div
                    style={{
                      fontSize: "10px",
                      fontWeight: "700",
                      color: "var(--blue)",
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                      marginBottom: "6px",
                    }}
                  >
                    Jira
                  </div>
                  <span
                    style={{
                      fontSize: "12px",
                      fontFamily: "monospace",
                      color: "var(--navy)",
                      background: "var(--bg)",
                      padding: "4px 8px",
                      borderRadius: "4px",
                      border: "1px solid var(--border)",
                    }}
                  >
                    {form.jira_ref}
                  </span>
                </div>
              )}
            </>
          ) : (
            // ── Edit mode ──
            <>
              <div>
                <label style={lbl}>Description</label>
                <textarea
                  style={{ ...inp, minHeight: "64px", resize: "vertical" }}
                  placeholder="Plain English — what does this feature do?"
                  value={form.description || ""}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, description: e.target.value }))
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
                  <label style={lbl}>Type</label>
                  <select
                    style={{ ...inp, cursor: "pointer" }}
                    value={form.type}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, type: e.target.value }))
                    }
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
                  >
                    {STATUSES.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "10px",
                }}
              >
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
                <div>
                  <label style={lbl}>Financial year</label>
                  <select
                    style={{ ...inp, cursor: "pointer" }}
                    value={form.financial_year || CURRENT_YEAR}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, financial_year: e.target.value }))
                    }
                  >
                    {FINANCIAL_YEARS.map((y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label style={lbl}>Hypothesis</label>
                <textarea
                  style={{ ...inp, minHeight: "80px", resize: "vertical" }}
                  placeholder="We believe that [this feature] will [move this driver] because [reasoning]"
                  value={form.hypothesis || ""}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, hypothesis: e.target.value }))
                  }
                />
              </div>

              <div
                style={{
                  borderTop: "1px solid var(--border)",
                  paddingTop: "12px",
                }}
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
                  Strategic context
                </div>
                <div
                  style={{
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
                      <label style={lbl}>Pillar</label>
                      <select
                        style={{ ...inp, cursor: "pointer" }}
                        value={form.pillar_id || ""}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            pillar_id: e.target.value,
                            goal_id: "",
                          }))
                        }
                      >
                        <option value="">— Select —</option>
                        {pillars.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label style={lbl}>KPI focus</label>
                      <select
                        style={{ ...inp, cursor: "pointer" }}
                        value={form.goal_id || ""}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, goal_id: e.target.value }))
                        }
                        disabled={!form.pillar_id}
                      >
                        <option value="">— Select —</option>
                        {filteredGoals.map((g) => (
                          <option key={g.id} value={g.id}>
                            {g.kpi_name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label style={lbl}>Lead metric this item moves</label>
                    <input
                      style={inp}
                      value={form.lead_metric_name || ""}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          lead_metric_name: e.target.value,
                        }))
                      }
                      placeholder="e.g. Average handling time"
                    />
                  </div>
                </div>
              </div>

              <div
                style={{
                  borderTop: "1px solid var(--border)",
                  paddingTop: "12px",
                }}
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
                  References
                </div>
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
                      value={form.jira_ref || ""}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, jira_ref: e.target.value }))
                      }
                      placeholder="e.g. SF-1951"
                    />
                  </div>
                  <div>
                    <label style={lbl}>Doc URL</label>
                    <input
                      style={inp}
                      value={form.doc_url || ""}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, doc_url: e.target.value }))
                      }
                      placeholder="https://..."
                    />
                  </div>
                </div>
              </div>
            </>
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
              fontFamily: "DM Sans, sans-serif",
            }}
          >
            Delete
          </button>
          <div style={{ display: "flex", gap: "8px" }}>
            {mode === "read" ? (
              <button
                onClick={() => setMode("edit")}
                style={{
                  padding: "7px 18px",
                  borderRadius: "6px",
                  border: "none",
                  background: "var(--navy)",
                  fontSize: "12px",
                  fontWeight: "600",
                  color: "#fff",
                  cursor: "pointer",
                  fontFamily: "DM Sans, sans-serif",
                }}
              >
                Edit
              </button>
            ) : (
              <>
                <button
                  onClick={() => setMode("read")}
                  style={{
                    padding: "7px 14px",
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
                    padding: "7px 18px",
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
              </>
            )}
          </div>
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
                <strong>{item.title}</strong> will be permanently removed.
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
                    fontFamily: "DM Sans, sans-serif",
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
    </div>
  );
}

// ── Add Item Modal ──────────────────────────────────────────────────────────
function AddItemModal({
  pillars,
  goals,
  teams,
  defaultPillarId,
  defaultGoalId,
  defaultTeamId,
  onClose,
  onSaved,
}) {
  const [form, setForm] = useState({
    title: "",
    type: "dev",
    status: "to_do",
    quarter: "Q1",
    financial_year: CURRENT_YEAR,
    team_id: defaultTeamId || "",
    pillar_id: defaultPillarId || "",
    goal_id: defaultGoalId || "",
    hypothesis: "",
    description: "",
    start_week: quarterStartWeek("Q1"),
    end_week: quarterStartWeek("Q1") + WEEKS_PER_MONTH,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  async function save() {
    if (!form.title.trim()) return setError("Title is required");
    setSaving(true);
    const { data: result, error } = await supabase.from("roadmap_items").insert({
      title: form.title.trim(),
      type: form.type,
      track: "delivery",
      status: form.status,
      quarter: form.quarter,
      financial_year: form.financial_year,
      team_id: form.team_id || null,
      pillar_id: form.pillar_id || null,
      goal_id: form.goal_id || null,
      hypothesis: form.hypothesis || null,
      start_week: form.start_week,
      end_week: form.end_week,
      description: form.description || null,
    }).select().single()
    setSaving(false);
    if (error) return setError(error.message);

    //Audit log
    await logEvent({
      eventType: 'item_created',
      entityType: 'roadmap_item',
      entityId: result?.id || 'unknown',
      entityName: form.title.trim(),
      pillarId: form.pillar_id || null,
      teamId: form.team_id || null,
      newValue: {
        type: form.type,
        quarter: form.quarter,
        financial_year: form.financial_year,
        duration_weeks: form.end_week - form.start_week,
      },
    })
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
  const filteredGoals = goals.filter((g) => g.pillar_id === form.pillar_id);

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
          width: "500px",
          maxHeight: "90vh",
          overflow: "auto",
          padding: "28px",
          boxShadow: "0 24px 48px rgba(0,0,0,0.2)",
        }}
      >
        <div style={{ marginBottom: "20px" }}>
          <h2
            className="font-display"
            style={{
              fontSize: "18px",
              color: "var(--navy)",
              marginBottom: "4px",
            }}
          >
            Add roadmap item
          </h2>
          <p style={{ fontSize: "12px", color: "var(--slate)" }}>
            Just the essentials — everything else can be filled in from the item
            panel.
          </p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <div>
            <label style={lbl}>Title *</label>
            <input
              style={inp}
              placeholder="e.g. Dynamic routing engine"
              value={form.title}
              onChange={(e) =>
                setForm((f) => ({ ...f, title: e.target.value }))
              }
            />
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1fr",
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
              >
                {ITEM_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label style={lbl}>Quarter</label>
              <select
                style={{ ...inp, cursor: "pointer" }}
                value={form.quarter}
                onChange={(e) => {
                  const q = e.target.value;
                  setForm((f) => ({ ...f, quarter: q, ...defaultWeeks(q) }));
                }}
              >
                {QUARTERS.map((q) => (
                  <option key={q} value={q}>
                    {q}
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
              >
                {STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "10px",
            }}
          >
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
            <div>
              <label style={lbl}>Pillar</label>
              <select
                style={{ ...inp, cursor: "pointer" }}
                value={form.pillar_id}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    pillar_id: e.target.value,
                    goal_id: "",
                  }))
                }
              >
                <option value="">— Select —</option>
                {pillars.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {form.pillar_id && (
            <div>
              <label style={lbl}>KPI focus</label>
              <select
                style={{ ...inp, cursor: "pointer" }}
                value={form.goal_id}
                onChange={(e) =>
                  setForm((f) => ({ ...f, goal_id: e.target.value }))
                }
              >
                <option value="">— Select —</option>
                {filteredGoals.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.kpi_name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label style={lbl}>
              Hypothesis{" "}
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
            <textarea
              style={{ ...inp, minHeight: "68px", resize: "vertical" }}
              placeholder="We believe that [this feature] will [move this driver] because [reasoning]"
              value={form.hypothesis}
              onChange={(e) =>
                setForm((f) => ({ ...f, hypothesis: e.target.value }))
              }
            />
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
              {saving ? "Saving…" : "Add to roadmap"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main ────────────────────────────────────────────────────────────────────
export default function Roadmap() {
  const [items, setItems] = useState([]);
  const [pillars, setPillars] = useState([]);
  const [goals, setGoals] = useState([]);
  const [teams, setTeams] = useState([]);
  const [outcomes, setOutcomes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [addCtx, setAddCtx] = useState({});
  const [selected, setSelected] = useState(null);
  const [filterYear, setFilterYear] = useState(CURRENT_YEAR);
  const [filterTeam, setFilterTeam] = useState("");
  const [filterConfidence, setFilterConfidence] = useState("all");
  const [collapsedPillars, setCollapsedPillars] = useState({});
  const [collapsedTeams, setCollapsedTeams] = useState({});
  const saveTimer = useRef({});
  const [mappingOutcome, setMappingOutcome] = useState(null);
  const [addingOutcome, setAddingOutcome] = useState(null); // { pillarId, goalId, goal };
  const [filterPillar, setFilterPillar] = useState("");


  async function loadAll() {
    const [ir, pr, gr, tr, or] = await Promise.all([
      supabase.from("roadmap_items").select("*").order("created_at"),
      supabase.from("pillars").select("*").order("sort_order"),
      supabase.from("goals").select("*"),
      supabase.from("teams").select("*").order("sort_order"),
      supabase.from("quarterly_outcomes").select("*"),
    ]);
    setItems(ir.data || []);
    setPillars(pr.data || []);
    setGoals(gr.data || []);
    setTeams(tr.data || []);
    setOutcomes(or.data || []);
    setLoading(false);
  }

  useEffect(() => {
    loadAll();
  }, []);

  const handleUpdate = useCallback((id, changes, persist) => {
    const originalItem = items.find(i => i.id === id)

    setItems(prev => prev.map(i => i.id === id ? { ...i, ...changes } : i))
    if (persist) {
      clearTimeout(saveTimer.current[id])
      saveTimer.current[id] = setTimeout(async () => {
        await supabase.from('roadmap_items').update(changes).eq('id', id)
        if (originalItem) {

        const oldSW       = originalItem.start_week ?? 0
        const oldEW       = originalItem.end_week ?? 4
        const newSW       = changes.start_week ?? oldSW
        const newEW       = changes.end_week ?? oldEW
        const oldDuration = oldEW - oldSW
        const newDuration = newEW - newSW
        const isResize    = newDuration !== oldDuration
          
        //Audit log
        await logEvent({
            eventType: isResize ? 'item_resized' : 'item_moved',
            entityType: 'roadmap_item',
            entityId: id,
            entityName: originalItem.title,
            pillarId: originalItem.pillar_id || null,
            teamId: originalItem.team_id || null,
            oldValue: { 
              quarter: originalItem.quarter, 
              start_week: oldSW, 
              end_week: oldEW,
              duration_weeks: oldDuration
            },
            newValue: { 
              quarter: changes.quarter ?? originalItem.quarter,
              start_week: newSW,
              end_week: newEW,
              duration_weeks: newDuration
            },
          })
        }
      }, 300)
    }
  }, [items])

  // Build row structure
  const rows = [];
  const visiblePillars = filterPillar
    ? (pillars || []).filter((p) => p.id === filterPillar)
    : pillars || [];
  visiblePillars.forEach((pillar) => {
    const pillarGoals = goals.filter((g) => g.pillar_id === pillar.id);
    const isCollapsed = collapsedPillars[pillar.id];
    rows.push({ type: "pillar", pillar, isCollapsed });
    if (!isCollapsed) {
      pillarGoals.forEach((goal) => {
        rows.push({ type: "kpi", pillar, goal });
        // Team sub-rows
        const visibleTeams = filterTeam
          ? teams.filter((t) => t.id === filterTeam)
          : teams;
        visibleTeams.forEach((team) => {
          const teamKey = `${goal.id}-${team.id}`;
          const isTeamCollapsed = collapsedTeams[teamKey];
          rows.push({
            type: "team",
            pillar,
            goal,
            team,
            isCollapsed: isTeamCollapsed,
          });
        });
        // Outcomes row
        rows.push({ type: "outcome", pillar, goal });
      });
      if (pillarGoals.length === 0) {
        rows.push({ type: "empty", pillar });

        // Unassigned row — items linked to pillar but no goal/team
        rows.push({ type: "unassigned", pillar });
      }
    }
  });

  // Y positions
  const rowH = (r, laneCount = 1) => {
    if (r.type === "pillar") return PILLAR_H;
    if (r.type === "kpi") return 28;
    if (r.type === "team")
      return r.isCollapsed
        ? 20
        : Math.max(TEAM_H, laneCount * (TEAM_H - 4) + 8);
    if (r.type === "outcome") return OUTCOME_H;
    if (r.type === "empty") return TEAM_H;
    if (r.type === "unassigned") return TEAM_H;
    return TEAM_H;
  };
  // Pre-calculate lane counts per row
  const laneMaps = rows.map((row) => {
    if (row.type === "team" && !row.isCollapsed && row.goal) {
      const rowItems = items.filter(
        (item) =>
          item.goal_id === row.goal.id &&
          item.team_id === row.team.id &&
          item.financial_year === filterYear &&
          (filterConfidence === "all" ||
            confidenceLevel(item) === filterConfidence),
      );
      return assignLanes(rowItems);
    }
    if (row.type === "unassigned") {
      const rowItems = items.filter(
        (item) =>
          item.pillar_id === row.pillar.id &&
          !item.goal_id &&
          item.financial_year === filterYear,
      );
      return assignLanes(rowItems);
    }
    return { laneMap: {}, laneCount: 1 };
  });

  // Y positions using dynamic row heights
  let cy = HEADER_H;
  const rowYs = rows.map((r, i) => {
    const y = cy;
    cy += rowH(r, laneMaps[i].laneCount);
    return y;
  });
  const totalH = cy;

  const sel = {
    padding: "6px 10px",
    border: "1px solid var(--border)",
    borderRadius: "6px",
    fontSize: "12px",
    fontFamily: "DM Sans, sans-serif",
    color: "var(--navy)",
    background: "#fff",
    cursor: "pointer",
    outline: "none",
  };

  return (
    <div
      style={{
        marginLeft: "-48px",
        marginRight: "-48px",
        marginTop: "-40px",
        padding: "20px 24px",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: "12px",
        }}
      >
        <div>
          <h1
            className="font-display"
            style={{
              fontSize: "22px",
              color: "var(--navy)",
              marginBottom: "3px",
            }}
          >
            Unified Roadmap
          </h1>
          <p style={{ fontSize: "11px", color: "var(--slate)" }}>
            Drag to move · resize edges to adjust duration · quarter inferred
            from position
          </p>
        </div>
        <div
          style={{
            display: "flex",
            gap: "8px",
            alignItems: "center",
            flexWrap: "wrap",
          }}
        >
          <select
            style={sel}
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
            style={sel}
            value={filterPillar}
            onChange={(e) => setFilterPillar(e.target.value)}
          >
            <option value="">All pillars</option>
            {(pillars || []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <select
            style={sel}
            value={filterTeam}
            onChange={(e) => setFilterTeam(e.target.value)}
          >
            <option value="">All teams</option>
            {(teams || []).map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <select
            style={sel}
            value={filterConfidence}
            onChange={(e) => setFilterConfidence(e.target.value)}
          >
            <option value="all">All confidence</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
          <button
            onClick={() => {
              setAddCtx({});
              setShowAdd(true);
            }}
            style={{
              padding: "8px 16px",
              borderRadius: "8px",
              border: "none",
              background: "var(--navy)",
              fontSize: "12px",
              fontWeight: "600",
              color: "#fff",
              cursor: "pointer",
              fontFamily: "DM Sans, sans-serif",
            }}
          >
            + Add item
          </button>
        </div>
      </div>

      {/* Legend */}
      <div
        style={{
          display: "flex",
          gap: "14px",
          marginBottom: "10px",
          flexWrap: "wrap",
        }}
      >
        {ITEM_TYPES.map((t) => (
          <div
            key={t.value}
            style={{ display: "flex", alignItems: "center", gap: "4px" }}
          >
            <div
              style={{
                width: "9px",
                height: "9px",
                borderRadius: "2px",
                background: t.bg,
                border: `1.5px solid ${t.color}`,
              }}
            />
            <span style={{ fontSize: "10px", color: "var(--slate)" }}>
              {t.label}
            </span>
          </div>
        ))}
        <div
          style={{ width: "1px", background: "var(--border)", margin: "0 4px" }}
        />
        {[
          ["#166534", "High"],
          ["#92400E", "Medium"],
          ["#991B1B", "Low"],
        ].map(([c, l]) => (
          <div
            key={l}
            style={{ display: "flex", alignItems: "center", gap: "4px" }}
          >
            <div
              style={{
                width: "7px",
                height: "7px",
                borderRadius: "50%",
                background: c,
              }}
            />
            <span style={{ fontSize: "10px", color: "var(--slate)" }}>{l}</span>
          </div>
        ))}
      </div>

      {loading ? (
        <p style={{ fontSize: "13px", color: "var(--slate-light)" }}>
          Loading...
        </p>
      ) : (
        <div
          style={{
            overflowX: "auto",
            border: "1px solid var(--border)",
            borderRadius: "10px",
            background: "#fff",
          }}
        >
          <div style={{ display: "flex", minWidth: LEFT_W + TOTAL_W }}>
            {/* Left panel */}
            <div
              style={{
                width: LEFT_W,
                flexShrink: 0,
                borderRight: "1px solid var(--border)",
                position: "sticky",
                left: 0,
                background: "#fff",
                zIndex: 3,
              }}
            >
              {/* Header */}
              <div
                style={{
                  height: HEADER_H,
                  borderBottom: "1px solid var(--border)",
                  display: "flex",
                  alignItems: "flex-end",
                  padding: "0 12px 8px",
                }}
              >
                <span
                  style={{
                    fontSize: "10px",
                    fontWeight: "700",
                    color: "var(--slate-light)",
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                  }}
                >
                  Pillar / Product focus / Team
                </span>
              </div>

              {rows.map((row, i) => {
                const h = rowH(row);
                if (row.type === "pillar")
                  return (
                    <div
                      key={i}
                      style={{
                        height: h,
                        display: "flex",
                        alignItems: "center",
                        padding: "0 12px",
                        background: row.pillar.colour + "18",
                        borderBottom: "1px solid var(--border)",
                        cursor: "pointer",
                        gap: "8px",
                      }}
                      onClick={() =>
                        setCollapsedPillars((p) => ({
                          ...p,
                          [row.pillar.id]: !p[row.pillar.id],
                        }))
                      }
                    >
                      <div
                        style={{
                          width: "8px",
                          height: "8px",
                          borderRadius: "50%",
                          background: row.pillar.colour,
                          flexShrink: 0,
                        }}
                      />
                      <span
                        style={{
                          fontSize: "11px",
                          fontWeight: "700",
                          color: "var(--navy)",
                          flex: 1,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {row.pillar.name}
                      </span>
                      <span
                        style={{
                          fontSize: "10px",
                          color: "var(--slate-light)",
                        }}
                      >
                        {row.isCollapsed ? "▸" : "▾"}
                      </span>
                    </div>
                  );
                if (row.type === "kpi")
                  return (
                    <div
                      key={i}
                      style={{
                        height: h,
                        display: "flex",
                        alignItems: "center",
                        padding: "0 12px 0 20px",
                        borderBottom: "1px solid var(--border)",
                        borderLeft: `3px solid ${row.pillar.colour}`,
                        background: "var(--bg)",
                        gap: "6px",
                      }}
                    >
                      <div style={{ flex: 1, overflow: "hidden" }}>
                        <div
                          style={{
                            fontSize: "10px",
                            fontWeight: "700",
                            color: "var(--navy)",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {row.goal.kpi_name}
                        </div>
                        {row.goal.driver_statement && (
                          <div
                            style={{
                              fontSize: "9px",
                              color: "var(--slate-light)",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                              marginTop: "1px",
                            }}
                          >
                            ↳ {row.goal.driver_statement}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                if (row.type === "team")
                  return (
                    <div
                      key={i}
                      style={{
                        height: rowH(row, laneMaps[i].laneCount),
                        display: "flex",
                        alignItems: "center",
                        padding: "0 10px 0 28px",
                        borderBottom: "1px solid var(--border)",
                        borderLeft: `3px solid ${row.team.colour}`,
                        gap: "6px",
                        cursor: "pointer",
                      }}
                      onClick={() => {
                        const k = `${row.goal.id}-${row.team.id}`;
                        setCollapsedTeams((p) => ({ ...p, [k]: !p[k] }));
                      }}
                    >
                      <div
                        style={{
                          width: "6px",
                          height: "6px",
                          borderRadius: "50%",
                          background: row.team.colour,
                          flexShrink: 0,
                        }}
                      />
                      <span
                        style={{
                          fontSize: "10px",
                          fontWeight: "600",
                          color: "var(--navy)",
                          flex: 1,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {row.team.name}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setAddCtx({
                            pillar_id: row.pillar.id,
                            goal_id: row.goal.id,
                            team_id: row.team.id,
                          });
                          setShowAdd(true);
                        }}
                        style={{
                          width: "18px",
                          height: "18px",
                          borderRadius: "3px",
                          border: "1px solid var(--border)",
                          background: "transparent",
                          color: "var(--slate-light)",
                          cursor: "pointer",
                          fontSize: "12px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                        }}
                      >
                        +
                      </button>
                      <span
                        style={{ fontSize: "9px", color: "var(--slate-light)" }}
                      >
                        {row.isCollapsed ? "▸" : "▾"}
                      </span>
                    </div>
                  );
                if (row.type === "outcome")
                  return (
                    <div
                      key={i}
                      style={{
                        height: rowH(row, laneMaps[i]?.laneCount ?? 1),
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "center",
                        padding: "0 12px 0 20px",
                        borderBottom: "1px solid var(--border)",
                        background: "#F0FDF4",
                        borderLeft: `3px solid ${row.pillar.colour}`,
                      }}
                    >
                      <span
                        style={{
                          fontSize: "9px",
                          fontWeight: "700",
                          color: "#166534",
                          letterSpacing: "0.06em",
                          textTransform: "uppercase",
                        }}
                      >
                        Outcomes
                      </span>
                      {row.goal?.lead_metric_name && (
                        <span
                          style={{
                            fontSize: "9px",
                            color: "#166534",
                            marginTop: "2px",
                            opacity: 0.7,
                          }}
                        >
                          Measuring: {row.goal.lead_metric_name}
                          {row.goal.lead_metric_baseline &&
                            row.goal.lead_metric_target && (
                              <span style={{ marginLeft: "4px", opacity: 0.8 }}>
                                ({row.goal.lead_metric_baseline} →{" "}
                                {row.goal.lead_metric_target})
                              </span>
                            )}
                        </span>
                      )}
                    </div>
                  );
                if (row.type === "empty")
                  return (
                    <div
                      key={i}
                      style={{
                        height: h,
                        display: "flex",
                        alignItems: "center",
                        padding: "0 12px 0 20px",
                        borderBottom: "1px solid var(--border)",
                        borderLeft: `3px solid ${row.pillar.colour}`,
                      }}
                    >
                      <span
                        style={{
                          fontSize: "10px",
                          color: "var(--slate-light)",
                          fontStyle: "italic",
                        }}
                      >
                        No product focus — add one in Pillars & Goals
                      </span>
                    </div>
                  );
                if (row.type === "unassigned")
                  return (
                    <div
                      key={i}
                      style={{
                        height: h,
                        display: "flex",
                        alignItems: "center",
                        padding: "0 12px 0 20px",
                        borderBottom: "1px solid var(--border)",
                        background: "#FFFBEB",
                        borderLeft: `3px solid ${row.pillar.colour}`,
                        gap: "6px",
                      }}
                    >
                      <span
                        style={{
                          fontSize: "9px",
                          fontWeight: "600",
                          color: "#92400E",
                          letterSpacing: "0.06em",
                          textTransform: "uppercase",
                        }}
                      >
                        Unassigned
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setAddCtx({ pillar_id: row.pillar.id });
                          setShowAdd(true);
                        }}
                        style={{
                          width: "18px",
                          height: "18px",
                          borderRadius: "3px",
                          border: "1px solid var(--border)",
                          background: "transparent",
                          color: "var(--slate-light)",
                          cursor: "pointer",
                          fontSize: "12px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                        }}
                      >
                        +
                      </button>
                    </div>
                  );
                return null;
              })}
            </div>

            {/* Timeline SVG */}
            <div style={{ flex: 1 }}>
              <svg width={TOTAL_W} height={totalH} style={{ display: "block" }}>
                {/* Quarter backgrounds */}
                {QUARTERS.map((q, qi) => {
                  const sx = MONTHS.indexOf(QUARTER_MONTHS[q][0]) * MONTH_W;
                  return (
                    <rect
                      key={q}
                      x={sx}
                      y={0}
                      width={3 * MONTH_W}
                      height={totalH}
                      fill={qi % 2 === 0 ? "#FAFAFA" : "#F3F4F6"}
                    />
                  );
                })}

                {/* Quarter headers */}
                {QUARTERS.map((q, qi) => {
                  const sx = MONTHS.indexOf(QUARTER_MONTHS[q][0]) * MONTH_W;
                  const w = 3 * MONTH_W;
                  const fills = ["#0F172A", "#1E293B", "#1E40AF", "#2563EB"];
                  return (
                    <g key={q}>
                      <rect
                        x={sx}
                        y={0}
                        width={w}
                        height={QUARTER_H}
                        fill={fills[qi]}
                      />
                      <text
                        x={sx + w / 2}
                        y={QUARTER_H / 2 + 5}
                        textAnchor="middle"
                        fill="white"
                        fontSize={12}
                        fontWeight={700}
                        fontFamily="DM Sans, sans-serif"
                      >
                        {q}
                      </text>
                    </g>
                  );
                })}

                {/* Month headers */}
                {MONTHS.map((m, mi) => {
                  const x = mi * MONTH_W;
                  return (
                    <g key={m}>
                      <rect
                        x={x}
                        y={QUARTER_H}
                        width={MONTH_W}
                        height={MONTH_H}
                        fill={mi % 2 === 0 ? "#F8FAFC" : "#F1F5F9"}
                      />
                      <text
                        x={x + MONTH_W / 2}
                        y={QUARTER_H + MONTH_H / 2 + 4}
                        textAnchor="middle"
                        fill="#475569"
                        fontSize={10}
                        fontFamily="DM Sans, sans-serif"
                        fontWeight={500}
                      >
                        {m}
                      </text>
                      <line
                        x1={x}
                        y1={QUARTER_H}
                        x2={x}
                        y2={totalH}
                        stroke="#E2E8F0"
                        strokeWidth={0.5}
                      />
                    </g>
                  );
                })}

                {/* Week headers */}
                {Array.from({ length: TOTAL_WEEKS }, (_, wi) => {
                  const x = wi * WEEK_W;
                  const wNum = (wi % WEEKS_PER_MONTH) + 1;
                  return (
                    <g key={`w${wi}`}>
                      <rect
                        x={x}
                        y={QUARTER_H + MONTH_H}
                        width={WEEK_W}
                        height={WEEK_H}
                        fill={wi % 2 === 0 ? "#FAFAFA" : "#F5F5F5"}
                      />
                      <text
                        x={x + WEEK_W / 2}
                        y={QUARTER_H + MONTH_H + WEEK_H / 2 + 3}
                        textAnchor="middle"
                        fill="#94A3B8"
                        fontSize={8}
                        fontFamily="DM Sans, sans-serif"
                      >
                        W{wNum}
                      </text>
                      <line
                        x1={x}
                        y1={QUARTER_H + MONTH_H}
                        x2={x}
                        y2={totalH}
                        stroke="#E2E8F0"
                        strokeWidth={0.3}
                      />
                    </g>
                  );
                })}

                {/* Row backgrounds + lines */}
                {rows.map((row, i) => {
                  const y = rowYs[i];
                  const h = rowH(row, laneMaps[i]?.laneCount ?? 1);
                  return (
                    <g key={`rb${i}`}>
                      {row.type === "pillar" && (
                        <rect
                          x={0}
                          y={y}
                          width={TOTAL_W}
                          height={h}
                          fill={row.pillar.colour + "10"}
                        />
                      )}
                      {row.type === "outcome" && (
                        <rect
                          x={0}
                          y={y}
                          width={TOTAL_W}
                          height={h}
                          fill="#F0FDF4"
                        />
                      )}
                      {row.type === "unassigned" && (
                        <rect
                          x={0}
                          y={y}
                          width={TOTAL_W}
                          height={h}
                          fill="#FFFBEB"
                        />
                      )}
                      {row.type === "kpi" && (
                        <rect
                          x={0}
                          y={y}
                          width={TOTAL_W}
                          height={h}
                          fill="#F8FAFC"
                        />
                      )}
                      <line
                        x1={0}
                        y1={y + h}
                        x2={TOTAL_W}
                        y2={y + h}
                        stroke="#E2E8F0"
                        strokeWidth={0.5}
                      />
                    </g>
                  );
                })}

                {/* Quarter dividers on outcome rows */}
                {rows.map((row, i) => {
                  if (row.type !== "outcome") return null;
                  const y = rowYs[i];
                  const h = rowH(row);
                  return QUARTERS.map((q) => {
                    const sx = MONTHS.indexOf(QUARTER_MONTHS[q][0]) * MONTH_W;
                    const w = 3 * MONTH_W;
                    return (
                      <rect
                        key={`oq-${i}-${q}`}
                        x={sx + 1}
                        y={y + 1}
                        width={w - 2}
                        height={h - 2}
                        fill="none"
                        stroke="#BBF7D0"
                        strokeWidth={1}
                        rx={3}
                      />
                    );
                  });
                })}

                {/* Roadmap items */}
                {rows.map((row, i) => {
                  if (row.type !== "team" || row.isCollapsed) return null;
                  const rowY = rowYs[i];
                  const { laneMap = {} } = laneMaps[i] || {};
                  const rowItems = items.filter(
                    (item) =>
                      item.goal_id === row.goal.id &&
                      item.team_id === row.team.id &&
                      item.financial_year === filterYear &&
                      (filterConfidence === "all" ||
                        confidenceLevel(item) === filterConfidence),
                  );
                  return rowItems.map((item) => (
                    <TimelineItem
                      key={item.id}
                      item={item}
                      rowY={rowY}
                      lane={laneMap[item.id] ?? 0}
                      onUpdate={handleUpdate}
                      onClick={setSelected}
                    />
                  ));
                })}

                {/* Unassigned items */}
                {rows.map((row, i) => {
                  if (row.type !== "unassigned") return null;
                  const rowY = rowYs[i];
                  const { laneMap = {} } = laneMaps[i] || {};
                  const rowItems = items.filter(
                    (item) =>
                      item.pillar_id === row.pillar.id &&
                      !item.goal_id &&
                      item.financial_year === filterYear,
                  );
                  return rowItems.map((item) => (
                    <TimelineItem
                      key={item.id}
                      item={item}
                      rowY={rowY}
                      lane={laneMap[item.id] ?? 0}
                      onUpdate={handleUpdate}
                      onClick={setSelected}
                    />
                  ));
                })}

                {/* Outcome cells — rendered as foreignObject per quarter */}
                {rows.map((row, i) => {
                  if (row.type !== "outcome") return null;
                  const y = rowYs[i];
                  const h = rowH(row);
                  return QUARTERS.map((q) => {
                    const sx = MONTHS.indexOf(QUARTER_MONTHS[q][0]) * MONTH_W;
                    const w = 3 * MONTH_W;
                    return (
                      <foreignObject
                        key={`fo-${i}-${q}`}
                        x={sx}
                        y={y}
                        width={w}
                        height={h}
                      >
                        <div
                          xmlns="http://www.w3.org/1999/xhtml"
                          style={{
                            width: "100%",
                            height: "100%",
                            overflow: "auto",
                          }}
                        >
                          <OutcomeCell
                            outcomes={outcomes}
                            pillarId={row.pillar.id}
                            goalId={row.goal.id}
                            quarter={q}
                            year={filterYear}
                            filterTeam={filterTeam}
                            teams={teams}
                            items={items}
                            onReload={loadAll}
                            onOpenMapping={setMappingOutcome}
                            onAddOutcome={() => setAddingOutcome( { pillarId: row.pillar.id, goalId: row.goal.id, goal: { ...row.goal, quarter: q }, quarter: q })}
                          />
                        </div>
                      </foreignObject>
                    );
                  });
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
          teams={teams}
          defaultPillarId={addCtx.pillar_id}
          defaultGoalId={addCtx.goal_id}
          defaultTeamId={addCtx.team_id}
          onClose={() => setShowAdd(false)}
          onSaved={() => {
            setShowAdd(false);
            loadAll();
          }}
        />
      )}

      {mappingOutcome && (
        <OutcomeMappingModal
          outcome={mappingOutcome}
          items={items}
          onClose={() => setMappingOutcome(null)}
          onSaved={() => {
            setMappingOutcome(null);
            loadAll();
          }}
        />
      )}
      {addingOutcome && (
        <AddOutcomeModal
          pillarId={addingOutcome.pillarId}
          goalId={addingOutcome.goalId}
          goal={addingOutcome.goal}
          quarter={addingOutcome.quarter}
          year={filterYear}
          filterTeam={filterTeam}
          teams={teams}
          onClose={() => setAddingOutcome(null)}
          onSaved={() => { setAddingOutcome(null); loadAll() }}
        />
      )}
      {selected && (
        <ItemDetailPanel
          item={selected}
          pillars={pillars}
          goals={goals}
          teams={teams}
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
