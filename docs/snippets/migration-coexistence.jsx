export const MigrationCoexistence = () => {
  // Mintlify inlines only this export into the MDX module, so the geometry
  // shared by the rails and the travelling dots has to live inside it.
  //
  // Both routes are expressed in the branch viewBox (100 wide, 12 tall) and are
  // reused verbatim as the dots' motion paths, so a dot can never drift off a
  // rail. x=50 is the merchant app's centre; x=21 and x=79 match the centres of
  // the 42%/16%/42% columns the child cards sit in.
  const toStripe = "M50 0 V3 H24 A3 3 0 0 0 21 6 V12";
  const toPolar = "M50 0 V3 H76 A3 3 0 0 1 79 6 V12";
  const cycle = "3.6s";
  const fade = { values: "0;1;1;0", keyTimes: "0;0.12;0.82;1" };

  return (
    <section
      className="migration-coexistence"
      aria-label="Merchant app sits above Stripe and Polar during migration"
    >
      <div className="migration-coexistence__tree">
        <div className="migration-coexistence__node migration-coexistence__node--app">
          <span className="migration-coexistence__name">Merchant app</span>
          <span className="migration-coexistence__note">Routes each customer</span>
        </div>

        <svg
          className="migration-coexistence__branch"
          viewBox="0 0 100 12"
          fill="none"
          role="presentation"
          aria-hidden="true"
        >
          <path
            className="migration-coexistence__rail"
            d={toStripe}
            vectorEffect="non-scaling-stroke"
          />
          <path
            className="migration-coexistence__rail"
            d={toPolar}
            vectorEffect="non-scaling-stroke"
          />

          <circle className="migration-coexistence__dot" cx="0" cy="0" r="0.75" opacity="0">
            <animateMotion dur={cycle} repeatCount="indefinite" path={toStripe} />
            <animate
              attributeName="opacity"
              dur={cycle}
              repeatCount="indefinite"
              values={fade.values}
              keyTimes={fade.keyTimes}
            />
          </circle>

          <circle className="migration-coexistence__dot" cx="0" cy="0" r="0.75" opacity="0">
            <animateMotion dur={cycle} begin="1.8s" repeatCount="indefinite" path={toPolar} />
            <animate
              attributeName="opacity"
              dur={cycle}
              begin="1.8s"
              repeatCount="indefinite"
              values={fade.values}
              keyTimes={fade.keyTimes}
            />
          </circle>
        </svg>

        <div className="migration-coexistence__children">
          <div className="migration-coexistence__node migration-coexistence__node--stripe">
            <span className="migration-coexistence__name">Stripe</span>
            <span className="migration-coexistence__note">Existing renewals</span>
          </div>
          <div className="migration-coexistence__spacer" aria-hidden="true" />
          <div className="migration-coexistence__node migration-coexistence__node--polar">
            <span className="migration-coexistence__name">Polar</span>
            <span className="migration-coexistence__note">New sales</span>
          </div>
        </div>
      </div>

      <p className="migration-coexistence__caption">
        Each subscription has one system responsible for its next renewal. New checkouts go to
        Polar; Stripe keeps renewing what it already owns until you switch them.
      </p>
    </section>
  );
};

export const MigrationSwitch = () => {
  const changes = [
    ["Renews on Stripe", "Renews on Polar"],
    ["Paid period already paid", "Same period kept"],
    ["Cards verified on Polar", "Those cards used on next renewal"],
  ];

  return (
    <section className="migration-switch" aria-label="What changes when a subscription switches">
      <div className="migration-switch__header" aria-hidden="true">
        <span>Stripe</span>
        <span>Switch</span>
        <span>Polar</span>
      </div>
      <div className="migration-switch__rows">
        {changes.map(([before, after]) => (
          <div className="migration-switch__row" key={before}>
            <span className="migration-switch__state">{before}</span>
            <span className="migration-switch__arrow" aria-hidden="true">
              →
            </span>
            <span className="migration-switch__state migration-switch__state--polar">{after}</span>
          </div>
        ))}
      </div>
    </section>
  );
};
