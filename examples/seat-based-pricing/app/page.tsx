import Link from 'next/link'

export default function Home() {
  return (
    <main>
      <h1>Seat-Based Pricing Example</h1>
      <p>
        This example demonstrates how to implement seat-based pricing using the Polar SDK.
        It includes examples from the official documentation guide.
      </p>

      <div className="card">
        <h2>Examples Included</h2>
        <ul style={{ marginLeft: '1.5rem', lineHeight: '2' }}>
          <li>
            <Link href="/examples/create-product">Create Seat-Based Product</Link> - How to create subscription and one-time seat-based products
          </li>
          <li>
            <Link href="/examples/checkout">Checkout Flow</Link> - Creating checkouts with seat selection
          </li>
          <li>
            <Link href="/examples/seat-management">Seat Management</Link> - Assign, list, and revoke seats
          </li>
          <li>
            <Link href="/examples/claim">Seat Claim Flow</Link> - How team members claim their seats
          </li>
          <li>
            <Link href="/examples/webhooks">Webhook Handlers</Link> - Handle subscription and seat events
          </li>
          <li>
            <Link href="/examples/scaling">Scaling Seats</Link> - Add or reduce seats for subscriptions
          </li>
        </ul>
      </div>

      <div className="card">
        <h2>Setup</h2>
        <ol style={{ marginLeft: '1.5rem', lineHeight: '2' }}>
          <li>Copy <code>.env.example</code> to <code>.env</code></li>
          <li>Add your Polar access token and organization ID</li>
          <li>Install dependencies: <code>pnpm install</code></li>
          <li>Run the dev server: <code>pnpm dev</code></li>
        </ol>
      </div>

      <div className="card">
        <h2>Prerequisites</h2>
        <ul style={{ marginLeft: '1.5rem', lineHeight: '2' }}>
          <li>Polar organization with <code>seat_based_pricing_enabled</code> feature flag</li>
          <li>Polar SDK installed (included in this example)</li>
          <li>Basic understanding of Polar products and subscriptions</li>
        </ul>
      </div>
    </main>
  )
}
