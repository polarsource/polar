export const MigrationCoexistence = () => (
  <figure
    className="migration-coexistence"
    aria-label="Merchant app sits above Stripe and Polar during migration"
  >
    <div className="migration-coexistence__tree">
      <div className="migration-coexistence__node migration-coexistence__node--app">
        <span className="migration-coexistence__name">Merchant app</span>
        <span className="migration-coexistence__note">Routes each customer</span>
      </div>

      <div className="migration-coexistence__branch" aria-hidden="true">
        <div className="migration-coexistence__branch-col">
          <span className="migration-coexistence__elbow migration-coexistence__elbow--left" />
          <span className="migration-coexistence__dot migration-coexistence__dot--left" />
        </div>
        <div className="migration-coexistence__branch-col">
          <span className="migration-coexistence__stub" />
          <span className="migration-coexistence__crossbar" />
        </div>
        <div className="migration-coexistence__branch-col">
          <span className="migration-coexistence__elbow migration-coexistence__elbow--right" />
          <span className="migration-coexistence__dot migration-coexistence__dot--right" />
        </div>
      </div>

      <div className="migration-coexistence__children">
        <div className="migration-coexistence__node migration-coexistence__node--stripe">
          <span className="migration-coexistence__name">Stripe</span>
          <span className="migration-coexistence__note">Existing renewals</span>
        </div>
        <div className="migration-coexistence__gap" aria-hidden="true" />
        <div className="migration-coexistence__node migration-coexistence__node--polar">
          <span className="migration-coexistence__name">Polar</span>
          <span className="migration-coexistence__note">New sales</span>
        </div>
      </div>
    </div>

    <figcaption className="migration-coexistence__caption">
      Each subscription has one system responsible for its next renewal. New
      checkouts go to Polar; Stripe keeps renewing what it already owns until you
      switch them.
    </figcaption>
  </figure>
)
