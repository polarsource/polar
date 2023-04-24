import { Platforms } from 'polarkit/api/client'
import React from 'react'
import { createRoot } from 'react-dom/client'
import api from './api'
import ExtensionIssueListItemDecoration from './components/ExtensionIssueListItemDecoration'
import './index.css'
import reportWebVitals from './reportWebVitals'

const [, orgName, repoName] = window.location.pathname.split('/')

if (orgName && repoName) {
  const issues = document.querySelectorAll(
    "div[id^='issue_']:has(a[id^='issue_'])",
  )

  const issueNumbers: string[] = []
  issues.forEach((issue) => {
    issueNumbers.push(issue.id.replace('issue_', ''))
  })

  api.extension
    .listIssuesForExtension({
      platform: Platforms.GITHUB,
      orgName,
      repoName,
      numbers: issueNumbers.join(','),
    })
    .then((extensionIssues) => {
      const items = {}
      extensionIssues.forEach((issue) => {
        items[`issues/${orgName}/${repoName}/${issue.number}`] = issue
      })
      chrome.storage.local.set(items)
    })

  issues.forEach((issue) => {
    const issueNumber = parseInt(issue.id.replace('issue_', ''))
    const badge = document.createElement('div')
    issue.insertAdjacentElement('afterend', badge)
    const root = createRoot(badge)
    root.render(
      <React.StrictMode>
        <ExtensionIssueListItemDecoration
          orgName={orgName}
          repoName={repoName}
          number={issueNumber}
        />
      </React.StrictMode>,
    )
  })
}

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals()
