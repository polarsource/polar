import React, { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import api from './api'
import './index.css'
import reportWebVitals from './reportWebVitals'

const MyComponent = () => {
  const [name, setName] = useState<string>('')
  useEffect(() => {
    ;(async () => {
      const user = await api.users.getAuthenticated()
      setName(user.username)
    })()
  }, [])

  return <div>Hello {name}</div>
}

const issues = document.querySelectorAll("div a[id^='issue_']")
issues.forEach((issue) => {
  const badge = document.createElement('div')
  issue.insertAdjacentElement('afterend', badge)
  const root = createRoot(badge)
  root.render(
    <React.StrictMode>
      {/* <Badge /> */}
      <MyComponent />
    </React.StrictMode>,
  )
})

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals()
