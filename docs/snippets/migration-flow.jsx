export const MigrationFlow = () => {
  // Mintlify inlines only this export into the MDX module, so stage data
  // must live inside the component — a file-level const is dropped.
  const MIGRATION_STAGES = [
    {
      key: 'new-sales',
      short: 'New sales',
      eyebrow: 'Start safely',
      title: 'Polar handles every new checkout',
      description:
        'New customers enter through Polar while existing subscriptions keep renewing in Stripe.',
      packet: 'New checkout',
      stripeTitle: 'Existing subscriptions',
      stripeStatus: 'Renewing',
      polarTitle: 'New sales',
      polarStatus: 'Live',
      owner: 'Existing → Stripe · New → Polar',
    },
    {
      key: 'prepare',
      short: 'Prepare',
      eyebrow: 'Build the bridge',
      title: 'Prepare the catalog and customer map',
      description:
        'Polar imports the products and customers needed by the subscriptions you select. Billing does not move yet.',
      packet: 'Products + customers',
      stripeTitle: 'Subscriptions',
      stripeStatus: 'Unchanged',
      polarTitle: 'Catalog + customers',
      polarStatus: 'Prepared',
      owner: 'Existing renewals → Stripe',
    },
    {
      key: 'cards',
      short: 'Move cards',
      eyebrow: 'Secure transfer',
      title: 'Stripe copies saved cards account to account',
      description:
        'Card details move directly between Stripe accounts. Polar verifies which subscriptions have a usable card.',
      packet: 'Saved cards',
      stripeTitle: 'Card vault',
      stripeStatus: 'Copying',
      polarTitle: 'Payment methods',
      polarStatus: 'Verifying',
      owner: 'Existing renewals → Stripe',
    },
    {
      key: 'cutover',
      short: 'Cutover',
      eyebrow: 'Change ownership',
      title: 'Selected subscriptions switch to Polar',
      description:
        'Polar preserves the paid period, stops the Stripe subscription, and activates the matching Polar subscription.',
      packet: 'Billing owner',
      stripeTitle: 'Selected subscriptions',
      stripeStatus: 'Stopping',
      polarTitle: 'Same paid periods',
      polarStatus: 'Activating',
      owner: 'Switched renewals → Polar',
    },
    {
      key: 'reconcile',
      short: 'Reconcile',
      eyebrow: 'Verify and clean up',
      title: 'Every subscription finishes with one owner',
      description:
        'Moved subscriptions renew in Polar. Historical payments and intentional exceptions remain in Stripe.',
      packet: 'Verified',
      stripeTitle: 'History + exceptions',
      stripeStatus: 'Retained',
      polarTitle: 'Moved subscriptions',
      polarStatus: 'Renewing',
      owner: 'Exactly one owner per subscription',
    },
  ]

  const [activeIndex, setActiveIndex] = useState(0)
  const [isPlaying, setIsPlaying] = useState(true)
  const [isVisible, setIsVisible] = useState(false)
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)
  const containerRef = useRef(null)

  const stage = MIGRATION_STAGES[activeIndex]

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    const updateMotionPreference = () => {
      setPrefersReducedMotion(mediaQuery.matches)
      if (mediaQuery.matches) {
        setIsPlaying(false)
      }
    }

    updateMotionPreference()
    mediaQuery.addEventListener('change', updateMotionPreference)
    return () => mediaQuery.removeEventListener('change', updateMotionPreference)
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
      setActiveIndex((current) => (current + 1) % MIGRATION_STAGES.length)
    }, 3600)

    return () => window.clearTimeout(timeout)
  }, [activeIndex, isPlaying, isVisible, prefersReducedMotion])

  const selectStage = (index) => {
    setActiveIndex(index)
    setIsPlaying(false)
  }

  const showPrevious = () => {
    setActiveIndex(
      (current) =>
        (current - 1 + MIGRATION_STAGES.length) % MIGRATION_STAGES.length,
    )
    setIsPlaying(false)
  }

  const showNext = () => {
    setActiveIndex((current) => (current + 1) % MIGRATION_STAGES.length)
    setIsPlaying(false)
  }

  return (
    <section
      ref={containerRef}
      className={`migration-flow migration-flow--${stage.key}`}
      aria-label="How a Stripe migration progresses"
    >
      <div className="migration-flow__topbar">
        <div>
          <p className="migration-flow__overline">Migration walkthrough</p>
          <p className="migration-flow__counter">
            Phase {activeIndex + 1} of {MIGRATION_STAGES.length}
          </p>
        </div>
        <button
          type="button"
          className="migration-flow__play"
          onClick={() => setIsPlaying((playing) => !playing)}
          disabled={prefersReducedMotion}
          aria-label={isPlaying ? 'Pause animation' : 'Play animation'}
        >
          <span aria-hidden="true">{isPlaying ? 'Ⅱ' : '▶'}</span>
          {prefersReducedMotion ? 'Reduced motion' : isPlaying ? 'Pause' : 'Play'}
        </button>
      </div>

      <div className="migration-flow__tabs" role="tablist" aria-label="Migration phases">
        {MIGRATION_STAGES.map((item, index) => (
          <button
            key={item.key}
            type="button"
            role="tab"
            aria-selected={index === activeIndex}
            className="migration-flow__tab"
            onClick={() => selectStage(index)}
          >
            <span className="migration-flow__tab-number">{index + 1}</span>
            <span>{item.short}</span>
          </button>
        ))}
      </div>

      <div className="migration-flow__progress" aria-hidden="true">
        <span
          className={`migration-flow__progress-fill migration-flow__progress-fill--${activeIndex + 1}`}
        />
      </div>

      <div className="migration-flow__copy" aria-live="polite">
        <p className="migration-flow__eyebrow">{stage.eyebrow}</p>
        <h3>{stage.title}</h3>
        <p>{stage.description}</p>
      </div>

      <div className="migration-flow__diagram">
        <div className="migration-flow__system migration-flow__system--stripe">
          <div className="migration-flow__system-heading">
            <span className="migration-flow__brand-mark migration-flow__brand-mark--stripe">
              S
            </span>
            <span>Stripe</span>
          </div>
          <p>{stage.stripeTitle}</p>
          <span className="migration-flow__status">{stage.stripeStatus}</span>
        </div>

        <div className="migration-flow__track" aria-hidden="true">
          <span className="migration-flow__track-line" />
          <span key={stage.key} className="migration-flow__packet">
            {stage.packet}
          </span>
          <span className="migration-flow__arrow">→</span>
        </div>

        <div className="migration-flow__system migration-flow__system--polar">
          <div className="migration-flow__system-heading">
            <span className="migration-flow__brand-mark migration-flow__brand-mark--polar">
              P
            </span>
            <span>Polar</span>
          </div>
          <p>{stage.polarTitle}</p>
          <span className="migration-flow__status">{stage.polarStatus}</span>
        </div>
      </div>

      <div className="migration-flow__owner">
        <span>Next renewal owner</span>
        <strong>{stage.owner}</strong>
      </div>

      <div className="migration-flow__controls">
        <button type="button" onClick={showPrevious} aria-label="Previous phase">
          <span aria-hidden="true">←</span>
          Previous
        </button>
        <button type="button" onClick={showNext} aria-label="Next phase">
          Next
          <span aria-hidden="true">→</span>
        </button>
      </div>
    </section>
  )
}
