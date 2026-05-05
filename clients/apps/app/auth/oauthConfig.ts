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
  'benefits:read',
  'benefits:write',
  'checkout_links:read',
  'checkout_links:write',
  'checkouts:read',
  'checkouts:write',
  'custom_fields:read',
  'custom_fields:write',
  'customer_meters:read',
  'customer_portal:read',
  'customer_portal:write',
  'customer_seats:read',
  'customer_seats:write',
  'customer_sessions:write',
  'customers:read',
  'customers:write',
  'discounts:read',
  'discounts:write',
  'disputes:read',
  'email',
  'events:read',
  'events:write',
  'files:read',
  'files:write',
  'license_keys:read',
  'license_keys:write',
  'member_sessions:write',
  'members:read',
  'members:write',
  'meters:read',
  'meters:write',
  'metrics:read',
  'metrics:write',
  'notification_recipients:read',
  'notification_recipients:write',
  'notifications:read',
  'notifications:write',
  'openid',
  'orders:read',
  'orders:write',
  'organization_access_tokens:read',
  'organization_access_tokens:write',
  'organizations:read',
  'organizations:write',
  'payments:read',
  'payouts:read',
  'payouts:write',
  'products:read',
  'products:write',
  'profile',
  'refunds:read',
  'refunds:write',
  'subscriptions:read',
  'subscriptions:write',
  'transactions:read',
  'transactions:write',
  'user:read',
  'user:write',
  'wallets:read',
  'wallets:write',
  'webhooks:read',
  'webhooks:write',
]
