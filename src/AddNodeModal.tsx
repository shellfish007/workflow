import { useState } from 'react'
import { Task, TaskType } from './types'

interface Props {
  allTasks: Task[]
  onAdd: (task: Omit<Task, 'state'>) => void
  onClose: () => void
}

export default function AddNodeModal({ allTasks, onAdd, onClose }: Props) {
  const existingTaskNames = [...new Set(allTasks.map(t => t.task))]
  const [taskName, setTaskName] = useState('')
  const [subtask, setSubtask]   = useState('')
  const [type, setType]         = useState<TaskType>('execute')
  const [deps, setDeps]         = useState<string[]>([])
  const [error, setError]       = useState('')

  const submit = () => {
    const t = taskName.trim(), s = subtask.trim()
    if (!t || !s) return setError('Task and subtask are required')
    const id = `${t}/${s}`
    if (allTasks.some(x => x.id === id)) return setError('Subtask already exists in this task')
    onAdd({ id, task: t, subtask: s, type, deps })
    onClose()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
      <div style={{ background: '#1a1a2e', border: '1px solid #333', borderRadius: 10, padding: 24, width: 340, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ color: '#fff', fontWeight: 700, fontSize: 16 }}>Add Node</div>

        <Field label="Task (group)">
          <input value={taskName} onChange={e => setTaskName(e.target.value)}
            list="task-list" placeholder="e.g. dev" style={inp} />
          <datalist id="task-list">
            {existingTaskNames.map(n => <option key={n} value={n} />)}
          </datalist>
        </Field>
        <Field label="Subtask">
          <input value={subtask} onChange={e => setSubtask(e.target.value)} placeholder="e.g. smoke-test" style={inp} />
        </Field>
        <Field label="Type">
          <select value={type} onChange={e => setType(e.target.value as TaskType)} style={inp}>
            {(['execute','approval','verify','wait'] as TaskType[]).map(t => <option key={t}>{t}</option>)}
          </select>
        </Field>
        <Field label="Depends on">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 120, overflowY: 'auto' }}>
            {allTasks.map(t => (
              <label key={t.id} style={{ color: '#ccc', fontSize: 13, display: 'flex', gap: 6, alignItems: 'center' }}>
                <input type="checkbox" checked={deps.includes(t.id)}
                  onChange={e => setDeps(d => e.target.checked ? [...d, t.id] : d.filter(x => x !== t.id))} />
                {t.id}
              </label>
            ))}
          </div>
        </Field>

        {error && <div style={{ color: '#f66', fontSize: 13 }}>{error}</div>}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ ...btnStyle, background: '#333' }}>Cancel</button>
          <button onClick={submit} style={{ ...btnStyle, background: '#2a7' }}>Add</button>
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><div style={{ color: '#888', fontSize: 11, marginBottom: 4 }}>{label}</div>{children}</div>
}

const inp: React.CSSProperties = {
  width: '100%', background: '#0d0d1a', border: '1px solid #444', borderRadius: 4,
  color: '#fff', padding: '6px 8px', fontSize: 13, boxSizing: 'border-box'
}
const btnStyle: React.CSSProperties = {
  border: 'none', borderRadius: 6, padding: '7px 14px', color: '#fff', cursor: 'pointer', fontSize: 14
}
