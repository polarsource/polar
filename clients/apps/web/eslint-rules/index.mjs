import noClassnameBox from './no-classname-box.mjs'
import noClassnameText from './no-classname-text.mjs'
import noMerchantApiCallsInCustomerPortal from './no-merchant-api-calls-in-customer-portal.mjs'
import noMerchantQueriesInCustomerPortal from './no-merchant-queries-in-customer-portal.mjs'
import noNextImage from './no-next-image.mjs'
import noRawHtmlLayout from './no-raw-html-layout.mjs'
import noStyleBox from './no-style-box.mjs'
import noStyleText from './no-style-text.mjs'
import noToastErrorDetail from './no-toast-error-detail.mjs'

/** @type {import('eslint').ESLint.Plugin} */
const polarPlugin = {
  meta: {
    name: 'polar',
  },
  rules: {
    'no-classname-box': noClassnameBox,
    'no-classname-text': noClassnameText,
    'no-merchant-api-calls-in-customer-portal':
      noMerchantApiCallsInCustomerPortal,
    'no-merchant-queries-in-customer-portal': noMerchantQueriesInCustomerPortal,
    'no-next-image': noNextImage,
    'no-raw-html-layout': noRawHtmlLayout,
    'no-style-box': noStyleBox,
    'no-style-text': noStyleText,
    'no-toast-error-detail': noToastErrorDetail,
  },
}

export default polarPlugin
