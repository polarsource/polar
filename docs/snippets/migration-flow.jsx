export const MigrationFlow = () => {
  // Mintlify inlines only this export into the MDX module, so stage data
  // must live inside the component — a file-level const is dropped.
  const PHASES = [
    {
      key: 'new-sales',
      short: 'New sales',
      caption: 'New checkouts go to Polar. Stripe keeps renewing what it already owns.',
      appNote: 'Routes new checkout',
      stripeNote: 'Renewing',
      polarNote: 'Selling',
      packets: [{ path: 'right-down', label: 'New checkout' }],
      rows: [
        { id: 'sub_4821', plan: 'Pro · monthly', owner: 'Stripe' },
        { id: 'sub_5190', plan: 'Team · yearly', owner: 'Stripe' },
        { id: 'sub_9002', plan: 'Pro · monthly', owner: 'Polar' },
      ],
    },
    {
      key: 'prepare',
      short: 'Prepare',
      caption: 'Polar builds the catalog and customers. No billing moves yet.',
      appNote: 'Maps customer IDs',
      stripeNote: 'Unchanged',
      polarNote: 'Preparing',
      packets: [{ path: 'sibling', label: 'Products + customers' }],
      rows: [
        { id: 'sub_4821', plan: 'Pro · monthly', owner: 'Stripe' },
        { id: 'sub_5190', plan: 'Team · yearly', owner: 'Stripe' },
        { id: 'sub_9002', plan: 'Pro · monthly', owner: 'Polar' },
      ],
    },
    {
      key: 'cards',
      short: 'Move cards',
      caption: 'Stripe copies saved cards to Polar. No card data touches your app.',
      appNote: 'Unchanged',
      stripeNote: 'Copying',
      polarNote: 'Verifying',
      packets: [{ path: 'sibling', label: 'Saved cards' }],
      rows: [
        { id: 'sub_4821', plan: 'Pro · monthly', owner: 'Stripe' },
        { id: 'sub_5190', plan: 'Team · yearly', owner: 'Stripe' },
        { id: 'sub_9002', plan: 'Pro · monthly', owner: 'Polar' },
      ],
    },
    {
      key: 'cutover',
      short: 'Cutover',
      caption: 'Polar keeps the paid period and Stripe stops that subscription.',
      appNote: 'Updates access',
      stripeNote: 'Stopping',
      polarNote: 'Activating',
      packets: [
        { path: 'sibling', label: 'Billing owner' },
        { path: 'right-up', label: 'subscription.updated' },
      ],
      rows: [
        { id: 'sub_4821', plan: 'Pro · monthly', owner: 'Polar', moved: true },
        { id: 'sub_5190', plan: 'Team · yearly', owner: 'Stripe' },
        { id: 'sub_9002', plan: 'Pro · monthly', owner: 'Polar' },
      ],
    },
    {
      key: 'reconcile',
      short: 'Reconcile',
      caption: 'Every subscription has one owner. Your app reads both systems.',
      appNote: 'One lookup',
      stripeNote: 'History only',
      polarNote: 'Renewing',
      packets: [
        { path: 'left-up', label: 'Past payments' },
        { path: 'right-up', label: 'Renewals' },
      ],
      rows: [
        { id: 'sub_4821', plan: 'Pro · monthly', owner: 'Polar' },
        { id: 'sub_5190', plan: 'Team · yearly', owner: 'Stripe', kept: true },
        { id: 'sub_9002', plan: 'Pro · monthly', owner: 'Polar' },
      ],
    },
  ]

  const [activeIndex, setActiveIndex] = useState(0)
  const [isPlaying, setIsPlaying] = useState(true)
  const [isVisible, setIsVisible] = useState(false)
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)
  const containerRef = useRef(null)

  const phase = PHASES[activeIndex]
  const stripeCount = phase.rows.filter((row) => row.owner === 'Stripe').length
  const polarCount = phase.rows.filter((row) => row.owner === 'Polar').length

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    const syncPreference = () => {
      setPrefersReducedMotion(mediaQuery.matches)
      if (mediaQuery.matches) {
        setIsPlaying(false)
      }
    }

    syncPreference()
    mediaQuery.addEventListener('change', syncPreference)
    return () => mediaQuery.removeEventListener('change', syncPreference)
  }, [])

  useEffect(() => {
    const container = containerRef.current
    if (!container) {
      return
    }

    const observer = new IntersectionObserver(
      ([entry]) => setIsVisible(entry.isIntersecting),
      { threshold: 0.35 },
    )
    observer.observe(container)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!isVisible || !isPlaying || prefersReducedMotion) {
      return
    }

    const timeout = window.setTimeout(() => {
      setActiveIndex((current) => (current + 1) % PHASES.length)
    }, 3800)

    return () => window.clearTimeout(timeout)
  }, [activeIndex, isPlaying, isVisible, prefersReducedMotion])

  const goTo = (index) => {
    setActiveIndex((index + PHASES.length) % PHASES.length)
    setIsPlaying(false)
  }

  const packetFor = (path) =>
    phase.packets.find((packet) => packet.path === path)

  const siblingPacket = packetFor('sibling')

  return (
    <section
      ref={containerRef}
      className={`migration-flow migration-flow--${phase.key}`}
      aria-label="How billing ownership moves during a Stripe migration"
    >
      <div className="migration-flow__topbar">
        <p className="migration-flow__counter">
          Phase {activeIndex + 1} of {PHASES.length}
        </p>
        <button
          type="button"
          className="migration-flow__play"
          onClick={() => setIsPlaying((playing) => !playing)}
          disabled={prefersReducedMotion}
        >
          <span aria-hidden="true">{isPlaying ? 'Ⅱ' : '▶'}</span>
          {prefersReducedMotion ? 'Reduced motion' : isPlaying ? 'Pause' : 'Play'}
        </button>
      </div>

      <div className="migration-flow__tabs" role="tablist" aria-label="Migration phases">
        {PHASES.map((item, index) => (
          <button
            key={item.key}
            type="button"
            role="tab"
            aria-selected={index === activeIndex}
            className="migration-flow__tab"
            onClick={() => goTo(index)}
          >
            {item.short}
          </button>
        ))}
      </div>

      <p className="migration-flow__caption" aria-live="polite">
        {phase.caption}
      </p>

      <div className="migration-flow__tree">
        <div className="migration-flow__node migration-flow__node--app">
          <span className="migration-flow__node-name">Merchant app</span>
          <span className="migration-flow__node-note">{phase.appNote}</span>
        </div>

        <div className="migration-flow__branch">
          <svg viewBox="0 0 200 48" preserveAspectRatio="none" aria-hidden="true">
            <path d="M100 0 V16 H26 V48" />
            <path d="M100 0 V16 H174 V48" />
          </svg>
          {packetFor('left-up') ? (
            <span
              key={`${phase.key}-left`}
              className="migration-flow__packet migration-flow__packet--left migration-flow__packet--up"
            >
              {packetFor('left-up').label}
            </span>
          ) : null}
          {packetFor('right-down') ? (
            <span
              key={`${phase.key}-right-down`}
              className="migration-flow__packet migration-flow__packet--right migration-flow__packet--down"
            >
              {packetFor('right-down').label}
            </span>
          ) : null}
          {packetFor('right-up') ? (
            <span
              key={`${phase.key}-right-up`}
              className="migration-flow__packet migration-flow__packet--right migration-flow__packet--up"
            >
              {packetFor('right-up').label}
            </span>
          ) : null}
        </div>

        <div className="migration-flow__children">
          <div className="migration-flow__node migration-flow__node--stripe">
            <span className="migration-flow__node-name">Stripe</span>
            <span className="migration-flow__node-note">{phase.stripeNote}</span>
            <span className="migration-flow__node-count">
              {stripeCount} subscription{stripeCount === 1 ? '' : 's'}
            </span>
          </div>

          <div className="migration-flow__link">
            <span className="migration-flow__link-line" aria-hidden="true" />
            {siblingPacket ? (
              <span key={`${phase.key}-sibling`} className="migration-flow__packet">
                {siblingPacket.label}
              </span>
            ) : null}
          </div>

          <div className="migration-flow__node migration-flow__node--polar">
            <span className="migration-flow__node-name">Polar</span>
            <span className="migration-flow__node-note">{phase.polarNote}</span>
            <span className="migration-flow__node-count">
              {polarCount} subscription{polarCount === 1 ? '' : 's'}
            </span>
          </div>
        </div>
      </div>

      <table className="migration-flow__table">
        <thead>
          <tr>
            <th>Subscription</th>
            <th>Renews in</th>
          </tr>
        </thead>
        <tbody>
          {phase.rows.map((row) => (
            <tr key={row.id}>
              <td>
                <code>{row.id}</code>
                <span>{row.plan}</span>
              </td>
              <td>
                <span
                  className={`migration-flow__owner migration-flow__owner--${row.owner.toLowerCase()}`}
                >
                  {row.owner}
                </span>
                {row.moved ? (
                  <span className="migration-flow__flag">just moved</span>
                ) : null}
                {row.kept ? (
                  <span className="migration-flow__flag">left on purpose</span>
                ) : null}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="migration-flow__controls">
        <button type="button" onClick={() => goTo(activeIndex - 1)}>
          <span aria-hidden="true">←</span> Previous
        </button>
        <button type="button" onClick={() => goTo(activeIndex + 1)}>
          Next <span aria-hidden="true">→</span>
        </button>
      </div>
    </section>
  )
}
