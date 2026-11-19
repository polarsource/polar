export const CLIENT_ID = 'polar_ci_yZLBGwoWZVsOdfN5CODRwVSTlJfwJhXqwg65e2CuNMZ'

export const discovery = {
  authorizationEndpoint: 'https://polar.sh/oauth2/authorize',
  tokenEndpoint: 'https://api.polar.sh/v1/oauth2/token',
  registrationEndpoint: 'https://api.polar.sh/v1/oauth2/register',
  revocationEndpoint: 'https://api.polar.sh/v1/oauth2/revoke',
}

/*
Uncomment these lines and update the client ID to run against a local version of the backend

To get the CLIENT_ID:
1. Create a new Oauth app at http://127.0.0.1:3000/dashboard/account/developer
2. Select "Public Client" and give it all the scopes
3. Set "Redirect URIs" to "polar://oauth/callback"

And make sure to set the EXPO_PUBLIC_POLAR_SERVER_URL is set to "http://127.0.0.1:8000".

export const CLIENT_ID = 'polar_ci_hbFdMZZRghgdm2F4LMceQSrcQNunmjlh6ukGJ1dG0Vg'

export const discovery = {
  authorizationEndpoint: 'http://127.0.0.1:3000/oauth2/authorize',
  tokenEndpoint: `${process.env.EXPO_PUBLIC_POLAR_SERVER_URL}/v1/oauth2/token`,
  registrationEndpoint: `${process.env.EXPO_PUBLIC_POLAR_SERVER_URL}/v1/oauth2/register`,
  revocationEndpoint: `${process.env.EXPO_PUBLIC_POLAR_SERVER_URL}/v1/oauth2/revoke`,
*/

export const scopes = [
  'checkout_links:read',
  'custom_fields:read',
  'customers:read',
  'email',
  'metrics:read',
  'notification_recipients:read',
  'notification_recipients:write',
  'notifications:read',
  'notifications:write',
  'openid',
  'orders:read',
  'organizations:read',
  'organizations:write',
  'payouts:read',
  'payouts:write',
  'products:read',
  'profile',
  'subscriptions:read',
  'transactions:read',
]
