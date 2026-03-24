import {
  DEFAULT_LOCALE,
  useTranslations,
  type AcceptedLocale,
} from '@polar-sh/i18n'

const BUYER_TERMS_PLACEHOLDER = '{buyerTermsLink}'

export const MandateText = ({
  isPaymentRequired,
  isTrial,
  isRecurring,
  buttonLabel,
  locale,
}: {
  isPaymentRequired: boolean
  isTrial: boolean
  isRecurring: boolean
  buttonLabel: string
  locale?: AcceptedLocale
}) => {
  const t = useTranslations(locale ?? DEFAULT_LOCALE)

  const interpolations = {
    buttonLabel,
    buyerTermsLink: BUYER_TERMS_PLACEHOLDER,
  }

  const mandate = isPaymentRequired
    ? isTrial
      ? t('checkout.footer.mandateSubscriptionTrial', interpolations)
      : isRecurring
        ? t('checkout.footer.mandateSubscription', interpolations)
        : t('checkout.footer.mandateOneTime', interpolations)
    : t('checkout.footer.merchantOfRecord')

  const buyerTermsLabel = t('checkout.footer.buyerTermsLink')
  const [prefix, suffix] = mandate.split(BUYER_TERMS_PLACEHOLDER)

  return (
    <p className="dark:text-polar-500 text-center text-xs text-gray-500">
      {prefix}
      {suffix !== undefined && (
        <>
          <a
            href="https://polar.sh/legal/terms"
            target="_blank"
            rel="noreferrer"
            className="underline"
          >
            {buyerTermsLabel}
          </a>
          {suffix}
        </>
      )}
    </p>
  )
}
