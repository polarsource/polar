export default function SupportedUseCases() {
  return (
    <div className="flex flex-col gap-y-4 text-sm">
      <div className="flex flex-col gap-y-2">
        <p className="font-medium">Supported Usecases</p>
        <p className="dark:text-polar-500 text-sm text-gray-500">
          SaaS subscriptions, digital downloads, software licenses, online
          courses, and other purely digital products.
        </p>
      </div>

      <div className="flex flex-col gap-y-2">
        <p className="font-medium">Prohibited Usecases</p>
        <ul className="dark:text-polar-500 space-y-1 text-sm text-gray-500">
          <li>• Physical goods or products requiring shipping</li>
          <li>• Human services (custom development, design and consultancy)</li>
          <li>• Marketplaces</li>
          <li>
            • Anything in our list of{' '}
            <a
              href="https://polar.sh/docs/merchant-of-record/acceptable-use"
              className="text-blue-500 underline dark:text-blue-400"
              target="_blank"
              rel="noreferrer"
            >
              prohibited products
            </a>
          </li>
        </ul>
      </div>

      <div className="dark:border-polar-700 border-t border-gray-200 pt-4">
        <p className="dark:text-polar-500 text-xs text-gray-500">
          Transactions that violate our policy will be canceled and refunded.
        </p>
      </div>
    </div>
  )
}
