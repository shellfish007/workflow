export type TaskState = 'blocked' | 'runnable' | 'waiting' | 'done'
export type TaskType = 'execute' | 'approval' | 'verify' | 'wait'

export interface Task {
  id: string       // auto-derived: `${task}/${subtask}`
  task: string     // parent task — must be unique across tasks
  subtask: string  // unique within a task
  type: TaskType
  deps: string[]
  state: TaskState
}

export interface Workflow {
  tasks: Task[]
}
