import { forwardRef, useRef, useLayoutEffect, useState, useEffect, useCallback } from "react";
import { motion, useMotionValue } from "framer-motion";

// --- Engine (ported from src/engine.ts) ---

function deriveStates(tasks) {
  const doneSet = new Set(tasks.filter(t => t.state === 'done').map(t => t.id));
  return tasks.map(t => {
    if (t.state === 'done') return t;
    if (t.state === 'waiting') return t;
    const allDepsDone = t.deps.every(d => doneSet.has(d));
    return { ...t, state: allDepsDone ? 'not started' : 'blocked' };
  });
}

function applyAction(tasks, taskId, action) {
  const state = action === 'done' ? 'done' : action === 'waiting' ? 'waiting' : 'not started';
  const updated = tasks.map(t => t.id === taskId ? { ...t, state } : t);
  return deriveStates(updated);
}

// --- API helpers ---

const API = 'http://localhost:3001/data';

const fetchTasks = async () => {
  const res = await fetch(API);
  if (!res.ok) return [];
  const data = await res.json();
  return data.tasks || [];
};

const saveTasks = async (tasks) => {
  await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tasks }),
  });
};

// --- State styling ---

const STATE_CLS = {
  blocked:  { dot: "bg-slate-300",   badge: "bg-slate-100 text-slate-500 border-slate-200",        card: "border-slate-200 shadow-sm" },
  "not started": { dot: "bg-blue-400",    badge: "bg-blue-50 text-blue-700 border-blue-200",           card: "border-blue-200 shadow-blue-100/50 shadow-md" },
  waiting:  { dot: "bg-amber-400",   badge: "bg-amber-50 text-amber-700 border-amber-200",        card: "border-amber-200 shadow-amber-100/50 shadow-md" },
  done:     { dot: "bg-emerald-400", badge: "bg-emerald-50 text-emerald-700 border-emerald-200", card: "border-emerald-200 shadow-emerald-100/50 shadow-md" },
};

const BADGE_CLS = {
  blocked:  "bg-slate-100 text-slate-600 border-slate-200",
  "not started": "bg-blue-50 text-blue-700 border-blue-200",
  waiting:  "bg-amber-50 text-amber-700 border-amber-200",
  done:     "bg-emerald-50 text-emerald-700 border-emerald-200",
};

const TYPE_LABELS = {
  approval: "Approve",
  verify:   "Verify",
  wait:     "Unblock",
};

// bezier midpoint at t=0.5: 0.125*P0 + 0.375*P1 + 0.375*P2 + 0.125*P3
function bezierMid(x0, y0, cx1, cy1, cx2, cy2, x1, y1) {
  return {
    mx: 0.125 * x0 + 0.375 * cx1 + 0.375 * cx2 + 0.125 * x1,
    my: 0.125 * y0 + 0.375 * cy1 + 0.375 * cy2 + 0.125 * y1,
  };
}

const NodeCard = forwardRef(function NodeCard({ title, state, type, isSelected, isLinkTarget, onClick, onAction, onDrag, onDragEnd, savedX, savedY }, ref) {
  const s = STATE_CLS[state] ?? STATE_CLS["blocked"];
  const actionLabel = TYPE_LABELS[type] || "Approve";

  const canAct = state === 'not started' || state === 'waiting';

  const x = useMotionValue(savedX || 0);
  const y = useMotionValue(savedY || 0);

  return (
    <motion.div
      ref={ref}
      onTap={onClick}
      drag={!isLinkTarget}
      dragMomentum={false}
      style={{ x, y }}
      onDrag={onDrag}
      onDragEnd={(e, info) => {
        onDragEnd?.(x.get(), y.get());
      }}
      onPointerDown={(e) => e.stopPropagation()}
      whileHover={{ scale: 1.015 }}
      whileDrag={{ scale: 1.05, zIndex: 50 }}
      transition={{ duration: 0.15 }}
      className={isLinkTarget ? "cursor-crosshair" : "cursor-grab active:cursor-grabbing"}
    >
      <div className={`relative w-52 rounded-2xl border-2 bg-white/95 backdrop-blur p-3.5 space-y-2.5 transition-shadow ${s.card} ${isSelected ? "ring-2 ring-blue-600 ring-offset-2" : ""} ${isLinkTarget ? "ring-2 ring-blue-400 ring-offset-2" : ""}`}>
        {isLinkTarget && (
          <div
            className="absolute inset-0 z-10 rounded-2xl cursor-crosshair"
            onPointerDown={(e) => e.stopPropagation()}
            onPointerUp={(e) => { e.stopPropagation(); onClick(); }}
          />
        )}
        <div className="flex items-start justify-between gap-2">
          <span className="text-sm font-semibold text-slate-800 tracking-tight leading-snug">{title}</span>
          <span className={`h-2.5 w-2.5 rounded-full flex-shrink-0 mt-0.5 ring-2 ring-white ${s.dot}`} />
        </div>
        <div className="flex items-center gap-2">
          <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium ${s.badge}`}>
            {state}
          </span>
        </div>
        {state !== 'done' && state !== 'blocked' && (
          <button
            onClick={(e) => { e.stopPropagation(); onAction(); }}
            className="w-full rounded-xl border-2 border-emerald-300 bg-emerald-50 hover:bg-emerald-500 hover:text-white hover:border-emerald-500 py-2 text-sm font-bold text-emerald-600 cursor-pointer transition-all shadow-sm"
          >
            Done
          </button>
        )}
      </div>
    </motion.div>
  );
});

function ConnectButton({ id, linkSource, onConnect }) {
  const isActive = linkSource === id;
  return (
    <button
      onPointerDown={(e) => { e.stopPropagation(); }}
      onPointerUp={(e) => { e.stopPropagation(); onConnect(id); }}
      title={isActive ? "Cancel connection" : "Draw arrow from this node"}
      className={`flex-shrink-0 w-9 h-9 rounded-full border-2 flex items-center justify-center text-base font-bold transition-all shadow-sm ${
        isActive
          ? "bg-blue-500 text-white border-blue-500 scale-110"
          : "bg-white border-blue-200 text-blue-400 hover:bg-blue-50 hover:border-blue-400 hover:text-blue-600"
      }`}
    >
      →
    </button>
  );
}

export default function WorkflowMockup() {
  const containerRef = useRef(null);
  const innerRef = useRef(null);
  const nodeEls = useRef({});
  const [edgePaths, setEdgePaths] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [linkSource, setLinkSource] = useState(null);
  const [selectedEdge, setSelectedEdge] = useState(null);
  const [layoutTick, setLayoutTick] = useState(0);

  // Backend state
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  // New node form
  const [hideCompleted, setHideCompleted] = useState(true);
  const [showNewNodeForm, setShowNewNodeForm] = useState(false);
  const [newNodeTask, setNewNodeTask] = useState("");
  const [newNodeSubtask, setNewNodeSubtask] = useState("");
  const [newNodeType, setNewNodeType] = useState("approval");
  const [newNodeDeps, setNewNodeDeps] = useState([]);

  const refFor = (id) => (el) => { nodeEls.current[id] = el; };
  const dragOffsets = useRef({});

  // --- Canvas pan & zoom ---
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const isPanning = useRef(false);
  const panStart = useRef({ x: 0, y: 0, panX: 0, panY: 0 });

  const handleCanvasPointerDown = (e) => {
    // Only pan on background clicks (not on cards/buttons)
    if (e.target !== e.currentTarget && !e.target.closest('[data-canvas-bg]')) return;
    isPanning.current = true;
    panStart.current = { x: e.clientX, y: e.clientY, panX: pan.x, panY: pan.y };
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const handleCanvasPointerMove = (e) => {
    if (!isPanning.current) return;
    setPan({
      x: panStart.current.panX + (e.clientX - panStart.current.x),
      y: panStart.current.panY + (e.clientY - panStart.current.y),
    });
  };

  const handleCanvasPointerUp = () => {
    isPanning.current = false;
  };

  const handleWheel = useCallback((e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.05 : 0.05;
    setZoom(z => Math.min(2, Math.max(0.3, z + delta)));
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, [handleWheel]);

  // --- Data helpers ---

  const updateTasks = useCallback(async (newTasks) => {
    const derived = deriveStates(newTasks);
    setTasks(derived);
    setLayoutTick(t => t + 1);
    await saveTasks(derived);
  }, []);

  // Default example data
  const defaultTasks = [
    { id: "deploy/helm rollout", task: "deploy", subtask: "helm rollout", type: "approval", deps: [], state: "not started" },
    { id: "verify/smoke test", task: "verify", subtask: "smoke test", type: "verify", deps: ["deploy/helm rollout"], state: "blocked" },
    { id: "verify/integration check", task: "verify", subtask: "integration check", type: "verify", deps: ["deploy/helm rollout"], state: "blocked" },
  ];

  // Fetch on mount
  useEffect(() => {
    fetchTasks().then(raw => {
      const data = raw.length > 0 ? raw : defaultTasks;
      setTasks(deriveStates(data));
      setLoading(false);
      setLayoutTick(t => t + 1);
    });
  }, []);

  // --- Derive columns dynamically ---

  const visibleTasks = hideCompleted ? tasks.filter(t => t.state !== 'done') : tasks;
  const taskGroups = [...new Set(visibleTasks.map(t => t.task))];
  const tasksByGroup = {};
  const nodeCol = {};
  taskGroups.forEach((group, i) => {
    tasksByGroup[group] = visibleTasks.filter(t => t.task === group);
    tasksByGroup[group].forEach(t => { nodeCol[t.id] = i; });
  });

  // --- Derive edges from deps ---

  const baseEdges = tasks.flatMap(t =>
    t.deps
      .filter(depId => tasks.some(x => x.id === depId))
      .map(depId => ({
        from: depId,
        to: t.id,
        type: nodeCol[depId] === nodeCol[t.id] ? 'v' : 'h',
        active: true,
        user: false,
      }))
  );

  // --- Actions ---

  const handleAction = (taskId) => {
    updateTasks(applyAction(tasks, taskId, 'done'));
  };

  const handleCardClick = (id) => {

    setSelectedEdge(null);
    if (linkSource && linkSource !== id) {
      // Add dep: target task now depends on linkSource
      const target = tasks.find(t => t.id === id);
      if (target && !target.deps.includes(linkSource)) {
        const newTasks = tasks.map(t =>
          t.id === id ? { ...t, deps: [...t.deps, linkSource] } : t
        );
        updateTasks(newTasks);
      }
      setLinkSource(null);
    } else {
      setSelectedId(id === selectedId ? null : id);
    }
  };

  const handleConnectClick = (id) => {

    if (linkSource === id) {
      setLinkSource(null);
    } else {
      setLinkSource(id);
      setSelectedId(id);
    }
  };

  const deleteEdge = (key) => {
    // key format: "dep-{from}-{to}"
    const parts = key.split('-');
    const fromId = parts.slice(1, -1).join('-');
    // Actually, we encode from/to with a separator
    const edge = baseEdges.find(e => `dep-${e.from}->${e.to}` === key);
    if (edge) {
      const newTasks = tasks.map(t =>
        t.id === edge.to ? { ...t, deps: t.deps.filter(d => d !== edge.from) } : t
      );
      updateTasks(newTasks);
    }
  };

  const deleteNode = (id) => {
    // Remove node and clean deps referencing it
    const newTasks = tasks
      .filter(t => t.id !== id)
      .map(t => ({ ...t, deps: t.deps.filter(d => d !== id) }));
    updateTasks(newTasks);
    if (selectedId === id) setSelectedId(null);
    if (linkSource === id) setLinkSource(null);
  };

  const addNode = () => {
    if (!newNodeTask.trim() || !newNodeSubtask.trim()) return;
    const id = `${newNodeTask.trim()}/${newNodeSubtask.trim()}`;
    if (tasks.some(t => t.id === id)) return; // duplicate
    const newTask = {
      id,
      task: newNodeTask.trim(),
      subtask: newNodeSubtask.trim(),
      type: newNodeType,
      deps: newNodeDeps,
      state: 'blocked',
    };
    updateTasks([...tasks, newTask]);
    setNewNodeTask("");
    setNewNodeSubtask("");
    setNewNodeType("approval");
    setNewNodeDeps([]);
    setShowNewNodeForm(false);
  };

  // --- Edge layout ---

  // Recalculate edges whenever the container resizes
  useLayoutEffect(() => {
    const ctr = containerRef.current;
    if (!ctr) return;
    const ro = new ResizeObserver(() => setLayoutTick((t) => t + 1));
    ro.observe(ctr);
    return () => ro.disconnect();
  }, []);

  useLayoutEffect(() => {
    const inner = innerRef.current;
    if (!inner) return;
    const cb = inner.getBoundingClientRect();
    const s = zoom; // account for scale in measurements

    const measure = (id) => {
      const el = nodeEls.current[id];
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return {
        left:   (r.left   - cb.left) / s,
        right:  (r.right  - cb.left) / s,
        top:    (r.top    - cb.top) / s,
        bottom: (r.bottom - cb.top) / s,
        cx:     ((r.left + r.right)  / 2 - cb.left) / s,
        cy:     ((r.top  + r.bottom) / 2 - cb.top) / s,
      };
    };

    const allEdges = baseEdges.map(e => ({ ...e, key: `dep-${e.from}->${e.to}` }));

    const computed = allEdges.map(({ from, to, type, active, user, key }) => {
      const s = measure(from), d = measure(to);
      if (!s || !d) return null;

      const GAP = 8;
      let path, mx, my;
      if (type === "v") {
        let x0, y0, x1, y1;
        if (s.bottom <= d.top) {
          [x0, y0, x1, y1] = [s.cx, s.bottom, d.cx, d.top - GAP];
        } else {
          [x0, y0, x1, y1] = [s.cx, s.top, d.cx, d.bottom + GAP];
        }
        const dxOff = Math.abs(x1 - x0);
        if (dxOff < 2) {
          path = `M ${x0} ${y0} L ${x1} ${y1}`;
          mx = (x0 + x1) / 2;
          my = (y0 + y1) / 2;
        } else {
          const dyOff = Math.abs(y1 - y0);
          const cp = Math.max(dyOff * 0.5, 30);
          const cx1 = x0, cy1 = y0 + (y1 > y0 ? cp : -cp);
          const cx2 = x1, cy2 = y1 + (y1 > y0 ? -cp : cp);
          path = `M ${x0} ${y0} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${x1} ${y1}`;
          ({ mx, my } = bezierMid(x0, y0, cx1, cy1, cx2, cy2, x1, y1));
        }
      } else if (type === "h") {
        let x0, y0, x1, y1, cx1, cy1, cx2, cy2;
        if (s.right <= d.left) {
          const dx = d.left - s.right;
          const cp = Math.max(dx * 0.4, 30);
          [x0, y0] = [s.right, s.cy];
          [x1, y1] = [d.left - GAP, d.cy];
          [cx1, cy1] = [x0 + cp, s.cy];
          [cx2, cy2] = [x1 - cp, d.cy];
        } else {
          const dx = s.left - d.right;
          const cp = Math.max(dx * 0.4, 30);
          [x0, y0] = [s.left, s.cy];
          [x1, y1] = [d.right + GAP, d.cy];
          [cx1, cy1] = [x0 - cp, s.cy];
          [cx2, cy2] = [x1 + cp, d.cy];
        }
        path = `M ${x0} ${y0} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${x1} ${y1}`;
        ({ mx, my } = bezierMid(x0, y0, cx1, cy1, cx2, cy2, x1, y1));
      } else {
        const ym = (s.bottom + d.top) / 2;
        path = `M ${s.cx} ${s.bottom} C ${s.cx} ${ym}, ${d.cx} ${ym}, ${d.cx} ${d.top - GAP}`;
        ({ mx, my } = bezierMid(s.cx, s.bottom, s.cx, ym, d.cx, ym, d.cx, d.top - GAP));
      }
      return { path, mx, my, type, active, user, key };
    }).filter(Boolean);

    setEdgePaths(computed);
  }, [tasks, layoutTick, zoom, pan]);

  // --- Derived view data ---

  const STATES = ['blocked', 'not started', 'waiting', 'done'];
  const counts = STATES.map((state) => ({
    state,
    n: tasks.filter((t) => t.state === state).length,
  }));

  const selectedNode = tasks.find((n) => n.id === selectedId);

  const renderNode = (id) => {
    const node = tasks.find((n) => n.id === id);
    if (!node) return null;
    return (
      <div className="group flex items-center gap-2">
        <NodeCard
          ref={refFor(id)}
          title={node.subtask}
          state={node.state}
          type={node.type}
          isSelected={selectedId === id && !linkSource}
          isLinkTarget={!!linkSource && linkSource !== id}
          onClick={() => handleCardClick(id)}
          onAction={() => handleAction(id)}
          onDrag={() => setLayoutTick(t => t + 1)}
          onDragEnd={(finalX, finalY) => {
            dragOffsets.current[id] = { x: finalX, y: finalY };
            setLayoutTick(t => t + 1);
          }}
          savedX={dragOffsets.current[id]?.x || 0}
          savedY={dragOffsets.current[id]?.y || 0}
        />
        <div className={`transition-opacity ${linkSource === id ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}>
          <ConnectButton id={id} linkSource={linkSource} onConnect={handleConnectClick} />
        </div>
      </div>
    );
  };

  // --- Loading state ---

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gradient-to-b from-blue-50 via-sky-50 to-white">
        <div className="text-xl text-slate-500 font-semibold">Loading workflow...</div>
      </div>
    );
  }

  // --- Column width calculation ---
  const colCount = taskGroups.length || 1;
  const colWidth = Math.floor(88 / colCount);

  return (
    <div className="h-screen overflow-hidden bg-gradient-to-b from-blue-50 via-sky-50 to-white p-4 flex flex-col gap-3">

      {/* Header */}
      <div className="flex-shrink-0 rounded-2xl border border-blue-100 bg-white/70 backdrop-blur shadow-md px-5 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-baseline gap-3">
            <h1 className="text-xl font-bold text-slate-800 tracking-tight">Workflow</h1>
            <p className="text-sm text-slate-400">{tasks.length} tasks &middot; {taskGroups.length} groups</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {counts.map(({ state, n }) => (
              <span key={state} className={`rounded-full border px-3 py-0.5 text-xs font-semibold ${BADGE_CLS[state]}`}>
                {n} {state}
              </span>
            ))}
            <button
              onClick={() => setHideCompleted(h => !h)}
              className={`ml-1 flex items-center gap-1.5 rounded-full border px-3 py-0.5 text-xs font-semibold transition-colors ${
                hideCompleted
                  ? "bg-emerald-100 text-emerald-700 border-emerald-300"
                  : "bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100"
              }`}
            >
              <span className={`inline-block w-3 h-3 rounded-sm border-2 transition-colors ${hideCompleted ? "bg-emerald-500 border-emerald-500" : "border-slate-300"}`} />
              Hide done
            </button>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="flex gap-4 flex-1 min-h-0">

        {/* Canvas card */}
        <div className="flex-1 min-h-0 rounded-2xl border border-blue-100 bg-white/80 backdrop-blur shadow-md p-3">
          <div
            ref={containerRef}
            onPointerDown={handleCanvasPointerDown}
            onPointerMove={handleCanvasPointerMove}
            onPointerUp={handleCanvasPointerUp}
            className="relative w-full h-full rounded-[28px] bg-gradient-to-b from-white to-blue-50/60 border border-blue-100/80 overflow-hidden cursor-grab active:cursor-grabbing"
            data-canvas-bg
          >
            <div ref={innerRef} style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transformOrigin: '0 0' }} className="relative w-fit h-fit">
            <svg className="absolute inset-0 z-20" style={{ pointerEvents: "none", width: '100%', height: '100%', overflow: 'visible' }}>
              <defs>
                <marker id="arr-green"  markerWidth="10" markerHeight="10" refX="7" refY="3.5" orient="auto" markerUnits="userSpaceOnUse">
                  <path d="M0,0 L7,3.5 L0,7 Z" fill="#34d399" />
                </marker>
                <marker id="arr-sky"    markerWidth="8"  markerHeight="8"  refX="6" refY="3"   orient="auto" markerUnits="userSpaceOnUse">
                  <path d="M0,0 L6,3 L0,6 Z" fill="#7dd3fc" />
                </marker>
                <marker id="arr-muted"  markerWidth="8"  markerHeight="8"  refX="6" refY="3"   orient="auto" markerUnits="userSpaceOnUse">
                  <path d="M0,0 L6,3 L0,6 Z" fill="#94a3b8" />
                </marker>
                <marker id="arr-blue"   markerWidth="10" markerHeight="10" refX="7" refY="3.5" orient="auto" markerUnits="userSpaceOnUse">
                  <path d="M0,0 L7,3.5 L0,7 Z" fill="#3b82f6" />
                </marker>
                <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
                  <feGaussianBlur stdDeviation="3" result="blur" />
                  <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                </filter>
              </defs>

              {edgePaths.map(({ path, key, type, active, user }) => {
                const isCross = type === "h";
                const stroke = user ? "#3b82f6" : active && isCross ? "#34d399" : active ? "#7dd3fc" : "#cbd5e1";
                const marker = user ? "url(#arr-blue)" : active && isCross ? "url(#arr-green)" : active ? "url(#arr-sky)" : "url(#arr-muted)";
                const animated = (active && isCross) || user;
                const isSelected = selectedEdge === key;
                return (
                  <g key={key}>
                    <path
                      d={path}
                      fill="none"
                      stroke="transparent"
                      strokeWidth={16}
                      style={{ pointerEvents: "stroke", cursor: "pointer" }}
                      onPointerDown={(e) => e.stopPropagation()}
                      onPointerUp={() => setSelectedEdge(isSelected ? null : key)}
                    />
                    <path
                      d={path}
                      fill="none"
                      stroke={isSelected ? "#ef4444" : stroke}
                      strokeWidth={isCross ? 3 : 2.5}
                      strokeLinecap="round"
                      strokeDasharray={undefined}
                      markerEnd={isSelected ? undefined : marker}
                      filter={animated && !isSelected ? "url(#glow)" : undefined}
                      style={{ pointerEvents: "none" }}
                    />
                  </g>
                );
              })}
            </svg>

            {/* Delete button — shown at midpoint of selected edge */}
            {edgePaths.filter(({ key }) => key === selectedEdge).map(({ mx, my, key }) => (
              <motion.button
                key={key}
                initial={{ opacity: 0, scale: 0.7 }}
                animate={{ opacity: 1, scale: 1 }}
                onPointerDown={(e) => e.stopPropagation()}
                onPointerUp={() => { deleteEdge(key); setSelectedEdge(null); }}
                title="Delete arrow"
                style={{ left: mx - 14, top: my - 14 }}
                className="absolute w-7 h-7 rounded-full bg-red-500 text-white hover:bg-red-600 flex items-center justify-center text-xs font-bold shadow-lg z-30 transition-colors"
              >
                ✕
              </motion.button>
            ))}

            {/* Dynamic columns */}
            <div className="relative z-10 flex gap-8 px-6 py-6" style={{ minWidth: `${taskGroups.length * 280}px` }}>
              {taskGroups.map((group) => (
                <div key={group} className="flex flex-col items-center gap-8" style={{ minWidth: 260 }}>
                  <div className="sticky top-0 z-10 flex flex-col items-center gap-2 bg-white/90 backdrop-blur rounded-2xl px-4 py-2 border border-blue-100/60 shadow-sm w-full">
                    <div className="text-base font-bold tracking-tight text-slate-700 capitalize">{group}</div>
                    <span className="rounded-full bg-blue-50 px-3 py-0.5 text-xs font-semibold text-blue-600 border border-blue-100">
                      {tasksByGroup[group].length} tasks
                    </span>
                  </div>
                  {(() => {
                    // Group sibling nodes (same deps) into rows
                    const groupTasks = tasksByGroup[group];
                    const rows = [];
                    const placed = new Set();
                    groupTasks.forEach(t => {
                      if (placed.has(t.id)) return;
                      // Find siblings: same deps within this group
                      const depsKey = JSON.stringify([...t.deps].sort());
                      const siblings = t.deps.length > 0
                        ? groupTasks.filter(s => !placed.has(s.id) && JSON.stringify([...s.deps].sort()) === depsKey)
                        : [t];
                      if (siblings.length > 1) {
                        rows.push(siblings);
                        siblings.forEach(s => placed.add(s.id));
                      } else {
                        rows.push([t]);
                        placed.add(t.id);
                      }
                    });
                    return rows.map((row, ri) =>
                      row.length === 1 ? (
                        <div key={row[0].id}>{renderNode(row[0].id)}</div>
                      ) : (
                        <div key={`row-${ri}`} className="flex gap-4 items-start">
                          {row.map(t => (
                            <div key={t.id}>{renderNode(t.id)}</div>
                          ))}
                        </div>
                      )
                    );
                  })()}
                </div>
              ))}
            </div>

            </div>{/* close transform wrapper */}

            {/* Zoom controls */}
            <div className="absolute bottom-3 right-3 z-30 flex items-center gap-1 bg-white/90 backdrop-blur rounded-xl border border-slate-200 shadow-sm px-1 py-1">
              <button onClick={() => setZoom(z => Math.max(0.3, z - 0.1))} className="w-7 h-7 rounded-lg hover:bg-slate-100 text-slate-500 font-bold text-sm">−</button>
              <button onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }} className="px-2 h-7 rounded-lg hover:bg-slate-100 text-xs font-medium text-slate-500 min-w-[3rem]">{Math.round(zoom * 100)}%</button>
              <button onClick={() => setZoom(z => Math.min(2, z + 0.1))} className="w-7 h-7 rounded-lg hover:bg-slate-100 text-slate-500 font-bold text-sm">+</button>
            </div>

            {/* Hint toast */}
            {linkSource && (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-blue-500/90 text-white text-sm font-semibold px-6 py-3 rounded-full shadow-lg pointer-events-none whitespace-nowrap z-50"
              >
                Click any node to draw an arrow from "{tasks.find(t => t.id === linkSource)?.subtask}"
              </motion.div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="w-72 flex-shrink-0 flex flex-col gap-4 overflow-y-auto">
          {/* New Node button / form */}
          {showNewNodeForm ? (
            <div className="rounded-3xl border border-blue-100 shadow-md bg-white/80 backdrop-blur p-6 space-y-4">
              <div className="text-sm font-semibold text-blue-600 uppercase tracking-wide">New Node</div>
              <div>
                <label className="text-sm text-slate-500 font-medium">Task group</label>
                <input
                  type="text"
                  list="task-groups"
                  placeholder="e.g. ingestion"
                  value={newNodeTask}
                  onChange={(e) => setNewNodeTask(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-blue-400 mt-1"
                  autoFocus
                />
                <datalist id="task-groups">
                  {taskGroups.map(g => <option key={g} value={g} />)}
                </datalist>
              </div>
              <div>
                <label className="text-sm text-slate-500 font-medium">Subtask name</label>
                <input
                  type="text"
                  placeholder="e.g. parse logs"
                  value={newNodeSubtask}
                  onChange={(e) => setNewNodeSubtask(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addNode()}
                  className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-blue-400 mt-1"
                />
              </div>
              <div>
                <label className="text-sm text-slate-500 font-medium">Type</label>
                <select
                  value={newNodeType}
                  onChange={(e) => setNewNodeType(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 mt-1"
                >
                  <option value="approval">approval</option>
                  <option value="verify">verify</option>
                  <option value="wait">wait</option>
                </select>
              </div>
              {tasks.length > 0 && (
                <div>
                  <label className="text-sm text-slate-500 font-medium">Dependencies</label>
                  <div className="max-h-40 overflow-y-auto space-y-1.5 mt-1.5">
                    {tasks.map(t => (
                      <label key={t.id} className="flex items-center gap-2 text-sm text-slate-600">
                        <input
                          type="checkbox"
                          checked={newNodeDeps.includes(t.id)}
                          onChange={(e) => {
                            if (e.target.checked) setNewNodeDeps(d => [...d, t.id]);
                            else setNewNodeDeps(d => d.filter(x => x !== t.id));
                          }}
                        />
                        {t.subtask} <span className="text-slate-400">({t.task})</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex gap-3">
                <button
                  onClick={addNode}
                  disabled={!newNodeTask.trim() || !newNodeSubtask.trim()}
                  className="flex-1 rounded-xl bg-blue-500 hover:bg-blue-600 disabled:bg-slate-200 disabled:text-slate-400 text-white text-sm font-semibold py-2.5 transition-colors shadow-sm"
                >
                  Create
                </button>
                <button
                  onClick={() => { setShowNewNodeForm(false); setNewNodeTask(""); setNewNodeSubtask(""); setNewNodeDeps([]); }}
                  className="rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 text-sm font-medium px-4 py-2.5 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowNewNodeForm(true)}
              className="rounded-3xl border-2 border-dashed border-blue-200 bg-white/60 hover:bg-blue-50/80 text-blue-500 hover:text-blue-600 text-base font-semibold py-4 transition-colors shadow-sm"
            >
              + New Node
            </button>
          )}

          {selectedId && selectedNode ? (
            <>
              <motion.div
                key={selectedId}
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                className="rounded-3xl border border-blue-100 shadow-md bg-white/80 backdrop-blur p-6 space-y-4"
              >
                <div className="text-sm font-semibold text-blue-600 uppercase tracking-wide">Selected Task</div>
                <div className="text-lg font-bold text-slate-800">{selectedNode.subtask}</div>
                <div className="text-sm text-slate-400">Group: {selectedNode.task}</div>
                <div className="text-sm text-slate-400">Type: {selectedNode.type}</div>
                <select
                  value={selectedNode.state === 'blocked' || selectedNode.state === 'not started' ? 'not started' : selectedNode.state}
                  onChange={(e) => {
                    const val = e.target.value;
                    const action = val === 'done' ? 'done' : val === 'waiting' ? 'waiting' : 'not started';
                    updateTasks(applyAction(tasks, selectedId, action));
                  }}
                  className={`rounded-full border px-3.5 py-1.5 text-sm font-medium outline-none cursor-pointer ${BADGE_CLS[selectedNode.state]}`}
                >
                  <option value="not started">not started</option>
                  <option value="waiting">waiting</option>
                  <option value="done">done</option>
                </select>
                {selectedNode.deps.length > 0 && (
                  <div>
                    <div className="text-sm text-slate-400 mb-1.5 font-medium">Dependencies:</div>
                    {selectedNode.deps.map(depId => {
                      const dep = tasks.find(t => t.id === depId);
                      return (
                        <div key={depId} className="text-sm text-slate-600 ml-3">
                          {dep ? `${dep.subtask} (${dep.task})` : depId}
                        </div>
                      );
                    })}
                  </div>
                )}
                {(selectedNode.state === 'not started' || selectedNode.state === 'waiting') && (
                  <button
                    onClick={() => handleAction(selectedId)}
                    className="w-full rounded-xl bg-blue-500 hover:bg-blue-600 text-white text-sm font-semibold py-2.5 transition-colors shadow-sm"
                  >
                    {selectedNode.state === 'waiting' ? 'Approve' : TYPE_LABELS[selectedNode.type] || 'Approve'}
                  </button>
                )}
                <button
                  onClick={() => deleteNode(selectedId)}
                  className="w-full rounded-xl bg-red-50 hover:bg-red-100 text-red-500 hover:text-red-600 text-sm font-medium py-2.5 transition-colors border border-red-200"
                >
                  Delete Node
                </button>
              </motion.div>

              {linkSource && (
                <div className="rounded-3xl border border-blue-100 shadow-md bg-white/80 backdrop-blur p-6 space-y-3">
                  <div className="text-sm font-semibold text-blue-500 uppercase tracking-wide">Arrow Mode</div>
                  <div className="text-base text-slate-500">Click any node to draw an arrow from this task.</div>
                  <button
                    onClick={() => setLinkSource(null)}
                    className="text-sm text-slate-400 hover:text-slate-600 underline mt-1"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="rounded-3xl border border-blue-100 shadow-md bg-white/80 backdrop-blur p-6 text-base text-slate-400 leading-relaxed">
              Click a node to view details. Use the arrow button to draw connections. Click an arrow to delete it.
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
