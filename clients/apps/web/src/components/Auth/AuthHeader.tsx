import { PolarLogotype } from '@/components/Layout/Public/PolarLogotype'
import { CONFIG } from '@/utils/config'

const AuthHeader = ({ error }: { error?: string }) => {
  return (
    <div className="flex flex-col gap-y-4">
      <PolarLogotype logoVariant="icon" size={60} />
      <div className="flex flex-col gap-4">
        <h2 className="text-2xl text-black dark:text-white">
          {CONFIG.IS_SANDBOX
            ? 'Welcome to the Polar Sandbox'
            : 'Welcome to Polar'}
        </h2>
        <span className="dark:text-polar-400 text-lg text-balance text-gray-500">
          {CONFIG.IS_SANDBOX ? (
            <>
              This is a testing environment. Changes here won&rsquo;t affect
              your live account and payments are not processed.
            </>
          ) : (
            'Monetize your software'
          )}
        </span>
      </div>
      {error && (
        <div className="rounded-lg bg-red-50 p-4 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">
          {error}
        </div>
      )}
    </div>
  )
}

export default AuthHeader
