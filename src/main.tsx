import './tailwind.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import WorkflowMockup from '../graph_first_workflow_mockup'

const MOCKUP = true // set to false to restore the main app

createRoot(document.getElementById('root')!).render(
  <StrictMode>{MOCKUP ? <WorkflowMockup /> : <App />}</StrictMode>
)
