import { CONFIG } from '../config'

const AuthorizationBanner = () => (
  <div id="polar-authorize-banner" className="mb-3 bg-red-200 p-3">
    To see pledges,{' '}
    <a
      href={`${CONFIG.WEB_URL}/dashboard/settings/extension`}
      target="_blank"
      rel="noreferrer"
    >
      authorize
    </a>{' '}
    with Polar
  </div>
)

export default AuthorizationBanner
