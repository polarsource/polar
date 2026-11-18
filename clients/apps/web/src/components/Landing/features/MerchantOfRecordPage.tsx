import { Checkout } from '../mor/Checkout'
import { Filings, Receipt, Routes } from '../mor/plates'
import { Head, Lede, Marker, Rows, Section, Split } from './Destination'
import { FeatureCTA, FeaturePageLayout } from './FeaturePageLayout'

const DOCS = '/docs/merchant-of-record/introduction'

/** What the marks on the receipt are. */
const RECEIPT_NOTES: [number, string, string][] = [
  [
    1,
    'The seller',
    'Polar, on every receipt, so the sale and its tax are ours.',
  ],
  [
    2,
    'Your product',
    'Sold on your behalf, under the name your customers know.',
  ],
  [3, 'Local tax', 'At the customer’s rate, worked out at checkout.'],
  [4, 'Registration', 'Filed under Polar’s registrations, not yours.'],
]

export const MerchantOfRecordPage = () => (
  <FeaturePageLayout>
    <Head
      title="Sell globally, without the tax compliance"
      line="Polar is the merchant on every sale."
      docs={DOCS}
    >
      <Routes />
    </Head>

    {/* 01: who sells, on the receipt */}
    <Section id="seller">
      <Split
        words={
          <>
            <Lede
              title="We are the seller, you keep the customer"
              line="A payment processor moves money, but the merchant on the receipt is still you, and so is the tax. As merchant of record, Polar resells your product, so the tax on every sale is ours."
            />
            <dl className="flex flex-col gap-6">
              {RECEIPT_NOTES.map(([n, k, v]) => (
                <div key={k} className="flex flex-col gap-1">
                  <dt className="flex items-center gap-2 text-base">
                    <Marker n={n} />
                    {k}
                  </dt>
                  <dd className="dark:text-polar-500 text-base text-gray-500">
                    {v}
                  </dd>
                </div>
              ))}
            </dl>
          </>
        }
        plate={
          <div className="mx-auto w-full max-w-[30rem]">
            <Receipt />
          </div>
        }
      />
    </Section>

    {/* 02: one price, four checkouts */}
    <Section id="checkout">
      <div className="flex flex-col gap-16">
        <Lede
          title="The right tax at every checkout"
          line="The rate follows the customer’s location and tax status, and EU businesses with a VAT ID get reverse charge automatically."
        />
        <Checkout />
      </div>
    </Section>

    {/* 03: the filings, and what is left to you */}
    <Section id="filings">
      <Split
        flip
        words={
          <>
            <Lede
              title="Filed and remitted, every period"
              line="Charging tax is the start. Polar takes the whole chain, from the checkout to the return."
            />
            <Rows
              rows={[
                [
                  'Registrations',
                  'EU OSS VAT through Ireland, UK VAT and US states, with more as volume crosses thresholds.',
                ],
                [
                  'Remittance',
                  'Returns filed and tax paid to each authority on the cadence it sets.',
                ],
                [
                  'Invoices',
                  'Every order comes with a tax-correct invoice for the customer’s accountant.',
                ],
                [
                  'Refunds and disputes',
                  'A refund adjusts the tax with it, and disputes are handled end to end.',
                ],
              ]}
            />
          </>
        }
        plate={<Filings />}
      />
    </Section>

    <FeatureCTA
      title="Sell internationally"
      description="Polar takes the international tax exposure as your Merchant of Record."
    />
  </FeaturePageLayout>
)
