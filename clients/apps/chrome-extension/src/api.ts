import { IssueExtensionRead, Platforms } from 'polarkit/api/client'
import { CONFIG } from './config'

const extensionVersion = chrome.runtime.getManifest().version

let token: string | undefined = undefined

// The alternative here would be to always read from storage, but since
// token changes so seldom, that seems like a waste.
const getToken = async (): Promise<string | undefined> => {
  if (token) {
    return token
  }

  return new Promise((resolve) => {
    chrome.storage.local.get('token', (result) => {
      if (result.token) {
        token = result.token
      }
      resolve(token)
    })
  })
}

export const isAuthenticated = async (): Promise<boolean> => {
  return !!(await getToken())
}

chrome.storage.local.onChanged.addListener(
  (changes: { [key: string]: chrome.storage.StorageChange }) => {
    if (changes.token && changes.token.newValue) {
      token = changes.token.newValue
    }
  },
)

const listIssuesForExtension = async ({
  platform,
  orgName,
  repoName,
  numbers,
}: {
  platform: Platforms
  orgName: string
  repoName: string
  numbers: string
}): Promise<Array<IssueExtensionRead>> => {
  const authorization = await getToken()
  const response = await fetch(
    `${CONFIG.API_URL}/api/v1/extension/${platform}/${orgName}/${repoName}/issues?numbers=${numbers}`,
    {
      // If we do 'include' here instead, the cookie is included and we could scrap the entire
      // auth mechanism. Let's not for now.
      credentials: 'omit',
      mode: 'cors',
      headers: {
        Authorization: `Bearer ${authorization}`,
        'X-Polar-Agent': `Polar-Extension/${extensionVersion}`,
      },
    },
  )
  /*
   * Always return an empty list of issues in case HTTP is not 200, e.g
   * unauthenticated, no issues for repo etc.
   */
  if (!response.ok) {
    return []
  }

  const body = await response.json()
  return body as Array<IssueExtensionRead>
}

export default {
  extension: { listIssuesForExtension },
}
