import React from 'react'
import { createRoot } from 'react-dom/client'
import { PopUp } from './components/PopUp'

window.addEventListener('load', function () {
  const elem = document.getElementById('polar-popup')
  if (elem) {
    const root = createRoot(elem)
    root.render(
      <React.StrictMode>
        <PopUp />
      </React.StrictMode>,
    )
  }
})
