import { createRoot } from 'react-dom/client'
import PolarBadge from './components/PolarBadge'

const taskLists = document.querySelector('task-lists')
if (taskLists) {
  const badge = document.createElement('div')
  taskLists.insertAdjacentElement('afterend', badge)
  const root = createRoot(badge)
  root.render(<PolarBadge showAmount={true} />)
}

export {}
