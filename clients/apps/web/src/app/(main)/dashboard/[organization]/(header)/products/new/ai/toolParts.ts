const LOCAL_TOOL_PART_TYPES = new Set([
  'tool-redirectToManualSetup',
  'tool-markAsDone',
])

export const TOOL_SEARCH_NAME = 'tool_search_tool_bm25'

export const isApiToolPartType = (type: string): boolean =>
  type.startsWith('tool-') && !LOCAL_TOOL_PART_TYPES.has(type)
