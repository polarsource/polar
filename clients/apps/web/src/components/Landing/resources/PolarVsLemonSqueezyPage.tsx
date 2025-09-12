'use client'

import { ArrowOutwardOutlined, CheckOutlined } from '@mui/icons-material'
import Link from 'next/link'
import { ResourceLayout, ResourceSection } from './ResourceLayout'

export const PolarVsLemonSqueezyPage = () => {
  const toc = [
    { id: 'overview', title: 'Overview' },
    { id: 'pricing-comparison', title: 'Pricing Comparison' },
    { id: 'features-comparison', title: 'Features Comparison' },
    { id: 'developer-experience', title: 'Developer Experience' },
    { id: 'global-reach', title: 'Global Reach & Compliance' },
    { id: 'checkout-experience', title: 'Checkout Experience' },
    { id: 'payout-flexibility', title: 'Payout Flexibility' },
    { id: 'migration-guide', title: 'Migration from LemonSqueezy' },
  ]

  return (
    <ResourceLayout title="Polar vs LemonSqueezy" toc={toc}>
      <ResourceSection id="overview" title="Overview">
        <div className="flex flex-col gap-4">
          <p className="text-lg">
            Both Polar and LemonSqueezy are Merchant of Record (MoR) platforms
            designed to help developers and businesses sell digital products.
            However, they differ significantly in pricing, features, and
            approach to developer experience.
          </p>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="dark:bg-polar-800 rounded-lg bg-gray-50 p-6">
              <h3 className="mb-3 text-lg font-semibold">Polar</h3>
              <ul className="space-y-2 text-sm">
                <li className="flex items-start gap-2">
                  <CheckOutlined
                    className="mt-0.5 text-green-500"
                    fontSize="small"
                  />
                  <span>Open source payment infrastructure</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckOutlined
                    className="mt-0.5 text-green-500"
                    fontSize="small"
                  />
                  <span>4% + 40¢ per transaction (cheapest MoR)</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckOutlined
                    className="mt-0.5 text-green-500"
                    fontSize="small"
                  />
                  <span>API-first design with powerful SDKs</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckOutlined
                    className="mt-0.5 text-green-500"
                    fontSize="small"
                  />
                  <span>Built for developers by developers</span>
                </li>
              </ul>
            </div>

            <div className="dark:bg-polar-700 rounded-lg bg-gray-100 p-6">
              <h3 className="mb-3 text-lg font-semibold">LemonSqueezy</h3>
              <ul className="space-y-2 text-sm">
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 text-gray-500">•</span>
                  <span>Established MoR platform</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 text-gray-500">•</span>
                  <span>5% + 50¢</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 text-gray-500">•</span>
                  <span>Dashboard-focused experience</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 text-gray-500">•</span>
                  <span>Good for non-technical users</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </ResourceSection>

      <ResourceSection id="pricing-comparison" title="Pricing Comparison">
        <div className="flex flex-col gap-6">
          <p>
            Pricing is one of the most significant differences between Polar and
            LemonSqueezy. Polar offers transparent, developer-friendly pricing
            that&apos;s 20% cheaper than alternatives.
          </p>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="dark:bg-polar-800 bg-gray-50">
                  <th className="px-4 py-3 text-left">Feature</th>
                  <th className="px-4 py-3 text-left">Polar</th>
                  <th className="px-4 py-3 text-left">LemonSqueezy</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                <tr>
                  <td className="px-4 py-3 font-medium">Transaction Fee</td>
                  <td className="px-4 py-3 font-semibold text-green-600">
                    4% + 40¢
                  </td>
                  <td className="px-4 py-3">5% + 50¢</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 font-medium">Setup Fees</td>
                  <td className="px-4 py-3 text-green-600">$0</td>
                  <td className="px-4 py-3">$0</td>
                </tr>
                <tr className="dark:bg-polar-900 bg-gray-25">
                  <td className="px-4 py-3 font-medium">Monthly Fees</td>
                  <td className="px-4 py-3 text-green-600">$0</td>
                  <td className="px-4 py-3">$0</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="dark:bg-polar-800 rounded-lg bg-blue-50 p-6">
            <h4 className="mb-2 font-semibold">
              Real Example: $100 Product Sale
            </h4>
            <div className="grid grid-cols-1 gap-4 text-sm md:grid-cols-2">
              <div>
                <p className="font-medium text-green-600">With Polar:</p>
                <p>Transaction: $4.40 (4% + 40¢)</p>
                <p className="font-semibold">You receive: $95.60</p>
              </div>
              <div>
                <p className="font-medium">With LemonSqueezy:</p>
                <p>Transaction: $5.00 (5%)</p>
                <p>Processing: $3.20 (2.9% + 30¢)</p>
                <p className="font-semibold">You receive: $91.80</p>
              </div>
            </div>
            <p className="mt-3 font-semibold text-green-600">
              Save $3.80 per $100 sale with Polar (4.1% more revenue)
            </p>
          </div>
        </div>
      </ResourceSection>

      <ResourceSection id="features-comparison" title="Features Comparison">
        <div className="flex flex-col gap-6">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="dark:bg-polar-800 bg-gray-50">
                  <th className="px-4 py-3 text-left">Feature</th>
                  <th className="px-4 py-3 text-center">Polar</th>
                  <th className="px-4 py-3 text-center">LemonSqueezy</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                <tr>
                  <td className="px-4 py-3">Merchant of Record</td>
                  <td className="px-4 py-3 text-center">
                    <CheckOutlined className="text-green-500" />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <CheckOutlined className="text-green-500" />
                  </td>
                </tr>
                <tr className="dark:bg-polar-900 bg-gray-25">
                  <td className="px-4 py-3">Global Tax Compliance</td>
                  <td className="px-4 py-3 text-center">
                    <CheckOutlined className="text-green-500" />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <CheckOutlined className="text-green-500" />
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-3">Subscriptions</td>
                  <td className="px-4 py-3 text-center">
                    <CheckOutlined className="text-green-500" />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <CheckOutlined className="text-green-500" />
                  </td>
                </tr>
                <tr className="dark:bg-polar-900 bg-gray-25">
                  <td className="px-4 py-3">Usage-based Billing</td>
                  <td className="px-4 py-3 text-center">
                    <CheckOutlined className="text-green-500" />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="text-gray-400">❌</span>
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-3">API-first Architecture</td>
                  <td className="px-4 py-3 text-center">
                    <CheckOutlined className="text-green-500" />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="text-gray-400">Limited</span>
                  </td>
                </tr>
                <tr className="dark:bg-polar-900 bg-gray-25">
                  <td className="px-4 py-3">Open Source</td>
                  <td className="px-4 py-3 text-center">
                    <CheckOutlined className="text-green-500" />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="text-gray-400">❌</span>
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-3">Webhooks</td>
                  <td className="px-4 py-3 text-center">
                    <CheckOutlined className="text-green-500" />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <CheckOutlined className="text-green-500" />
                  </td>
                </tr>
                <tr className="dark:bg-polar-900 bg-gray-25">
                  <td className="px-4 py-3">Custom Checkout</td>
                  <td className="px-4 py-3 text-center">
                    <CheckOutlined className="text-green-500" />
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="text-gray-400">Limited</span>
                  </td>
                </tr>
                <tr>
                  <td className="px-4 py-3">Affiliate System</td>
                  <td className="px-4 py-3 text-center">
                    <span className="text-gray-400">Coming Soon</span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <CheckOutlined className="text-green-500" />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </ResourceSection>

      <ResourceSection id="developer-experience" title="Developer Experience">
        <div className="flex flex-col gap-6">
          <p>
            Polar is built by developers for developers, with a focus on
            providing the best possible developer experience through
            comprehensive APIs, SDKs, and documentation.
          </p>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div>
              <h4 className="mb-3 font-semibold text-green-600">
                Polar Advantages
              </h4>
              <ul className="space-y-2 text-sm">
                <li className="flex items-start gap-2">
                  <CheckOutlined
                    className="mt-0.5 text-green-500"
                    fontSize="small"
                  />
                  <span>Comprehensive REST API with OpenAPI specs</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckOutlined
                    className="mt-0.5 text-green-500"
                    fontSize="small"
                  />
                  <span>Official SDKs for Python, JavaScript, and more</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckOutlined
                    className="mt-0.5 text-green-500"
                    fontSize="small"
                  />
                  <span>React components for easy integration</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckOutlined
                    className="mt-0.5 text-green-500"
                    fontSize="small"
                  />
                  <span>Local development with self-hosting options</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckOutlined
                    className="mt-0.5 text-green-500"
                    fontSize="small"
                  />
                  <span>Real-time webhooks with retry logic</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckOutlined
                    className="mt-0.5 text-green-500"
                    fontSize="small"
                  />
                  <span>GraphQL support for flexible queries</span>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="mb-3 font-semibold">LemonSqueezy</h4>
              <ul className="space-y-2 text-sm text-gray-600">
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 text-gray-500">•</span>
                  <span>REST API with limited endpoints</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 text-gray-500">•</span>
                  <span>JavaScript SDK available</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 text-gray-500">•</span>
                  <span>Dashboard-first approach</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 text-gray-500">•</span>
                  <span>Good documentation</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 text-gray-500">•</span>
                  <span>Webhooks supported</span>
                </li>
              </ul>
            </div>
          </div>

          <div className="dark:bg-polar-800 rounded-lg bg-gray-50 p-6">
            <h4 className="mb-3 font-semibold">
              Code Example: Creating a Product
            </h4>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <p className="mb-2 text-sm font-medium text-green-600">
                  Polar (Python SDK)
                </p>
                <pre className="dark:bg-polar-900 overflow-x-auto rounded bg-white p-3 text-xs">
                  {`from polar_sdk import Polar

polar = Polar(access_token="your_token")

product = polar.products.create({
  "name": "My SaaS Product",
  "type": "subscription",
  "prices": [{
    "amount": 2999,
    "currency": "USD",
    "interval": "month"
  }]
})`}
                </pre>
              </div>
              <div>
                <p className="mb-2 text-sm font-medium">LemonSqueezy (HTTP)</p>
                <pre className="overflow-x-auto rounded bg-white p-3 text-xs dark:bg-gray-700">
                  {`curl -X POST \\
  https://api.lemonsqueezy.com/v1/products \\
  -H "Authorization: Bearer token" \\
  -H "Content-Type: application/json" \\
  -d '{
    "data": {
      "type": "products",
      "attributes": {
        "name": "My SaaS Product"
      }
    }
  }'`}
                </pre>
              </div>
            </div>
          </div>
        </div>
      </ResourceSection>

      <ResourceSection id="global-reach" title="Global Reach & Compliance">
        <div className="flex flex-col gap-4">
          <p>
            Both platforms handle global tax compliance as a Merchant of Record,
            but they differ in their approach to international markets.
          </p>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="dark:bg-polar-800 rounded-lg bg-gray-50 p-6">
              <h4 className="mb-3 font-semibold">Polar</h4>
              <ul className="space-y-2 text-sm">
                <li>✅ Global VAT/GST compliance</li>
                <li>✅ 135+ countries supported</li>
                <li>✅ Automatic tax calculation</li>
                <li>✅ EU, US, UK tax registration</li>
                <li>✅ Currency conversion</li>
                <li>✅ GDPR compliant</li>
              </ul>
            </div>

            <div className="dark:bg-polar-700 rounded-lg bg-gray-100 p-6">
              <h4 className="mb-3 font-semibold">LemonSqueezy</h4>
              <ul className="space-y-2 text-sm">
                <li>✅ Global tax compliance</li>
                <li>✅ Multiple countries supported</li>
                <li>✅ Automatic tax handling</li>
                <li>✅ Regional tax registration</li>
                <li>✅ Multi-currency support</li>
                <li>✅ Privacy compliant</li>
              </ul>
            </div>
          </div>

          <div className="rounded-lg bg-blue-50 p-6 dark:bg-blue-900">
            <p className="text-sm">
              <strong>Key Difference:</strong> Polar&apos;s transparent pricing
              means you know exactly what you&apos;ll pay regardless of customer
              location, while LemonSqueezy may have variable fees for different
              regions.
            </p>
          </div>
        </div>
      </ResourceSection>

      <ResourceSection id="checkout-experience" title="Checkout Experience">
        <div className="flex flex-col gap-6">
          <p>
            The checkout experience is crucial for conversion rates. Both
            platforms offer hosted checkout pages, but Polar provides more
            customization options.
          </p>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div>
              <h4 className="mb-3 font-semibold text-green-600">
                Polar Checkout
              </h4>
              <ul className="space-y-2 text-sm">
                <li className="flex items-start gap-2">
                  <CheckOutlined
                    className="mt-0.5 text-green-500"
                    fontSize="small"
                  />
                  <span>Fully customizable checkout pages</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckOutlined
                    className="mt-0.5 text-green-500"
                    fontSize="small"
                  />
                  <span>Embedded checkout components</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckOutlined
                    className="mt-0.5 text-green-500"
                    fontSize="small"
                  />
                  <span>Custom CSS and branding</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckOutlined
                    className="mt-0.5 text-green-500"
                    fontSize="small"
                  />
                  <span>Mobile-optimized by default</span>
                </li>
                <li className="flex items-start gap-2">
                  <CheckOutlined
                    className="mt-0.5 text-green-500"
                    fontSize="small"
                  />
                  <span>A/B testing support</span>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="mb-3 font-semibold">LemonSqueezy Checkout</h4>
              <ul className="space-y-2 text-sm text-gray-600">
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 text-gray-500">•</span>
                  <span>Hosted checkout pages</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 text-gray-500">•</span>
                  <span>Limited customization options</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 text-gray-500">•</span>
                  <span>Basic branding support</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 text-gray-500">•</span>
                  <span>Mobile-friendly</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-0.5 text-gray-500">•</span>
                  <span>Standard checkout flow</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </ResourceSection>

      <ResourceSection id="payout-flexibility" title="Payout Flexibility">
        <div className="flex flex-col gap-4">
          <p>
            How and when you receive your money is important for cash flow
            management.
          </p>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div className="dark:bg-polar-800 rounded-lg bg-gray-50 p-6">
              <h4 className="mb-3 font-semibold">Polar Payouts</h4>
              <ul className="space-y-2 text-sm">
                <li>✅ Manual payout control</li>
                <li>✅ Multiple payout methods (Stripe, Open Collective)</li>
                <li>✅ No additional Polar fees</li>
                <li>✅ Flexible payout schedules</li>
                <li>✅ Real-time balance tracking</li>
              </ul>
            </div>

            <div className="dark:bg-polar-700 rounded-lg bg-gray-100 p-6">
              <h4 className="mb-3 font-semibold">LemonSqueezy Payouts</h4>
              <ul className="space-y-2 text-sm">
                <li>✅ Automated payouts</li>
                <li>✅ PayPal and bank transfers</li>
                <li>✅ Weekly/monthly schedules</li>
                <li>❌ Limited manual control</li>
                <li>✅ Payout reporting</li>
              </ul>
            </div>
          </div>
        </div>
      </ResourceSection>

      <ResourceSection id="migration-guide" title="Migration from LemonSqueezy">
        <div className="flex flex-col gap-6">
          <p>
            Switching from LemonSqueezy to Polar is straightforward thanks to
            our comprehensive APIs and migration tools.
          </p>

          <div className="dark:bg-polar-800 rounded-lg bg-gray-50 p-6">
            <h4 className="mb-4 font-semibold">Migration Checklist</h4>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <h5 className="mb-2 font-medium">Data Migration</h5>
                <ul className="space-y-1 text-sm">
                  <li>□ Export customer data from LemonSqueezy</li>
                  <li>□ Import products to Polar</li>
                  <li>□ Set up pricing and subscriptions</li>
                  <li>□ Configure tax settings</li>
                </ul>
              </div>
              <div>
                <h5 className="mb-2 font-medium">Integration</h5>
                <ul className="space-y-1 text-sm">
                  <li>□ Install Polar SDK</li>
                  <li>□ Update checkout links</li>
                  <li>□ Configure webhooks</li>
                  <li>□ Test payment flow</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="rounded-lg bg-green-50 p-6 dark:bg-green-900">
            <h4 className="mb-2 font-semibold">Migration Support</h4>
            <p className="mb-4 text-sm">
              Our team provides white-glove migration assistance to help you
              switch from LemonSqueezy to Polar with zero downtime.
            </p>
            <Link
              href="mailto:support@polar.sh?subject=Migration%20from%20LemonSqueezy"
              className="inline-flex items-center gap-2 border-b border-current text-sm font-medium"
            >
              Contact our migration team
              <ArrowOutwardOutlined fontSize="inherit" />
            </Link>
          </div>

          <div className="space-y-4">
            <h4 className="font-semibold">Expected Savings After Migration</h4>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">20%</div>
                <div className="text-sm text-gray-600">Lower fees</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">50%</div>
                <div className="text-sm text-gray-600">Faster development</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">100%</div>
                <div className="text-sm text-gray-600">More control</div>
              </div>
            </div>
          </div>
        </div>
      </ResourceSection>
    </ResourceLayout>
  )
}
