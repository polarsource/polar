'use client'

import GavelOutlined from '@mui/icons-material/GavelOutlined'
import LanguageOutlined from '@mui/icons-material/LanguageOutlined'
import ReceiptLongOutlined from '@mui/icons-material/ReceiptLongOutlined'
import VerifiedOutlined from '@mui/icons-material/VerifiedOutlined'
import { OrbitingSpheres } from '../graphics/OrbitingSpheres'
import {
  FeatureCardGrid,
  FeatureCTA,
  FeaturePageGraphic,
  FeaturePageHeader,
  FeaturePageIntro,
  FeaturePageLayout,
  FeatureRichList,
  FeatureSection,
} from './FeaturePageLayout'

export const MerchantOfRecordPage = () => {
  return (
    <FeaturePageLayout>
      <FeaturePageHeader
        title="Sell globally, without the tax compliance"
        description="Polar as your Merchant of Record."
        docsHref="/docs/merchant-of-record/introduction"
      />

      <FeaturePageGraphic graphic={OrbitingSpheres} />

      <FeaturePageIntro>
        Most jurisdictions tax digital sales, and the rules differ country by
        country. Polar takes the role of reseller for those sales, which moves
        the international tax liability off your balance sheet onto ours.
      </FeaturePageIntro>

      <FeatureSection title="What Merchant of Record actually means">
        <p>
          A Payment Service Provider like Stripe routes money between your
          customer and your bank. It&apos;s a powerful abstraction for
          processing transactions, but it stops there: the merchant on every
          receipt is still you, which means the tax liability for every
          international sale is also still yours.
        </p>
        <p>
          A Merchant of Record sits one layer higher. Polar buys the digital
          good from you and resells it to your customer, which makes us the
          merchant for that specific sale. As a consequence, international sales
          tax (VAT, GST, US Sales Tax, and the rest) is owed by us, not you.
        </p>
        <p>
          What stays with you is the customer relationship. The renewals, the
          support, and the product experience are all yours. We sit underneath,
          handling the regulatory layer the customer never has to think about.
        </p>
      </FeatureSection>

      <FeatureCardGrid
        cards={[
          {
            icon: <LanguageOutlined fontSize="large" />,
            title: 'Global coverage',
            description:
              'Sell into every country we support. We monitor thresholds and expand registrations as our volume grows.',
          },
          {
            icon: <ReceiptLongOutlined fontSize="large" />,
            title: 'Tax-correct invoices',
            description:
              'Every order ships with a compliant invoice and the right VAT, GST, or Sales Tax line.',
          },
          {
            icon: <GavelOutlined fontSize="large" />,
            title: 'Liability on us',
            description:
              "We're on the hook for capturing and remitting international sales tax.",
          },
          {
            icon: <VerifiedOutlined fontSize="large" />,
            title: 'EU B2B reverse charge',
            description:
              'VAT-registered EU businesses get reverse-charge handling automatically.',
          },
        ]}
      />

      <FeatureRichList
        title="What we cover"
        description="Tax compliance is more than charging the right rate at checkout. Polar takes the full chain, from the moment money is captured to the moment it's remitted."
        items={[
          {
            title: 'Capture',
            description:
              "We charge the correct rate at checkout based on the customer's location and tax status, including reverse charge for EU B2B.",
          },
          {
            title: 'Remittance',
            description:
              'We file and pay sales tax to the relevant authorities on the cadence they require.',
          },
          {
            title: 'Registrations',
            description:
              'We hold EU OSS VAT (Ireland), UK VAT, and US state registrations, and we add new ones as we cross volume thresholds.',
          },
          {
            title: 'Invoices and receipts',
            description:
              'Every order produces a tax-correct invoice the customer can hand to their accountant.',
          },
          {
            title: 'Refunds and disputes',
            description:
              'Refunds adjust the tax line automatically. Disputes are managed end to end.',
          },
        ]}
      />

      <FeatureCTA
        title="Sell internationally"
        description="Polar takes the international tax exposure as your Merchant of Record."
      />
    </FeaturePageLayout>
  )
}
