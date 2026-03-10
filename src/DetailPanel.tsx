import { useState } from 'react'
import { Task, TaskType } from './types'

interface Props {
  task: Task | null
  allTasks: Task[]
  onClose: () => void
  onAction: (id: string, action: 'done' | 'waiting' | 'unblock') => void
  onEdit: (task: Omit<Task, 'state'>) => void
}

export default function DetailPanel({ task, allTasks, onClose, onAction, onEdit }: Props) {
  const [editing, setEditing] = useState(false)

  if (!task) return null
  if (editing) return (
    <EditForm task={task} allTasks={allTasks}
      onSave={t => { onEdit(t); setEditing(false) }}
      onCancel={() => setEditing(false)} />
  )

  return (
    <div style={panel}>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <button onClick={() => setEditing(true)} style={btn('#333')}>Edit</button>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#aaa', cursor: 'pointer', fontSize: 18 }}>✕</button>
      </div>
      <div style={{ color: '#fff', fontSize: 16, fontWeight: 600 }}>{task.task}</div>
      <div style={{ color: '#aaa', fontSize: 13 }}>{task.subtask}</div>
      <div style={{ display: 'flex', gap: 6 }}>
        <span style={{ background: '#333', color: '#ccc', padding: '2px 6px', borderRadius: 4, fontSize: 12 }}>{task.type}</span>
      </div>
      <div style={{ color: '#aaa', fontSize: 14 }}>State: <b style={{ color: '#fff' }}>{task.state}</b></div>
      <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {task.state !== 'done' && (
          <button onClick={() => onAction(task.id, 'done')} style={btn('#2a7')}>Mark Done</button>
        )}
        {(task.state === 'runnable' || task.state === 'blocked') && (
          <button onClick={() => onAction(task.id, 'waiting')} style={btn('#38f')}>Mark Waiting</button>
        )}
        {task.state === 'waiting' && (
          <button onClick={() => onAction(task.id, 'done')} style={btn('#a4f')}>Approval Received → Done</button>
        )}
      </div>
    </div>
  )
}

function EditForm({ task, allTasks, onSave, onCancel }: {
  task: Task; allTasks: Task[]
  onSave: (t: Omit<Task, 'state'>) => void
  onCancel: () => void
}) {
  const existingTaskNames = [...new Set(allTasks.map(t => t.task))]
  const [taskName, setTaskName] = useState(task.task)
  const [subtask, setSubtask]   = useState(task.subtask)
  const [type, setType]         = useState<TaskType>(task.type)
  const [deps, setDeps]         = useState<string[]>(task.deps)
  const [error, setError]       = useState('')

  const others = allTasks.filter(t => t.id !== task.id)

  const save = () => {
    const t = taskName.trim(), s = subtask.trim()
    if (!t || !s) return setError('Task and subtask are required')
    const newId = `${t}/${s}`
    // only block if the new id already exists and it's not the current node
    if (newId !== task.id && others.some(x => x.id === newId)) return setError('Subtask already exists in this task')
    onSave({ id: newId, task: t, subtask: s, type, deps })
  }

  return (
    <div style={panel}>
      <div style={{ color: '#fff', fontWeight: 700 }}>Edit node</div>

      <label style={lbl}>Task
        <input value={taskName} onChange={e => setTaskName(e.target.value)}
          list="edit-task-list" style={inp} />
        <datalist id="edit-task-list">
          {existingTaskNames.map(n => <option key={n} value={n} />)}
        </datalist>
      </label>
      <label style={lbl}>Subtask
        <input value={subtask} onChange={e => setSubtask(e.target.value)} style={inp} />
      </label>
      <label style={lbl}>Type
        <select value={type} onChange={e => setType(e.target.value as TaskType)} style={inp}>
          {(['execute','approval','verify','wait'] as TaskType[]).map(t => <option key={t}>{t}</option>)}
        </select>
      </label>
      <div style={lbl}>Deps
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, maxHeight: 140, overflowY: 'auto', marginTop: 4 }}>
          {others.map(t => (
            <label key={t.id} style={{ color: '#ccc', fontSize: 13, display: 'flex', gap: 6 }}>
              <input type="checkbox" checked={deps.includes(t.id)}
                onChange={e => setDeps(d => e.target.checked ? [...d, t.id] : d.filter(x => x !== t.id))} />
              {t.id}
            </label>
          ))}
        </div>
      </div>

      {error && <div style={{ color: '#f66', fontSize: 12 }}>{error}</div>}
      <div style={{ display: 'flex', gap: 8, marginTop: 'auto' }}>
        <button onClick={onCancel} style={btn('#333')}>Cancel</button>
        <button onClick={save} style={btn('#2a7')}>Save</button>
      </div>
    </div>
  )
}

const panel: React.CSSProperties = {
  position: 'fixed', right: 0, top: 40, bottom: 0, width: 260,
  background: '#1a1a2e', borderLeft: '1px solid #333',
  padding: 16, display: 'flex', flexDirection: 'column', gap: 10, zIndex: 10
}
const inp: React.CSSProperties = {
  width: '100%', background: '#0d0d1a', border: '1px solid #444',
  borderRadius: 4, color: '#fff', padding: '5px 8px', fontSize: 13, boxSizing: 'border-box'
}
const lbl: React.CSSProperties = { color: '#888', fontSize: 11, display: 'flex', flexDirection: 'column', gap: 3 }
function btn(bg: string) {
  return { background: bg, color: '#fff', border: 'none', borderRadius: 6, padding: '8px 12px', cursor: 'pointer', fontSize: 14, flex: 1 }
}
