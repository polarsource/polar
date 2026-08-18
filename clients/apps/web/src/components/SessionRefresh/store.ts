export interface SessionRefreshOptions {
  returnTo?: string
}

type Listener = (options?: SessionRefreshOptions) => void

let listener: Listener | null = null

export const setSessionRefreshListener = (l: Listener | null) => {
  listener = l
}

export const promptSessionRefresh = (options?: SessionRefreshOptions) => {
  listener?.(options)
}
