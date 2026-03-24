'use client'

import GetStartedButton from '@/components/Auth/GetStartedButton'
import CheckOutlined from '@mui/icons-material/CheckOutlined'
import CloseOutlined from '@mui/icons-material/CloseOutlined'
import { ResourceLayout, ResourceSection } from '../resources/ResourceLayout'

export const PolarVsLemonSqueezyPage = () => {
  const tocItems = [
    { id: 'overview', title: 'Overview' },
    { id: 'comparison', title: 'Feature Comparison' },
    { id: 'pricing', title: 'Pricing' },
    { id: 'developer-experience', title: 'Developer Experience' },
    { id: 'scalability', title: 'Scalability & Features' },
    { id: 'why-polar', title: 'Why Choose Polar?' },
  ]

  return (
    <ResourceLayout title="Polar vs Lemon Squeezy" toc={tocItems}>
      <ResourceSection id="overview" title="Overview">
        <p className="text-lg">
          Comparing modern Merchant of Record solutions for indie developers and
          SaaS businesses.
        </p>
        <p className="dark:text-polar-300 text-gray-500">
          Both Polar and Lemon Squeezy are Merchant of Record platforms that
          handle tax compliance globally. While Lemon Squeezy caters to solo
          creators and indie hackers, Polar is built for developers who need
          robust APIs, advanced features, and the ability to scale to
          enterprise-level requirements.
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
                <th className="p-4 text-center font-medium">Lemon Squeezy</th>
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
                  <CheckOutlined className="text-green-600" fontSize="small" />
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
                  <CheckOutlined className="text-green-600" fontSize="small" />
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
                  20% cheaper than Lemon Squeezy
                </span>
              </li>
              <li className="flex items-start gap-2 py-2">
                <CheckOutlined className="text-green-600" fontSize="small" />
                <span className="dark:text-polar-300 text-sm text-gray-600">
                  No hidden fees or surprise charges
                </span>
              </li>
              <li className="flex items-start gap-2 py-2">
                <CheckOutlined className="text-green-600" fontSize="small" />
                <span className="dark:text-polar-300 text-sm text-gray-600">
                  All features included at one price
                </span>
              </li>
            </ul>
          </div>

          <div className="dark:border-polar-700 flex flex-col gap-4 border border-gray-200 p-6">
            <div className="flex flex-col gap-2">
              <h3 className="text-lg font-medium">Lemon Squeezy</h3>
              <div className="text-4xl">5% + 50¢</div>
              <p className="dark:text-polar-300 text-sm text-gray-500">
                per transaction
              </p>
            </div>
            <ul className="dark:divide-polar-700 flex flex-col divide-y divide-gray-200">
              <li className="flex items-start gap-2 py-2">
                <CloseOutlined className="text-red-600" fontSize="small" />
                <span className="dark:text-polar-300 text-sm text-gray-600">
                  Higher base transaction fee
                </span>
              </li>
              <li className="flex items-start gap-2 py-2">
                <CloseOutlined className="text-red-600" fontSize="small" />
                <span className="dark:text-polar-300 text-sm text-gray-600">
                  Additional fees for certain features
                </span>
              </li>
              <li className="flex items-start gap-2 py-2">
                <CloseOutlined className="text-red-600" fontSize="small" />
                <span className="dark:text-polar-300 text-sm text-gray-600">
                  Limited advanced features
                </span>
              </li>
            </ul>
          </div>
        </div>
        <p className="dark:text-polar-300 text-sm text-gray-500">
          At $50,000 monthly revenue, Polar saves you $500/month. At $100,000,
          you save $1,000/month compared to Lemon Squeezy.
        </p>
      </ResourceSection>

      <ResourceSection id="developer-experience" title="Developer Experience">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <h3 className="text-lg">
              Built for developers who want full control
            </h3>
            <p className="dark:text-polar-300 text-gray-500">
              Lemon Squeezy is designed for simplicity, which is great for
              getting started quickly. However, Polar provides both simplicity
              AND power with modern developer tooling, comprehensive APIs, and
              the flexibility to build exactly what you need.
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

      <ResourceSection id="scalability" title="Scalability & Features">
        <div className="flex flex-col gap-4">
          <h3 className="text-lg">Built to scale with your business</h3>
          <p className="dark:text-polar-300 text-gray-500">
            While Lemon Squeezy works well for small projects and indie
            creators, Polar is designed to grow with you from your first sale to
            enterprise scale, with advanced features and robust infrastructure.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div className="dark:bg-polar-800 flex flex-col gap-3 bg-gray-50 p-6">
            <h4 className="font-medium">Polar at Scale</h4>
            <ul className="flex flex-col gap-2">
              <li className="dark:text-polar-300 flex items-start gap-2 text-sm text-gray-600">
                <CheckOutlined className="text-green-600" fontSize="small" />
                Advanced subscriptions with usage-based billing and tiers
              </li>
              <li className="dark:text-polar-300 flex items-start gap-2 text-sm text-gray-600">
                <CheckOutlined className="text-green-600" fontSize="small" />
                Robust webhooks with real-time events and automatic retries
              </li>
              <li className="dark:text-polar-300 flex items-start gap-2 text-sm text-gray-600">
                <CheckOutlined className="text-green-600" fontSize="small" />
                API-first platform to build custom experiences
              </li>
              <li className="dark:text-polar-300 flex items-start gap-2 text-sm text-gray-600">
                <CheckOutlined className="text-green-600" fontSize="small" />
                Open source with full transparency and community contributions
              </li>
            </ul>
          </div>

          <div className="dark:bg-polar-800 flex flex-col gap-3 bg-gray-50 p-6">
            <h4 className="font-medium">Lemon Squeezy Limitations</h4>
            <ul className="flex flex-col gap-2">
              <li className="dark:text-polar-300 flex items-start gap-2 text-sm text-gray-600">
                <CloseOutlined className="text-red-600" fontSize="small" />
                Basic subscriptions with limited flexibility
              </li>
              <li className="dark:text-polar-300 flex items-start gap-2 text-sm text-gray-600">
                <CloseOutlined className="text-red-600" fontSize="small" />
                Simple webhooks with limited event types
              </li>
              <li className="dark:text-polar-300 flex items-start gap-2 text-sm text-gray-600">
                <CloseOutlined className="text-red-600" fontSize="small" />
                UI-focused with less programmatic control
              </li>
              <li className="dark:text-polar-300 flex items-start gap-2 text-sm text-gray-600">
                <CloseOutlined className="text-red-600" fontSize="small" />
                Closed source with no visibility into platform internals
              </li>
            </ul>
          </div>
        </div>
      </ResourceSection>

      <ResourceSection id="why-polar" title="Why Choose Polar?">
        <div className="flex flex-col gap-4">
          <h3 className="text-lg">
            Start simple, scale to enterprise without switching
          </h3>
          <p className="dark:text-polar-300 text-gray-500">
            Lemon Squeezy is great for getting started, but many developers
            quickly outgrow its limitations. Polar gives you the same simple
            start but with the power and flexibility to scale without ever
            needing to migrate to a different platform.
          </p>
        </div>
        <ul className="dark:border-polar-700 dark:divide-polar-700 divide-y divide-gray-200 border-y border-gray-200 [&>li]:py-3">
          <li>
            <h4 className="font-medium">Better pricing</h4>
            <p className="dark:text-polar-300 text-gray-500">
              20% cheaper with the same MoR benefits (4% vs 5%).
            </p>
          </li>
          <li>
            <h4 className="font-medium">More powerful</h4>
            <p className="dark:text-polar-300 text-gray-500">
              Advanced features for complex use cases and scale.
            </p>
          </li>
          <li>
            <h4 className="font-medium">Developer-first</h4>
            <p className="dark:text-polar-300 text-gray-500">
              Modern tooling, TypeScript-first, framework adapters.
            </p>
          </li>
          <li>
            <h4 className="font-medium">Open source</h4>
            <p className="dark:text-polar-300 text-gray-500">
              Full transparency and community-driven development.
            </p>
          </li>
        </ul>
      </ResourceSection>

      <div className="dark:border-polar-700 flex flex-col border-t border-gray-200 pt-16">
        <div className="flex flex-col items-center gap-8">
          <div className="flex flex-col items-center gap-4">
            <h3 className="text-xl">Choose a platform that grows with you</h3>
            <p className="dark:text-polar-300 text-center text-gray-700 md:w-[440px]">
              Get the simplicity of Lemon Squeezy with the power and scalability
              to take your business to the next level.
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
