'use client'

import Button from '@polar-sh/ui/components/atoms/Button'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type MouseEvent,
} from 'react'

type Tab = 'headers' | 'preview' | 'response' | 'timing' | 'console'

const timestamp = new Date().toISOString()
const requestId = Math.random().toString(36).substring(2, 15)

const sanitizeUrl = (url: string): string | null => {
  try {
    const parsed = new URL(url)
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
      return parsed.href
    }
    return null
  } catch {
    return null
  }
}

type DeletableElement =
  | 'tabs'
  | 'requestRow'
  | 'bottomBar'
  | 'trafficLights'
  | 'titleBar'
  | 'resizeHandle'
  | 'consoleHistory'
  | 'consoleInput'
  | 'windowBorder'
  | 'everything'

const deletionSequence: { element: DeletableElement; message: string }[] = [
  { element: 'tabs', message: 'rm -rf /usr/share/tabs/*' },
  { element: 'requestRow', message: 'rm -rf /srv/requests' },
  { element: 'bottomBar', message: 'rm -rf /usr/local/statusbar' },
  { element: 'resizeHandle', message: 'rm -rf /dev/resize' },
  { element: 'trafficLights', message: 'rm -rf /System/TrafficLights.app' },
  { element: 'titleBar', message: 'rm -rf /usr/bin/windowmanager' },
  { element: 'consoleHistory', message: 'rm -rf /var/log/*' },
  { element: 'consoleInput', message: 'rm -rf /dev/stdin' },
  { element: 'windowBorder', message: 'rm -rf /usr/lib/libshadow.so' },
  { element: 'everything', message: 'rm -rf /boot ... bye!' },
]

const consoleCommands: Record<string, string | string[]> = {
  help: [
    'Available commands:',
    '  help          - Show this help message',
    '  ls            - List directory contents',
    '  cat <file>    - Read file contents',
    '  exit          - Exit',
    '  clear         - Clear console',
    '  git blame     - Show what author last modified each line of a file',
    '  apply         - Work with us',
  ],
  'find page':
    'find: No results found. The page has ascended to a higher plane.',
  ls: 'index.html  404.html  tears.txt  hopes-and-dreams/  node_modules/ (1.2 GB)',
  'cat error.log':
    '[ERROR] Page not found\n[ERROR] User still looking\n[ERROR] Hope depleting\n[WARN] Coffee levels critical\n[INFO] Have you tried the homepage?',
  'cat index.html':
    '<!DOCTYPE html>\n<html>\n<head>\n  <title>Welcome to Polar</title>\n</head>\n<body>\n  <h1>This page exists!</h1>\n  <p>Unlike the one you were looking for.</p>\n</body>\n</html>',
  'cat 404.html':
    "<!DOCTYPE html>\n<html>\n<head>\n  <title>404 - You are here</title>\n</head>\n<body>\n  <h1>Congratulations!</h1>\n  <p>You found the 404 page by looking at the 404 page.</p>\n  <p>It's 404s all the way down.</p>\n</body>\n</html>",
  'cat tears.txt':
    'Day 1: Page not found.\nDay 2: Still not found.\nDay 3: Starting to lose hope.\nDay 4: What even is a page?\nDay 5: Maybe the real page was the friends we made along the way.',
  'ls hopes-and-dreams':
    'dreams.txt  aspirations.md  goals.json\n\n(All files are empty)',
  'cat hopes-and-dreams': 'cat: hopes-and-dreams: Is a directory',
  'cd hopes-and-dreams':
    "You enter the hopes-and-dreams directory.\nIt's empty in here.\nJust like... never mind.",
  'ls node_modules':
    "Oh no. You don't want to do that.\n\n... fine.\n\nlodash/  react/  is-odd/  is-even/  is-number/  left-pad/  and 1,241 more...",
  'cat node_modules': 'cat: node_modules: Is a directory (and weighs 1.2 GB)',
  whoami: 'A lost developer, searching for meaning in a sea of 404s',
  'sudo !!': 'Nice try. Still 404. But I admire your determination.',
  exit: 'You can check out any time you like, but you can never leave. 🎸',
  'exit vim': ":q!\nJust kidding, you're not in vim. Or are you? :wq",
  'git blame':
    'Line 1: (You, 2 minutes ago) "just a little friday deploy no problem"',
  apply:
    "We're always looking for curious people.\n\nApply → https://polar.sh/careers",
  jobs: 'Visit https://polar.sh/careers',
  hire: 'Visit https://polar.sh/careers',
  careers: 'Visit https://polar.sh/careers',
  'npm install':
    'Installing dependencies...\nadded 1,247 packages in 3m\n\n12 vulnerabilities (4 moderate, 8 high)\n\nPage still not found.',
  'curl localhost':
    'curl: (7) Failed to connect to localhost port 80: Connection refused\n...because the page does not exist.',
  ping: 'PING page (127.0.0.1): 56 data bytes\nRequest timeout for icmp_seq 0\nRequest timeout for icmp_seq 1\nRequest timeout for icmp_seq 2\n--- page ping statistics ---\n3 packets transmitted, 0 packets received, 100.0% packet loss',
  'docker ps':
    'CONTAINER ID   IMAGE     COMMAND   STATUS\nNo containers found. Even Docker gave up.',
  pwd: '/dev/null/404/you-are-here',
  date: new Date().toString(),
  echo: 'echo echo echo... (the void echoes back)',
  man: 'No manual entry for "finding lost pages"',
  ssh: 'Connection refused. The server is also lost.',
}

const ResponseInspector = () => {
  const [activeTab, setActiveTab] = useState<Tab>('headers')
  const pathname = usePathname()

  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const dragOffset = useRef({ x: 0, y: 0 })

  const [size, setSize] = useState({ width: 900, height: 600 })
  const [isResizing, setIsResizing] = useState(false)
  const resizeStart = useRef({ x: 0, y: 0, width: 0, height: 0 })

  const [consoleHistory, setConsoleHistory] = useState<
    { type: 'input' | 'output'; text: string }[]
  >([])
  const [consoleInput, setConsoleInput] = useState('')
  const consoleEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const [deletedElements, setDeletedElements] = useState<Set<DeletableElement>>(
    new Set(),
  )
  const [isDeleting, setIsDeleting] = useState(false)
  const [shakeOffset, setShakeOffset] = useState({ x: 0, y: 0 })
  const [windowClosed, setWindowClosed] = useState(false)

  const handleCloseWindow = useCallback(() => {
    if (windowClosed) return
    setWindowClosed(true)
    // Slide back after a moment
    setTimeout(() => {
      setWindowClosed(false)
    }, 1500)
  }, [windowClosed])

  const triggerShake = useCallback(() => {
    const shakeSequence = [
      { x: -3, y: 0 },
      { x: 3, y: -1 },
      { x: -2, y: 1 },
      { x: 2, y: 0 },
      { x: 0, y: 0 },
    ]
    let i = 0
    const shake = () => {
      if (i < shakeSequence.length) {
        setShakeOffset(shakeSequence[i])
        i++
        setTimeout(shake, 30)
      }
    }
    shake()
  }, [])

  const startDeletion = useCallback(() => {
    if (isDeleting) return
    setIsDeleting(true)
    setActiveTab('console')

    let index = 0
    const deleteNext = () => {
      if (index < deletionSequence.length) {
        const { element, message } = deletionSequence[index]
        setConsoleHistory((prev) => [
          ...prev,
          { type: 'output', text: message },
        ])
        setDeletedElements((prev) => new Set([...prev, element]))
        triggerShake()
        index++
        setTimeout(deleteNext, 1200 + Math.random() * 600)
      }
    }
    deleteNext()
  }, [isDeleting, triggerShake])

  useEffect(() => {
    consoleEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [consoleHistory])

  useEffect(() => {
    if (activeTab === 'console') {
      inputRef.current?.focus()
    }
  }, [activeTab])

  const handleConsoleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      setConsoleHistory([])
      return
    }

    if (e.key === 'Tab') {
      e.preventDefault()
      const input = consoleInput.toLowerCase()
      if (!input) return

      const commands = Object.keys(consoleCommands)
      const matches = commands.filter((cmd) => cmd.startsWith(input))

      if (matches.length === 1) {
        setConsoleInput(matches[0])
      } else if (matches.length > 1) {
        const commonPrefix = matches.reduce((prefix, cmd) => {
          while (!cmd.startsWith(prefix)) {
            prefix = prefix.slice(0, -1)
          }
          return prefix
        }, matches[0])

        if (commonPrefix.length > input.length) {
          setConsoleInput(commonPrefix)
        } else {
          setConsoleHistory((prev) => [
            ...prev,
            { type: 'output', text: matches.join('  ') },
          ])
        }
      }
      return
    }

    if (e.key === 'Enter' && consoleInput.trim()) {
      const cmd = consoleInput.trim().toLowerCase()
      setConsoleHistory((prev) => [
        ...prev,
        { type: 'input', text: `$ ${consoleInput}` },
      ])

      if (cmd === 'clear') {
        setConsoleHistory([])
      } else if (
        cmd === 'rm -rf /' ||
        cmd === 'rm -rf /*' ||
        cmd === 'sudo rm -rf /' ||
        cmd === 'sudo rm -rf /*'
      ) {
        setConsoleHistory((prev) => [
          ...prev,
          {
            type: 'output',
            text: 'Authenticated. Starting deletion...\n',
          },
        ])
        setTimeout(() => startDeletion(), 500)
      } else {
        const response =
          consoleCommands[cmd] ||
          `Command not found: ${consoleInput}. Type "help" for available commands.`
        const output = Array.isArray(response) ? response.join('\n') : response
        setConsoleHistory((prev) => [...prev, { type: 'output', text: output }])
      }

      setConsoleInput('')
    }
  }

  const handleDragStart = useCallback(
    (e: MouseEvent) => {
      if ((e.target as HTMLElement).closest('button')) return
      setIsDragging(true)
      dragOffset.current = {
        x: e.clientX - position.x,
        y: e.clientY - position.y,
      }
    },
    [position],
  )

  const handleDrag = useCallback(
    (e: globalThis.MouseEvent) => {
      if (isDragging) {
        setPosition({
          x: e.clientX - dragOffset.current.x,
          y: e.clientY - dragOffset.current.y,
        })
      }
    },
    [isDragging],
  )

  const handleDragEnd = useCallback(() => {
    setIsDragging(false)
  }, [])

  const handleResizeStart = useCallback(
    (e: MouseEvent) => {
      e.preventDefault()
      setIsResizing(true)
      resizeStart.current = {
        x: e.clientX,
        y: e.clientY,
        width: size.width,
        height: size.height,
      }
    },
    [size],
  )

  const handleResize = useCallback(
    (e: globalThis.MouseEvent) => {
      if (isResizing) {
        const deltaX = e.clientX - resizeStart.current.x
        const deltaY = e.clientY - resizeStart.current.y
        setSize({
          width: Math.max(400, resizeStart.current.width + deltaX),
          height: Math.max(300, resizeStart.current.height + deltaY),
        })
      }
    },
    [isResizing],
  )

  const handleResizeEnd = useCallback(() => {
    setIsResizing(false)
  }, [])

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleDrag)
      window.addEventListener('mouseup', handleDragEnd)
      return () => {
        window.removeEventListener('mousemove', handleDrag)
        window.removeEventListener('mouseup', handleDragEnd)
      }
    }
  }, [isDragging, handleDrag, handleDragEnd])

  useEffect(() => {
    if (isResizing) {
      window.addEventListener('mousemove', handleResize)
      window.addEventListener('mouseup', handleResizeEnd)
      return () => {
        window.removeEventListener('mousemove', handleResize)
        window.removeEventListener('mouseup', handleResizeEnd)
      }
    }
  }, [isResizing, handleResize, handleResizeEnd])

  const tabs: { id: Tab; label: string }[] = [
    { id: 'headers', label: 'Headers' },
    { id: 'preview', label: 'Preview' },
    { id: 'response', label: 'Response' },
    { id: 'timing', label: 'Timing' },
    { id: 'console', label: 'Console' },
  ]

  const timings = [
    { label: 'Queueing', duration: 1.2, color: 'bg-gray-400' },
    { label: 'DNS Lookup', duration: 0, color: 'bg-teal-400' },
    { label: 'Initial connection', duration: 0, color: 'bg-orange-400' },
    { label: 'SSL', duration: 0, color: 'bg-purple-400' },
    { label: 'Request sent', duration: 0.1, color: 'bg-green-400' },
    { label: 'Waiting (TTFB)', duration: 42.3, color: 'bg-green-500' },
    { label: 'Content Download', duration: 2.1, color: 'bg-blue-400' },
  ]

  if (deletedElements.has('everything')) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center bg-black p-4 font-mono text-green-400">
        <div className="space-y-2 text-sm">
          <p className="text-gray-500">$ sudo rm -rf /</p>
          <p className="pt-4">Well, you did it. You deleted everything.</p>
          <p className="text-gray-500">That was fun, wasn&apos;t it?</p>
          <Link
            href="/"
            className="inline-block pt-4 text-blue-400 underline hover:text-blue-300"
          >
            → Respawn
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen w-full items-center justify-center bg-white p-4 dark:bg-gray-900">
      <div
        className={`absolute flex flex-col overflow-hidden ${
          deletedElements.has('windowBorder')
            ? ''
            : 'dark:border-polar-700 rounded-xl border border-gray-200 shadow-[0_25px_50px_-12px_rgba(0,0,0,0.25)] dark:shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5)]'
        }`}
        style={{
          width: size.width,
          height: size.height,
          transform: `translate(${position.x + shakeOffset.x}px, ${position.y + shakeOffset.y + (windowClosed ? window.innerHeight + 100 : 0)}px)`,
          cursor: isDragging ? 'grabbing' : 'default',
          transition:
            shakeOffset.x !== 0 || shakeOffset.y !== 0 || isDragging
              ? undefined
              : 'transform 0.4s ease-in-out',
        }}
      >
        {!deletedElements.has('titleBar') && (
          <div
            className="dark:bg-polar-800 dark:border-polar-700 flex items-center gap-2 border-b border-gray-300 bg-gray-200 px-3 py-2"
            onMouseDown={handleDragStart}
            style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
          >
            {!deletedElements.has('trafficLights') && (
              <div className="flex items-center gap-1.5">
                <button
                  onClick={handleCloseWindow}
                  className="h-3 w-3 rounded-full bg-red-500 transition-transform hover:scale-110"
                />
                <div className="h-3 w-3 rounded-full bg-yellow-500" />
                <div className="h-3 w-3 rounded-full bg-green-500" />
              </div>
            )}
            <span className="ml-2 font-mono text-xs text-gray-600 select-none dark:text-gray-400">
              DevTools - Network
            </span>
          </div>
        )}

        {!deletedElements.has('requestRow') && (
          <div className="dark:bg-polar-950 dark:border-polar-700 flex items-center gap-4 border-b border-gray-200 bg-white px-4 py-2 font-mono text-sm">
            <span className="font-semibold text-red-500">404</span>
            <span className="text-gray-600 dark:text-gray-400">GET</span>
            <span className="truncate text-gray-900 dark:text-gray-100">
              {pathname}
            </span>
            <span className="ml-auto text-gray-500">45.7 ms</span>
            <span className="text-gray-500">0 B</span>
          </div>
        )}

        {!deletedElements.has('tabs') && (
          <div className="dark:bg-polar-950 dark:border-polar-700 flex gap-0 border-b border-gray-200 bg-white">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`border-b-2 px-4 py-2 font-mono text-xs transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        )}

        <div className="dark:bg-polar-950 flex-1 overflow-auto bg-white p-4">
          {activeTab === 'headers' && (
            <div className="space-y-4 font-mono text-xs">
              <div>
                <h3 className="mb-2 font-semibold text-gray-900 dark:text-gray-100">
                  General
                </h3>
                <div className="dark:bg-polar-900 space-y-1 rounded bg-gray-50 p-3">
                  <div className="flex">
                    <span className="w-40 shrink-0 text-gray-500">
                      Request URL:
                    </span>
                    <span className="text-gray-900 dark:text-gray-100">
                      https://polar.sh{pathname}
                    </span>
                  </div>
                  <div className="flex">
                    <span className="w-40 shrink-0 text-gray-500">
                      Request Method:
                    </span>
                    <span className="text-gray-900 dark:text-gray-100">
                      GET
                    </span>
                  </div>
                  <div className="flex">
                    <span className="w-40 shrink-0 text-gray-500">
                      Status Code:
                    </span>
                    <span className="font-semibold text-red-500">
                      404 Not Found
                    </span>
                  </div>
                  <div className="flex">
                    <span className="w-40 shrink-0 text-gray-500">
                      Remote Address:
                    </span>
                    <span className="text-gray-900 dark:text-gray-100">
                      104.26.12.47:443
                    </span>
                  </div>
                  <div className="flex">
                    <span className="w-40 shrink-0 text-gray-500">
                      Referrer Policy:
                    </span>
                    <span className="text-gray-900 dark:text-gray-100">
                      strict-origin-when-cross-origin
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="mb-2 font-semibold text-gray-900 dark:text-gray-100">
                  Response Headers
                </h3>
                <div className="dark:bg-polar-900 space-y-1 rounded bg-gray-50 p-3">
                  <div className="flex">
                    <span className="w-40 shrink-0 text-gray-500">
                      cache-control:
                    </span>
                    <span className="text-gray-900 dark:text-gray-100">
                      no-cache, no-store, must-revalidate, max-age=0
                    </span>
                  </div>
                  <div className="flex">
                    <span className="w-40 shrink-0 text-gray-500">
                      content-type:
                    </span>
                    <span className="text-gray-900 dark:text-gray-100">
                      application/json; charset=utf-8
                    </span>
                  </div>
                  <div className="flex">
                    <span className="w-40 shrink-0 text-gray-500">date:</span>
                    <span className="text-gray-900 dark:text-gray-100">
                      {new Date().toUTCString()}
                    </span>
                  </div>
                  <div className="flex">
                    <span className="w-40 shrink-0 text-gray-500">
                      x-request-id:
                    </span>
                    <span className="text-gray-900 dark:text-gray-100">
                      {requestId}
                    </span>
                  </div>
                  <div className="flex">
                    <span className="w-40 shrink-0 text-gray-500">
                      x-hiring:
                    </span>
                    <span className="text-gray-900 dark:text-gray-100">
                      Like inspecting headers? We&apos;re hiring!
                      polar.sh/careers
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="mb-2 font-semibold text-gray-900 dark:text-gray-100">
                  Request Headers
                </h3>
                <div className="dark:bg-polar-900 space-y-1 rounded bg-gray-50 p-3">
                  <div className="flex">
                    <span className="w-40 shrink-0 text-gray-500">accept:</span>
                    <span className="text-gray-900 dark:text-gray-100">
                      text/html,application/xhtml+xml,application/xml;q=0.9
                    </span>
                  </div>
                  <div className="flex">
                    <span className="w-40 shrink-0 text-gray-500">
                      accept-encoding:
                    </span>
                    <span className="text-gray-900 dark:text-gray-100">
                      gzip, deflate, br, zstd
                    </span>
                  </div>
                  <div className="flex">
                    <span className="w-40 shrink-0 text-gray-500">
                      user-agent:
                    </span>
                    <span className="text-gray-900 dark:text-gray-100">
                      Mozilla/5.0 LostDeveloper/1.0
                    </span>
                  </div>
                  <div className="flex">
                    <span className="w-40 shrink-0 text-gray-500">cookie:</span>
                    <span className="text-gray-900 dark:text-gray-100">
                      _lost=true; _found=false; _hope=diminishing
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'preview' && (
            <div className="flex h-full flex-col items-center justify-center">
              <div className="text-6xl font-bold text-red-500">404</div>
              <p className="mt-4 text-gray-600 dark:text-gray-400">
                The requested resource could not be found
              </p>
              <Link href="/" className="mt-6">
                <Button>Take me home</Button>
              </Link>
            </div>
          )}

          {activeTab === 'response' && (
            <pre className="dark:bg-polar-900 overflow-auto rounded bg-gray-50 p-4 font-mono text-xs leading-relaxed">
              <span className="text-gray-500">{'{\n'}</span>
              <span className="text-purple-600 dark:text-purple-400">
                {'  "error"'}
              </span>
              <span className="text-gray-500">{': {\n'}</span>
              <span className="text-purple-600 dark:text-purple-400">
                {'    "code"'}
              </span>
              <span className="text-gray-500">{': '}</span>
              <span className="text-orange-600 dark:text-orange-400">404</span>
              <span className="text-gray-500">{',\n'}</span>
              <span className="text-purple-600 dark:text-purple-400">
                {'    "message"'}
              </span>
              <span className="text-gray-500">{': '}</span>
              <span className="text-green-600 dark:text-green-400">
                {'"Not Found"'}
              </span>
              <span className="text-gray-500">{',\n'}</span>
              <span className="text-purple-600 dark:text-purple-400">
                {'    "path"'}
              </span>
              <span className="text-gray-500">{': '}</span>
              <span className="text-green-600 dark:text-green-400">
                {`"${pathname}"`}
              </span>
              <span className="text-gray-500">{',\n'}</span>
              <span className="text-purple-600 dark:text-purple-400">
                {'    "timestamp"'}
              </span>
              <span className="text-gray-500">{': '}</span>
              <span className="text-green-600 dark:text-green-400">
                {`"${timestamp}"`}
              </span>
              <span className="text-gray-500">{',\n'}</span>
              <span className="text-purple-600 dark:text-purple-400">
                {'    "blame"'}
              </span>
              <span className="text-gray-500">{': '}</span>
              <span className="text-green-600 dark:text-green-400">
                {'"DNS"'}
              </span>
              <span className="text-gray-500">{'\n  },\n'}</span>
              <span className="text-purple-600 dark:text-purple-400">
                {'  "suggestions"'}
              </span>
              <span className="text-gray-500">{': [\n'}</span>
              <span className="text-green-600 dark:text-green-400">
                {'    "Have you tried turning it off and on again?"'}
              </span>
              <span className="text-gray-500">{',\n'}</span>
              <span className="text-green-600 dark:text-green-400">
                {'    "It works on my machine"'}
              </span>
              <span className="text-gray-500">{'\n  ],\n'}</span>
              <span className="text-purple-600 dark:text-purple-400">
                {'  "requestId"'}
              </span>
              <span className="text-gray-500">{': '}</span>
              <span className="text-green-600 dark:text-green-400">
                {`"${requestId}"`}
              </span>
              <span className="text-gray-500">{'\n}'}</span>
            </pre>
          )}

          {activeTab === 'timing' && (
            <div className="space-y-4 font-mono text-xs">
              <div className="dark:bg-polar-900 rounded bg-gray-50 p-4">
                <h3 className="mb-4 font-semibold text-gray-900 dark:text-gray-100">
                  Request Timing
                </h3>
                <div className="space-y-2">
                  {timings.map((timing) => (
                    <div key={timing.label} className="flex items-center gap-3">
                      <span className="w-36 shrink-0 text-gray-600 dark:text-gray-400">
                        {timing.label}
                      </span>
                      <div className="flex h-4 flex-1 items-center">
                        {timing.duration > 0 && (
                          <div
                            className={`h-2 rounded ${timing.color}`}
                            style={{
                              width: `${Math.max(timing.duration * 2, 4)}%`,
                              marginLeft: `${timing.label === 'Waiting (TTFB)' ? 3 : 0}%`,
                            }}
                          />
                        )}
                      </div>
                      <span className="w-16 shrink-0 text-right text-gray-500">
                        {timing.duration > 0 ? `${timing.duration} ms` : '-'}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="mt-4 border-t border-gray-200 pt-4 dark:border-gray-700">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-gray-900 dark:text-gray-100">
                      Total
                    </span>
                    <span className="text-gray-900 dark:text-gray-100">
                      45.7 ms
                    </span>
                  </div>
                </div>
              </div>

              <div className="dark:bg-polar-900 rounded bg-gray-50 p-4">
                <h3 className="mb-2 font-semibold text-gray-900 dark:text-gray-100">
                  Server Timing
                </h3>
                <div className="space-y-1 text-gray-600 dark:text-gray-400">
                  <div className="flex justify-between">
                    <span>
                      db;desc=&quot;SELECT * FROM pages WHERE EXISTS =
                      false&quot;
                    </span>
                    <span>12.4 ms</span>
                  </div>
                  <div className="flex justify-between">
                    <span>cache;desc=&quot;Miss (as expected)&quot;</span>
                    <span>0.1 ms</span>
                  </div>
                  <div className="flex justify-between">
                    <span>existential-dread</span>
                    <span>18.4 ms</span>
                  </div>
                  <div className="flex justify-between">
                    <span>acceptance</span>
                    <span>0.6 ms</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'console' && (
            <div
              className="flex h-full flex-col p-4 font-mono text-xs"
              onClick={() => inputRef.current?.focus()}
            >
              {!deletedElements.has('consoleHistory') && (
                <div className="flex-1 overflow-auto pb-4">
                  {consoleHistory.map((entry, i) => (
                    <div
                      key={i}
                      className={`whitespace-pre-wrap ${
                        entry.type === 'input'
                          ? 'text-green-600 dark:text-green-400'
                          : 'text-gray-700 dark:text-gray-300'
                      }`}
                    >
                      {entry.text
                        .split(/(https?:\/\/[^\s]+)/g)
                        .map((part, j) => {
                          const safeUrl = part.match(/^https?:\/\//)
                            ? sanitizeUrl(part)
                            : null
                          return safeUrl ? (
                            <a
                              key={j}
                              href={safeUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 underline hover:text-blue-500 dark:text-blue-400 dark:hover:text-blue-300"
                            >
                              {part}
                            </a>
                          ) : (
                            part
                          )
                        })}
                    </div>
                  ))}
                  <div ref={consoleEndRef} />
                </div>
              )}
              {!deletedElements.has('consoleInput') && (
                <div className="flex items-center border-t border-gray-200 pt-3 text-green-600 dark:border-gray-700 dark:text-green-400">
                  <span className="mr-2">$</span>
                  <input
                    ref={inputRef}
                    type="text"
                    value={consoleInput}
                    onChange={(e) => setConsoleInput(e.target.value)}
                    onKeyDown={handleConsoleKeyDown}
                    className="flex-1 border-none bg-transparent text-green-600 caret-green-600 shadow-none ring-0 outline-none focus:border-none focus:shadow-none focus:ring-0 focus:outline-none dark:text-green-400 dark:caret-green-400"
                    spellCheck={false}
                    autoComplete="off"
                  />
                </div>
              )}
            </div>
          )}
        </div>

        {!deletedElements.has('bottomBar') && (
          <div className="dark:bg-polar-800 dark:border-polar-700 flex items-center justify-between border-t border-gray-300 bg-gray-200 px-4 py-2">
            <div className="flex items-center gap-4 font-mono text-xs text-gray-600 dark:text-gray-400">
              <span>1 request</span>
              <span>0 B transferred</span>
              <span>Finish: 45.7 ms</span>
            </div>
            <Link href="/">
              <Button size="sm">Go Home</Button>
            </Link>
          </div>
        )}

        {!deletedElements.has('resizeHandle') && (
          <div
            className="absolute right-0 bottom-0 h-4 w-4 cursor-se-resize"
            onMouseDown={handleResizeStart}
            style={{
              background:
                'linear-gradient(135deg, transparent 50%, rgba(128,128,128,0.5) 50%)',
            }}
          />
        )}
      </div>
    </div>
  )
}

export default ResponseInspector
