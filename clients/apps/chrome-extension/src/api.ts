import { IssueExtensionRead, Platforms } from 'polarkit/api/client'
import { CONFIG } from './config'

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
  const respose = await fetch(
    `${CONFIG.API_URL}/api/v1/extension/${platform}/${orgName}/${repoName}/issues?numbers=${numbers}&auth_token=${authorization}`,
    {
      mode: 'no-cors',
    },
  )
  console.log('RESPONSE', respose)
  const body = await respose.json()
  console.log('BODY', body)
  return body as Array<IssueExtensionRead>
}

export default {
  extension: { listIssuesForExtension },
}
