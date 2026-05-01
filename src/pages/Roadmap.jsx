import { useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "../lib/supabase";
import { logEvent } from "../lib/audit";
import ItemDetailPanel from "../pages/ItemDetailPanel";

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
const OUTCOME_H = 100;
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

function assignLanes(rowItems) {
  const sorted = [...rowItems].sort(
    (a, b) => (a.start_week ?? 0) - (b.start_week ?? 0),
  );
  const lanes = [];
  const laneMap = {};
  sorted.forEach((item) => {
    const sw = item.start_week ?? 0;
    const ew = item.end_week ?? sw + 4;
    let placed = false;
    for (let i = 0; i < lanes.length; i++) {
      const last = lanes[i][lanes[i].length - 1];
      if (sw >= (last.end_week ?? 4)) {
        lanes[i].push(item);
        laneMap[item.id] = i;
        placed = true;
        break;
      }
    }
    if (!placed) {
      lanes.push([item]);
      laneMap[item.id] = lanes.length - 1;
    }
  });
  return { laneMap, laneCount: lanes.length || 1 };
}

function assignContainerLanes(groups, items) {
  // Get time span for each container
  const containerSpans = groups
    .map((group) => {
      const groupItems = items.filter((i) => i.group_id === group.id);
      if (groupItems.length === 0) return null;
      return {
        id: group.id,
        start: Math.min(...groupItems.map((i) => i.start_week ?? 0)),
        end: Math.max(...groupItems.map((i) => i.end_week ?? 4)),
      };
    })
    .filter(Boolean);

  // Assign lanes to containers using the same overlap logic
  const lanes = [];
  const containerLaneMap = {};

  containerSpans.forEach((span) => {
    let placed = false;
    for (let i = 0; i < lanes.length; i++) {
      const last = lanes[i][lanes[i].length - 1];
      if (span.start >= last.end) {
        lanes[i].push(span);
        containerLaneMap[span.id] = i;
        placed = true;
        break;
      }
    }
    if (!placed) {
      lanes.push([span]);
      containerLaneMap[span.id] = lanes.length - 1;
    }
  });

  return { containerLaneMap, containerLaneCount: lanes.length };
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
function TimelineItem({
  item,
  rowY,
  onUpdate,
  onClick,
  faded = false,
  onGroup,
  containerLanes = 0,
  internalLane = 0,
  ungroupedLane = 0,
  containerHeightsBefore = 0,
  ungroupedOffset = 0,
}) {
  const dragRef = useRef(null);
  const tm = typeMeta(item.type);
  const teamColour = item.team_colour || null;
  const pillarColour = item.pillar_colour || null;

  const sw = item.start_week ?? quarterStartWeek(item.quarter || "Q1");
  const ew = item.end_week ?? sw + WEEKS_PER_MONTH;
  const x = weekToX(sw);
  const w = Math.max(WEEK_W, weekToX(ew) - x);

  const ITEM_H = TEAM_H - 10;
  const containerHeight =
    containerLanes > 0 ? containerLanes * (ITEM_H + 4) + 8 + 18 : 0;
  const laneOffsetY = item.group_id
    ? containerHeightsBefore + 18 + internalLane * (ITEM_H + 4)
    : ungroupedOffset + ungroupedLane * (ITEM_H + 4);

  const didDragRef = useRef(false);

  function startDrag(e, mode) {
    e.stopPropagation();
    e.preventDefault();
    didDragRef.current = false;
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
    didDragRef.current = true;
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
    <g opacity={faded ? 0.25 : 1}>
      {/* Main box */}
      <rect
        x={x + 2}
        y={rowY + laneOffsetY + 5}
        width={w - 4}
        height={itemH}
        rx={4}
        fill="#ffffff"
        stroke={pillarColour || tm.color}
        strokeWidth={1.5}
        onMouseDown={(e) => startDrag(e, "move")}
        onClick={() => {
          if (!didDragRef.current) onClick(item);
        }}
        style={{ cursor: faded ? "default" : "grab" }}
      />

      {/* Top metadata row — type badge + team name + dep count + SMT star */}
      <foreignObject
        x={x + 6}
        y={rowY + laneOffsetY + 6}
        width={Math.max(0, w - 12)}
        height={16}
        style={{ pointerEvents: "none" }}
      >
        <div
          xmlns="http://www.w3.org/1999/xhtml"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "3px",
            overflow: "hidden",
            whiteSpace: "nowrap",
          }}
        >
          <span
            style={{
              fontSize: "8px",
              fontWeight: "700",
              padding: "1px 4px",
              borderRadius: "2px",
              background: teamColour ? teamColour + "40" : tm.bg,
              color: teamColour || tm.color,
              fontFamily: "Inter, sans-serif",
              letterSpacing: "0.04em",
              textTransform: "uppercase",
              flexShrink: 0,
            }}
          >
            {tm.label}
          </span>
          {item.team_name && (
            <span
              style={{
                fontSize: "9px",
                color: teamColour || tm.color,
                fontFamily: "Inter, sans-serif",
                fontWeight: "500",
                overflow: "hidden",
                textOverflow: "ellipsis",
                flexShrink: 1,
              }}
            >
              {item.team_name}
            </span>
          )}
          {item.dep_count > 0 && (
            <span
              style={{
                fontSize: "8px",
                fontWeight: "700",
                padding: "1px 4px",
                borderRadius: "2px",
                background: "#0F172A",
                color: "#fff",
                fontFamily: "Inter, sans-serif",
                flexShrink: 0,
              }}
            >
              {item.dep_count}
            </span>
          )}
          {item.smt_priority && (
            <span
              style={{
                fontSize: "9px",
                color: teamColour || tm.color,
                fontFamily: "Inter, sans-serif",
                flexShrink: 0,
              }}
            >
              ★
            </span>
          )}
        </div>
      </foreignObject>

      {/* Container button */}
      {!item.group_id && (
        <foreignObject
          x={x + w - 22}
          y={rowY + laneOffsetY + 22}
          width={18}
          height={14}
        >
          <div
            xmlns="http://www.w3.org/1999/xhtml"
            onMouseDown={(e) => {
              e.stopPropagation();
              e.preventDefault();
              onGroup(item);
            }}
            style={{
              fontSize: "8px",
              fontWeight: "700",
              padding: "1px 4px",
              borderRadius: "2px",
              background: "var(--border)",
              color: "var(--slate)",
              fontFamily: "Inter, sans-serif",
              cursor: "pointer",
              userSelect: "none",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
            title="Add to container"
          >
            [ ]
          </div>
        </foreignObject>
      )}

      {/* Feature name */}
      <foreignObject
        x={x + 6}
        y={rowY + laneOffsetY + 18}
        width={Math.max(0, w - 12)}
        height={itemH - 20}
        style={{ pointerEvents: "none" }}
      >
        <div
          xmlns="http://www.w3.org/1999/xhtml"
          style={{
            fontSize: "10px",
            fontWeight: "600",
            color: "#20292f",
            fontFamily: "Inter, sans-serif",
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

      {/* Resize handles */}
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
    fontFamily: "Inter, sans-serif",
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
                    fontFamily: "Inter, sans-serif",
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
                    fontFamily: "Inter, sans-serif",
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
                    fontFamily: "Inter, sans-serif",
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
                    fontFamily: "Inter, sans-serif",
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
                                fontFamily: "Inter, sans-serif",
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
                              fontFamily: "Inter, sans-serif",
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
              fontFamily: "Inter, sans-serif",
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
      eventType: "outcome_added",
      entityType: "quarterly_outcome",
      entityId: goalId,
      entityName: text.trim(),
      pillarId,
      teamId: teamId || null,
      newValue: { quarter: goal.quarter, summary: text.trim() },
    });
    setSaving(false);
    onSaved();
  }

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
  onAddOutcome,
  pillarColour,
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
    const outcome = outcomes.find((o) => o.id === id);
    if (outcome) {
      await logEvent({
        eventType: "outcome_deleted",
        entityType: "quarterly_outcome",
        entityId: id,
        entityName: outcome.summary,
        pillarId: outcome.pillar_id || null,
        teamId: outcome.team_id || null,
        oldValue: { quarter: outcome.quarter, summary: outcome.summary },
      });
    }

    await supabase.from("quarterly_outcomes").delete().eq("id", id);
    onReload();
  }

  return (
    <div
      style={{
        padding: "4px 6px",
        height: OUTCOME_H,
        maxHeight: OUTCOME_H,
        overflowY: "auto",
        display: "flex",
        flexDirection: "column",
        gap: "3px",
      }}
    >
      <button
        onClick={() => onAddOutcome()}
        style={{
          fontSize: "9px",
          color: pillarColour || "var(--slate-light)",
          background: "transparent",
          border: "1px dashed var(--border)",
          borderRadius: "4px",
          padding: "2px 6px",
          cursor: "pointer",
          fontFamily: "Inter, sans-serif",
          alignSelf: "flex-start",
        }}
      >
        + outcome
      </button>
      {qOutcomes.map((o) => (
        <div
          key={o.id}
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: "6px",
            padding: "3px 6px",
            borderRadius: "4px",
            border: `1px solid ${pillarColour || "var(--border)"}30`,
            background: pillarColour,
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
                fontFamily: "Inter, sans-serif",
                outline: "none",
              }}
            />
          ) : (
            <span
              onClick={() => onOpenMapping(o)}
              style={{
                fontSize: "9px",
                fontWeight: "500",
                color: "#ffffff",
                lineHeight: "1.3",
                flex: 1,
                cursor: "pointer",
                fontFamily: "Inter, sans-serif",
              }}
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
    smt_priority: false,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  async function save() {
    if (!form.title.trim()) return setError("Title is required");
    setSaving(true);
    const { data: result, error } = await supabase
      .from("roadmap_items")
      .insert({
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
        smt_priority: form.smt_priority || false,
      })
      .select()
      .single();
    setSaving(false);
    if (error) return setError(error.message);

    //Audit log
    await logEvent({
      eventType: "item_created",
      entityType: "roadmap_item",
      entityId: result?.id || "unknown",
      entityName: form.title.trim(),
      pillarId: form.pillar_id || null,
      teamId: form.team_id || null,
      newValue: {
        type: form.type,
        quarter: form.quarter,
        financial_year: form.financial_year,
        duration_weeks: form.end_week - form.start_week,
      },
    });
    onSaved();
  }

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
              {saving ? "Saving…" : "Add to roadmap"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
// ── Add to container modal ──────────────────────────────────────────────────────────
function AddToContainerModal({
  group,
  pillarId,
  goalId,
  financialYear,
  items,
  pillars,
  goals,
  teams,
  onClose,
  onSaved,
}) {
  const [tab, setTab] = useState("search");
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newType, setNewType] = useState("dev");
  const [error, setError] = useState(null);

  const availableItems = items.filter(
    (item) =>
      item.goal_id === goalId &&
      item.financial_year === financialYear &&
      !item.group_id &&
      item.id !== undefined,
  );

  const searchResults = search.trim()
    ? availableItems
        .filter((item) =>
          search
            .toLowerCase()
            .split(" ")
            .every((w) => item.title.toLowerCase().includes(w)),
        )
        .slice(0, 8)
    : availableItems.slice(0, 8);

  async function addExisting(itemId) {
    setSaving(true);
    await supabase
      .from("roadmap_items")
      .update({ group_id: group.id })
      .eq("id", itemId);
    setSaving(false);
    onSaved();
  }

  async function createNew() {
    if (!newTitle.trim()) return setError("Title is required");
    setSaving(true);
    await supabase.from("roadmap_items").insert({
      title: newTitle.trim(),
      type: newType,
      track: "delivery",
      status: "to_do",
      quarter: "Q1",
      financial_year: financialYear,
      pillar_id: pillarId || null,
      goal_id: goalId || null,
      group_id: group.id,
      start_week: 0,
      end_week: 4,
      smt_priority: false,
    });
    setSaving(false);
    onSaved();
  }

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
          width: "480px",
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
              Add to container
            </h2>
            <p style={{ fontSize: "12px", color: "var(--slate)" }}>
              {group.title}
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

        {/* Tabs */}
        <div
          style={{
            display: "flex",
            border: "1px solid var(--border)",
            borderRadius: "6px",
            overflow: "hidden",
            marginBottom: "20px",
          }}
        >
          <button
            onClick={() => setTab("search")}
            style={{
              flex: 1,
              padding: "8px",
              border: "none",
              background: tab === "search" ? "var(--navy)" : "#fff",
              color: tab === "search" ? "#fff" : "var(--slate)",
              fontSize: "12px",
              fontWeight: "500",
              cursor: "pointer",
              fontFamily: "Inter, sans-serif",
            }}
          >
            Add existing
          </button>
          <button
            onClick={() => setTab("create")}
            style={{
              flex: 1,
              padding: "8px",
              border: "none",
              borderLeft: "1px solid var(--border)",
              background: tab === "create" ? "var(--navy)" : "#fff",
              color: tab === "create" ? "#fff" : "var(--slate)",
              fontSize: "12px",
              fontWeight: "500",
              cursor: "pointer",
              fontFamily: "Inter, sans-serif",
            }}
          >
            Create new
          </button>
        </div>

        {tab === "search" && (
          <div
            style={{ display: "flex", flexDirection: "column", gap: "10px" }}
          >
            <input
              autoFocus
              style={inp}
              placeholder="Search features..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {searchResults.length === 0 ? (
              <p
                style={{
                  fontSize: "12px",
                  color: "var(--slate-light)",
                  fontStyle: "italic",
                }}
              >
                No ungrouped features in this product focus.
              </p>
            ) : (
              <div
                style={{ display: "flex", flexDirection: "column", gap: "6px" }}
              >
                {searchResults.map((item) => {
                  const team = teams.find((t) => t.id === item.team_id);
                  return (
                    <div
                      key={item.id}
                      onClick={() => !saving && addExisting(item.id)}
                      style={{
                        padding: "10px 12px",
                        border: "1px solid var(--border)",
                        borderRadius: "6px",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                      }}
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.background = "var(--bg)")
                      }
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.background = "#fff")
                      }
                    >
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
                          {item.title}
                        </div>
                        <div
                          style={{
                            display: "flex",
                            gap: "8px",
                            marginTop: "2px",
                          }}
                        >
                          {team && (
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
                                  background: team.colour,
                                }}
                              />
                              <span
                                style={{
                                  fontSize: "10px",
                                  color: "var(--slate-light)",
                                }}
                              >
                                {team.name}
                              </span>
                            </div>
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
                      <span
                        style={{
                          fontSize: "11px",
                          color: "var(--blue)",
                          flexShrink: 0,
                        }}
                      >
                        Add →
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {tab === "create" && (
          <div
            style={{ display: "flex", flexDirection: "column", gap: "14px" }}
          >
            <div>
              <label style={lbl}>Title *</label>
              <input
                autoFocus
                style={inp}
                placeholder="e.g. Build routing algorithm"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") createNew();
                }}
              />
            </div>
            <div>
              <label style={lbl}>Type</label>
              <select
                style={{ ...inp, cursor: "pointer" }}
                value={newType}
                onChange={(e) => setNewType(e.target.value)}
              >
                {ITEM_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
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
                onClick={createNew}
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
                {saving ? "Creating…" : "Create & add"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Create container modal ──────────────────────────────────────────────────────────
function CreateContainerModal({ item, pillars, goals, onClose, onSaved }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [title, setTitle] = useState(item.title);

  async function save() {
    if (!title.trim()) return setError("Title is required");
    setSaving(true);

    const { data: group, error: groupError } = await supabase
      .from("feature_groups")
      .insert({
        title: title.trim(),
        goal_id: item.goal_id || null,
        pillar_id: item.pillar_id || null,
        financial_year: item.financial_year,
      })
      .select()
      .single();

    if (groupError) {
      setError(groupError.message);
      setSaving(false);
      return;
    }

    await supabase
      .from("roadmap_items")
      .update({ group_id: group.id })
      .eq("id", item.id);

    setSaving(false);
    onSaved();
  }

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
          Create container
        </h2>
        <p
          style={{
            fontSize: "12px",
            color: "var(--slate)",
            marginBottom: "20px",
            lineHeight: "1.5",
          }}
        >
          Group related features under a shared container.{" "}
          <strong>{item.title}</strong> will be the first item.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <div>
            <label
              style={{
                fontSize: "10px",
                fontWeight: "600",
                color: "var(--slate)",
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                marginBottom: "4px",
                display: "block",
              }}
            >
              Container name
            </label>
            <input
              autoFocus
              style={inp}
              placeholder="e.g. Routing overhaul"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") save();
              }}
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
            style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}
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
              {saving ? "Creating…" : "Create container"}
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
  const [collapsedPillars, setCollapsedPillars] = useState(new Set());
  const [collapsedTeams, setCollapsedTeams] = useState({});
  const [collapsedGoals, setCollapsedGoals] = useState(new Set());
  const saveTimer = useRef({});
  const [mappingOutcome, setMappingOutcome] = useState(null);
  const [addingOutcome, setAddingOutcome] = useState(null); // { pillarId, goalId, goal };
  const [filterPillar, setFilterPillar] = useState("");
  const [filterSMT, setFilterSMT] = useState(false);
  const [dependencies, setDependencies] = useState([]);
  const [featureGroups, setFeatureGroups] = useState([]);
  const [containerItem, setContainerItem] = useState(null);
  const [addToContainer, setAddToContainer] = useState(null);

  async function loadAll() {
    const [ir, pr, gr, tr, or, dr, fgr] = await Promise.all([
      supabase.from("roadmap_items").select("*").order("created_at"),
      supabase.from("pillars").select("*").order("sort_order"),
      supabase.from("goals").select("*"),
      supabase.from("teams").select("*").order("sort_order"),
      supabase.from("quarterly_outcomes").select("*"),
      supabase.from("dependencies").select("from_item_id, to_item_id"),
      supabase.from("feature_groups").select("*"),
    ]);
    const teamsData = tr.data || [];
    const depsData = dr.data || [];
    const pillarsData = pr.data || [];
    setItems(
      (ir.data || []).map((item) => ({
        ...item,
        team_colour:
          teamsData.find((t) => t.id === item.team_id)?.colour || null,
        team_name: teamsData.find((t) => t.id === item.team_id)?.name || null,
        pillar_colour:
          pillarsData.find((p) => p.id === item.pillar_id)?.colour || null,
        dep_count: depsData.filter(
          (d) => d && (d.from_item_id === item.id || d.to_item_id === item.id),
        ).length,
      })),
    );
    setPillars(pr.data || []);
    setGoals(gr.data || []);
    setTeams(teamsData);
    setOutcomes(or.data || []);
    setLoading(false);
    setDependencies(dr.data || []);
    setFeatureGroups(fgr.data || []);
  }

  useEffect(() => {
    loadAll();
  }, []);

  const handleUpdate = useCallback(
    (id, changes, persist) => {
      const originalItem = items.find((i) => i.id === id);

      setItems((prev) =>
        prev.map((i) => (i.id === id ? { ...i, ...changes } : i)),
      );
      if (persist) {
        clearTimeout(saveTimer.current[id]);
        saveTimer.current[id] = setTimeout(async () => {
          await supabase.from("roadmap_items").update(changes).eq("id", id);
          if (originalItem) {
            const oldSW = originalItem.start_week ?? 0;
            const oldEW = originalItem.end_week ?? 4;
            const newSW = changes.start_week ?? oldSW;
            const newEW = changes.end_week ?? oldEW;
            const oldDuration = oldEW - oldSW;
            const newDuration = newEW - newSW;
            const isResize = newDuration !== oldDuration;

            //Audit log
            await logEvent({
              eventType: isResize ? "item_resized" : "item_moved",
              entityType: "roadmap_item",
              entityId: id,
              entityName: originalItem.title,
              pillarId: originalItem.pillar_id || null,
              teamId: originalItem.team_id || null,
              oldValue: {
                quarter: originalItem.quarter,
                start_week: oldSW,
                end_week: oldEW,
                duration_weeks: oldDuration,
              },
              newValue: {
                quarter: changes.quarter ?? originalItem.quarter,
                start_week: newSW,
                end_week: newEW,
                duration_weeks: newDuration,
              },
            });
          }
        }, 300);
      }
    },
    [items],
  );

  // Build row structure
  const rows = [];
  const visiblePillars = filterPillar
    ? pillars.filter((p) => p.id === filterPillar)
    : pillars;

  visiblePillars.forEach((pillar) => {
    const pillarGoals = goals.filter((g) => g.pillar_id === pillar.id);
    const isCollapsed = collapsedPillars.has(pillar.id);

    rows.push({ type: "pillar", pillar, isCollapsed });

    if (!isCollapsed) {
      if (pillarGoals.length === 0) {
        rows.push({ type: "empty", pillar });
      } else {
        pillarGoals.forEach((goal) => {
          const isGoalCollapsed = collapsedGoals.has(goal.id);
          rows.push({
            type: "focus",
            pillar,
            goal,
            isCollapsed: isGoalCollapsed,
          });
          if (!isGoalCollapsed) {
            rows.push({ type: "outcome", pillar, goal });
          }
        });
      }
      // Unassigned row — items with no goal
      rows.push({ type: "unassigned", pillar });
    }
  });

  // Y positions
  const rowH = (
    r,
    laneCount = 1,
    hasGroupedItems = false,
    groupLaneCount = 0,
  ) => {
    if (r.type === "pillar") return 36;
    if (r.type === "focus") {
      if (r.isCollapsed) return 36;
      const ITEM_H = TEAM_H - 10;
      // This needs containerLaneCount and containerInternalLaneCounts
      // For now use a simpler calculation based on laneCount
      if (!hasGroupedItems) return Math.max(80, laneCount * (ITEM_H + 4) + 8);
      // With containers: sum container heights + ungrouped below
      return Math.max(80, laneCount * (ITEM_H + 4) + 8 + 18 + 4);
    }
    if (r.type === "outcome") return OUTCOME_H;
    if (r.type === "empty") return TEAM_H;
    if (r.type === "unassigned") return TEAM_H;
    return TEAM_H;
  };

  // Pre-calculate lane counts per row
  const laneMaps = rows.map((row) => {
    if (row.type === "focus" && row.goal) {
      const rowItems = items.filter(
        (item) =>
          item.goal_id === row.goal.id &&
          item.financial_year === filterYear &&
          (!filterSMT || item.smt_priority),
      );
      const rowGroups = featureGroups.filter(
        (g) => g.goal_id === row.goal.id && g.financial_year === filterYear,
      );

      // Step 1 — assign container lanes (each container is a unit)
      const { containerLaneMap, containerLaneCount } = assignContainerLanes(
        rowGroups,
        rowItems,
      );

      // Step 2 — assign internal lanes within each container
      const itemContainerLane = {}; // item.id -> containerLane index
      const itemInternalLane = {}; // item.id -> lane within container
      const containerInternalLaneCounts = {}; // group.id -> how many internal lanes used

      rowGroups.forEach((group) => {
        const containerLane = containerLaneMap[group.id] ?? 0;
        const groupItems = rowItems
          .filter((i) => i.group_id === group.id)
          .sort((a, b) => (a.start_week ?? 0) - (b.start_week ?? 0));

        const internalLanes = [];
        groupItems.forEach((item) => {
          const sw = item.start_week ?? 0;
          const ew = item.end_week ?? sw + 4;
          let placed = false;
          for (let i = 0; i < internalLanes.length; i++) {
            const last = internalLanes[i][internalLanes[i].length - 1];
            if (sw >= (last.end_week ?? 4)) {
              internalLanes[i].push(item);
              itemContainerLane[item.id] = containerLane;
              itemInternalLane[item.id] = i;
              placed = true;
              break;
            }
          }
          if (!placed) {
            internalLanes.push([item]);
            itemContainerLane[item.id] = containerLane;
            itemInternalLane[item.id] = internalLanes.length - 1;
          }
        });
        containerInternalLaneCounts[group.id] = internalLanes.length || 1;
      });

      // Step 3 — assign lanes to ungrouped items (stack after containers)
      const ungrouped = rowItems
        .filter((i) => !i.group_id)
        .sort((a, b) => (a.start_week ?? 0) - (b.start_week ?? 0));

      const ungroupedLaneMap = {};
      const ungroupedLanes = [];
      ungrouped.forEach((item) => {
        const sw = item.start_week ?? 0;
        const ew = item.end_week ?? sw + 4;
        let placed = false;
        for (let i = 0; i < ungroupedLanes.length; i++) {
          const last = ungroupedLanes[i][ungroupedLanes[i].length - 1];
          if (sw >= (last.end_week ?? 4)) {
            ungroupedLanes[i].push(item);
            ungroupedLaneMap[item.id] = i;
            placed = true;
            break;
          }
        }
        if (!placed) {
          ungroupedLanes.push([item]);
          ungroupedLaneMap[item.id] = ungroupedLanes.length - 1;
        }
      });

      return {
        itemContainerLane,
        itemInternalLane,
        ungroupedLaneMap,
        ungroupedLaneCount: ungroupedLanes.length,
        containerLaneMap,
        containerLaneCount,
        containerInternalLaneCounts,
        hasGroupedItems: rowGroups.length > 0,
        // Keep laneMap for compatibility
        laneMap: {},
        laneCount: 1,
        groupLaneCount: 0,
      };
    }
    if (row.type === "unassigned") {
      const rowItems = items.filter(
        (item) =>
          item.pillar_id === row.pillar.id &&
          !item.goal_id &&
          item.financial_year === filterYear,
      );
      const { laneMap, laneCount } = assignLanes(rowItems);
      return {
        laneMap,
        laneCount,
        hasGroupedItems: false,
        groupLaneCount: 0,
        containerLaneMap: {},
        containerLaneCount: 0,
        itemContainerLane: {},
        itemInternalLane: {},
        ungroupedLaneMap: laneMap,
        ungroupedLaneCount: laneCount,
        containerInternalLaneCounts: {},
      };
    }
    return {
      laneMap: {},
      laneCount: 1,
      hasGroupedItems: false,
      groupLaneCount: 0,
      containerLaneMap: {},
      containerLaneCount: 0,
      itemContainerLane: {},
      itemInternalLane: {},
      ungroupedLaneMap: {},
      ungroupedLaneCount: 0,
      containerInternalLaneCounts: {},
    };
  });

  function getFocusRowHeight(laneMapData, rowGroups) {
  const ITEM_H = TEAM_H - 10
  const { hasGroupedItems, containerLaneCount = 0, containerInternalLaneCounts = {}, ungroupedLaneCount = 0, containerLaneMap = {} } = laneMapData

  if (!hasGroupedItems) {
    return Math.max(80, (laneMapData.laneCount || 1) * (ITEM_H + 4) + 8)
  }

  // Calculate height of each container lane
  let totalContainerH = 0
  for (let lane = 0; lane < containerLaneCount; lane++) {
    const groupsInLane = rowGroups.filter(g => (containerLaneMap[g.id] ?? 0) === lane)
    const maxInternal = Math.max(1, ...groupsInLane.map(g => containerInternalLaneCounts[g.id] ?? 1))
    totalContainerH += maxInternal * (ITEM_H + 4) + 18 + 8
  }

  const ungroupedH = ungroupedLaneCount > 0 ? ungroupedLaneCount * (ITEM_H + 4) + 4 : 0
  return Math.max(80, totalContainerH + ungroupedH + 8)
}

  // Y positions using dynamic row heights
  let cy = HEADER_H;
  const rowYs = rows.map((r, i) => {
    const y = cy;
    if (r.type === 'focus') {
      const rowGroups = featureGroups.filter(g => g.goal_id === r.goal?.id && g.financial_year === filterYear)
      cy += r.isCollapsed ? 36 : getFocusRowHeight(laneMaps[i], rowGroups)
    } else {
      cy += rowH(r, laneMaps[i]?.laneCount ?? 1, laneMaps[i]?.hasGroupedItems ?? false, laneMaps[i]?.groupLaneCount ?? 0)
    }
    return y
  })
  const totalH = cy

  const sel = {
    padding: "6px 10px",
    border: "1px solid var(--border)",
    borderRadius: "6px",
    fontSize: "12px",
    fontFamily: "Inter, sans-serif",
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
          <button
            onClick={() => setFilterSMT((f) => !f)}
            style={{
              padding: "6px 12px",
              borderRadius: "6px",
              fontSize: "12px",
              border: filterSMT ? "none" : "1px solid var(--border)",
              background: filterSMT ? "var(--navy)" : "#fff",
              color: filterSMT ? "#fff" : "var(--slate)",
              cursor: "pointer",
              fontFamily: "Inter, sans-serif",
              fontWeight: filterSMT ? "600" : "400",
              display: "flex",
              alignItems: "center",
              gap: "4px",
            }}
          >
            ★ SMT
          </button>
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
              fontFamily: "Inter, sans-serif",
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
                  Pillar / Product focus
                </span>
              </div>

              {rows.map((row, i) => {
                const h = rowH(
                  row,
                  laneMaps[i]?.laneCount ?? 1,
                  laneMaps[i]?.hasGroupedItems ?? false,
                  laneMaps[i]?.groupLaneCount ?? 0,
                );
                if (row.type === "pillar")
                  return (
                    <div
                      key={i}
                      style={{
                        height: h,
                        display: "flex",
                        alignItems: "center",
                        padding: "0 14px",
                        background: row.pillar.colour,
                        borderBottom: "1px solid rgba(0,0,0,0.1)",
                        cursor: "pointer",
                        gap: "8px",
                      }}
                      onClick={() =>
                        setCollapsedPillars((prev) => {
                          const next = new Set(prev);
                          if (next.has(row.pillar.id))
                            next.delete(row.pillar.id);
                          else next.add(row.pillar.id);
                          return next;
                        })
                      }
                    >
                      <span
                        style={{
                          fontSize: "11px",
                          fontWeight: "700",
                          color: "#fff",
                          flex: 1,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          letterSpacing: "0.02em",
                        }}
                      >
                        {row.pillar.name}
                      </span>
                      <span
                        style={{
                          fontSize: "10px",
                          color: "rgba(255,255,255,0.7)",
                        }}
                      >
                        {row.isCollapsed ? "▸" : "▾"}
                      </span>
                    </div>
                  );

                if (row.type === "focus")
                  return (
                    <div
                      key={i}
                      style={{
                        height: row.isCollapsed ? 36 : getFocusRowHeight(
                          laneMaps[i], 
                          featureGroups.filter(g => g.goal_id === row.goal?.id && g.financial_year === filterYear)
                        ),
                        display: "flex",
                        alignItems: "flex-start",
                        padding: "8px 12px 8px 16px",
                        borderTop: "1px solid #CBD5E1",
                        borderBottom: "none",
                        borderLeft: `3px solid ${row.pillar.colour}`,
                        background: row.pillar.colour + "0D",
                        gap: "8px",
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        {(() => {
                          const leadTeam = teams.find(
                            (t) => t.id === row.goal.team_id,
                          );
                          return leadTeam ? (
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "3px",
                                marginBottom: "4px",
                              }}
                            >
                              <div
                                style={{
                                  width: "5px",
                                  height: "5px",
                                  borderRadius: "50%",
                                  background: leadTeam.colour,
                                  flexShrink: 0,
                                }}
                              />
                              <span
                                style={{
                                  fontSize: "9px",
                                  fontWeight: "500",
                                  color: "var(--slate)",
                                  whiteSpace: "nowrap",
                                  fontFamily: "Inter, sans-serif",
                                }}
                              >
                                {leadTeam.name}
                              </span>
                            </div>
                          ) : null;
                        })()}
                        <div
                          style={{
                            fontSize: "10px",
                            fontWeight: "600",
                            color: "var(--navy)",
                            letterSpacing: "0.01em",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            fontFamily: "Inter, sans-serif",
                          }}
                        >
                          {row.goal.driver_statement ||
                            row.goal.kpi_name ||
                            "No focus defined"}
                        </div>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setAddCtx({
                            pillar_id: row.pillar.id,
                            goal_id: row.goal.id,
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
                          marginTop: "2px",
                          fontFamily: "Inter, sans-serif",
                        }}
                      >
                        +
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setCollapsedGoals((prev) => {
                            const next = new Set(prev);
                            if (next.has(row.goal.id)) next.delete(row.goal.id);
                            else next.add(row.goal.id);
                            return next;
                          });
                        }}
                        style={{
                          width: "16px",
                          height: "16px",
                          borderRadius: "3px",
                          border: "none",
                          background: "transparent",
                          color: "var(--slate-light)",
                          cursor: "pointer",
                          fontSize: "10px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                          padding: 0,
                        }}
                      >
                        {row.isCollapsed ? "▸" : "▾"}
                      </button>
                    </div>
                  );
                if (row.type === "outcome")
                  return (
                    <div
                      key={i}
                      style={{
                        height: rowH(
                          row,
                          laneMaps[i]?.laneCount ?? 1,
                          laneMaps[i]?.hasGroupedItems ?? false,
                          laneMaps[i]?.groupLaneCount ?? 0,
                        ),
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "center",
                        padding: "0 12px 0 16px",
                        borderBottom: "1px solid #CBD5E1",
                        background: row.pillar.colour + "0D",
                        borderLeft: `3px solid ${row.pillar.colour}`,
                      }}
                    >
                      <span
                        style={{
                          fontSize: "8px",
                          fontWeight: "700",
                          color: "#20292f",
                          letterSpacing: "0.08em",
                          textTransform: "uppercase",
                          fontFamily: "Inter, sans-serif",
                        }}
                      >
                        Outcomes
                      </span>
                      {row.goal?.lead_metric_name && (
                        <span
                          style={{
                            fontSize: "9px",
                            color: "#20292f",
                            marginTop: "2px",
                            opacity: 0.7,
                            fontFamily: "Inter, sans-serif",
                          }}
                        >
                          {row.goal.lead_metric_name}
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
                        fontFamily="Inter, sans-serif"
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
                        fontFamily="Inter, sans-serif"
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
                        strokeWidth={1}
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
                        fontFamily="Inter, sans-serif"
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
                  const h = row.type === 'focus'
                    ? (row.isCollapsed ? 36 : getFocusRowHeight(laneMaps[i], featureGroups.filter(g => g.goal_id === row.goal?.id && g.financial_year === filterYear)))
                    : rowH(row, laneMaps[i]?.laneCount ?? 1, laneMaps[i]?.hasGroupedItems ?? false, laneMaps[i]?.groupLaneCount ?? 0)
                  return (
                    <g key={`rb${i}`}>
                      {row.type === "pillar" && (
                        <rect
                          x={0}
                          y={y}
                          width={TOTAL_W}
                          height={h}
                          fill={row.pillar.colour}
                        />
                      )}
                      {row.type === "outcome" && (
                        <>
                          <rect
                            x={0}
                            y={y}
                            width={TOTAL_W}
                            height={h}
                            fill="#ffffff"
                          />
                          <rect
                            x={0}
                            y={y}
                            width={TOTAL_W}
                            height={h}
                            fill={row.pillar.colour}
                            opacity={0.06}
                          />
                        </>
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
                      {row.type === "focus" && (
                        <rect
                          x={0}
                          y={y}
                          width={TOTAL_W}
                          height={h}
                          fill={row.pillar.colour + "0D"}
                        />
                      )}
                      {row.type === "focus" && (
                        <line
                          x1={0}
                          y1={y}
                          x2={TOTAL_W}
                          y2={y}
                          stroke="#CBD5E1"
                          strokeWidth={1}
                        />
                      )}
                      <line
                        x1={0}
                        y1={y + h}
                        x2={TOTAL_W}
                        y2={y + h}
                        stroke={
                          row.type === "focus" ? "transparent" : "#CBD5E1"
                        }
                        strokeWidth={1}
                      />
                    </g>
                  );
                })}

                {/* Quarter borders */}
                {QUARTERS.map((q) => {
                  const sx = MONTHS.indexOf(QUARTER_MONTHS[q][0]) * MONTH_W;
                  const w = 3 * MONTH_W;
                  return (
                    <g key={`qb-${q}`}>
                      {/* Left border */}
                      <line
                        x1={sx}
                        y1={HEADER_H}
                        x2={sx}
                        y2={totalH}
                        stroke="#CBD5E1"
                        strokeWidth={1}
                      />
                      {/* Right border */}
                      <line
                        x1={sx + w}
                        y1={HEADER_H}
                        x2={sx + w}
                        y2={totalH}
                        stroke="#CBD5E1"
                        strokeWidth={1}
                      />
                    </g>
                  );
                })}

                {/* Feature group containers */}
                {rows.map((row, i) => {
                  if (row.type !== "focus" || row.isCollapsed) return null;
                  const rowY = rowYs[i];
                  const {
                    containerLaneMap = {},
                    containerLaneCount = 0,
                    containerInternalLaneCounts = {},
                  } = laneMaps[i] || {};

                  const rowGroups = featureGroups.filter(
                    (g) =>
                      g.goal_id === row.goal.id &&
                      g.financial_year === filterYear,
                  );
                  const ITEM_H = TEAM_H - 10;

                  function containerLaneHeight(lane) {
                    const groupsInLane = rowGroups.filter(
                      (g) => (containerLaneMap[g.id] ?? 0) === lane,
                    );
                    const maxInternalLanes = Math.max(
                      1,
                      ...groupsInLane.map(
                        (g) => containerInternalLaneCounts[g.id] ?? 1,
                      ),
                    );
                    return maxInternalLanes * (ITEM_H + 4) + 18 + 8;
                  }

                  function heightBeforeContainerLane(lane) {
                    let total = 0;
                    for (let i = 0; i < lane; i++)
                      total += containerLaneHeight(i);
                    return total;
                  }

                  return rowGroups.map((group) => {
                    const groupItems = items.filter(
                      (item) =>
                        item.group_id === group.id &&
                        item.financial_year === filterYear,
                    );
                    if (groupItems.length === 0) return null;

                    const startWeek = Math.min(
                      ...groupItems.map((i) => i.start_week ?? 0),
                    );
                    const endWeek = Math.max(
                      ...groupItems.map((i) => i.end_week ?? 4),
                    );
                    const x = weekToX(startWeek);
                    const w = weekToX(endWeek) - x;

                    const cLane = containerLaneMap[group.id] ?? 0;
                    const yOffset = heightBeforeContainerLane(cLane);
                    const internalLanes =
                      containerInternalLaneCounts[group.id] ?? 1;
                    const h = internalLanes * (ITEM_H + 4) + 18 + 8;
                    const pillarColour = row.pillar.colour;

                    return (
                      <g key={group.id}>
                        <rect
                          x={x - 4}
                          y={rowY + 4 + yOffset}
                          width={w + 8}
                          height={h}
                          rx={6}
                          fill={pillarColour + "18"}
                          stroke={pillarColour}
                          strokeWidth={1.5}
                          strokeDasharray="4 2"
                        />
                        <rect
                          x={x - 4}
                          y={rowY + 4 + yOffset}
                          width={w + 8}
                          height={18}
                          rx={6}
                          fill={pillarColour}
                        />
                        <rect
                          x={x - 4}
                          y={rowY + 16 + yOffset}
                          width={w + 8}
                          height={6}
                          fill={pillarColour}
                        />
                        <foreignObject
                          x={x - 2}
                          y={rowY + 5 + yOffset}
                          width={w + 4}
                          height={16}
                          style={{ pointerEvents: "none" }}
                        >
                          <div
                            xmlns="http://www.w3.org/1999/xhtml"
                            style={{
                              fontSize: "9px",
                              fontWeight: "700",
                              color: "#ffffff",
                              fontFamily: "Inter, sans-serif",
                              letterSpacing: "0.04em",
                              padding: "1px 6px",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {group.title}
                          </div>
                        </foreignObject>
                        <foreignObject
                          x={x + w - 18}
                          y={rowY + 5 + yOffset}
                          width={16}
                          height={16}
                        >
                          <div
                            xmlns="http://www.w3.org/1999/xhtml"
                            onMouseDown={(e) => {
                              e.stopPropagation();
                              e.preventDefault();
                              setAddToContainer(group);
                            }}
                            style={{
                              width: "14px",
                              height: "14px",
                              borderRadius: "3px",
                              background: "rgba(255,255,255,0.3)",
                              color: "#fff",
                              fontSize: "12px",
                              fontWeight: "700",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              cursor: "pointer",
                              userSelect: "none",
                              fontFamily: "Inter, sans-serif",
                            }}
                          >
                            +
                          </div>
                        </foreignObject>
                      </g>
                    );
                  });
                })}

                {/* Roadmap items */}
                {rows.map((row, i) => {
                  if (row.type !== "focus" || row.isCollapsed) return null;
                  const rowY = rowYs[i];
                  const {
                    itemContainerLane = {},
                    itemInternalLane = {},
                    ungroupedLaneMap = {},
                    containerLaneMap = {},
                    containerLaneCount = 0,
                    containerInternalLaneCounts = {},
                    hasGroupedItems = false,
                  } = laneMaps[i] || {};

                  const rowGroups = featureGroups.filter(
                    (g) =>
                      g.goal_id === row.goal.id &&
                      g.financial_year === filterYear,
                  );

                  const ITEM_H = TEAM_H - 10;

                  // Calculate cumulative height of each container lane
                  function containerLaneHeight(lane) {
                    const groupsInLane = rowGroups.filter(
                      (g) => (containerLaneMap[g.id] ?? 0) === lane,
                    );
                    const maxInternalLanes = Math.max(
                      1,
                      ...groupsInLane.map(
                        (g) => containerInternalLaneCounts[g.id] ?? 1,
                      ),
                    );
                    return maxInternalLanes * (ITEM_H + 4) + 18 + 8;
                  }

                  function heightBeforeContainerLane(lane) {
                    let total = 0;
                    for (let i = 0; i < lane; i++)
                      total += containerLaneHeight(i);
                    return total;
                  }

                  // Total height of all containers
                  const totalContainerHeight = Array.from(
                    { length: containerLaneCount },
                    (_, i) => containerLaneHeight(i),
                  ).reduce((sum, h) => sum + h, 0);

                  const ungroupedOffset = hasGroupedItems
                    ? totalContainerHeight + 4
                    : 0;

                  const rowItems = items.filter(
                    (item) =>
                      item.goal_id === row.goal.id &&
                      item.financial_year === filterYear &&
                      (!filterSMT || item.smt_priority),
                  );

                  return rowItems.map((item) => {
                    const faded = filterTeam && item.team_id !== filterTeam;
                    const cLane = itemContainerLane[item.id] ?? 0;
                    const containerHeightsBefore = item.group_id
                      ? heightBeforeContainerLane(cLane)
                      : 0;

                    return (
                      <TimelineItem
                        key={item.id}
                        item={item}
                        rowY={rowY}
                        onUpdate={handleUpdate}
                        onClick={faded ? () => {} : setSelected}
                        faded={faded}
                        onGroup={setContainerItem}
                        containerLane={cLane}
                        internalLane={itemInternalLane[item.id] ?? 0}
                        ungroupedLane={ungroupedLaneMap[item.id] ?? 0}
                        containerHeightsBefore={containerHeightsBefore}
                        ungroupedOffset={ungroupedOffset}
                      />
                    );
                  });
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
                  const h = rowH(
                    row,
                    laneMaps[i]?.laneCount ?? 1,
                    laneMaps[i]?.hasGroupedItems ?? false,
                    laneMaps[i]?.groupLaneCount ?? 0,
                  );
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
                            pillarColour={row.pillar.colour}
                            onAddOutcome={() =>
                              setAddingOutcome({
                                pillarId: row.pillar.id,
                                goalId: row.goal.id,
                                goal: { ...row.goal, quarter: q },
                                quarter: q,
                              })
                            }
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

      {addToContainer && (
        <AddToContainerModal
          group={addToContainer}
          pillarId={addToContainer.pillar_id}
          goalId={addToContainer.goal_id}
          financialYear={filterYear}
          items={items}
          pillars={pillars}
          goals={goals}
          teams={teams}
          onClose={() => setAddToContainer(null)}
          onSaved={() => {
            setAddToContainer(null);
            loadAll();
          }}
        />
      )}

      {containerItem && (
        <CreateContainerModal
          item={containerItem}
          pillars={pillars}
          goals={goals}
          onClose={() => setContainerItem(null)}
          onSaved={() => {
            setContainerItem(null);
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
          onSaved={() => {
            setAddingOutcome(null);
            loadAll();
          }}
        />
      )}
      {selected && (
        <ItemDetailPanel
          item={selected}
          pillars={pillars}
          goals={goals}
          teams={teams}
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
