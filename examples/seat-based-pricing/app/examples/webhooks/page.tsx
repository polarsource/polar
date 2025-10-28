import Link from 'next/link'

export default function WebhooksExample() {
  return (
    <main>
      <nav>
        <Link href="/">← Back to Home</Link>
      </nav>

      <h1>Webhook Handlers</h1>
      <p>
        Examples of handling Polar webhooks for seat-based products. Webhooks notify your
        application of important events like subscriptions, orders, and benefit grants.
      </p>

      <div className="card">
        <h2>Post-Purchase Webhooks</h2>
        <p>Handle subscription and order creation events:</p>
        <pre><code>{`// app/api/webhooks/polar/route.ts
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const event = await request.json()

  // For subscriptions
  if (event.type === 'subscription.created') {
    const subscription = event.data

    if (subscription.product.has_seat_based_price) {
      await notifyBillingManager(subscription.customer_id, {
        message: \`Your \${subscription.seats}-seat subscription is active!\`,
        manage_seats_url: \`https://yourapp.com/seats/subscription/\${subscription.id}\`
      })
    }
  }

  // For one-time purchases
  if (event.type === 'order.created') {
    const order = event.data

    if (order.seats) {
      await notifyBillingManager(order.customer_id, {
        message: \`Your \${order.seats} perpetual seat licenses have been purchased!\`,
        manage_seats_url: \`https://yourapp.com/seats/order/\${order.id}\`
      })
    }
  }

  return NextResponse.json({ received: true })
}

async function notifyBillingManager(customerId: string, info: any) {
  // Send email, push notification, etc.
  console.log('Notify customer:', customerId, info)
}`}</code></pre>
      </div>

      <div className="card">
        <h2>Benefit Grant Webhooks</h2>
        <p>Handle when benefits are granted or revoked after seat claims:</p>
        <pre><code>{`// app/api/webhooks/polar/route.ts
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const event = await request.json()

  if (event.type === 'benefit_grant.created') {
    const grant = event.data

    // A team member received their benefits
    console.log(\`Benefit \${grant.benefit_id} granted to \${grant.customer_id}\`)

    // Update your app (e.g., create license, grant access)
    await grantAccess(grant.customer_id, grant.benefit)
  }

  if (event.type === 'benefit_grant.revoked') {
    const grant = event.data

    // A seat was revoked
    await revokeAccess(grant.customer_id, grant.benefit)
  }

  return NextResponse.json({ received: true })
}

async function grantAccess(customerId: string, benefit: any) {
  // Implement your access granting logic
  console.log('Grant access:', customerId, benefit)
}

async function revokeAccess(customerId: string, benefit: any) {
  // Implement your access revocation logic
  console.log('Revoke access:', customerId, benefit)
}`}</code></pre>
      </div>

      <div className="card">
        <h2>Complete Webhook Handler</h2>
        <p>Full example with all relevant events:</p>
        <pre><code>{`// app/api/webhooks/polar/route.ts
import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'

export async function POST(request: NextRequest) {
  // Verify webhook signature (recommended)
  const signature = request.headers.get('polar-signature')
  const body = await request.text()

  if (!verifyWebhookSignature(body, signature)) {
    return NextResponse.json(
      { error: 'Invalid signature' },
      { status: 401 }
    )
  }

  const event = JSON.parse(body)

  try {
    switch (event.type) {
      case 'subscription.created':
        await handleSubscriptionCreated(event.data)
        break

      case 'subscription.updated':
        await handleSubscriptionUpdated(event.data)
        break

      case 'order.created':
        await handleOrderCreated(event.data)
        break

      case 'benefit_grant.created':
        await handleBenefitGranted(event.data)
        break

      case 'benefit_grant.revoked':
        await handleBenefitRevoked(event.data)
        break

      default:
        console.log('Unhandled event type:', event.type)
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('Webhook processing error:', error)
    return NextResponse.json(
      { error: 'Processing failed' },
      { status: 500 }
    )
  }
}

function verifyWebhookSignature(body: string, signature: string | null): boolean {
  if (!signature) return false

  const secret = process.env.POLAR_WEBHOOK_SECRET
  if (!secret) return true // Skip verification if no secret configured

  const hmac = crypto.createHmac('sha256', secret)
  hmac.update(body)
  const digest = hmac.digest('hex')

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(digest)
  )
}

async function handleSubscriptionCreated(subscription: any) {
  if (subscription.product.has_seat_based_price) {
    console.log(\`New subscription with \${subscription.seats} seats\`)
    // Send email to billing manager
    // Create internal record
  }
}

async function handleSubscriptionUpdated(subscription: any) {
  if (subscription.product.has_seat_based_price) {
    console.log(\`Subscription updated: \${subscription.seats} seats\`)
    // Handle seat count changes
  }
}

async function handleOrderCreated(order: any) {
  if (order.seats) {
    console.log(\`New order with \${order.seats} seats\`)
    // Create internal record for perpetual seats
  }
}

async function handleBenefitGranted(grant: any) {
  console.log(\`Grant benefit \${grant.benefit_id} to \${grant.customer_id}\`)
  // Grant access in your system
  // Create license key
  // Add to Discord
}

async function handleBenefitRevoked(grant: any) {
  console.log(\`Revoke benefit \${grant.benefit_id} from \${grant.customer_id}\`)
  // Remove access from your system
  // Invalidate license key
  // Remove from Discord
}`}</code></pre>
      </div>

      <div className="card">
        <h2>Webhook Events for Seat-Based Products</h2>
        <table>
          <thead>
            <tr>
              <th>Event</th>
              <th>When It Fires</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><code>subscription.created</code></td>
              <td>Customer completes checkout</td>
              <td>Notify billing manager, create internal record</td>
            </tr>
            <tr>
              <td><code>subscription.updated</code></td>
              <td>Seat count changes</td>
              <td>Update internal records, notify team</td>
            </tr>
            <tr>
              <td><code>order.created</code></td>
              <td>One-time purchase completed</td>
              <td>Create perpetual seat records</td>
            </tr>
            <tr>
              <td><code>benefit_grant.created</code></td>
              <td>Team member claims seat</td>
              <td>Grant access, create license, add to systems</td>
            </tr>
            <tr>
              <td><code>benefit_grant.revoked</code></td>
              <td>Seat is revoked</td>
              <td>Remove access, invalidate licenses</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="card">
        <h2>Testing Webhooks Locally</h2>
        <p>Use a tool like ngrok to test webhooks during development:</p>
        <pre><code>{`# Start your Next.js dev server
pnpm dev

# In another terminal, expose your local server
ngrok http 3000

# Configure webhook URL in Polar dashboard:
# https://your-ngrok-url.ngrok.io/api/webhooks/polar`}</code></pre>
      </div>

      <div className="card">
        <h2>Best Practices</h2>
        <ul style={{ marginLeft: '1.5rem', lineHeight: '2' }}>
          <li><strong>Always verify signatures</strong> in production</li>
          <li><strong>Return 200 quickly</strong> - process work asynchronously</li>
          <li><strong>Handle retries</strong> - Polar will retry failed webhooks</li>
          <li><strong>Log events</strong> for debugging and auditing</li>
          <li><strong>Be idempotent</strong> - same event may be delivered multiple times</li>
        </ul>
      </div>
    </main>
  )
}
