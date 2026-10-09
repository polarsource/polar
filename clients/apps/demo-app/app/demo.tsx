'use client'

import { useEffect, useRef, useState } from 'react'
import type { getTopUps } from '../polar'
import { call, checkUpgraded, getBalance, topUp, upgrade } from './actions'

type Server = 'builtin' | 'custom'

type Entry = {
  id: string
  server: Server
  at: number
  pending: boolean
}

// Tool call history per customer: { [externalCustomerId]: [{ server, at }] }
const HISTORY_KEY = 'tool_call_history'

// Older history grouped batched calls into a single item with a count
type History = Record<
  string,
  (Pick<Entry, 'server' | 'at'> & { count?: number })[]
>

// One entry per call, so a batch of 100 floods the timeline
const entriesOf = (
  server: Server,
  at: number,
  count: number,
  pending: boolean,
) =>
  Array.from({ length: count }, (_, index) => ({
    id: `${at}-${index}`,
    server,
    at,
    pending,
  }))

const readHistory = (): History => {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) ?? '{}')
  } catch {
    return {}
  }
}

const LABELS: Record<Server, string> = { builtin: 'built-in', custom: 'custom' }

const relative = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })

const timeAgo = (at: number, now: number) => {
  const seconds = Math.round((now - at) / 1000)
  if (seconds < 10) return 'just now'
  if (seconds < 60) return relative.format(-seconds, 'second')
  if (seconds < 3600)
    return relative.format(-Math.floor(seconds / 60), 'minute')
  return relative.format(-Math.floor(seconds / 3600), 'hour')
}

// Shift calls the tool 100 times, Cmd 10 times
const countOf = (event: { shiftKey: boolean; metaKey: boolean }) =>
  event.shiftKey ? 100 : event.metaKey ? 10 : 1

type Modal = 'paywall' | 'upgrading' | 'upgraded' | 'topup'

type TopUpPack = Awaited<ReturnType<typeof getTopUps>>[number]

const number = new Intl.NumberFormat('en-US')

export function Demo({
  externalCustomerId,
  proPrice,
  pro: initialPro,
  topUps,
  upgrading,
}: {
  externalCustomerId: string
  proPrice: string
  pro: boolean
  topUps: TopUpPack[]
  upgrading: boolean
}) {
  const [pro, setPro] = useState(initialPro)
  const [pack, setPack] = useState(topUps[0]?.id)
  const [purchasing, setPurchasing] = useState(false)
  const [purchaseError, setPurchaseError] = useState<string>()
  const [balance, setBalance] = useState<number>()
  const [pristine, setPristine] = useState(false)
  const [syncStartedAt, setSyncStartedAt] = useState<number>()
  const [calling, setCalling] = useState(false)
  const [heldCount, setHeldCount] = useState(1)
  const [entries, setEntries] = useState<Entry[]>([])
  const [historyLoaded, setHistoryLoaded] = useState(false)
  const [now, setNow] = useState(() => Date.now())
  const [modal, setModal] = useState<Modal | undefined>(
    upgrading ? 'upgrading' : undefined,
  )
  // Keeps the last content rendered while the dialog fades out
  const [content, setContent] = useState(modal)
  const dialog = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    if (modal) {
      setContent(modal)
      dialog.current?.showModal()
    } else dialog.current?.close()
  }, [modal])

  // Back from checkout: poll until the Pro subscription and its benefits are active
  useEffect(() => {
    if (!upgrading) return
    window.history.replaceState(null, '', '/')

    let timeout: ReturnType<typeof setTimeout>
    const poll = async () => {
      if (await checkUpgraded()) {
        setPro(true)
        setModal('upgraded')
        setPristine(false)
      } else timeout = setTimeout(poll, 1000)
    }
    void poll()

    return () => clearTimeout(timeout)
  }, [upgrading])

  // Loaded after mount, as localStorage isn't available during server rendering
  useEffect(() => {
    setEntries(
      (readHistory()[externalCustomerId] ?? []).flatMap(
        ({ server, at, count = 1 }) => entriesOf(server, at, count, false),
      ),
    )
    setHistoryLoaded(true)
  }, [externalCustomerId])

  useEffect(() => {
    if (!historyLoaded) return
    try {
      localStorage.setItem(
        HISTORY_KEY,
        JSON.stringify({
          ...readHistory(),
          [externalCustomerId]: entries
            .filter((entry) => !entry.pending)
            .map(({ server, at }) => ({ server, at })),
        }),
      )
    } catch {}
  }, [entries, historyLoaded, externalCustomerId])

  // Mirrors the held modifier keys in the button labels
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => setHeldCount(countOf(event))
    const reset = () => setHeldCount(1)
    window.addEventListener('keydown', onKey)
    window.addEventListener('keyup', onKey)
    window.addEventListener('blur', reset)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('keyup', onKey)
      window.removeEventListener('blur', reset)
    }
  }, [])

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

  const onClick = async (server: Server, event: React.MouseEvent) => {
    const count = countOf(event)
    const at = Date.now()
    setNow(at)
    setCalling(true)
    setEntries((entries) => [...entriesOf(server, at, count, true), ...entries])

    const result = await call(server, count)
    setCalling(false)

    if (result.paywall) {
      setEntries((entries) => entries.filter((entry) => entry.at !== at))
      setModal('paywall')
      return
    }

    setEntries((entries) =>
      entries.map((entry) =>
        entry.at === at ? { ...entry, pending: false } : entry,
      ),
    )
    setNow(Date.now())
    setSyncStartedAt(Date.now())
    setPristine(false)
  }

  const openTopUp = () => {
    setPurchaseError(undefined)
    setModal('topup')
  }

  const onTopUp = async () => {
    if (!pack) return
    setPurchasing(true)
    setPurchaseError(undefined)

    const result = await topUp(pack).catch(() => ({
      error: 'Something went wrong. Please try again.',
    }))
    setPurchasing(false)

    if (result.error) {
      setPurchaseError(result.error)
      return
    }

    setModal(undefined)
    setPristine(false)
  }

  const selectedPack = topUps.find((topUp) => topUp.id === pack)
  const disabled = calling || !pristine
  const syncSeconds =
    syncStartedAt === undefined
      ? 0
      : Math.max(0, Math.floor((now - syncStartedAt) / 1000))

  return (
    <main className="app">
      <ul className="log">
        {entries.length === 0 && (
          <li className="empty muted">No tool calls yet</li>
        )}
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
          {pro && pristine && topUps.length > 0 && (
            <>
              {' · '}
              <button className="link" onClick={openTopUp}>
                Top up
              </button>
            </>
          )}
        </p>
        {heldCount > 1 && <span className="multiplier">×{heldCount}</span>}
        <button
          className="primary"
          disabled={disabled}
          onClick={(event) => onClick('builtin', event)}
        >
          Built-in tool
        </button>
        <button
          className="secondary"
          disabled={disabled}
          onClick={(event) => onClick('custom', event)}
        >
          Custom tool
        </button>
      </footer>
      <dialog
        ref={dialog}
        onCancel={(event) => {
          if (modal === 'upgrading' || purchasing) event.preventDefault()
        }}
        onClose={() => setModal(undefined)}
      >
        {content === 'paywall' && (
          <div className="card">
            <div>
              <h1>Upgrade to Pro</h1>
              <p className="muted">
                Get 1,000 tool calls a month and access to custom servers.
              </p>
            </div>
            <div className="actions">
              <form action={upgrade}>
                <button type="submit" className="primary">
                  Get Pro for {proPrice}
                </button>
              </form>
              <button className="ghost" onClick={() => setModal(undefined)}>
                Not now
              </button>
            </div>
          </div>
        )}
        {content === 'topup' && (
          <div className="card">
            <div>
              <h1>Top up</h1>
              <p className="muted text-pretty">
                Extra tool calls roll over until you use them.
              </p>
            </div>
            <fieldset className="packs" disabled={purchasing}>
              {topUps.map((topUp) => (
                <label key={topUp.id} className="pack">
                  <input
                    type="radio"
                    name="pack"
                    value={topUp.id}
                    checked={pack === topUp.id}
                    onChange={() => setPack(topUp.id)}
                  />
                  <span>{number.format(topUp.units)} tool calls</span>
                  <span className="muted">{topUp.price}</span>
                </label>
              ))}
            </fieldset>
            {purchaseError && <p className="error">{purchaseError}</p>}
            <div className="actions">
              <button
                className="primary"
                disabled={!selectedPack || purchasing}
                onClick={onTopUp}
              >
                {purchasing
                  ? 'Charging your card…'
                  : `Buy for ${selectedPack?.price}`}
              </button>
              <button
                className="ghost"
                disabled={purchasing}
                onClick={() => setModal(undefined)}
              >
                I changed my mind
              </button>
            </div>
          </div>
        )}
        {content === 'upgrading' && (
          <div className="card">
            <span className="spinner" />
            <div>
              <h1>Confirming your upgrade</h1>
              <p className="muted">This usually takes a few seconds.</p>
            </div>
          </div>
        )}
        {content === 'upgraded' && (
          <div className="card">
            <div>
              <h1>Welcome to Pro</h1>
              <p className="muted">
                You now have 1,000 tool calls a month and access to custom
                servers.
              </p>
            </div>
            <button
              className="primary"
              autoFocus
              onClick={() => setModal(undefined)}
            >
              Continue
            </button>
          </div>
        )}
      </dialog>
    </main>
  )
}
