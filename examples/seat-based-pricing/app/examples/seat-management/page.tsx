import Link from 'next/link'

export default function SeatManagementExample() {
  return (
    <main>
      <nav>
        <Link href="/">← Back to Home</Link>
      </nav>

      <h1>Seat Management</h1>
      <p>
        Examples of managing seats including listing, assigning, and revoking seats.
        Works for both subscription-based and one-time purchase seat-based products.
      </p>

      <div className="card">
        <h2>List Seats</h2>
        <p>Get information about available and claimed seats:</p>
        <pre><code>{`import { polar } from '@/lib/polar'

// For subscriptions
async function getSeatInfo(subscriptionId: string) {
  const { seats, available_seats, total_seats } =
    await polar.customerSeats.list({ subscription_id: subscriptionId });

  return {
    seats,
    available: available_seats,
    total: total_seats,
    canAssign: available_seats > 0
  };
}

// For one-time purchases
async function getSeatInfoForOrder(orderId: string) {
  const { seats, available_seats, total_seats } =
    await polar.customerSeats.list({ order_id: orderId });

  return {
    seats,
    available: available_seats,
    total: total_seats,
    canAssign: available_seats > 0
  };
}`}</code></pre>
      </div>

      <div className="card">
        <h2>Assign a Seat</h2>
        <p>Send an invitation to a team member to claim their seat:</p>
        <pre><code>{`import { polar } from '@/lib/polar'

// For subscriptions
async function assignSeat(
  subscriptionId: string,
  email: string,
  metadata?: Record<string, any>
) {
  try {
    const seat = await polar.customerSeats.assign({
      subscription_id: subscriptionId,
      email: email,
      metadata: metadata // e.g., { department: "Engineering" }
    });

    return {
      success: true,
      seat: seat,
      message: \`Invitation sent to \${email}\`
    };
  } catch (error: any) {
    if (error.status === 400) {
      return {
        success: false,
        error: "No seats available or customer already has a seat"
      };
    }
    throw error;
  }
}

// For one-time purchases
async function assignSeatForOrder(
  orderId: string,
  email: string,
  metadata?: Record<string, any>
) {
  const seat = await polar.customerSeats.assign({
    order_id: orderId,
    email: email,
    metadata: metadata
  });

  return { success: true, seat };
}`}</code></pre>
      </div>

      <div className="card">
        <h2>React Component Example</h2>
        <p>Full seat management interface:</p>
        <pre><code>{`'use client'

import { useState, useEffect } from 'react'

interface Seat {
  id: string
  customer_email: string
  status: 'pending' | 'claimed' | 'revoked'
  seat_metadata?: Record<string, any>
}

interface SeatInfo {
  seats: Seat[]
  available: number
  total: number
  canAssign: boolean
}

function SeatManagement({ subscriptionId }: { subscriptionId: string }) {
  const [seatInfo, setSeatInfo] = useState<SeatInfo | null>(null)
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    loadSeats()
  }, [subscriptionId])

  async function loadSeats() {
    const response = await fetch(\`/api/seats?subscriptionId=\${subscriptionId}\`)
    const data = await response.json()
    setSeatInfo(data)
  }

  async function handleAssign() {
    setLoading(true)
    try {
      const response = await fetch('/api/seats/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subscriptionId,
          email,
          metadata: { role: "Developer" }
        }),
      })

      const result = await response.json()

      if (result.success) {
        setEmail("")
        loadSeats()
        alert("Invitation sent!")
      }
    } finally {
      setLoading(false)
    }
  }

  async function handleRevoke(seatId: string) {
    if (!confirm('Are you sure you want to revoke this seat?')) return

    await fetch('/api/seats/revoke', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ seatId }),
    })

    loadSeats()
  }

  if (!seatInfo) return <div>Loading...</div>

  return (
    <div>
      <h2>Seat Management</h2>
      <p>{seatInfo.available} of {seatInfo.total} seats available</p>

      {/* Assign new seat */}
      <div>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="team-member@company.com"
        />
        <button
          onClick={handleAssign}
          disabled={!seatInfo.canAssign || loading}
        >
          Assign Seat
        </button>
      </div>

      {/* List existing seats */}
      <table>
        <thead>
          <tr>
            <th>Email</th>
            <th>Status</th>
            <th>Role</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {seatInfo.seats.map(seat => (
            <tr key={seat.id}>
              <td>{seat.customer_email}</td>
              <td>
                <span className={\`badge badge-\${seat.status}\`}>
                  {seat.status}
                </span>
              </td>
              <td>{seat.seat_metadata?.role || '-'}</td>
              <td>
                {seat.status === 'claimed' && (
                  <button onClick={() => handleRevoke(seat.id)}>
                    Revoke
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}`}</code></pre>
      </div>

      <div className="card">
        <h2>Revoke a Seat</h2>
        <p>Remove access from a team member:</p>
        <pre><code>{`import { polar } from '@/lib/polar'

async function revokeSeat(seatId: string) {
  const revokedSeat = await polar.customerSeats.revoke({
    seat_id: seatId
  });

  // Benefits are automatically revoked via webhook
  return {
    success: true,
    seat: revokedSeat,
    message: "Seat revoked successfully"
  };
}`}</code></pre>
        <p className="error">
          <strong>Warning:</strong> Revoking a seat immediately removes access but does not
          issue a refund. The billing manager continues to pay for all purchased seats.
        </p>
      </div>

      <div className="card">
        <h2>Using Metadata</h2>
        <p>Store useful context about seat assignments:</p>
        <pre><code>{`await polar.customerSeats.assign({
  subscription_id: subscriptionId,
  email: "dev@company.com",
  metadata: {
    department: "Engineering",
    role: "Senior Developer",
    cost_center: "R&D",
    manager: "jane@company.com"
  }
});`}</code></pre>
      </div>
    </main>
  )
}
