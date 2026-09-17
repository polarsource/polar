import process from 'node:process'

export const ENVIRONMENT =
  process.env.VERCEL_ENV || process.env.NEXT_PUBLIC_VERCEL_ENV || 'development'

const flatten = (policy) => policy.replace(/\n/g, '')

const S3_PUBLIC_IMAGES_BUCKET_ORIGIN = process.env
  .S3_PUBLIC_IMAGES_BUCKET_HOSTNAME
  ? `${process.env.S3_PUBLIC_IMAGES_BUCKET_PROTOCOL || 'https'}://${process.env.S3_PUBLIC_IMAGES_BUCKET_HOSTNAME}${process.env.S3_PUBLIC_IMAGES_BUCKET_PORT ? `:${process.env.S3_PUBLIC_IMAGES_BUCKET_PORT}` : ''}`
  : ''
const baseCSP = () => `
    default-src 'self';
    connect-src 'self' ${process.env.NEXT_PUBLIC_API_URL} ${process.env.S3_UPLOAD_ORIGINS} https://api.stripe.com https://maps.googleapis.com https://*.google-analytics.com https://chat.uk.plain.com https://prod-uk-services-attachm-attachmentsuploadbucket2-1l2e4906o2asm.s3.eu-west-2.amazonaws.com;
    frame-src 'self' https://challenges.cloudflare.com https://*.js.stripe.com https://js.stripe.com https://hooks.stripe.com https://customer-wl21dabnj6qtvcai.cloudflarestream.com videodelivery.net *.cloudflarestream.com;
    script-src 'self' 'unsafe-eval' 'unsafe-inline' https://challenges.cloudflare.com https://*.js.stripe.com https://js.stripe.com https://maps.googleapis.com https://www.googletagmanager.com https://chat.cdn-plain.com https://embed.cloudflarestream.com;
    style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
    img-src 'self' blob: data: https://www.gravatar.com https://img.logo.dev https://lh3.googleusercontent.com https://avatars.githubusercontent.com ${S3_PUBLIC_IMAGES_BUCKET_ORIGIN} https://uploads.polar.sh https://prod-uk-services-workspac-workspacefilespublicbuck-vs4gjqpqjkh6.s3.amazonaws.com https://prod-uk-services-attachm-attachmentsbucket28b3ccf-uwfssb4vt2us.s3.eu-west-2.amazonaws.com https://i0.wp.com;
    font-src 'self';
    object-src 'none';
    base-uri 'self';
    ${ENVIRONMENT !== 'development' ? 'upgrade-insecure-requests;' : ''}
`
export const nonEmbeddedCSP = () =>
  flatten(`
  ${baseCSP()}
  form-action 'self' ${process.env.NEXT_PUBLIC_API_URL} polar:;
  frame-ancestors 'none';
`)
export const embeddedCSP = () =>
  flatten(`
  ${baseCSP()}
  form-action 'self' ${process.env.NEXT_PUBLIC_API_URL} polar:;
  frame-ancestors *;
`)
// Don't add form-action to the OAuth2 authorize page, as it blocks the OAuth2 redirection
// 10-years old debate about whether to block redirects with form-action or not: https://github.com/w3c/webappsec-csp/issues/8
export const oauth2CSP = () =>
  flatten(`
  ${baseCSP()}
  frame-ancestors 'none';
`)

// We rewrite Mintlify docs to polar.sh/docs, so we need a specific CSP for them
// Ref: https://www.mintlify.com/docs/guides/csp-configuration#content-security-policy-csp-configuration
export const docsCSP = () =>
  flatten(`
  default-src 'self';
  script-src 'self' 'unsafe-inline' 'unsafe-eval' cdn.jsdelivr.net www.googletagmanager.com cdn.segment.com plausible.io
  us.posthog.com tag.clearbitscripts.com cdn.heapanalytics.com chat.cdn-plain.com chat-assets.frontapp.com
  browser.sentry-cdn.com js.sentry-cdn.com;
  style-src 'self' 'unsafe-inline' d4tuoctqmanu0.cloudfront.net fonts.googleapis.com;
  font-src 'self' d4tuoctqmanu0.cloudfront.net fonts.googleapis.com;
  img-src 'self' data: blob: d3gk2c5xim1je2.cloudfront.net mintcdn.com *.mintcdn.com cdn.jsdelivr.net mintlify.s3.us-west-1.amazonaws.com;
  connect-src 'self' *.mintlify.dev *.mintlify.com d1ctpt7j8wusba.cloudfront.net mintcdn.com *.mintcdn.com
  api.mintlifytrieve.com www.googletagmanager.com cdn.segment.com plausible.io us.posthog.com browser.sentry-cdn.com;
  frame-src 'self' *.mintlify.dev https://polar-public-assets.s3.us-east-2.amazonaws.com;
`)

export const checkoutCSP = (frameAncestors) =>
  flatten(`
  ${baseCSP()}
  form-action 'self' ${process.env.NEXT_PUBLIC_API_URL} polar:;
  frame-ancestors ${frameAncestors};
`)
