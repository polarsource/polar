const AuthorizationBanner = () => (
  <div id="polar-authorize-banner" className="mb-3 bg-red-200 p-3">
    To see pledges,{' '}
    <a
      href="http://127.0.0.1:3000/settings/extension"
      target="_blank"
      rel="noreferrer"
    >
      authorize
    </a>{' '}
    with Polar
  </div>
)

export default AuthorizationBanner
