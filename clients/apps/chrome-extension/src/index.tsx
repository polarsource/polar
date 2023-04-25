import { Platforms } from 'polarkit/api/client'
import React from 'react'
import { createRoot } from 'react-dom/client'
import api from './api'
import CachedIssueListItemDecoration from './components/CachedIssueListItemDecoration'
import './index.css'
import reportWebVitals from './reportWebVitals'

const [, orgName, repoName] = window.location.pathname.split('/')

const getIssueNumbers = (issues: NodeListOf<Element>) => {
  const issueNumbers: string[] = []
  issues.forEach((issue) => {
    issueNumbers.push(issue.id.replace('issue_', ''))
  })
  return issueNumbers
}

const apiRequestDecoration = (issueNumbers: string[]) => {
  api.extension
    .listIssuesForExtension({
      platform: Platforms.GITHUB,
      orgName,
      repoName,
      numbers: issueNumbers.join(','),
    })
    .then((extensionIssues) => {
      // Add all the issues to chrome.storage
      const itemsToAdd = {}
      extensionIssues.forEach((issue) => {
        itemsToAdd[`issues/${orgName}/${repoName}/${issue.number}`] = issue
      })
      chrome.storage.local.set(itemsToAdd)

      // Remove the issues we asked for but didn't get a response for from the cache
      const keysToRemove = issueNumbers.filter(
        (issueNumber) =>
          !extensionIssues.some(
            (extensionIssue) =>
              extensionIssue.number.toString() === issueNumber,
          ),
      )
      chrome.storage.local.remove(
        keysToRemove.map((k) => `issues/${orgName}/${repoName}/${k}`),
      )
    })
}

const mountReact = (issues: NodeListOf<Element>) => {
  issues.forEach((issue) => {
    const issueNumber = parseInt(issue.id.replace('issue_', ''))
    const badge = document.createElement('div')
    issue.insertAdjacentElement('afterend', badge)
    const root = createRoot(badge)
    root.render(
      <React.StrictMode>
        <CachedIssueListItemDecoration
          orgName={orgName}
          repoName={repoName}
          number={issueNumber}
        />
      </React.StrictMode>,
    )
  })
}

if (orgName && repoName) {
  // Install the CSS
  const head = document.querySelector('head')
  if (head) {
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = chrome.runtime.getURL('index.css')
    head.appendChild(link)
  }

  // Find all the issues on the page
  const issues = document.querySelectorAll(
    "div[id^='issue_']:has(a[id^='issue_'])",
  )

  const issueNumbers = getIssueNumbers(issues)
  apiRequestDecoration(issueNumbers)
  mountReact(issues)

  // Listen for changes to the issue list
  const issueList = document.querySelector(
    'turbo-frame[id="repo-content-turbo-frame"]',
  )
  if (issueList) {
    const callback = (mutationList: MutationRecord[], observer) => {
      for (const mutation of mutationList) {
        if (mutation.type === 'childList') {
          mutation.addedNodes.forEach((addedNode) => {
            if (addedNode.nodeType === Node.ELEMENT_NODE) {
              const el = addedNode as Element
              const issues = el.querySelectorAll(
                "div[id^='issue_']:has(a[id^='issue_'])",
              )

              if (issues.length > 0) {
                const issueNumbers = getIssueNumbers(issues)
                apiRequestDecoration(issueNumbers)
                mountReact(issues)
              }
            }
          })
        }
      }
    }
    const observer = new MutationObserver(callback)
    observer.observe(issueList, {
      childList: true,
      subtree: true,
    })
  }
}

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals()
