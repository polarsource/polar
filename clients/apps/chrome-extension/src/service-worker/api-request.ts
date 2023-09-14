import { Platforms } from 'polarkit/api/client'
import api from '../api'

const apiRequestDecoration = async (
  orgName: string,
  repoName: string,
  issueNumbers: string[],
) => {
  const extensionIssues = await api.extension.listIssuesForExtension({
    platform: Platforms.GITHUB,
    orgName,
    repoName,
    numbers: issueNumbers.join(','),
  })

  // Add all the issues to chrome.storage
  const itemsToAdd = {}
  extensionIssues.forEach((issue) => {
    itemsToAdd[`issues_v2/${orgName}/${repoName}/${issue.number}`] = issue
  })
  chrome.storage.local.set(itemsToAdd)

  // Remove the issues we asked for but didn't get a response for from the cache
  const keysToRemove = issueNumbers.filter(
    (issueNumber) =>
      !extensionIssues.some(
        (extensionIssue) => extensionIssue.number.toString() === issueNumber,
      ),
  )
  chrome.storage.local.remove(
    keysToRemove.map((k) => `issues_v2/${orgName}/${repoName}/${k}`),
  )
}

chrome.runtime.onMessage.addListener(async (message, sender, sendResponse) => {
  const { type, orgName, repoName, issueNumbers } = message
  if (type === 'decorate-issues') {
    await apiRequestDecoration(orgName, repoName, issueNumbers)
    return true
  }
})

export {}
