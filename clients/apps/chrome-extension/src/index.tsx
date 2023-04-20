import { Platforms } from 'polarkit/api/client'
import React from 'react'
import { createRoot } from 'react-dom/client'
import api from './api'
import './index.css'
import reportWebVitals from './reportWebVitals'

const issues = document.querySelectorAll(
  "div[id^='issue_']:has(a[id^='issue_'])",
)

const issueNumbers: string[] = []
issues.forEach((issue) => {
  issueNumbers.push(issue.id.replace('issue_', ''))
})

api.issues
  .listIssuesForExtension({
    platform: Platforms.GITHUB,
    orgName: 'polarsource',
    repoName: 'polar',
    numbers: issueNumbers.join(','),
  })
  .then((extensionIssues) => {
    issues.forEach((issue) => {
      const extensionIssue = extensionIssues.find(
        (e) => e.number === parseInt(issue.id.replace('issue_', '')),
      )
      if (extensionIssue) {
        const badge = document.createElement('div')
        issue.insertAdjacentElement('afterend', badge)
        const root = createRoot(badge)
        root.render(
          <React.StrictMode>
            {extensionIssue.title} - {extensionIssue.number}
          </React.StrictMode>,
        )
      }
    })
  })

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals()
