'use client'

import { useEffect, useRef, useState } from 'react'
import { call, getBalance } from './actions'

type Server = 'builtin' | 'custom'

type Entry = { id: number; server: Server; at: number; pending: boolean }

const LABELS: Record<Server, string> = { builtin: 'built-in', custom: 'custom' }

const relative = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })

const timeAgo = (at: number, now: number) => {
  const seconds = Math.round((now - at) / 1000)
  if (seconds < 10) return 'just now'
  if (seconds < 60) return relative.format(-seconds, 'second')
  if (seconds < 3600) return relative.format(-Math.floor(seconds / 60), 'minute')
  return relative.format(-Math.floor(seconds / 3600), 'hour')
}

export function Demo() {
  const [balance, setBalance] = useState<number>()
  const [pristine, setPristine] = useState(false)
  const [syncStartedAt, setSyncStartedAt] = useState<number>()
  const [calling, setCalling] = useState(false)
  const [entries, setEntries] = useState<Entry[]>([])
  const [now, setNow] = useState(() => Date.now())
  const [paywall, setPaywall] = useState(false)
  const dialog = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    if (paywall) dialog.current?.showModal()
    else dialog.current?.close()
  }, [paywall])

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(interval)
  }, [])

  // Poll until the balance reflects every tracked tool call
  useEffect(() => {
    if (pristine) return

    let timeout: ReturnType<typeof setTimeout>
    const poll = async () => {
      const result = await getBalance()
      setBalance(result.balance)
      if (result.pristine) setPristine(true)
      else timeout = setTimeout(poll, 1000)
    }
    void poll()

    return () => clearTimeout(timeout)
  }, [pristine])

  const onClick = async (server: Server) => {
    const id = Date.now()
    setNow(id)
    setCalling(true)
    setEntries((entries) => [{ id, server, at: id, pending: true }, ...entries])

    const result = await call(server)
    setCalling(false)

    if (result.paywall) {
      setEntries((entries) => entries.filter((entry) => entry.id !== id))
      setPaywall(true)
      return
    }

    setEntries((entries) =>
      entries.map((entry) =>
        entry.id === id ? { ...entry, pending: false } : entry,
      ),
    )
    setNow(Date.now())
    setSyncStartedAt(Date.now())
    setPristine(false)
  }

  const disabled = calling || !pristine
  const syncSeconds =
    syncStartedAt === undefined
      ? 0
      : Math.max(0, Math.floor((now - syncStartedAt) / 1000))

  return (
    <main className="app">
      <ul className="log">
        {entries.length === 0 && <li className="empty muted">No tool calls yet</li>}
        {entries.map((entry) => (
          <li key={entry.id} className="entry">
            <span className={entry.pending ? 'muted' : undefined}>
              {entry.pending
                ? `Calling ${LABELS[entry.server]} tool…`
                : `A ${LABELS[entry.server]} tool has been called`}
            </span>
            <time className="faint">{timeAgo(entry.at, now)}</time>
          </li>
        ))}
      </ul>
      <footer className="footer">
        <p className={pristine ? undefined : 'muted'}>
          {balance === undefined
            ? 'Loading balance…'
            : !pristine
              ? `Syncing balance… (${syncSeconds} ${syncSeconds === 1 ? 'second' : 'seconds'})`
              : `${balance} tool ${balance === 1 ? 'call' : 'calls'} remaining`}
        </p>
        <button
          className="primary"
          disabled={disabled}
          onClick={() => onClick('builtin')}
        >
          Built-in tool
        </button>
        <button
          className="secondary"
          disabled={disabled}
          onClick={() => onClick('custom')}
        >
          Custom tool
        </button>
      </footer>
      <dialog ref={dialog} onClose={() => setPaywall(false)}>
        <div className="card">
          <div>
            <h1>Upgrade to Pro</h1>
            <p className="muted">
              Get 1,000 tool calls a month and access to custom servers.
            </p>
          </div>
          <button className="primary" onClick={() => setPaywall(false)}>
            Got it
          </button>
        </div>
      </dialog>
    </main>
  )
}
