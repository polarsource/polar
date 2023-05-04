import { CONFIG } from './config'

const requestProcessor = (
  details: chrome.webRequest.WebResponseHeadersDetails,
) => {
  const headers = details.responseHeaders
  if (!headers) {
    return { responseHeaders: headers }
  }
  for (let i = 0; i < headers.length; i++) {
    const header = headers[i]
    var name = header.name.toLowerCase()
    if (
      name !== 'content-security-policy' &&
      name !== 'content-security-policy-report-only' &&
      name !== 'x-webkit-csp'
    ) {
      continue
    }
    if (header.value) {
      header.value = header.value.replace(
        '(connect-src [^;]+)',
        `$0 ${CONFIG.API_URL}`,
      )
    }
  }
  return { responseHeaders: headers }
}

chrome.webRequest.onHeadersReceived.addListener(
  requestProcessor,
  {
    urls: ['*://github.com/*/*/issues*'],
    types: ['main_frame', 'sub_frame'],
  },
  ['blocking', 'responseHeaders'],
)

export {}
