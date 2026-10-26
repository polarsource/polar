import { useState } from 'react'

const resize = (keys: string[], length: number): string[] =>
  keys.length >= length
    ? keys.slice(0, length)
    : [
        ...keys,
        ...Array.from({ length: length - keys.length }, () =>
          crypto.randomUUID(),
        ),
      ]

/**
 * Stable React keys for an editable list whose items carry no id of their
 * own. Rows appended to the list get a fresh key; call `remove` alongside
 * removing a row so the rows after it keep theirs.
 */
export const useListKeys = (length: number) => {
  const [keys, setKeys] = useState(() => resize([], length))
  const current = keys.length === length ? keys : resize(keys, length)
  if (current !== keys) {
    setKeys(current)
  }
  const remove = (index: number) =>
    setKeys(current.filter((_, i) => i !== index))
  return { keys: current, remove }
}
