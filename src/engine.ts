import { Task, TaskState, Workflow } from './types'

// Derive state for each task based on its deps.
// Rules:
//   - if all deps are done → runnable (unless already done or waiting)
//   - if any dep is not done → blocked (unless already done)
//   - waiting and done states are sticky (set by user action)
export function deriveStates(tasks: Task[]): Task[] {
  const doneSet = new Set(tasks.filter(t => t.state === 'done').map(t => t.id))

  return tasks.map(t => {
    if (t.state === 'done') return t
    if (t.state === 'waiting') return t

    const allDepsDone = t.deps.every(d => doneSet.has(d))
    const derived: TaskState = allDepsDone ? 'runnable' : 'blocked'
    return { ...t, state: derived }
  })
}

// Apply a user action to a task and re-derive all states.
export function applyAction(
  workflow: Workflow,
  taskId: string,
  action: 'done' | 'waiting' | 'unblock'
): Workflow {
  const updated = workflow.tasks.map(t => {
    if (t.id !== taskId) return t
    const state: TaskState =
      action === 'done' ? 'done' : action === 'waiting' ? 'waiting' : 'runnable'
    return { ...t, state }
  })
  return { tasks: deriveStates(updated) }
}
