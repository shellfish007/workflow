import { forwardRef, useRef, useLayoutEffect, useState } from "react";
import { motion } from "framer-motion";

const NODES_DATA = {
  taskA: [{ id: "a1", title: "Ingest Spark Logs", state: "done" }],
  taskB: [
    { id: "b1", title: "Parse Job Events", state: "runnable" },
    { id: "b2", title: "Await Code Review", state: "waiting" },
  ],
  taskC: [
    { id: "c1", title: "Unit Tests", state: "runnable" },
    { id: "c2", title: "Integration Tests", state: "blocked" },
    { id: "c3", title: "Deploy to Staging", state: "blocked" },
    { id: "c4", title: "Notify On-Call", state: "blocked" },
  ],
};

const NODE_INFO = {
  a1: { label: "Ingest Spark Logs",   desc: "Pull executor and driver logs from the Kubernetes cluster into the pipeline store." },
  b1: { label: "Parse Job Events",    desc: "Extract SparkApplication CRD events, stage metrics, and failure reasons from raw logs." },
  b2: { label: "Await Code Review",   desc: "Ticket SRE-1142: operator config change blocked on senior review in Gerrit." },
  c1: { label: "Unit Tests",          desc: "Run unit tests for the operator reconcile loop and webhook handlers. Must pass before integration tests can start." },
  c2: { label: "Integration Tests",   desc: "Run e2e suite against the staging k8s cluster — validating the operator reconcile loop." },
  c3: { label: "Deploy to Staging",   desc: "Helm upgrade to the bbg-data-eng namespace. Blocked until integration tests pass." },
  c4: { label: "Notify On-Call",      desc: "Page the Spark Platform on-call via PagerDuty once staging deploy succeeds." },
};

const NODE_COL = { a1: 0, b1: 1, b2: 1, c1: 2, c2: 2, c3: 2, c4: 2 };

const ALL_NODES_FLAT = [
  ...NODES_DATA.taskA,
  ...NODES_DATA.taskB,
  ...NODES_DATA.taskC,
];

const STATE_CLS = {
  done:     { dot: "bg-emerald-400", badge: "bg-emerald-100 text-emerald-700 border-emerald-200", card: "border-emerald-100" },
  runnable: { dot: "bg-blue-400",    badge: "bg-blue-100 text-blue-700 border-blue-200",           card: "border-blue-200" },
  waiting:  { dot: "bg-amber-400",   badge: "bg-amber-100 text-amber-700 border-amber-200",        card: "border-amber-100" },
  blocked:  { dot: "bg-slate-300",   badge: "bg-slate-100 text-slate-500 border-slate-200",        card: "border-slate-100" },
};

const BADGE_CLS = {
  runnable: "bg-blue-100 text-blue-700 border-blue-200",
  waiting:  "bg-amber-100 text-amber-700 border-amber-200",
  blocked:  "bg-slate-100 text-slate-600 border-slate-200",
  done:     "bg-emerald-100 text-emerald-700 border-emerald-200",
};

const BASE_EDGES = [
  { from: "a1", to: "b1", type: "h",   active: true  },
  { from: "b1", to: "b2", type: "v",   active: true  },
  { from: "b1", to: "c1", type: "h",   active: true  },
  { from: "b2", to: "c2", type: "h",   active: false },
  { from: "c1", to: "c2", type: "v",   active: false },
  { from: "c2", to: "c3", type: "fan", active: false },
  { from: "c2", to: "c4", type: "fan", active: false },
];

// bezier midpoint at t=0.5: 0.125*P0 + 0.375*P1 + 0.375*P2 + 0.125*P3
function bezierMid(x0, y0, cx1, cy1, cx2, cy2, x1, y1) {
  return {
    mx: 0.125 * x0 + 0.375 * cx1 + 0.375 * cx2 + 0.125 * x1,
    my: 0.125 * y0 + 0.375 * cy1 + 0.375 * cy2 + 0.125 * y1,
  };
}

const NodeCard = forwardRef(function NodeCard({ title, state, isSelected, isLinkTarget, onClick }, ref) {
  const s = STATE_CLS[state] ?? STATE_CLS.blocked;
  const dim = state === "blocked" && !isSelected && !isLinkTarget;
  return (
    <motion.div
      ref={ref}
      onClick={onClick}
      whileHover={{ y: -2, scale: 1.015 }}
      transition={{ duration: 0.15 }}
      style={{ opacity: dim ? 0.5 : 1 }}
      className={isLinkTarget ? "cursor-crosshair" : "cursor-pointer"}
    >
      <div className={`relative w-40 rounded-[22px] border bg-white/95 backdrop-blur p-4 space-y-3 shadow-sm ${s.card} ${isSelected ? "ring-2 ring-blue-600 ring-offset-2" : ""} ${isLinkTarget ? "ring-2 ring-blue-400 ring-offset-2" : ""}`}>
        {state === "runnable" && (
          <motion.div
            className="absolute inset-0 rounded-[22px] border-2 border-blue-300 pointer-events-none"
            animate={{ scale: [1, 1.07, 1], opacity: [0.5, 0, 0.5] }}
            transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut" }}
          />
        )}
        <div className="flex items-start justify-between gap-1">
          <span className="text-sm font-semibold text-slate-800 tracking-tight leading-tight">{title}</span>
          <span className={`h-2.5 w-2.5 rounded-full flex-shrink-0 mt-0.5 ${s.dot}`} />
        </div>
        <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${s.badge}`}>
          {state}
        </span>
        {state === "runnable" && (
          <button
            onClick={(e) => e.stopPropagation()}
            className="w-full rounded-xl bg-blue-500 hover:bg-blue-600 text-white text-xs font-semibold py-1.5 transition-colors shadow-sm"
          >
            Start
          </button>
        )}
        {state === "waiting" && (
          <button
            onClick={(e) => e.stopPropagation()}
            className="w-full rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium py-1.5 transition-colors"
          >
            Approve
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
      onClick={(e) => { e.stopPropagation(); onConnect(id); }}
      title={isActive ? "Cancel connection" : "Draw arrow from this node"}
      className={`flex-shrink-0 w-7 h-7 rounded-full border flex items-center justify-center text-sm font-bold transition-all shadow-sm ${
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
  const nodeEls = useRef({});
  const [edgePaths, setEdgePaths] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [linkSource, setLinkSource] = useState(null);
  const [userEdges, setUserEdges] = useState([]);
  const [deletedBaseKeys, setDeletedBaseKeys] = useState(new Set());

  const refFor = (id) => (el) => { nodeEls.current[id] = el; };

  const handleCardClick = (id) => {
    if (linkSource && linkSource !== id) {
      const fromCol = NODE_COL[linkSource];
      const toCol = NODE_COL[id];
      const type = fromCol === toCol ? "v" : "h";
      setUserEdges((prev) => [...prev, { from: linkSource, to: id, type, active: true, user: true }]);
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
    if (key.startsWith("base-")) {
      setDeletedBaseKeys((prev) => new Set([...prev, key]));
    } else {
      const idx = parseInt(key.replace("user-", ""), 10);
      setUserEdges((prev) => prev.filter((_, j) => j !== idx));
    }
  };

  useLayoutEffect(() => {
    const ctr = containerRef.current;
    if (!ctr) return;
    const cb = ctr.getBoundingClientRect();

    const measure = (id) => {
      const el = nodeEls.current[id];
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return {
        left:   r.left   - cb.left,
        right:  r.right  - cb.left,
        top:    r.top    - cb.top,
        bottom: r.bottom - cb.top,
        cx:     (r.left + r.right)  / 2 - cb.left,
        cy:     (r.top  + r.bottom) / 2 - cb.top,
      };
    };

    const activeBase = BASE_EDGES.filter((e) => !deletedBaseKeys.has(`base-${e.from}-${e.to}`));
    const allEdges = [
      ...activeBase.map((e) => ({ ...e, key: `base-${e.from}-${e.to}` })),
      ...userEdges.map((e, i) => ({ ...e, key: `user-${i}` })),
    ];

    const computed = allEdges.map(({ from, to, type, active, user, key }) => {
      const s = measure(from), d = measure(to);
      if (!s || !d) return null;

      let path, mx, my;
      if (type === "v") {
        let x0, y0, x1, y1;
        if (s.bottom <= d.top) {
          [x0, y0, x1, y1] = [s.cx, s.bottom, d.cx, d.top];
        } else {
          [x0, y0, x1, y1] = [s.cx, s.top, d.cx, d.bottom];
        }
        path = `M ${x0} ${y0} L ${x1} ${y1}`;
        mx = (x0 + x1) / 2;
        my = (y0 + y1) / 2;
      } else if (type === "h") {
        let x0, y0, x1, y1, cx1, cy1, cx2, cy2;
        if (s.right <= d.left) {
          const midx = (s.right + d.left) / 2;
          [x0, y0, cx1, cy1, cx2, cy2, x1, y1] = [s.right, s.cy, midx, s.cy, midx, d.cy, d.left, d.cy];
        } else {
          const midx = (d.right + s.left) / 2;
          [x0, y0, cx1, cy1, cx2, cy2, x1, y1] = [s.left, s.cy, midx, s.cy, midx, d.cy, d.right, d.cy];
        }
        path = `M ${x0} ${y0} C ${cx1} ${cy1}, ${cx2} ${cy2}, ${x1} ${y1}`;
        ({ mx, my } = bezierMid(x0, y0, cx1, cy1, cx2, cy2, x1, y1));
      } else {
        const ym = (s.bottom + d.top) / 2;
        path = `M ${s.cx} ${s.bottom} C ${s.cx} ${ym}, ${d.cx} ${ym}, ${d.cx} ${d.top}`;
        ({ mx, my } = bezierMid(s.cx, s.bottom, s.cx, ym, d.cx, ym, d.cx, d.top));
      }
      return { path, mx, my, type, active, user, key };
    }).filter(Boolean);

    setEdgePaths(computed);
  }, [userEdges, deletedBaseKeys]);

  const counts = ["runnable", "waiting", "blocked", "done"].map((state) => ({
    state,
    n: ALL_NODES_FLAT.filter((t) => t.state === state).length,
  }));

  const selectedNode = ALL_NODES_FLAT.find((n) => n.id === selectedId);

  const renderNode = (id) => {
    const node = ALL_NODES_FLAT.find((n) => n.id === id);
    return (
      <div className="flex items-center gap-2">
        <NodeCard
          ref={refFor(id)}
          title={node.title}
          state={node.state}
          isSelected={selectedId === id && !linkSource}
          isLinkTarget={!!linkSource && linkSource !== id}
          onClick={() => handleCardClick(id)}
        />
        <ConnectButton id={id} linkSource={linkSource} onConnect={handleConnectClick} />
      </div>
    );
  };

  return (
    <div className="h-screen overflow-hidden bg-gradient-to-b from-blue-50 via-sky-50 to-white p-6 flex flex-col gap-4">

      {/* Header */}
      <div className="flex-shrink-0 rounded-3xl border border-blue-100 bg-white/70 backdrop-blur shadow-sm px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-800">Spark Operator Workflow</h1>
            <p className="text-sm text-slate-500 mt-0.5">Bloomberg — spark-kubernetes-operator · PR #4821</p>
          </div>
          <div className="flex gap-2">
            {counts.map(({ state, n }) => (
              <span key={state} className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${BADGE_CLS[state]}`}>
                {n} {state}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="flex gap-6 flex-1 min-h-0">

        {/* Canvas card */}
        <div className="flex-1 min-h-0 rounded-[32px] border border-blue-100 bg-white/80 backdrop-blur shadow-sm p-6">
          <div
            ref={containerRef}
            className="relative w-full h-full rounded-[28px] bg-gradient-to-b from-white to-blue-50/60 border border-blue-100/80"
          >
            <svg className="absolute inset-0 w-full h-full pointer-events-none z-0">
              <defs>
                <marker id="arr-green"  markerWidth="10" markerHeight="10" refX="7" refY="3.5" orient="auto">
                  <path d="M0,0 L7,3.5 L0,7 Z" fill="#34d399" />
                </marker>
                <marker id="arr-sky"    markerWidth="8"  markerHeight="8"  refX="6" refY="3"   orient="auto">
                  <path d="M0,0 L6,3 L0,6 Z" fill="#7dd3fc" />
                </marker>
                <marker id="arr-muted"  markerWidth="8"  markerHeight="8"  refX="6" refY="3"   orient="auto">
                  <path d="M0,0 L6,3 L0,6 Z" fill="#94a3b8" />
                </marker>
                <marker id="arr-blue"   markerWidth="10" markerHeight="10" refX="7" refY="3.5" orient="auto">
                  <path d="M0,0 L7,3.5 L0,7 Z" fill="#3b82f6" />
                </marker>
                <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
                  <feGaussianBlur stdDeviation="3" result="blur" />
                  <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                </filter>
              </defs>

              {edgePaths.map(({ path, type, active, user }, i) => {
                const isCross = type === "h";
                const stroke = user ? "#3b82f6" : active && isCross ? "#34d399" : active ? "#7dd3fc" : "#cbd5e1";
                const marker = user ? "url(#arr-blue)" : active && isCross ? "url(#arr-green)" : active ? "url(#arr-sky)" : "url(#arr-muted)";
                const animated = (active && isCross) || user;
                return (
                  <g key={i}>
                    <path
                      d={path}
                      fill="none"
                      stroke={stroke}
                      strokeWidth={isCross ? 3 : 2.5}
                      strokeLinecap="round"
                      strokeDasharray={!active && !user ? "5 4" : undefined}
                      markerEnd={marker}
                      filter={animated ? "url(#glow)" : undefined}
                    />
                    {animated && (
                      <path d={path} fill="none" stroke={stroke} strokeWidth={3} strokeLinecap="round" strokeDasharray="8 24" opacity={0.6}>
                        <animate attributeName="stroke-dashoffset" from="32" to="0" dur="1.4s" repeatCount="indefinite" />
                      </path>
                    )}
                  </g>
                );
              })}
            </svg>

            {/* Edge delete buttons — positioned at midpoint of each edge */}
            {edgePaths.map(({ mx, my, key }) => (
              <button
                key={key}
                onClick={() => deleteEdge(key)}
                title="Delete arrow"
                style={{ left: mx - 10, top: my - 10 }}
                className="absolute w-5 h-5 rounded-full bg-white border border-slate-200 text-slate-400 hover:bg-red-50 hover:border-red-300 hover:text-red-500 flex items-center justify-center text-[10px] font-bold shadow-sm z-20 transition-colors opacity-0 hover:opacity-100 group-hover:opacity-100"
              >
                ✕
              </button>
            ))}

            {/* Hover area to reveal delete buttons */}
            {edgePaths.map(({ mx, my, key }) => (
              <div
                key={`hover-${key}`}
                style={{ left: mx - 14, top: my - 14 }}
                className="absolute w-7 h-7 z-10 group"
              >
                <button
                  onClick={() => deleteEdge(key)}
                  title="Delete arrow"
                  className="w-5 h-5 ml-1 mt-1 rounded-full bg-white border border-slate-200 text-slate-400 hover:bg-red-50 hover:border-red-300 hover:text-red-500 flex items-center justify-center text-[10px] font-bold shadow-sm transition-all opacity-0 hover:opacity-100"
                >
                  ✕
                </button>
              </div>
            ))}

            {/* Column A — Data Ingestion */}
            <div className="absolute left-[6%] top-[8%] z-10 flex flex-col items-center gap-4">
              <div className="text-lg font-semibold tracking-tight text-slate-700">Data Ingestion</div>
              <span className="rounded-full bg-white/90 px-3 py-1 text-xs font-medium text-blue-700 border border-blue-100 shadow-sm">source</span>
              {renderNode("a1")}
            </div>

            {/* Column B — Development */}
            <div className="absolute left-[36%] top-[8%] z-10 flex flex-col items-center gap-4">
              <div className="text-lg font-semibold tracking-tight text-slate-700">Development</div>
              <span className="rounded-full bg-white/90 px-3 py-1 text-xs font-medium text-blue-700 border border-blue-100 shadow-sm">linear stage</span>
              {renderNode("b1")}
              <div style={{ height: 36 }} />
              {renderNode("b2")}
            </div>

            {/* Column C — Validation & Deploy */}
            <div className="absolute left-[64%] top-[8%] z-10 flex flex-col items-center gap-4">
              <div className="text-lg font-semibold tracking-tight text-slate-700">Validation & Deploy</div>
              <span className="rounded-full bg-white/90 px-3 py-1 text-xs font-medium text-blue-700 border border-blue-100 shadow-sm">fan-out stage</span>
              {renderNode("c1")}
              <div style={{ height: 36 }} />
              {renderNode("c2")}
              <div className="pt-8 grid grid-cols-2 gap-8">
                {renderNode("c3")}
                {renderNode("c4")}
              </div>
            </div>

            {/* Hint toast */}
            {linkSource && (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-blue-500/90 text-white text-xs font-medium px-4 py-2 rounded-full shadow-md pointer-events-none whitespace-nowrap"
              >
                Click any node to draw an arrow from "{NODE_INFO[linkSource]?.label}"
              </motion.div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="w-72 flex-shrink-0 flex flex-col gap-4 overflow-y-auto">
          {selectedId && selectedNode ? (
            <>
              <motion.div
                key={selectedId}
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                className="rounded-3xl border border-blue-100 shadow-sm bg-white/80 backdrop-blur p-5 space-y-3"
              >
                <div className="text-xs font-medium text-blue-600 uppercase tracking-wide">Selected Task</div>
                <div className="font-semibold text-slate-800">{NODE_INFO[selectedId].label}</div>
                <div className="text-sm text-slate-500 leading-relaxed">{NODE_INFO[selectedId].desc}</div>
                <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-medium ${BADGE_CLS[selectedNode.state]}`}>
                  {selectedNode.state}
                </span>
              </motion.div>

              {linkSource && (
                <div className="rounded-3xl border border-blue-100 shadow-sm bg-white/80 backdrop-blur p-5 space-y-2">
                  <div className="text-xs font-medium text-blue-500 uppercase tracking-wide">Arrow Mode</div>
                  <div className="text-sm text-slate-500">Click any node to draw an arrow from this task.</div>
                  <button
                    onClick={() => setLinkSource(null)}
                    className="text-xs text-slate-400 hover:text-slate-600 underline mt-1"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="rounded-3xl border border-blue-100 shadow-sm bg-white/80 backdrop-blur p-5 text-sm text-slate-400">
              Click a node to view details. Use → to draw arrows. Hover an arrow to delete it.
            </div>
          )}

          {userEdges.length > 0 && (
            <div className="rounded-3xl border border-blue-100 shadow-sm bg-white/80 backdrop-blur p-5 space-y-3">
              <div className="text-xs font-medium text-blue-600 uppercase tracking-wide">Custom Arrows</div>
              {userEdges.map((e, i) => (
                <div key={i} className="flex items-center justify-between text-xs text-slate-600 gap-2">
                  <span className="truncate">{NODE_INFO[e.from]?.label} → {NODE_INFO[e.to]?.label}</span>
                  <button
                    onClick={() => deleteEdge(`user-${i}`)}
                    className="text-slate-300 hover:text-red-400 flex-shrink-0"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
