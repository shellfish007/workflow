const http = require('http')
const Database = require('better-sqlite3')

const db = new Database('workflow.db')
const PORT = 3001

// One table, one row per task
db.exec(`
  CREATE TABLE IF NOT EXISTS tasks (
    id      TEXT PRIMARY KEY,
    task    TEXT NOT NULL,
    subtask TEXT NOT NULL,
    type    TEXT NOT NULL,
    deps    TEXT NOT NULL DEFAULT '[]',
    state   TEXT NOT NULL DEFAULT 'blocked'
  )
`)

const getAll  = db.prepare('SELECT * FROM tasks')
const upsert  = db.prepare(`
  INSERT INTO tasks (id, task, subtask, type, deps, state)
  VALUES (@id, @task, @subtask, @type, @deps, @state)
  ON CONFLICT(id) DO UPDATE SET
    task=excluded.task, subtask=excluded.subtask,
    type=excluded.type, deps=excluded.deps, state=excluded.state
`)
const deleteAll = db.prepare('DELETE FROM tasks')

function readWorkflow() {
  return {
    tasks: getAll.all().map(r => ({ ...r, deps: JSON.parse(r.deps) }))
  }
}

const replaceAll = db.transaction(tasks => {
  deleteAll.run()
  for (const t of tasks) upsert.run({ ...t, deps: JSON.stringify(t.deps) })
})

http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end() }

  if (req.method === 'GET' && req.url === '/data') {
    const workflow = readWorkflow()
    if (workflow.tasks.length === 0) { res.writeHead(404); return res.end() }
    res.writeHead(200, { 'Content-Type': 'application/json' })
    return res.end(JSON.stringify(workflow))
  }

  if (req.method === 'POST' && req.url === '/data') {
    let body = ''
    req.on('data', chunk => body += chunk)
    req.on('end', () => {
      const { tasks } = JSON.parse(body)
      replaceAll(tasks)
      res.writeHead(200); res.end()
    })
    return
  }

  res.writeHead(404); res.end()
}).listen(PORT, () => console.log(`Data server → http://localhost:${PORT}  (db: workflow.db)`))
