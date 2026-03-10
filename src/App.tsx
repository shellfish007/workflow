import { useState, useEffect } from 'react'
import ReactFlow, {
  Background, Controls, Node, Edge, MarkerType, useNodesState, useEdgesState
} from 'reactflow'
import 'reactflow/dist/style.css'
import { useWorkflow } from './useWorkflow'
import { Task } from './types'
import DetailPanel from './DetailPanel'
import SidePanel from './SidePanel'
import AddNodeModal from './AddNodeModal'

const STATE_BORDER: Record<string, string> = {
  blocked: '#555', runnable: '#4f8', waiting: '#38f', done: '#888'
}

function toNodes(tasks: Task[]): Node[] {
  // column per unique task group, row per position within that group
  const taskOrder = [...new Set(tasks.map(t => t.task))]
  const rowIndex: Record<string, number> = {}
  return tasks.map(t => {
    const col = taskOrder.indexOf(t.task)
    const row = rowIndex[t.task] ?? 0
    rowIndex[t.task] = row + 1
    return {
      id: t.id,
      position: { x: col * 220 + 240, y: row * 120 + 60 },
      data: { label: <NodeCard task={t} /> },
      style: {
        background: '#1a1a2e',
        border: `2px solid ${STATE_BORDER[t.state]}`,
        borderRadius: 8,
        padding: 0,
        width: 160,
      }
    }
  })
}

function toEdges(tasks: Task[]): Edge[] {
  return tasks.flatMap(t =>
    t.deps.map(dep => ({
      id: `${dep}->${t.id}`,
      source: dep,
      target: t.id,
      markerEnd: { type: MarkerType.ArrowClosed },
      style: { stroke: '#444' }
    }))
  )
}

function NodeCard({ task }: { task: Task }) {
  return (
    <div style={{ padding: '8px 12px' }}>
      <div style={{ fontSize: 12, color: '#888' }}>{task.task}</div>
      <div style={{ fontSize: 13, fontWeight: 600, color: '#fff', marginTop: 2 }}>{task.subtask}</div>
      <div style={{ fontSize: 11, color: '#666', marginTop: 1 }}>{task.type}</div>
      <div style={{ fontSize: 11, marginTop: 4, color: STATE_BORDER[task.state], fontWeight: 600 }}>
        {task.state}
      </div>
    </div>
  )
}

export default function App() {
  const { workflow, dispatch, addTask, editTask, reset } = useWorkflow()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showAdd, setShowAdd] = useState(false)

  const [nodes, setNodes, onNodesChange] = useNodesState(toNodes(workflow.tasks))
  const [edges, , onEdgesChange] = useEdgesState(toEdges(workflow.tasks))

  useEffect(() => {
    setNodes(toNodes(workflow.tasks))
  }, [workflow.tasks, setNodes])

  const tasks = workflow.tasks
  const counts = {
    runnable: tasks.filter(t => t.state === 'runnable').length,
    waiting:  tasks.filter(t => t.state === 'waiting').length,
    blocked:  tasks.filter(t => t.state === 'blocked').length,
    done:     tasks.filter(t => t.state === 'done').length,
  }

  const selectedTask = selectedId ? tasks.find(t => t.id === selectedId) ?? null : null

  return (
    <div style={{ height: '100vh', background: '#0d0d1a', fontFamily: 'system-ui, sans-serif' }}>
      {/* Top bar */}
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, height: 40, zIndex: 20,
        background: '#12122a', borderBottom: '1px solid #333',
        display: 'flex', alignItems: 'center', gap: 24, padding: '0 16px'
      }}>
        <span style={{ color: '#fff', fontWeight: 700, fontSize: 14 }}>Rollout DAG</span>
        {Object.entries(counts).map(([state, n]) => (
          <span key={state} style={{ color: STATE_BORDER[state], fontSize: 13 }}>
            {n} {state}
          </span>
        ))}
        <span style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <button onClick={() => setShowAdd(true)} style={{ background: '#2a7', border: 'none', color: '#fff', borderRadius: 5, padding: '4px 10px', cursor: 'pointer', fontSize: 13 }}>+ Add Node</button>
          <button onClick={reset} style={{ background: '#333', border: 'none', color: '#aaa', borderRadius: 5, padding: '4px 10px', cursor: 'pointer', fontSize: 13 }}>Reset</button>
        </span>
      </div>

      <SidePanel tasks={tasks} onSelect={setSelectedId} />

      {/* Main graph */}
      <div style={{ marginLeft: 200, marginTop: 40, marginRight: selectedTask ? 260 : 0, height: 'calc(100vh - 40px)' }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={(_, node) => setSelectedId(node.id)}
          fitView
          fitViewOptions={{ padding: 0.3 }}
        >
          <Background color="#222" gap={20} />
          <Controls style={{ background: '#1a1a2e' }} />
        </ReactFlow>
      </div>

      {showAdd && (
        <AddNodeModal
          allTasks={tasks}
          onAdd={addTask}
          onClose={() => setShowAdd(false)}
        />
      )}

      <DetailPanel
        task={selectedTask}
        allTasks={tasks}
        onClose={() => setSelectedId(null)}
        onAction={(id, action) => { dispatch(id, action); setSelectedId(null) }}
        onEdit={editTask}
      />
    </div>
  )
}
