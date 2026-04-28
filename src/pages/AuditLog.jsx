import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

const EVENT_META = {
  item_moved: { label: "Feature moved", color: "#1E40AF", bg: "#DBEAFE" },
  item_resized: { label: "Feature resized", color: "#92400E", bg: "#FEF3C7" },
  item_updated: { label: "Feature updated", color: "#0F766E", bg: "#CCFBF1" },
  item_created: { label: "Feature added", color: "#166534", bg: "#DCFCE7" },
  item_deleted: { label: "Feature deleted", color: "#991B1B", bg: "#FEE2E2" },
  outcome_added: { label: "Outcome added", color: "#7C3AED", bg: "#EDE9FE" },
  outcome_deleted: {
    label: "Outcome deleted",
    color: "#BE185D",
    bg: "#FCE7F3",
  },
  kpi_updated: { label: "KPI updated", color: "#B45309", bg: "#FEF3C7" },
  kpi_deleted: { label: "KPI deleted", color: "#991B1B", bg: "#FEE2E2" },
  kpi_created: { label: "KPI created", color: "#166534", bg: "#DCFCE7" },
  dependency_created: {
    label: "Dependency added",
    color: "#ffffff",
    bg: "#0F172A",
  },
  dependency_removed: {
    label: "Dependency removed",
    color: "#ffffff",
    bg: "#0F172A",
  },
};

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

function weekToLabel(week) {
  if (week === undefined || week === null) return "—";
  const monthIdx = Math.floor(week / 4);
  const weekNum = (week % 4) + 1;
  const month = MONTHS[monthIdx] || "—";
  return `${month} W${weekNum}`;
}

function EventBadge({ type }) {
  const m = EVENT_META[type] || {
    label: type,
    color: "#475569",
    bg: "#F1F5F9",
  };
  return (
    <span
      style={{
        fontSize: "9px",
        fontWeight: "700",
        padding: "2px 7px",
        borderRadius: "3px",
        background: m.bg,
        color: m.color,
        letterSpacing: "0.05em",
        textTransform: "uppercase",
        flexShrink: 0,
      }}
    >
      {m.label}
    </span>
  );
}

function formatDate(ts) {
  const d = new Date(ts);
  return (
    d.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }) +
    " · " +
    d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })
  );
}

function ChangeSummary({ eventType, oldValue, newValue }) {
  if (!oldValue && !newValue) return null;
  if (eventType === "item_moved") {
    const quarterChanged = oldValue?.quarter !== newValue?.quarter;
    const durationChanged =
      oldValue?.duration_weeks !== newValue?.duration_weeks;
    const lines = [];

    if (quarterChanged) {
      lines.push(
        `Quarter: ${oldValue?.quarter || "unscheduled"} → ${newValue?.quarter || "unscheduled"}`,
      );
    }

    if (durationChanged) {
      const diff =
        (newValue?.duration_weeks ?? 0) - (oldValue?.duration_weeks ?? 0);
      const direction =
        diff > 0 ? `Extended by ${diff}` : `Shortened by ${Math.abs(diff)}`;
      lines.push(`${direction} week${Math.abs(diff) !== 1 ? "s" : ""}`);
    }

    if (
      oldValue?.start_week !== undefined &&
      newValue?.start_week !== undefined
    ) {
      lines.push(
        `Was: ${weekToLabel(oldValue.start_week)} → ${weekToLabel(oldValue.end_week)}`,
      );
      lines.push(
        `Now: ${weekToLabel(newValue.start_week)} → ${weekToLabel(newValue.end_week)}`,
      );
    }

    return (
      <div
        style={{
          fontSize: "11px",
          color: "var(--slate)",
          marginTop: "4px",
          lineHeight: "1.6",
        }}
      >
        {lines.map((l, i) => (
          <div key={i}>{l}</div>
        ))}
      </div>
    );
  }

  if (eventType === "item_resized") {
    const diff =
      (newValue?.duration_weeks ?? 0) - (oldValue?.duration_weeks ?? 0);
    const direction =
      diff > 0 ? `Extended by ${diff}` : `Shortened by ${Math.abs(diff)}`;
    return (
      <div
        style={{
          fontSize: "11px",
          color: "var(--slate)",
          marginTop: "4px",
          lineHeight: "1.6",
        }}
      >
        <div>
          {direction} week{Math.abs(diff) !== 1 ? "s" : ""}
        </div>
        <div>
          Was: {weekToLabel(oldValue?.start_week)} →{" "}
          {weekToLabel(oldValue?.end_week)}
        </div>
        <div>
          Now: {weekToLabel(newValue?.start_week)} →{" "}
          {weekToLabel(newValue?.end_week)}
        </div>
      </div>
    );
  }

      if (eventType === "dependency_created") {
      return (
        <div
          style={{
            fontSize: "11px",
            color: "var(--slate)",
            marginTop: "4px",
            lineHeight: "1.6",
          }}
        >
          <div>
            <strong>{newValue?.from}</strong> depends on{" "}
            <strong>{newValue?.to}</strong>
          </div>
        </div>
      );
    }

    if (eventType === "dependency_removed") {
      return (
        <div
          style={{
            fontSize: "11px",
            color: "var(--slate)",
            marginTop: "4px",
            lineHeight: "1.6",
          }}
        >
          <div>
            Removed: <strong>{oldValue?.from}</strong> →{" "}
            <strong>{oldValue?.to}</strong>
          </div>
        </div>
      );
    }

  if (eventType === "item_updated") {
    const changes = [];
    if (oldValue?.status !== newValue?.status) {
      changes.push(
        `Status: ${oldValue?.status?.replace("_", " ")} → ${newValue?.status?.replace("_", " ")}`,
      );
    }
    if (oldValue?.quarter !== newValue?.quarter) {
      changes.push(`Quarter: ${oldValue?.quarter} → ${newValue?.quarter}`);
    }
    if (changes.length === 0) return null;
    return (
      <div
        style={{
          fontSize: "11px",
          color: "var(--slate)",
          marginTop: "4px",
          lineHeight: "1.5",
        }}
      >
        {changes.map((c, i) => (
          <div key={i}>{c}</div>
        ))}
      </div>
    );
  }

  if (eventType === "kpi_updated") {
    const changes = [];
    if (oldValue?.kpi_name !== newValue?.kpi_name)
      changes.push(`KPI: ${oldValue?.kpi_name} → ${newValue?.kpi_name}`);
    if (oldValue?.kpi_target !== newValue?.kpi_target)
      changes.push(`Target: ${oldValue?.kpi_target} → ${newValue?.kpi_target}`);
    if (oldValue?.driver_statement !== newValue?.driver_statement)
      changes.push(`Focus area updated`);
    if (oldValue?.lead_metric_name !== newValue?.lead_metric_name)
      changes.push(
        `Measure: ${oldValue?.lead_metric_name} → ${newValue?.lead_metric_name}`,
      );
    if (changes.length === 0) return null;
    return (
      <div
        style={{
          fontSize: "11px",
          color: "var(--slate)",
          marginTop: "4px",
          lineHeight: "1.5",
        }}
      >
        {changes.map((c, i) => (
          <div key={i}>{c}</div>
        ))}
      </div>
    );
  }
  if (eventType === "kpi_created") {
    return (
      <div
        style={{
          fontSize: "11px",
          color: "var(--slate)",
          marginTop: "4px",
          lineHeight: "1.6",
        }}
      >
        {newValue?.kpi_name && <div>KPI: {newValue.kpi_name}</div>}
        {newValue?.driver_statement && (
          <div>Focus: {newValue.driver_statement}</div>
        )}
        {newValue?.lead_metric_name && (
          <div>Measuring: {newValue.lead_metric_name}</div>
        )}
      </div>
    );
  }

  if (eventType === "outcome_added") {
    return (
      <div
        style={{
          fontSize: "11px",
          color: "var(--slate)",
          marginTop: "4px",
          fontStyle: "italic",
        }}
      >
        "{newValue?.summary}"
      </div>
    );
  }

  return null;
}

export default function AuditLog() {
  const [logs, setLogs] = useState([]);
  const [pillars, setPillars] = useState([]);
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterPillar, setFilterPillar] = useState("");
  const [filterTeam, setFilterTeam] = useState("");
  const [filterType, setFilterType] = useState("");

  async function loadAll() {
    const [lr, pr, tr] = await Promise.all([
      supabase
        .from("audit_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200),
      supabase.from("pillars").select("*").order("sort_order"),
      supabase.from("teams").select("*").order("sort_order"),
    ]);
    setLogs(lr.data || []);
    setPillars(pr.data || []);
    setTeams(tr.data || []);
    setLoading(false);
  }

  useEffect(() => {
    loadAll();
  }, []);

  const filtered = logs.filter((l) => {
    if (filterPillar && l.pillar_id !== filterPillar) return false;
    if (filterTeam && l.team_id !== filterTeam) return false;
    if (filterType && l.event_type !== filterType) return false;
    return true;
  });

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
    <div style={{ maxWidth: "860px" }}>
      <div
        style={{
          marginBottom: "24px",
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
            Audit Log
          </h1>
          <p
            style={{
              fontSize: "13px",
              color: "var(--slate)",
              lineHeight: "1.6",
            }}
          >
            A record of significant changes to your roadmap, outcomes and KPIs.
          </p>
        </div>
        <button
          onClick={loadAll}
          style={{
            padding: "8px 16px",
            borderRadius: "8px",
            border: "1px solid var(--border)",
            background: "#fff",
            fontSize: "12px",
            color: "var(--slate)",
            cursor: "pointer",
            fontFamily: "DM Sans, sans-serif",
            flexShrink: 0,
            marginLeft: "16px",
          }}
        >
          Refresh
        </button>
      </div>

      {/* Filters */}
      <div
        style={{
          display: "flex",
          gap: "8px",
          marginBottom: "20px",
          flexWrap: "wrap",
        }}
      >
        <select
          style={sel}
          value={filterPillar}
          onChange={(e) => setFilterPillar(e.target.value)}
        >
          <option value="">All pillars</option>
          {pillars.map((p) => (
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
          {teams.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}
            </option>
          ))}
        </select>
        <select
          style={sel}
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
        >
          <option value="">All events</option>
          {Object.entries(EVENT_META).map(([value, { label }]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        {(filterPillar || filterTeam || filterType) && (
          <button
            onClick={() => {
              setFilterPillar("");
              setFilterTeam("");
              setFilterType("");
            }}
            style={{ ...sel, color: "var(--blue)", borderColor: "var(--blue)" }}
          >
            Clear filters
          </button>
        )}
      </div>

      {loading ? (
        <p style={{ fontSize: "13px", color: "var(--slate-light)" }}>
          Loading...
        </p>
      ) : filtered.length === 0 ? (
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
            No events yet
          </div>
          <p
            style={{
              fontSize: "13px",
              color: "var(--slate)",
              lineHeight: "1.6",
            }}
          >
            Changes to features, outcomes and KPIs will appear here.
            <br />
            Start by moving a feature on the roadmap or updating a KPI.
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
          {filtered.map((log, i) => {
            const prevLog = filtered[i - 1];
            const thisDate = new Date(log.created_at).toDateString();
            const prevDate = prevLog
              ? new Date(prevLog.created_at).toDateString()
              : null;
            const showDateDivider = thisDate !== prevDate;

            return (
              <div key={log.id}>
                {showDateDivider && (
                  <div
                    style={{
                      fontSize: "10px",
                      fontWeight: "700",
                      color: "var(--slate-light)",
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                      padding: "12px 0 6px",
                      borderBottom: "1px solid var(--border)",
                      marginBottom: "8px",
                    }}
                  >
                    {new Date(log.created_at).toLocaleDateString("en-GB", {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                    })}
                  </div>
                )}
                <div
                  style={{
                    display: "flex",
                    gap: "12px",
                    padding: "10px 14px",
                    background: "#fff",
                    border: "1px solid var(--border)",
                    borderRadius: "8px",
                    alignItems: "flex-start",
                  }}
                >
                  <EventBadge type={log.event_type} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: "13px",
                        fontWeight: "600",
                        color: "var(--navy)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {log.entity_name || log.entity_id}
                    </div>
                    <ChangeSummary
                      eventType={log.event_type}
                      oldValue={log.old_value}
                      newValue={log.new_value}
                    />
                  </div>
                  <div
                    style={{
                      fontSize: "10px",
                      color: "var(--slate-light)",
                      flexShrink: 0,
                      textAlign: "right",
                      marginTop: "2px",
                    }}
                  >
                    {formatDate(log.created_at)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
