import { Task } from './types'
import { deriveStates } from './engine'

function n(task: string, subtask: string, type: Task['type'], deps: string[]): Task {
  return { id: `${task}/${subtask}`, task, subtask, type, deps, state: 'blocked' }
}

const raw: Task[] = [
  n('dev',   'apply',    'execute',  []),
  n('dev',   'approval', 'approval', ['dev/apply']),
  n('dev',   'verify',   'verify',   ['dev/approval']),
  n('alpha', 'apply',    'execute',  ['dev/verify']),
  n('alpha', 'approval', 'approval', ['alpha/apply']),
  n('alpha', 'verify',   'verify',   ['alpha/approval']),
  n('prod',  'apply',    'execute',  ['alpha/verify']),
  n('prod',  'approval', 'approval', ['prod/apply']),
  n('prod',  'verify',   'verify',   ['prod/approval']),
]

export const seedTasks: Task[] = deriveStates(raw)
