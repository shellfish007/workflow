import { useState, useEffect, useRef } from 'react'
import { Workflow, Task, TaskState } from './types'
import { applyAction, deriveStates } from './engine'
import { seedTasks } from './seed'

const API = 'http://localhost:3001/data'

async function loadFromFile(): Promise<Workflow> {
  try {
    const res = await fetch(API)
    if (res.ok) return await res.json()
  } catch {}
  return { tasks: [] }
}

async function saveToFile(w: Workflow) {
  await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(w),
  }).catch(() => {})
}

export function useWorkflow() {
  const [workflow, setWorkflow] = useState<Workflow>({ tasks: [] })
  const ready = useRef(false)

  // Load from file on mount
  useEffect(() => {
    loadFromFile().then(w => { setWorkflow(w); ready.current = true })
  }, [])

  // Save to file whenever workflow changes (skip initial seed)
  useEffect(() => {
    if (ready.current) saveToFile(workflow)
  }, [workflow])

  const dispatch = (taskId: string, action: 'done' | 'waiting' | 'unblock') => {
    setWorkflow(w => applyAction(w, taskId, action))
  }

  const editTask = (updated: Omit<Task, 'state'>) => {
    setWorkflow(w => ({
      tasks: deriveStates(w.tasks.map(t => t.id === updated.id ? { ...updated, state: t.state } : t))
    }))
  }

  const addTask = (task: Omit<Task, 'state'>) => {
    setWorkflow(w => ({
      tasks: deriveStates([...w.tasks, { ...task, state: 'blocked' as TaskState }])
    }))
  }

  const reset = () => { setWorkflow({ tasks: seedTasks }) }

  return { workflow, dispatch, addTask, editTask, reset }
}
