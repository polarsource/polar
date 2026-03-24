'use client'

import GetStartedButton from '@/components/Auth/GetStartedButton'
import CheckOutlined from '@mui/icons-material/CheckOutlined'
import CloseOutlined from '@mui/icons-material/CloseOutlined'
import { ResourceLayout, ResourceSection } from '../resources/ResourceLayout'

export const PolarVsPaddlePage = () => {
  const tocItems = [
    { id: 'overview', title: 'Overview' },
    { id: 'comparison', title: 'Feature Comparison' },
    { id: 'pricing', title: 'Pricing' },
    { id: 'developer-experience', title: 'Developer Experience' },
    { id: 'transparency', title: 'Transparency & Control' },
    { id: 'why-polar', title: 'Why Choose Polar?' },
  ]

  return (
    <ResourceLayout title="Polar vs Paddle" toc={tocItems}>
      <ResourceSection id="overview" title="Overview">
        <p className="text-lg">
          Comparing two Merchant of Record solutions for software businesses.
        </p>
        <p className="dark:text-polar-300 text-gray-500">
          Both Polar and Paddle act as Merchant of Record (MoR), handling tax
          compliance and payments for you. However, Polar is built by developers
          for developers with modern tooling, transparent pricing, and an
          open-source approach that gives you full control and visibility.
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
                <th className="p-4 text-center font-medium">Paddle</th>
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
                  20% cheaper than Paddle
                </span>
              </li>
              <li className="flex items-start gap-2 py-2">
                <CheckOutlined className="text-green-600" fontSize="small" />
                <span className="dark:text-polar-300 text-sm text-gray-600">
                  No hidden fees or markups
                </span>
              </li>
              <li className="flex items-start gap-2 py-2">
                <CheckOutlined className="text-green-600" fontSize="small" />
                <span className="dark:text-polar-300 text-sm text-gray-600">
                  All features included
                </span>
              </li>
            </ul>
          </div>

          <div className="dark:border-polar-700 flex flex-col gap-4 border border-gray-200 p-6">
            <div className="flex flex-col gap-2">
              <h3 className="text-lg font-medium">Paddle</h3>
              <div className="text-4xl">5% + 50¢</div>
              <p className="dark:text-polar-300 text-sm text-gray-500">
                per transaction
              </p>
            </div>
            <ul className="dark:divide-polar-700 flex flex-col divide-y divide-gray-200">
              <li className="flex items-start gap-2 py-2">
                <CloseOutlined className="text-red-600" fontSize="small" />
                <span className="dark:text-polar-300 text-sm text-gray-600">
                  Higher base fees
                </span>
              </li>
              <li className="flex items-start gap-2 py-2">
                <CloseOutlined className="text-red-600" fontSize="small" />
                <span className="dark:text-polar-300 text-sm text-gray-600">
                  Additional fees for some features
                </span>
              </li>
              <li className="flex items-start gap-2 py-2">
                <CloseOutlined className="text-red-600" fontSize="small" />
                <span className="dark:text-polar-300 text-sm text-gray-600">
                  Volume discounts require negotiation
                </span>
              </li>
            </ul>
          </div>
        </div>
        <p className="dark:text-polar-300 text-sm text-gray-500">
          On $100,000 in monthly revenue, Polar saves you ~$1,000/month compared
          to Paddle ($4,000 vs $5,000 in fees).
        </p>
      </ResourceSection>

      <ResourceSection id="developer-experience" title="Developer Experience">
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <h3 className="text-lg">Built for modern development</h3>
            <p className="dark:text-polar-300 text-gray-500">
              Polar is designed from the ground up for today&apos;s developers,
              with modern tooling, framework adapters, and a TypeScript-first
              approach. Paddle&apos;s tools feel dated in comparison.
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

      <ResourceSection id="transparency" title="Transparency & Control">
        <div className="flex flex-col gap-4">
          <h3 className="text-lg">Open source vs closed platform</h3>
          <p className="dark:text-polar-300 text-gray-500">
            One of the biggest differences between Polar and Paddle is
            transparency. Polar is fully open source, giving you complete
            visibility into how the platform works and enabling community
            contributions.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div className="dark:bg-polar-800 flex flex-col gap-3 bg-gray-50 p-6">
            <h4 className="font-medium">With Polar</h4>
            <ul className="flex flex-col gap-2">
              <li className="dark:text-polar-300 flex items-start gap-2 text-sm text-gray-600">
                <CheckOutlined className="text-green-600" fontSize="small" />
                Fully transparent - see exactly how everything works
              </li>
              <li className="dark:text-polar-300 flex items-start gap-2 text-sm text-gray-600">
                <CheckOutlined className="text-green-600" fontSize="small" />
                Open development with public roadmap and issue tracking
              </li>
              <li className="dark:text-polar-300 flex items-start gap-2 text-sm text-gray-600">
                <CheckOutlined className="text-green-600" fontSize="small" />
                Community driven - contribute features and fixes
              </li>
              <li className="dark:text-polar-300 flex items-start gap-2 text-sm text-gray-600">
                <CheckOutlined className="text-green-600" fontSize="small" />
                Data portability with full API access
              </li>
            </ul>
          </div>

          <div className="dark:bg-polar-800 flex flex-col gap-3 bg-gray-50 p-6">
            <h4 className="font-medium">With Paddle</h4>
            <ul className="flex flex-col gap-2">
              <li className="dark:text-polar-300 flex items-start gap-2 text-sm text-gray-600">
                <CloseOutlined className="text-red-600" fontSize="small" />
                Closed source - black box implementation
              </li>
              <li className="dark:text-polar-300 flex items-start gap-2 text-sm text-gray-600">
                <CloseOutlined className="text-red-600" fontSize="small" />
                Private development with limited visibility into roadmap
              </li>
              <li className="dark:text-polar-300 flex items-start gap-2 text-sm text-gray-600">
                <CloseOutlined className="text-red-600" fontSize="small" />
                Limited transparency - dependent on vendor roadmap
              </li>
              <li className="dark:text-polar-300 flex items-start gap-2 text-sm text-gray-600">
                <CloseOutlined className="text-red-600" fontSize="small" />
                Limited data access - dependent on their API capabilities
              </li>
            </ul>
          </div>
        </div>
      </ResourceSection>

      <ResourceSection id="why-polar" title="Why Choose Polar?">
        <div className="flex flex-col gap-4">
          <h3 className="text-lg">
            A modern alternative to Paddle for forward-thinking teams
          </h3>
          <p className="dark:text-polar-300 text-gray-500">
            If you&apos;re choosing a Merchant of Record, Polar offers
            everything Paddle does but with better pricing, modern developer
            tools, and open source transparency.
          </p>
        </div>
        <ul className="dark:border-polar-700 dark:divide-polar-700 divide-y divide-gray-200 border-y border-gray-200 [&>li]:py-3">
          <li>
            <h4 className="font-medium">20% cheaper</h4>
            <p className="dark:text-polar-300 text-gray-500">
              Same MoR benefits, lower fees (4% vs 5%).
            </p>
          </li>
          <li>
            <h4 className="font-medium">Better developer experience</h4>
            <p className="dark:text-polar-300 text-gray-500">
              Modern tooling built for today&apos;s tech stack.
            </p>
          </li>
          <li>
            <h4 className="font-medium">Open source</h4>
            <p className="dark:text-polar-300 text-gray-500">
              Full transparency, community contributions, public roadmap.
            </p>
          </li>
          <li>
            <h4 className="font-medium">Built for developers</h4>
            <p className="dark:text-polar-300 text-gray-500">
              TypeScript-first, framework adapters, 6-line integration.
            </p>
          </li>
        </ul>
      </ResourceSection>

      <div className="dark:border-polar-700 flex flex-col border-t border-gray-200 pt-16">
        <div className="flex flex-col items-center gap-8">
          <div className="flex flex-col items-center gap-4">
            <h3 className="text-xl">Ready to switch from Paddle?</h3>
            <p className="dark:text-polar-300 text-center text-gray-700 md:w-[440px]">
              Join developers who are moving to a more modern, transparent, and
              affordable Merchant of Record solution.
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
