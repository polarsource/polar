export type ToolMode = 'codemode' | 'operations'

const CODE_MODE_PARAM = 'codemode'

// Every client gets the search and execute code mode tools by default. Clients
// with their own code mode, such as opencode v2, opt out with `?codemode=false`
// and get one tool per operation.
export const toolModeFor = (url: URL): ToolMode =>
  url.searchParams.get(CODE_MODE_PARAM) === 'false' ? 'operations' : 'codemode'
