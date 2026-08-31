import {
  DEFAULT_LOCALE,
  useTranslations,
  type AcceptedLocale,
  type TranslateFn,
} from '@polar-sh/i18n'

const BUYER_TERMS_PLACEHOLDER = '{buyerTermsLink}'

interface MandateProps {
  isPaymentRequired: boolean
  isTrial: boolean
  isRecurring: boolean
  hasTemporaryDiscount?: boolean
  buttonLabel: string
  locale?: AcceptedLocale
}

const getMandate = (
  t: TranslateFn,
  {
    isPaymentRequired,
    isTrial,
    isRecurring,
    hasTemporaryDiscount,
  }: MandateProps,
  interpolations: { buttonLabel: string; buyerTermsLink: string },
): string => {
  if (!isPaymentRequired) {
    return t('checkout.footer.merchantOfRecord')
  }
  if (isTrial) {
    return hasTemporaryDiscount
      ? t('checkout.footer.mandateSubscriptionTrialDiscounted', interpolations)
      : t('checkout.footer.mandateSubscriptionTrial', interpolations)
  }
  if (isRecurring) {
    return hasTemporaryDiscount
      ? t('checkout.footer.mandateSubscriptionDiscounted', interpolations)
      : t('checkout.footer.mandateSubscription', interpolations)
  }
  return t('checkout.footer.mandateOneTime', interpolations)
}

export const MandateText = (props: MandateProps) => {
  const t = useTranslations(props.locale ?? DEFAULT_LOCALE)

  const interpolations = {
    buttonLabel: props.buttonLabel,
    buyerTermsLink: BUYER_TERMS_PLACEHOLDER,
  }

  const mandate = getMandate(t, props, interpolations)

  const buyerTermsLabel = t('checkout.footer.buyerTermsLink')
  const [prefix, suffix] = mandate.split(BUYER_TERMS_PLACEHOLDER)

  return (
    <p className="dark:text-polar-500 text-center text-xs text-gray-500">
      {prefix}
      {suffix !== undefined && (
        <>
          <a
            href="https://polar.sh/legal/checkout-buyer-terms"
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
