import Link from 'next/link'

export default function CheckoutExample() {
  return (
    <main>
      <nav>
        <Link href="/">← Back to Home</Link>
      </nav>

      <h1>Checkout Flow</h1>
      <p>
        Examples of creating checkouts with seat quantity selection. The checkout
        automatically calculates pricing based on your configured tiers.
      </p>

      <div className="card">
        <h2>Basic Checkout</h2>
        <p>Create a checkout session with a specific number of seats:</p>
        <pre><code>{`import { polar } from '@/lib/polar'

const checkout = await polar.checkouts.create({
  product_price_id: "price_123",
  seats: 5, // Customer selects quantity
  success_url: "https://yourapp.com/success",
  customer_email: "billing@company.com"
});

// Redirect user to checkout.url
console.log('Checkout URL:', checkout.url);`}</code></pre>
      </div>

      <div className="card">
        <h2>What Customers See</h2>
        <p>The checkout page displays:</p>
        <ul style={{ marginLeft: '1.5rem', lineHeight: '2' }}>
          <li>Price per seat based on the selected quantity</li>
          <li>Total amount calculated automatically</li>
          <li>Clear indication this is for team access</li>
        </ul>
        <p className="success">
          <strong>Example:</strong> A customer selecting 5 seats will see the $9/seat price tier,
          totaling $45 (or $45/month for subscriptions).
        </p>
      </div>

      <div className="card">
        <h2>API Route Example</h2>
        <p>Implementation in Next.js API route:</p>
        <pre><code>{`// app/api/checkout/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { polar } from '@/lib/polar'

export async function POST(request: NextRequest) {
  try {
    const { productPriceId, seats, customerEmail } = await request.json()

    const checkout = await polar.checkouts.create({
      product_price_id: productPriceId,
      seats: seats,
      success_url: \`\${process.env.NEXT_PUBLIC_BASE_URL}/success\`,
      customer_email: customerEmail,
    })

    return NextResponse.json({ url: checkout.url })
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to create checkout' },
      { status: 500 }
    )
  }
}`}</code></pre>
      </div>

      <div className="card">
        <h2>Frontend Integration</h2>
        <p>Example React component for initiating checkout:</p>
        <pre><code>{`'use client'

import { useState } from 'react'

export default function CheckoutForm() {
  const [seats, setSeats] = useState(5)
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleCheckout() {
    setLoading(true)
    try {
      const response = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productPriceId: 'price_123',
          seats: seats,
          customerEmail: email,
        }),
      })

      const data = await response.json()

      if (data.url) {
        // Redirect to Polar checkout
        window.location.href = data.url
      }
    } catch (error) {
      console.error('Checkout failed:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <input
        type="number"
        min="1"
        value={seats}
        onChange={(e) => setSeats(Number(e.target.value))}
        placeholder="Number of seats"
      />
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="billing@company.com"
      />
      <button onClick={handleCheckout} disabled={loading}>
        {loading ? 'Creating checkout...' : 'Purchase Seats'}
      </button>
    </div>
  )
}`}</code></pre>
      </div>

      <div className="card">
        <h2>Checkout Parameters</h2>
        <table>
          <thead>
            <tr>
              <th>Parameter</th>
              <th>Description</th>
              <th>Required</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><code>product_price_id</code></td>
              <td>ID of the seat-based price</td>
              <td>Yes</td>
            </tr>
            <tr>
              <td><code>seats</code></td>
              <td>Number of seats to purchase</td>
              <td>Yes</td>
            </tr>
            <tr>
              <td><code>success_url</code></td>
              <td>Where to redirect after successful payment</td>
              <td>Yes</td>
            </tr>
            <tr>
              <td><code>customer_email</code></td>
              <td>Billing contact email</td>
              <td>Recommended</td>
            </tr>
          </tbody>
        </table>
      </div>
    </main>
  )
}
