type Listener = () => void

let listener: Listener | null = null

export const setSessionRefreshListener = (l: Listener | null) => {
  listener = l
}

export const promptSessionRefresh = () => {
  listener?.()
}
