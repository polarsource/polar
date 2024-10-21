'use client'

import { ArrowForward, KeyboardArrowRight } from '@mui/icons-material'
import Link from 'next/link'
import Button from 'polarkit/components/ui/atoms/button'

export const GetStarted = () => {
  return (
    <div className="grid grid-cols-1 gap-y-12 md:grid-cols-3 md:gap-x-16">
      <div className="rounded-4xl dark:bg-polar-900 relative col-span-1 flex w-full flex-col justify-between gap-y-8 p-10">
        <div className="flex w-full flex-col gap-y-8">
          <div className="flex w-full max-w-sm flex-col gap-y-6">
            <h3 className="text-3xl font-medium leading-tight">
              Build with Polar without any headaches
            </h3>
          </div>
          <ul className="dark:text-polar-200 flex flex-col gap-y-2">
            <li className="flex flex-row gap-x-2">
              <ArrowForward className="mt-1" fontSize="inherit" />
              <span>Use the Polar SDK on your platform</span>
            </li>
            <li className="flex flex-row gap-x-2">
              <ArrowForward className="mt-1" fontSize="inherit" />
              <span>Generate Checkout Sessions</span>
            </li>
            <li className="flex flex-row gap-x-2">
              <ArrowForward className="mt-1" fontSize="inherit" />
              <span>Consume our reliable Webhooks</span>
            </li>
            <li className="flex flex-row gap-x-2">
              <ArrowForward className="mt-1" fontSize="inherit" />
              <span>Reconcile checkouts with your own database</span>
            </li>
          </ul>
        </div>
        <Link href="/docs/guides/nextjs">
          <Button
            size="lg"
            fullWidth
            wrapperClassNames="flex flex-row items-center gap-x-1"
          >
            <span>Polar Integration Guide</span>
            <KeyboardArrowRight className="text-lg" fontSize="inherit" />
          </Button>
        </Link>
      </div>
      <div className="dark:bg-polar-950 dark:border-polar-700 col-span-2 flex w-full flex-col gap-y-6 overflow-auto rounded-2xl border p-6 text-sm">
        <div className="flex flex-row items-center gap-x-1.5">
          <div className="h-2.5 w-2.5 rounded-full bg-red-500" />
          <div className="h-2.5 w-2.5 rounded-full bg-yellow-500" />
          <div className="h-2.5 w-2.5 rounded-full bg-green-500" />
        </div>
        <div className="flex flex-col gap-y-2">
          <span className="dark:text-polar-500 font-mono">
            src/app/api/webhook/polar/route.ts
          </span>
          <pre>
            <code className="language-js">{`export async function POST(request: NextRequest) {
	const requestBody = await request.text();

	const webhookSecret = Buffer.from(env.POLAR_WEBHOOK_SECRET).toString(
		"base64",
	);
	const wh = new Webhook(webhookSecret);
	const webhookPayload = wh.verify(requestBody, request.headers);

	switch (webhookPayload.type) {
		case "checkout.created":
			break;
		case "checkout.updated":
			break;
		default:
			console.log(\`Unhandled event type \${webhookPayload.type}\`);
	}

	return NextResponse.json({ received: true });
}`}</code>
          </pre>
        </div>
      </div>
    </div>
  )
}
