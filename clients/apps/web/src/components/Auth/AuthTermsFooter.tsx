const AuthTermsFooter = () => (
  <div className="dark:text-polar-500 mt-6 text-center text-xs text-balance text-gray-400">
    By using Polar, you agree to our{' '}
    <a
      className="dark:text-polar-300 text-gray-600"
      href="https://polar.sh/legal/master-services-terms"
      rel="noopener noreferrer"
    >
      Terms of Service
    </a>{' '}
    &amp;{' '}
    <a
      className="dark:text-polar-300 text-gray-600"
      href="https://polar.sh/legal/privacy-policy"
      rel="noopener noreferrer"
    >
      Privacy Policy
    </a>
    .
  </div>
)

export default AuthTermsFooter
