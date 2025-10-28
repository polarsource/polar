import Link from 'next/link'

export default function ClaimExample() {
  return (
    <main>
      <nav>
        <Link href="/">← Back to Home</Link>
      </nav>

      <h1>Seat Claim Flow</h1>
      <p>
        When a team member receives an invitation email, they click a link with an
        invitation token. These examples show how to implement the claim flow.
      </p>

      <div className="card">
        <h2>Get Claim Information</h2>
        <p>First, retrieve information about the invitation (no authentication required):</p>
        <pre><code>{`import { polar } from '@/lib/polar'

async function handleClaimPage(token: string) {
  // Get claim information (no auth required)
  const claimInfo = await polar.customerSeats.getClaimInfo({
    invitation_token: token
  });

  if (!claimInfo.can_claim) {
    return {
      error: "This invitation has expired or already been claimed"
    };
  }

  return {
    product: claimInfo.product_name,
    organization: claimInfo.organization_name,
    email: claimInfo.customer_email
  };
}`}</code></pre>
      </div>

      <div className="card">
        <h2>Claim the Seat</h2>
        <p>Process the claim and receive a customer session token:</p>
        <pre><code>{`import { polar } from '@/lib/polar'

async function claimSeat(token: string) {
  const { seat, customer_session_token } =
    await polar.customerSeats.claim({
      invitation_token: token
    });

  // Store the customer session token
  // This allows immediate portal access
  localStorage.setItem('polar_session', customer_session_token);

  return {
    success: true,
    seat: seat,
    sessionToken: customer_session_token
  };
}`}</code></pre>
      </div>

      <div className="card">
        <h2>Complete Claim Page Component</h2>
        <p>React component for the claim flow:</p>
        <pre><code>{`'use client'

import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'

interface ClaimInfo {
  product?: string
  organization?: string
  email?: string
  error?: string
}

export default function ClaimPage() {
  const searchParams = useSearchParams()
  const token = searchParams.get('token')
  const [claimInfo, setClaimInfo] = useState<ClaimInfo | null>(null)
  const [claiming, setClaiming] = useState(false)

  useEffect(() => {
    if (token) {
      loadClaimInfo()
    }
  }, [token])

  async function loadClaimInfo() {
    const response = await fetch(\`/api/claim/info?token=\${token}\`)
    const info = await response.json()
    setClaimInfo(info)
  }

  async function handleClaim() {
    setClaiming(true)
    try {
      const response = await fetch('/api/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      })

      const result = await response.json()

      if (result.success) {
        // Redirect to customer portal
        window.location.href = \`/portal?session=\${result.sessionToken}\`
      } else {
        alert('Failed to claim seat')
      }
    } catch (error) {
      alert('Failed to claim seat')
    } finally {
      setClaiming(false)
    }
  }

  if (!claimInfo) {
    return <div>Loading...</div>
  }

  if (claimInfo.error) {
    return (
      <div className="error">
        <h2>Error</h2>
        <p>{claimInfo.error}</p>
      </div>
    )
  }

  return (
    <div>
      <h1>You've been invited!</h1>
      <p>
        Join {claimInfo.organization}'s {claimInfo.product} plan
      </p>
      <p>Email: {claimInfo.email}</p>

      <button onClick={handleClaim} disabled={claiming}>
        {claiming ? "Claiming..." : "Claim My Seat"}
      </button>
    </div>
  )
}`}</code></pre>
      </div>

      <div className="card">
        <h2>API Route: Get Claim Info</h2>
        <p>Endpoint to retrieve claim information:</p>
        <pre><code>{`// app/api/claim/info/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { polar } from '@/lib/polar'

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token')

  if (!token) {
    return NextResponse.json(
      { error: 'Token is required' },
      { status: 400 }
    )
  }

  try {
    const claimInfo = await polar.customerSeats.getClaimInfo({
      invitation_token: token
    })

    if (!claimInfo.can_claim) {
      return NextResponse.json({
        error: "This invitation has expired or already been claimed"
      })
    }

    return NextResponse.json({
      product: claimInfo.product_name,
      organization: claimInfo.organization_name,
      email: claimInfo.customer_email
    })
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to get claim info' },
      { status: 500 }
    )
  }
}`}</code></pre>
      </div>

      <div className="card">
        <h2>API Route: Claim Seat</h2>
        <p>Endpoint to process the claim:</p>
        <pre><code>{`// app/api/claim/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { polar } from '@/lib/polar'

export async function POST(request: NextRequest) {
  try {
    const { token } = await request.json()

    const { seat, customer_session_token } =
      await polar.customerSeats.claim({
        invitation_token: token
      })

    return NextResponse.json({
      success: true,
      seat: seat,
      sessionToken: customer_session_token
    })
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to claim seat' },
      { status: 500 }
    )
  }
}`}</code></pre>
      </div>

      <div className="card">
        <h2>Error Handling</h2>
        <p>Handle expired or invalid tokens gracefully:</p>
        <pre><code>{`try {
  await claimSeat(token);
} catch (error: any) {
  if (error.status === 400) {
    // Show resend option
    return "This invitation has expired. Contact your admin to resend.";
  }
  throw error;
}`}</code></pre>
      </div>

      <div className="card">
        <h2>Claim Flow Summary</h2>
        <ol style={{ marginLeft: '1.5rem', lineHeight: '2' }}>
          <li>Team member receives invitation email with token</li>
          <li>User clicks link: <code>/claim?token=abc123...</code></li>
          <li>Page fetches claim info using token</li>
          <li>User clicks "Claim My Seat" button</li>
          <li>Benefits are granted via background job</li>
          <li>User gets customer session token for portal access</li>
        </ol>
      </div>
    </main>
  )
}
