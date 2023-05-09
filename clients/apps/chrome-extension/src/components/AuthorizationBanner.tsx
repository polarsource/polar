import { LogoType70 } from 'polarkit/components/brand'
import { CONFIG } from '../config'

const AuthorizationBanner = () => (
  <div className="flex items-center space-x-4">
    <LogoType70 className="h-12" />
    <a
      href={`${CONFIG.WEB_URL}/dashboard/settings/extension`}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center space-x-2 rounded-lg bg-blue-500 p-2 px-3 text-center text-sm font-medium text-white transition-colors duration-100 hover:bg-blue-600"
    >
      Connect Polar
    </a>
    <span className="text-sm text-gray-500">
      Connect Polar to see pledges here on GitHub
    </span>
  </div>
)

export default AuthorizationBanner
