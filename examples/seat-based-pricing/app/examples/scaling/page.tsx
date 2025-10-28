import Link from 'next/link'

export default function ScalingExample() {
  return (
    <main>
      <nav>
        <Link href="/">← Back to Home</Link>
      </nav>

      <h1>Scaling Seats</h1>
      <p>
        Examples of adding or reducing seats for subscriptions, and purchasing additional
        seats for one-time purchases.
      </p>

      <div className="card">
        <h2>Add Seats (Subscriptions)</h2>
        <p>Increase the seat count for a subscription:</p>
        <pre><code>{`import { polar } from '@/lib/polar'

async function addSeats(subscriptionId: string, newTotal: number) {
  // Update subscription seat count
  const subscription = await polar.subscriptions.update({
    id: subscriptionId,
    seats: newTotal
  });

  // New seats are immediately available for assignment
  return subscription;
}`}</code></pre>
        <p className="success">
          New seats are immediately available for assignment. Billing is adjusted
          automatically based on your pricing tiers.
        </p>
      </div>

      <div className="card">
        <h2>Reduce Seats (Subscriptions)</h2>
        <p>Decrease seat count with proper validation:</p>
        <pre><code>{`import { polar } from '@/lib/polar'

async function reduceSeats(subscriptionId: string, newTotal: number) {
  // First, check how many seats are currently claimed
  const { seats } = await polar.customerSeats.list({
    subscription_id: subscriptionId
  });

  const claimedCount = seats.filter(s => s.status === 'claimed').length;

  if (newTotal < claimedCount) {
    throw new Error(
      \`Cannot reduce to \${newTotal} seats. \${claimedCount} seats are currently claimed. Revoke seats first.\`
    );
  }

  // Update will take effect at next renewal
  const subscription = await polar.subscriptions.update({
    id: subscriptionId,
    seats: newTotal
  });

  return subscription;
}`}</code></pre>
        <p className="error">
          <strong>Important:</strong> You cannot reduce below the currently claimed count.
          Revoke seats first before reducing the total.
        </p>
      </div>

      <div className="card">
        <h2>React Component: Manage Seat Count</h2>
        <p>UI for scaling subscription seats:</p>
        <pre><code>{`'use client'

import { useState, useEffect } from 'react'

interface SubscriptionInfo {
  id: string
  seats: number
  claimedSeats: number
}

function SeatScaling({ subscriptionId }: { subscriptionId: string }) {
  const [info, setInfo] = useState<SubscriptionInfo | null>(null)
  const [newTotal, setNewTotal] = useState(0)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    loadInfo()
  }, [subscriptionId])

  async function loadInfo() {
    const response = await fetch(\`/api/subscriptions/\${subscriptionId}\`)
    const data = await response.json()
    setInfo(data)
    setNewTotal(data.seats)
  }

  async function handleUpdate() {
    if (newTotal < info!.claimedSeats) {
      alert(\`Cannot reduce below \${info!.claimedSeats} claimed seats\`)
      return
    }

    setLoading(true)
    try {
      const response = await fetch('/api/subscriptions/update-seats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscriptionId, seats: newTotal }),
      })

      if (response.ok) {
        loadInfo()
        alert('Seat count updated successfully!')
      }
    } finally {
      setLoading(false)
    }
  }

  if (!info) return <div>Loading...</div>

  return (
    <div>
      <h2>Manage Seat Count</h2>
      <p>Current seats: {info.seats}</p>
      <p>Claimed seats: {info.claimedSeats}</p>
      <p>Available seats: {info.seats - info.claimedSeats}</p>

      <div>
        <input
          type="number"
          min={info.claimedSeats}
          value={newTotal}
          onChange={(e) => setNewTotal(Number(e.target.value))}
        />
        <button
          onClick={handleUpdate}
          disabled={loading || newTotal === info.seats}
        >
          {loading ? 'Updating...' : 'Update Seat Count'}
        </button>
      </div>

      {newTotal < info.claimedSeats && (
        <p className="error">
          Cannot reduce below {info.claimedSeats} claimed seats
        </p>
      )}
    </div>
  )
}`}</code></pre>
      </div>

      <div className="card">
        <h2>API Route: Update Seat Count</h2>
        <p>Backend implementation for updating seats:</p>
        <pre><code>{`// app/api/subscriptions/update-seats/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { polar } from '@/lib/polar'

export async function POST(request: NextRequest) {
  try {
    const { subscriptionId, seats } = await request.json()

    // Validate claimed seats
    const { seats: seatList } = await polar.customerSeats.list({
      subscription_id: subscriptionId
    })

    const claimedCount = seatList.filter(
      s => s.status === 'claimed'
    ).length

    if (seats < claimedCount) {
      return NextResponse.json(
        {
          error: \`Cannot reduce to \${seats} seats. \${claimedCount} are claimed.\`
        },
        { status: 400 }
      )
    }

    // Update subscription
    const subscription = await polar.subscriptions.update({
      id: subscriptionId,
      seats: seats
    })

    return NextResponse.json(subscription)
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to update seats' },
      { status: 500 }
    )
  }
}`}</code></pre>
      </div>

      <div className="card">
        <h2>Purchase Additional Seats (One-Time)</h2>
        <p>For one-time purchases, create a new order for additional seats:</p>
        <pre><code>{`import { polar } from '@/lib/polar'

async function purchaseMoreSeats(
  productId: string,
  additionalSeats: number
) {
  // Create a new checkout for additional seats
  const checkout = await polar.checkouts.create({
    product_id: productId,
    seats: additionalSeats,
    success_url: "https://yourapp.com/success"
  });

  // Each order is independent with its own seat pool
  return checkout;
}`}</code></pre>
        <p className="success">
          <strong>Note:</strong> For one-time purchases, each order has its own independent
          seat pool. Customers can purchase additional seats anytime by creating a new order.
          All seats remain perpetual.
        </p>
      </div>

      <div className="card">
        <h2>Bulk Seat Assignment</h2>
        <p>Assign multiple seats at once after scaling up:</p>
        <pre><code>{`import { polar } from '@/lib/polar'

async function assignMultipleSeats(
  subscriptionId: string,
  emails: string[]
) {
  const results = await Promise.allSettled(
    emails.map(email =>
      polar.customerSeats.assign({
        subscription_id: subscriptionId,
        email: email
      })
    )
  );

  const succeeded = results.filter(r => r.status === 'fulfilled');
  const failed = results.filter(r => r.status === 'rejected');

  return {
    succeeded: succeeded.length,
    failed: failed.length,
    errors: failed.map((f: any) => f.reason)
  };
}`}</code></pre>
      </div>

      <div className="card">
        <h2>Utilization Tracking</h2>
        <p>Monitor seat usage to identify upsell opportunities:</p>
        <pre><code>{`import { polar } from '@/lib/polar'

async function checkUtilization(subscriptionId: string) {
  const { seats, available_seats, total_seats } =
    await polar.customerSeats.list({
      subscription_id: subscriptionId
    });

  const utilization = ((total_seats - available_seats) / total_seats) * 100;

  if (utilization > 80) {
    // Suggest adding more seats
    return {
      shouldUpgrade: true,
      message: "You're using 80%+ of your seats. Consider upgrading!",
      utilization: utilization
    };
  }

  return {
    shouldUpgrade: false,
    utilization: utilization
  };
}`}</code></pre>
      </div>

      <div className="card">
        <h2>Scaling Best Practices</h2>
        <table>
          <thead>
            <tr>
              <th>Scenario</th>
              <th>Best Practice</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Adding seats</td>
              <td>New seats are immediately available for assignment</td>
            </tr>
            <tr>
              <td>Reducing seats</td>
              <td>Must revoke claimed seats first</td>
            </tr>
            <tr>
              <td>High utilization</td>
              <td>Proactively suggest upgrades at 80%+</td>
            </tr>
            <tr>
              <td>One-time purchases</td>
              <td>Create new orders for additional seats</td>
            </tr>
            <tr>
              <td>Billing</td>
              <td>Changes apply immediately with prorated charges</td>
            </tr>
          </tbody>
        </table>
      </div>
    </main>
  )
}
