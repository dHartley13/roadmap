import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import ItemDetailPanel from "../pages/ItemDetailPanel";

function ItemBox({ item, teams, highlighted, onSelect }) {
  const team = teams.find((t) => t.id === item.team_id);
  const isHighlighted = highlighted ? highlighted.has(item.id) : false;

  return (
    <div
      onClick={() => onSelect(item)}
      style={{
        padding: "10px 14px",
        borderRadius: "8px",
        cursor: "pointer",
        border: isHighlighted
          ? "2px solid var(--blue)"
          : "1px solid var(--border)",
        background: isHighlighted ? "var(--blue-light)" : "var(--bg)",
        Width: "160px",
        flexShrink: 0,
        transition: "all 0.15s",
      }}
      onMouseEnter={(e) =>
        (e.currentTarget.style.boxShadow = "0 2px 12px rgba(0,0,0,0.1)")
      }
      onMouseLeave={(e) => (e.currentTarget.style.boxShadow = "none")}
    >
      <div
        style={{
          fontSize: "12px",
          fontWeight: "600",
          color: "var(--navy)",
          lineHeight: "1.3",
          marginBottom: "6px",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          width: "160px",
        }}
      >
        {item.title}
      </div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "5px",
          flexWrap: "wrap",
        }}
      >
        {team && (
          <div style={{ display: "flex", alignItems: "center", gap: "3px" }}>
            <div
              style={{
                width: "6px",
                height: "6px",
                borderRadius: "50%",
                background: team.colour,
                flexShrink: 0,
              }}
            />
            <span style={{ fontSize: "10px", color: "var(--slate-light)" }}>
              {team.name}
            </span>
          </div>
        )}
        {item.quarter && (
          <span style={{ fontSize: "10px", color: "var(--slate-light)" }}>
            {item.quarter}
          </span>
        )}
      </div>
    </div>
  );
}

function TreeNode({ node, teams, highlighted, onSelect }) {
  if (!node) return null;
  const hasChildren = node.children.length > 0;

  return (
    <div style={{ display: "flex", alignItems: "flex-start" }}>
      {/* This node */}
      <ItemBox
        item={node.item}
        teams={teams}
        highlighted={highlighted}
        onSelect={onSelect}
      />

      {/* Children — each gets its own arrow */}
      {hasChildren && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "8px",
            marginLeft: "0",
          }}
        >
          {node.children.map((child, ci) => (
            <div
              key={child.item.id}
              style={{ display: "flex", alignItems: "center" }}
            >
              {/* Arrow per child */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  padding: "0 8px",
                  color: "var(--slate-light)",
                  fontSize: "16px",
                  flexShrink: 0,
                  marginTop: "0",
                }}
              >
                →
              </div>
              {/* Child subtree */}
              <TreeNode
                node={child}
                teams={teams}
                highlighted={highlighted}
                onSelect={onSelect}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Dependencies() {
  const [items, setItems] = useState([]);
  const [teams, setTeams] = useState([]);
  const [pillars, setPillars] = useState([]);
  const [goals, setGoals] = useState([]);
  const [outcomes, setOutcomes] = useState([])
  const [deps, setDeps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState(null);
  const [searchResults, setSearchResults] = useState([]);

  async function loadAll() {
    const [ir, tr, pr, gr, dr, or] = await Promise.all([
      supabase.from("roadmap_items").select("*"),
      supabase.from("teams").select("*"),
      supabase.from("pillars").select("*"),
      supabase.from("goals").select("*"),
      supabase.from("dependencies").select("*"),
      supabase.from("quarterly_outcomes").select("*"),
    ]);
    const teamsData = tr.data || [];
    const itemsData = (ir.data || []).map((item) => ({
      ...item,
      team_colour: teamsData.find((t) => t.id === item.team_id)?.colour || null,
      team_name: teamsData.find((t) => t.id === item.team_id)?.name || null,
    }));
    setItems(itemsData);
    setTeams(teamsData);
    setPillars(pr.data || []);
    setGoals(gr.data || []);
    setDeps(dr.data || []);
    setOutcomes(or.data || []);
    setLoading(false);
  }

  useEffect(() => {
    loadAll();
  }, []);

  //Support dependencies go to option in audit log
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const q = params.get('q')
    if (q) setSearch(q)
  }, [])

  // Fuzzy search
  useEffect(() => {
    if (!search.trim()) {
      setSearchResults([]);
      return;
    }
    const words = search.toLowerCase().split(" ").filter(Boolean);
    setSearchResults(
      items
        .filter((item) =>
          words.every((w) => item.title.toLowerCase().includes(w)),
        )
        .slice(0, 8),
    );
  }, [search, items]);

  // Build tree structure from dependencies
  function buildTree(itemId, visited = new Set()) {
    if (visited.has(itemId)) return null;
    visited.add(itemId);
    const item = items.find((i) => i.id === itemId);
    if (!item) return null;
    const outgoing = deps.filter((d) => d.from_item_id === itemId);
    const children = outgoing
      .map((d) => buildTree(d.to_item_id, new Set(visited)))
      .filter(Boolean);
    return { item, children };
  }

  function buildTrains() {
    if (deps.length === 0) return [];
    const itemsWithDeps = new Set([
      ...deps.map((d) => d.from_item_id),
      ...deps.map((d) => d.to_item_id),
    ]);
    const hasIncoming = new Set(deps.map((d) => d.to_item_id));
    const roots = [...itemsWithDeps].filter((id) => !hasIncoming.has(id));
    const startIds =
      roots.length > 0
        ? roots
        : [...itemsWithDeps].filter((id) =>
            deps.some((d) => d.from_item_id === id),
          );

    function countNodes(node) {
      if (!node) return 0;
      return 1 + node.children.reduce((sum, c) => sum + countNodes(c), 0);
    }

    function collectTeams(node) {
      if (!node) return new Set();
      const teams = new Set(node.item.team_id ? [node.item.team_id] : []);
      node.children.forEach((c) =>
        collectTeams(c).forEach((t) => teams.add(t)),
      );
      return teams;
    }

    return startIds
      .map((id) => {
        const tree = buildTree(id);
        if (!tree) return null;
        return {
          tree,
          nodeCount: countNodes(tree),
          teamCount: collectTeams(tree).size,
        };
      })
      .filter(Boolean)
      .sort((a, b) => b.nodeCount - a.nodeCount);
  }

  const trains = buildTrains();

  const highlighted = search.trim()
    ? new Set(searchResults.map((r) => r.id))
    : null;

  return (
    <div style={{ maxWidth: "1100px" }}>
      {/* Header */}
      <div style={{ marginBottom: "24px" }}>
        <h1
          className="font-display"
          style={{
            fontSize: "28px",
            color: "var(--navy)",
            marginBottom: "6px",
          }}
        >
          Dependencies
        </h1>
        <p
          style={{ fontSize: "13px", color: "var(--slate)", lineHeight: "1.6" }}
        >
          Dependency trains — ordered by size. Click any feature to view its
          detail.
        </p>
      </div>

      {/* Search */}
      <div
        style={{
          marginBottom: "24px",
          position: "relative",
          maxWidth: "400px",
        }}
      >
        <input
          placeholder="Search features..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            width: "100%",
            padding: "9px 14px",
            border: "1px solid var(--border)",
            borderRadius: "8px",
            fontSize: "13px",
            fontFamily: "Inter, sans-serif",
            color: "var(--navy)",
            background: "#fff",
            outline: "none",
          }}
        />
        {search && (
          <button
            onClick={() => setSearch("")}
            style={{
              position: "absolute",
              right: "10px",
              top: "50%",
              transform: "translateY(-50%)",
              border: "none",
              background: "transparent",
              color: "var(--slate-light)",
              cursor: "pointer",
              fontSize: "14px",
            }}
          >
            ✕
          </button>
        )}
        {searchResults.length > 0 && (
          <div
            style={{
              position: "absolute",
              top: "100%",
              left: 0,
              right: 0,
              marginTop: "4px",
              background: "#fff",
              border: "1px solid var(--border)",
              borderRadius: "8px",
              boxShadow: "0 8px 24px rgba(0,0,0,0.1)",
              zIndex: 10,
              overflow: "hidden",
            }}
          >
            {searchResults.map((result) => {
              const team = teams.find((t) => t.id === result.team_id);
              return (
                <div
                  key={result.id}
                  onClick={() => {
                    setSelected(result);
                    setSearch("");
                  }}
                  style={{
                    padding: "10px 14px",
                    cursor: "pointer",
                    borderBottom: "1px solid var(--border)",
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.background = "var(--bg)")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.background = "#fff")
                  }
                >
                  <div
                    style={{
                      fontSize: "13px",
                      fontWeight: "600",
                      color: "var(--navy)",
                    }}
                  >
                    {result.title}
                  </div>
                  <div
                    style={{ display: "flex", gap: "8px", marginTop: "2px" }}
                  >
                    {team && (
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "4px",
                        }}
                      >
                        <div
                          style={{
                            width: "6px",
                            height: "6px",
                            borderRadius: "50%",
                            background: team.colour,
                          }}
                        />
                        <span
                          style={{
                            fontSize: "11px",
                            color: "var(--slate-light)",
                          }}
                        >
                          {team.name}
                        </span>
                      </div>
                    )}
                    {result.quarter && (
                      <span
                        style={{
                          fontSize: "11px",
                          color: "var(--slate-light)",
                        }}
                      >
                        {result.quarter}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {loading ? (
        <p style={{ fontSize: "13px", color: "var(--slate-light)" }}>
          Loading...
        </p>
      ) : trains.length === 0 ? (
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
            No dependencies yet
          </div>
          <p
            style={{
              fontSize: "13px",
              color: "var(--slate)",
              lineHeight: "1.6",
            }}
          >
            Add dependencies to features from the item detail panel on the
            roadmap.
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {trains.map((train, ti) => (
            <div
              key={ti}
              style={{
                background: "#fff",
                border: "1px solid var(--border)",
                borderRadius: "10px",
                overflow: "hidden",
              }}
            >
              {/* Train header */}
              <div
                style={{
                  padding: "10px 16px",
                  background: "var(--navy)",
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                }}
              >
                <span
                  style={{ fontSize: "11px", fontWeight: "700", color: "#fff" }}
                >
                  Dependency train {ti + 1}
                </span>
                <span
                  style={{
                    fontSize: "10px",
                    color: "var(--slate-light)",
                    background: "rgba(255,255,255,0.1)",
                    padding: "2px 8px",
                    borderRadius: "99px",
                  }}
                >
                  {train.nodeCount} {train.nodeCount === 1 ? "item" : "items"}
                </span>
                <span
                  style={{
                    fontSize: "10px",
                    color: "var(--slate-light)",
                    background: "rgba(255,255,255,0.1)",
                    padding: "2px 8px",
                    borderRadius: "99px",
                  }}
                >
                  {train.teamCount} {train.teamCount === 1 ? "team" : "teams"}
                </span>
              </div>

              {/* Tree */}
              <div style={{ padding: "16px", overflowX: "auto" }}>
                <TreeNode
                  node={train.tree}
                  teams={teams}
                  highlighted={highlighted}
                  onSelect={setSelected}
                  isRoot={true}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Item detail panel */}
      {selected && (
        <ItemDetailPanel
          item={selected}
          pillars={pillars}
          goals={goals}
          outcomes={outcomes}
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
