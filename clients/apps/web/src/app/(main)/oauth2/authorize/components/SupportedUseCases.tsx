import { Box } from '@polar-sh/orbit/Box'

export default function SupportedUseCases() {
  return (
    <Box display="flex" flexDirection="column" rowGap="l">
      <Box display="flex" flexDirection="column" rowGap="s">
        <p className="text-sm font-medium">Supported Usecases</p>
        <p className="dark:text-polar-500 text-sm text-gray-500">
          SaaS subscriptions, digital downloads, software licenses, online
          courses, and other purely digital products.
        </p>
      </Box>

      <Box display="flex" flexDirection="column" rowGap="s">
        <p className="text-sm font-medium">Prohibited Usecases</p>
        <Box as="ul" display="flex" flexDirection="column" rowGap="xs">
          <Box as="li">
            <p className="dark:text-polar-500 text-sm text-gray-500">
              • Physical goods or products requiring shipping
            </p>
          </Box>
          <Box as="li">
            <p className="dark:text-polar-500 text-sm text-gray-500">
              • Human services (custom development, design and consultancy)
            </p>
          </Box>
          <Box as="li">
            <p className="dark:text-polar-500 text-sm text-gray-500">
              • Marketplaces
            </p>
          </Box>
          <Box as="li">
            <p className="dark:text-polar-500 text-sm text-gray-500">
              • Anything in our list of{' '}
              <a
                href="https://polar.sh/legal/acceptable-use-policy"
                className="text-blue-500 underline dark:text-blue-400"
                target="_blank"
                rel="noreferrer"
              >
                prohibited products
              </a>
            </p>
          </Box>
        </Box>
      </Box>

      <Box
        borderTopWidth={1}
        borderStyle="solid"
        borderColor="border-primary"
        paddingTop="l"
      >
        <p className="dark:text-polar-500 text-xs text-gray-500">
          Transactions that violate our policy will be canceled and refunded.
        </p>
      </Box>
    </Box>
  )
}
