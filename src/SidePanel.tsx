import { Task } from './types'

interface Props {
  tasks: Task[]
  onSelect: (id: string) => void
}

export default function SidePanel({ tasks, onSelect }: Props) {
  const runnable = tasks.filter(t => t.state === 'runnable')
  const waiting  = tasks.filter(t => t.state === 'waiting')

  return (
    <div style={{
      position: 'fixed', left: 0, top: 40, bottom: 0, width: 200,
      background: '#12122a', borderRight: '1px solid #333',
      padding: 12, overflowY: 'auto', zIndex: 5
    }}>
      <Section title="Runnable Now" tasks={runnable} color="#4f8" onSelect={onSelect} />
      <Section title="Waiting"      tasks={waiting}  color="#38f" onSelect={onSelect} />
    </div>
  )
}

function Section({ title, tasks, color, onSelect }: {
  title: string; tasks: Task[]; color: string; onSelect: (id: string) => void
}) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ color, fontSize: 11, fontWeight: 700, marginBottom: 6, textTransform: 'uppercase' }}>{title}</div>
      {tasks.length === 0
        ? <div style={{ color: '#555', fontSize: 12 }}>—</div>
        : tasks.map(t => (
            <div key={t.id} onClick={() => onSelect(t.id)}
              style={{ cursor: 'pointer', background: '#1e1e3a', borderRadius: 4, padding: '5px 8px', marginBottom: 4, fontSize: 13, color: '#ddd' }}>
              <span style={{ opacity: 0.6, marginRight: 4 }}>[{t.env}]</span>{t.title}
            </div>
          ))
      }
    </div>
  )
}
