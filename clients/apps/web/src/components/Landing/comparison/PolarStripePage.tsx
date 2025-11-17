'use client'

import GetStartedButton from '@/components/Auth/GetStartedButton'
import CheckOutlined from '@mui/icons-material/CheckOutlined'
import CloseOutlined from '@mui/icons-material/CloseOutlined'
import { useState } from 'react'
import { ResourceLayout, ResourceSection } from '../resources/ResourceLayout'

export const PolarVsStripePage = () => {
  const [openFAQ, setOpenFAQ] = useState<number | null>(null)
  const tocItems = [
    { id: 'overview', title: 'Overview' },
    { id: 'comparison', title: 'Feature Comparison' },
    { id: 'pricing', title: 'Pricing' },
    { id: 'developer-experience', title: 'Developer Experience' },
    { id: 'merchant-of-record', title: 'Merchant of Record' },
    { id: 'why-polar', title: 'Why Choose Polar?' },
  ]

  return (
    <ResourceLayout title="Polar vs Stripe" toc={tocItems}>
      <ResourceSection id="overview" title="Overview">
        <p className="text-lg">
          Choosing the right payment infrastructure for your software business.
        </p>
        <p className="dark:text-polar-300 text-gray-500">
          While Stripe is a powerful payment processor, Polar is a complete
          billing infrastructure platform built specifically for developers who
          want to monetize software. The key difference: Polar acts as a
          Merchant of Record, handling all tax compliance globally, while Stripe
          is a payment processor that leaves tax compliance to you.
        </p>
      </ResourceSection>

      <ResourceSection id="comparison" title="Feature Comparison">
        <div className="dark:border-polar-700 overflow-x-auto border border-gray-200">
          <table className="w-full">
            <thead className="dark:bg-polar-800 bg-gray-50">
              <tr className="dark:border-polar-700 border-b border-gray-200">
                <th className="dark:border-polar-700 border-r border-gray-200 p-4 text-left font-medium">
                  Feature
                </th>
                <th className="dark:border-polar-700 border-r border-gray-200 p-4 text-center font-medium">
                  Polar
                </th>
                <th className="p-4 text-center font-medium">Stripe</th>
              </tr>
            </thead>
            <tbody className="dark:divide-polar-700 divide-y divide-gray-200">
              <tr>
                <td className="dark:border-polar-700 border-r border-gray-200 p-4">
                  Payment Processing
                </td>
                <td className="dark:border-polar-700 border-r border-gray-200 p-4 text-center">
                  <CheckOutlined className="text-green-600" fontSize="small" />
                </td>
                <td className="p-4 text-center">
                  <CheckOutlined className="text-green-600" fontSize="small" />
                </td>
              </tr>
              <tr>
                <td className="dark:border-polar-700 border-r border-gray-200 p-4">
                  Subscription Management
                </td>
                <td className="dark:border-polar-700 border-r border-gray-200 p-4 text-center">
                  <CheckOutlined className="text-green-600" fontSize="small" />
                </td>
                <td className="p-4 text-center">
                  <CheckOutlined className="text-green-600" fontSize="small" />
                </td>
              </tr>
              <tr>
                <td className="dark:border-polar-700 border-r border-gray-200 p-4">
                  Merchant of Record
                </td>
                <td className="dark:border-polar-700 border-r border-gray-200 p-4 text-center">
                  <CheckOutlined className="text-green-600" fontSize="small" />
                </td>
                <td className="p-4 text-center">
                  <CloseOutlined className="text-red-600" fontSize="small" />
                </td>
              </tr>
              <tr>
                <td className="dark:border-polar-700 border-r border-gray-200 p-4">
                  Global Tax Compliance
                </td>
                <td className="dark:border-polar-700 border-r border-gray-200 p-4 text-center">
                  <CheckOutlined className="text-green-600" fontSize="small" />
                </td>
                <td className="p-4 text-center">
                  <CloseOutlined className="text-red-600" fontSize="small" />
                </td>
              </tr>
              <tr>
                <td className="dark:border-polar-700 border-r border-gray-200 p-4">
                  Framework Adapters
                </td>
                <td className="dark:border-polar-700 border-r border-gray-200 p-4 text-center">
                  <CheckOutlined className="text-green-600" fontSize="small" />
                </td>
                <td className="p-4 text-center">
                  <CloseOutlined className="text-red-600" fontSize="small" />
                </td>
              </tr>
              <tr>
                <td className="dark:border-polar-700 border-r border-gray-200 p-4">
                  Automated Benefits Engine
                </td>
                <td className="dark:border-polar-700 border-r border-gray-200 p-4 text-center">
                  <CheckOutlined className="text-green-600" fontSize="small" />
                </td>
                <td className="p-4 text-center">
                  <CloseOutlined className="text-red-600" fontSize="small" />
                </td>
              </tr>
              <tr>
                <td className="dark:border-polar-700 border-r border-gray-200 p-4">
                  Open Source
                </td>
                <td className="dark:border-polar-700 border-r border-gray-200 p-4 text-center">
                  <CheckOutlined className="text-green-600" fontSize="small" />
                </td>
                <td className="p-4 text-center">
                  <CloseOutlined className="text-red-600" fontSize="small" />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </ResourceSection>

      <ResourceSection id="pricing" title="Pricing">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="dark:border-polar-700 flex flex-col gap-4 border border-gray-200 p-6">
            <div className="flex flex-col gap-2">
              <h3 className="text-lg font-medium">Polar</h3>
              <div className="text-4xl">4% + 40¢</div>
              <p className="dark:text-polar-300 text-sm text-gray-500">
                per transaction
              </p>
            </div>
            <ul className="dark:divide-polar-700 flex flex-col divide-y divide-gray-200">
              <li className="flex items-start gap-2 py-2">
                <CheckOutlined className="text-green-600" fontSize="small" />
                <span className="dark:text-polar-300 text-sm text-gray-600">
                  Global tax compliance included
                </span>
              </li>
              <li className="flex items-start gap-2 py-2">
                <CheckOutlined className="text-green-600" fontSize="small" />
                <span className="dark:text-polar-300 text-sm text-gray-600">
                  No hidden fees
                </span>
              </li>
              <li className="flex items-start gap-2 py-2">
                <CheckOutlined className="text-green-600" fontSize="small" />
                <span className="dark:text-polar-300 text-sm text-gray-600">
                  Merchant of Record service
                </span>
              </li>
            </ul>
          </div>

          <div className="dark:border-polar-700 flex flex-col gap-4 border border-gray-200 p-6">
            <div className="flex flex-col gap-2">
              <h3 className="text-lg font-medium">Stripe</h3>
              <div className="text-4xl">2.9% + 30¢</div>
              <p className="dark:text-polar-300 text-sm text-gray-500">
                per transaction
              </p>
            </div>
            <ul className="dark:divide-polar-700 flex flex-col divide-y divide-gray-200">
              <li className="flex items-start gap-2 py-2">
                <CloseOutlined className="text-red-600" fontSize="small" />
                <span className="dark:text-polar-300 text-sm text-gray-600">
                  Tax compliance is your responsibility
                </span>
              </li>
              <li className="flex items-start gap-2 py-2">
                <CloseOutlined className="text-red-600" fontSize="small" />
                <span className="dark:text-polar-300 text-sm text-gray-600">
                  Subscriptions at 0.7% added fee
                </span>
              </li>
              <li className="flex items-start gap-2 py-2">
                <CloseOutlined className="text-red-600" fontSize="small" />
                <span className="dark:text-polar-300 text-sm text-gray-600">
                  Additional costs for international sales
                </span>
              </li>
            </ul>
          </div>
        </div>
        <p className="dark:text-polar-300 text-sm text-gray-500">
          While Stripe&apos;s base processing fee appears lower, Polar&apos;s
          pricing includes Merchant of Record services, global tax compliance,
          and international sales tax handling that would require additional
          Stripe products and accounting services.
        </p>
      </ResourceSection>

      <ResourceSection id="developer-experience" title="Developer Experience">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <h3 className="text-lg">Designed for developers</h3>
            <p className="dark:text-polar-300 text-gray-500">
              Both Stripe and Polar offer excellent developer experiences, but
              Polar is purpose-built for software monetization with modern
              frameworks and ergonomic SDKs.
            </p>
          </div>
          <ul className="dark:border-polar-700 dark:divide-polar-700 divide-y divide-gray-200 border-y border-gray-200 [&>li]:py-3">
            <li>
              <h4 className="font-medium">6-line integration</h4>
              <p className="dark:text-polar-300 text-gray-500">
                Polar provides a 6-line integration with framework adapters,
                making it easy to get started with minimal code.
              </p>
            </li>
            <li>
              <h4 className="font-medium">Framework adapters</h4>
              <p className="dark:text-polar-300 text-gray-500">
                Polar provides native support for Next.js, BetterAuth, Laravel,
                and more.
              </p>
            </li>
            <li>
              <h4 className="font-medium">Open source</h4>
              <p className="dark:text-polar-300 text-gray-500">
                Polar is open source, so you can inspect and contribute to the
                codebase.
              </p>
            </li>
          </ul>
        </div>
      </ResourceSection>

      <ResourceSection id="merchant-of-record" title="Merchant of Record">
        <div className="flex flex-col gap-4">
          <h3 className="text-lg">The key differentiator</h3>
          <p className="dark:text-polar-300 text-gray-500">
            This is where Polar and Stripe fundamentally differ. Polar acts as
            the Merchant of Record, meaning we handle all the complexity of
            international sales tax, VAT, GST, and compliance.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div className="dark:bg-polar-800 flex flex-col gap-3 bg-gray-50 p-6">
            <h4 className="font-medium">With Polar (MoR)</h4>
            <ul className="flex flex-col gap-2">
              <li className="dark:text-polar-300 flex items-start gap-2 text-sm text-gray-600">
                <CheckOutlined className="text-green-600" fontSize="small" />
                We handle all tax compliance
              </li>
              <li className="dark:text-polar-300 flex items-start gap-2 text-sm text-gray-600">
                <CheckOutlined className="text-green-600" fontSize="small" />
                We file tax returns globally
              </li>
              <li className="dark:text-polar-300 flex items-start gap-2 text-sm text-gray-600">
                <CheckOutlined className="text-green-600" fontSize="small" />
                We take on the liability
              </li>
              <li className="dark:text-polar-300 flex items-start gap-2 text-sm text-gray-600">
                <CheckOutlined className="text-green-600" fontSize="small" />
                You focus on building
              </li>
            </ul>
          </div>

          <div className="dark:bg-polar-800 flex flex-col gap-3 bg-gray-50 p-6">
            <h4 className="font-medium">With Stripe (Payment Processor)</h4>
            <ul className="flex flex-col gap-2">
              <li className="dark:text-polar-300 flex items-start gap-2 text-sm text-gray-600">
                <CloseOutlined className="text-red-600" fontSize="small" />
                You handle tax compliance
              </li>
              <li className="dark:text-polar-300 flex items-start gap-2 text-sm text-gray-600">
                <CloseOutlined className="text-red-600" fontSize="small" />
                You file tax returns in each jurisdiction
              </li>
              <li className="dark:text-polar-300 flex items-start gap-2 text-sm text-gray-600">
                <CloseOutlined className="text-red-600" fontSize="small" />
                You carry the liability
              </li>
              <li className="dark:text-polar-300 flex items-start gap-2 text-sm text-gray-600">
                <CloseOutlined className="text-red-600" fontSize="small" />
                Requires accounting/legal support
              </li>
            </ul>
          </div>
        </div>
      </ResourceSection>

      <ResourceSection id="why-polar" title="Why Choose Polar?">
        <div className="flex flex-col gap-4">
          <h3 className="text-lg">
            Polar is purpose-built for software businesses
          </h3>
          <p className="dark:text-polar-300 text-gray-500">
            While Stripe is a powerful general-purpose payment processor, Polar
            is specifically designed for developers monetizing software. If you
            want to sell globally without worrying about tax compliance, Polar
            is the better choice.
          </p>
        </div>
        <ul className="dark:border-polar-700 dark:divide-polar-700 divide-y divide-gray-200 border-y border-gray-200 [&>li]:py-3">
          <li>
            <h4 className="font-medium">Zero tax complexity</h4>
            <p className="dark:text-polar-300 text-gray-500">
              Sell globally from day one without worrying about VAT, GST, or
              sales tax.
            </p>
          </li>
          <li>
            <h4 className="font-medium">Lower total cost</h4>
            <p className="dark:text-polar-300 text-gray-500">
              No need for additional tax software, accountants, or legal counsel
              for international sales.
            </p>
          </li>
          <li>
            <h4 className="font-medium">Built for software</h4>
            <p className="dark:text-polar-300 text-gray-500">
              Features designed specifically for SaaS, digital products, and
              software licensing.
            </p>
          </li>
          <li>
            <h4 className="font-medium">Open source transparency</h4>
            <p className="dark:text-polar-300 text-gray-500">
              See exactly how the platform works and contribute to its
              development
            </p>
          </li>
        </ul>
      </ResourceSection>

      <div className="dark:border-polar-700 flex flex-col border-t border-gray-200 pt-16">
        <div className="flex flex-col items-center gap-8">
          <div className="flex flex-col items-center gap-4">
            <h3 className="text-xl">Ready to simplify your payments?</h3>
            <p className="dark:text-polar-300 text-center text-gray-700 md:w-[440px]">
              Join thousands of developers who have chosen Polar for hassle-free
              global software monetization.
            </p>
          </div>
          <GetStartedButton
            size="lg"
            text="Get Started"
            className="dark:hover:bg-polar-50 rounded-full bg-black font-medium text-white hover:bg-gray-800 dark:bg-white dark:text-black"
          />
        </div>
      </div>
    </ResourceLayout>
  )
}
