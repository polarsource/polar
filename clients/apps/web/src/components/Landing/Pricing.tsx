import ArrowOutwardOutlined from '@mui/icons-material/ArrowOutwardOutlined'
import Check from '@mui/icons-material/Check'
import CheckOutlined from '@mui/icons-material/CheckOutlined'
import CloseOutlined from '@mui/icons-material/CloseOutlined'
import Button from '@polar-sh/ui/components/atoms/Button'
import { motion } from 'framer-motion'
import Image from 'next/image'
import Link from 'next/link'

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      duration: 1,
      staggerChildren: 0.05,
    },
  },
}

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 1 } },
}

export const Pricing = () => {
  return (
    <motion.div
      className={`dark:bg-polar-900 flex w-full flex-col overflow-hidden rounded-2xl bg-white md:flex-row md:rounded-4xl`}
      variants={containerVariants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true }}
    >
      <div className="flex flex-col justify-center gap-y-8 p-8 md:w-1/2 md:p-16">
        <div className="flex flex-col gap-y-8">
          <motion.h2
            className="text-2xl leading-normal! md:text-4xl"
            variants={itemVariants}
          >
            Competitive Pricing
          </motion.h2>
          <motion.p
            className="text-lg leading-relaxed text-pretty"
            variants={itemVariants}
          >
            Polar is proud to be the cheapest Merchant of Record on the market.
          </motion.p>
          <ul className="flex flex-col gap-y-1">
            <motion.li
              className="flex flex-row items-center gap-x-2"
              variants={itemVariants}
            >
              <Check className="text-emerald-500" fontSize="small" />
              <p className="leading-relaxed text-pretty">
                4% + 40¢ per transaction
              </p>
            </motion.li>
            <motion.li
              className="flex flex-row items-center gap-x-2"
              variants={itemVariants}
            >
              <Check className="text-emerald-500" fontSize="small" />
              <p className="leading-relaxed text-pretty">No hidden fees</p>
            </motion.li>
            <motion.li
              className="flex flex-row items-center gap-x-2"
              variants={itemVariants}
            >
              <Check className="text-emerald-500" fontSize="small" />
              <p className="leading-relaxed text-pretty">
                Global Merchant of Record
              </p>
            </motion.li>
            <motion.li
              className="flex flex-row items-center gap-x-2"
              variants={itemVariants}
            >
              <Check className="text-emerald-500" fontSize="small" />
              <p className="leading-relaxed text-pretty">
                Negotiated Volume Discounts
              </p>
            </motion.li>
          </ul>
          <motion.span
            className="flex flex-row gap-x-4 text-sm text-gray-400"
            variants={itemVariants}
          >
            <Link href="/resources/pricing" target="_blank">
              <Button className="dark:hover:bg-polar-50 rounded-full border-none bg-black hover:bg-neutral-900 dark:bg-white dark:text-black">
                Pricing Guide
              </Button>
            </Link>
            <Link href="/resources/comparison/stripe" target="_blank">
              <Button variant="secondary" className="rounded-full">
                Polar vs. Stripe
                <ArrowOutwardOutlined fontSize="inherit" className="ml-2" />
              </Button>
            </Link>
          </motion.span>
        </div>
      </div>

      <div className="dark:bg-polar-800 relative flex flex-col items-center justify-center bg-gray-100 p-8 text-sm md:w-1/2 md:p-16">
        <Image
          className="absolute inset-0 h-full w-full object-cover"
          src="/assets/landing/abstract_07.jpg"
          fill
          sizes="(max-width: 768px) 100vw, (max-width: 1280px) 75vw, 640px"
          loading="lazy"
          alt=""
        />
        <div className="dark:border-polar-700 dark:bg-polar-900 z-10 w-96 overflow-hidden rounded-xl border border-gray-200 bg-white">
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
                  Payments in 6 lines of code
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
                  Flexible Usage Billing
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
      </div>
    </motion.div>
  )
}
