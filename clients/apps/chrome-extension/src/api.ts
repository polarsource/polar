import { PolarAPI } from 'polarkit/api/client'

const headers = {}

// The alternative here would be to always read from storage, but since
// token changes so seldom, that seems like a waste.
const getHeaders = async (): Promise<Record<string, string>> => {
  if (headers['Authorization']) {
    return headers
  }

  return new Promise((resolve) => {
    chrome.storage.local.get('token', (result) => {
      if (result.token) {
        headers['Authorization'] = `Bearer ${result.token}`
      }
      resolve(headers)
    })
  })
}

export const isAuthenticated = async (): Promise<boolean> => {
  const headers = await getHeaders()
  return !!headers['Authorization']
}

chrome.storage.local.onChanged.addListener(
  (changes: { [key: string]: chrome.storage.StorageChange }) => {
    if (changes.token && changes.token.newValue) {
      headers['Authorization'] = `Bearer ${changes.token.newValue}`
    }
  },
)

const api = new PolarAPI({
  BASE: 'http://127.0.0.1:8000', // TODO
  WITH_CREDENTIALS: false,
  HEADERS: getHeaders,
})

export default api
