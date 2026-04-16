import noClassnameBox from './no-classname-box.mjs'
import noMerchantApiCallsInCustomerPortal from './no-merchant-api-calls-in-customer-portal.mjs'
import noMerchantQueriesInCustomerPortal from './no-merchant-queries-in-customer-portal.mjs'
import noNextImage from './no-next-image.mjs'
import noStyleBox from './no-style-box.mjs'
import noToastErrorDetail from './no-toast-error-detail.mjs'

/** @type {import('eslint').ESLint.Plugin} */
const polarPlugin = {
  meta: {
    name: 'polar',
  },
  rules: {
    'no-classname-box': noClassnameBox,
    'no-merchant-api-calls-in-customer-portal':
      noMerchantApiCallsInCustomerPortal,
    'no-merchant-queries-in-customer-portal': noMerchantQueriesInCustomerPortal,
    'no-next-image': noNextImage,
    'no-style-box': noStyleBox,
    'no-toast-error-detail': noToastErrorDetail,
  },
}

export default polarPlugin
