import Link from 'next/link'

export default function CreateProductExample() {
  return (
    <main>
      <nav>
        <Link href="/">← Back to Home</Link>
      </nav>

      <h1>Create Seat-Based Product</h1>
      <p>
        Examples of creating seat-based products using the Polar SDK. These examples
        are directly from the documentation guide.
      </p>

      <div className="card">
        <h2>Subscription Product Example</h2>
        <p>Create a recurring subscription with seat-based pricing and volume tiers:</p>
        <pre><code>{`import { polar } from '@/lib/polar'

const subscriptionProduct = await polar.products.create({
  name: "Team Pro Plan",
  organization_id: "org_123",
  is_recurring: true,
  prices: [{
    type: "recurring",
    recurring_interval: "month",
    amount_type: "seat_based",
    price_currency: "usd",
    seat_tiers: [
      { min_seats: 1, max_seats: 4, price_per_seat: 1000 },   // $10/month
      { min_seats: 5, max_seats: 9, price_per_seat: 900 },    // $9/month
      { min_seats: 10, max_seats: null, price_per_seat: 800 } // $8/month
    ]
  }]
});`}</code></pre>
      </div>

      <div className="card">
        <h2>One-Time Purchase Example</h2>
        <p>Create a one-time purchase product with perpetual seat licenses:</p>
        <pre><code>{`import { polar } from '@/lib/polar'

const oneTimeProduct = await polar.products.create({
  name: "Enterprise License Pack",
  organization_id: "org_123",
  is_recurring: false,
  prices: [{
    type: "one_time",
    amount_type: "seat_based",
    price_currency: "usd",
    seat_tiers: [
      { min_seats: 1, max_seats: 10, price_per_seat: 5000 },   // $50 per seat
      { min_seats: 11, max_seats: 50, price_per_seat: 4500 },  // $45 per seat
      { min_seats: 51, max_seats: null, price_per_seat: 4000 } // $40 per seat
    ]
  }]
});`}</code></pre>
      </div>

      <div className="card">
        <h2>Key Configuration Options</h2>
        <table>
          <thead>
            <tr>
              <th>Property</th>
              <th>Description</th>
              <th>Required</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><code>is_recurring</code></td>
              <td>true for subscriptions, false for one-time purchases</td>
              <td>Yes</td>
            </tr>
            <tr>
              <td><code>amount_type</code></td>
              <td>Must be "seat_based"</td>
              <td>Yes</td>
            </tr>
            <tr>
              <td><code>seat_tiers</code></td>
              <td>Array of pricing tiers with min/max seats and price per seat</td>
              <td>Yes</td>
            </tr>
            <tr>
              <td><code>recurring_interval</code></td>
              <td>"month" or "year" (subscriptions only)</td>
              <td>For subscriptions</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="card">
        <h2>Pricing Tiers Explained</h2>
        <p>Tiers allow volume-based discounts:</p>
        <ul style={{ marginLeft: '1.5rem', lineHeight: '2' }}>
          <li><strong>Tier 1 (1-4 seats):</strong> $10/month per seat</li>
          <li><strong>Tier 2 (5-9 seats):</strong> $9/month per seat</li>
          <li><strong>Tier 3 (10+ seats):</strong> $8/month per seat</li>
        </ul>
        <p>
          A team purchasing 6 seats would pay: <code>6 × $9 = $54/month</code>
        </p>
      </div>
    </main>
  )
}
