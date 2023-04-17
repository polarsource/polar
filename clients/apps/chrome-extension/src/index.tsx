import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'
import reportWebVitals from './reportWebVitals'

const taskLists = document.querySelector('task-lists')
if (taskLists) {
  const badge = document.createElement('div')
  taskLists.insertAdjacentElement('afterend', badge)
  const root = createRoot(badge)
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  )
}

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals()
