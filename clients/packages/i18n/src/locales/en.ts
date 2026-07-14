export default {
  checkout: {
    footer: {
      poweredBy: 'Powered by',
      merchantOfRecord:
        'This order is processed by our online reseller & Merchant of Record, Polar, who also handles order-related inquiries and returns.',
      mandateSubscriptionTrial:
        'By clicking "{buttonLabel}," you authorize Polar Software, Inc., our online reseller and merchant of record, to charge your selected payment method in the amount shown above at the end of your trial period and on each subsequent billing date until you cancel, and agree to the {buyerTermsLink}. You may cancel at any time before the end of your trial to avoid being charged.',
      mandateSubscription:
        'By clicking "{buttonLabel}," you authorize Polar Software, Inc., our online reseller and merchant of record, to immediately charge your selected payment method in the amount shown above and to charge the same amount on each subsequent billing date until you cancel, and agree to the {buyerTermsLink}.',
      mandateOneTime:
        'By clicking "{buttonLabel}," you authorize Polar Software, Inc., our online reseller and merchant of record, to charge your selected payment method the amount shown above, and agree to the {buyerTermsLink}. This is a one-time charge.',
      buyerTermsLink: 'Buyer Terms',
    },
    form: {
      email: 'Email',
      cardholderName: 'Cardholder name',
      purchasingAsBusiness: "I'm purchasing as a business",
      businessName: 'Business name',
      billingDetails: 'Business Details',
      billingAddress: {
        label: 'Billing address',
        line1: {
          value: 'Street address',
          _llmContext:
            'The first line of the billing address, typically including street address and number. Adjust to fit the most common format for the target locale.',
        },
        line2: {
          value: 'Apartment or unit number',
          _llmContext:
            'The second line of the billing address, typically used for apartment, suite, unit, building, floor, etc. Adjust to fit the most common format for the target locale.',
        },
        postalCode: 'Postal code',
        city: 'City',
        country: 'Country',
        state: 'State',
        province: 'Province',
        stateProvince: 'State / Province',
      },
      taxId: 'Tax ID',
      discountCode: 'Discount code',
      addDiscountCode: 'Add discount code',
      optional: 'Optional',
      apply: {
        value: 'Apply',
        _llmContext: 'Button text for applying a discount code.',
      },
      fieldRequired: 'This field is required',
    },
    pricing: {
      subtotal: 'Subtotal',
      taxableAmount: 'Taxable amount',
      taxes: {
        value: 'Taxes',
        _llmContext:
          'Taxes applied to the order. This is VAT or sales tax. Prefer the specific term used in the target locale over a generic taxes (e.g. TVA in French, BTW in Dutch, etc.)',
      },
      inclTax: {
        value: 'Taxes (included)',
        _llmContext:
          'Label for the tax line in the pricing breakdown when tax is already included in the displayed price. Prefer the specific tax term used in the target locale (e.g. TVA (incluse) in French, BTW (inbegrepen) in Dutch, Moms (inkluderad) in Swedish, etc.)',
      },
      free: 'Free',
      payWhatYouWant: {
        value: 'Pay what you want',
        _llmContext:
          'A pricing type where the customer can choose how much to pay.',
      },
      total: 'Total',
      everyInterval: {
        day: {
          _mode: 'plural',
          '=1': 'Daily',
          '=2': 'Every other day',
          other: 'Every # days',
        },
        week: {
          _mode: 'plural',
          '=1': 'Weekly',
          '=2': 'Every other week',
          other: 'Every # weeks',
        },
        month: {
          _mode: 'plural',
          '=1': 'Monthly',
          '=2': 'Every other month',
          other: 'Every # months',
        },
        year: {
          _mode: 'plural',
          '=1': 'Yearly',
          '=2': 'Every other year',
          other: 'Every # years',
        },
      },
      additionalMeteredUsage: 'Additional metered usage',
      perSeat: 'per seat',
      basePrice: {
        value: 'Base price',
        _llmContext:
          'Label for the flat, fixed portion of a product that combines a fixed base fee with per-seat pricing. Shown as a line item above the per-seat rows in the checkout pricing breakdown.',
      },
      seats: {
        label: 'Seats',
        numberOfSeats: 'Number of seats',
        count: {
          _mode: 'plural',
          '=1': '# seat',
          other: '# seats',
        },
        included: {
          _mode: 'plural',
          '=1': 'One seat included',
          other: '# seats included',
        },
        range: {
          value: '{min} - {max} seats',
          _llmContext:
            'Shown when a seat-based product has both a minimum and maximum seat count. Displayed as: "5 - 100 seats". Always plural.',
        },
        minimum: {
          value: 'Minimum {min} seats',
          _llmContext:
            'Shown when a seat-based product has a minimum seat count but no maximum. The {min} value is always > 1 in this context, so the noun is always plural.',
        },
        maximum: {
          value: 'Maximum {max} seats',
          _llmContext:
            'Shown when a seat-based product has a maximum seat count but no minimum constraint. The {max} value can be any number, but the message is always rendered with the plural noun.',
        },
        updateFailed: 'Failed to update seats',
      },
      discount: {
        until: {
          value: 'Until {date}',
          _llmContext:
            'Shown next to the discount name to indicate when the discount expires. Displayed as: "Spring Sale (-50%) · Until Apr 23".',
        },
      },
    },
    trial: {
      hero: {
        free: {
          day: {
            _mode: 'plural',
            '=1': '# day free',
            other: '# days free',
          },
          month: {
            _mode: 'plural',
            '=1': '# month free',
            other: '# months free',
          },
          year: {
            _mode: 'plural',
            '=1': '# year free',
            other: '# years free',
          },
        },
        intervalSuffix: {
          day: '/day',
          week: '/week',
          month: '/month',
          year: '/year',
        },
        then: {
          value: 'Then',
          _llmContext:
            'Prefix before the recurring price in the trial hero subtitle. Displayed as: "Then <bold>$99.99/year</bold> starting April 5, 2026". The price is a separate bold element.',
        },
        startingDate: {
          value: 'starting {date}',
          _llmContext:
            'Suffix after the recurring price when a trial end date is known. Displayed as: "Then $99.99/year starting April 5, 2026". The "Then" prefix and bold price are separate elements.',
        },
      },
    },
    pwywForm: {
      label: 'Name a fair price',
      minimum: '{amount} minimum',
      amountMinimum: 'Amount must be at least {min}',
      amountFreeOrMinimum: 'Amount must be {zero} or at least {min}',
    },
    productSwitcher: {
      billedRecurring: 'Billed {frequency}',
      oneTimePurchase: 'One-time purchase',
      fromPrefix: 'From',
    },
    productDescription: {
      readMore: 'Read more',
    },
    benefits: {
      granting: 'Granting benefits...',
      requestNewInvite: 'Request new invite',
      retryIn: {
        _mode: 'plural',
        '=1': 'Try again in # second',
        other: 'Try again in # seconds',
      },
      connectNewAccount: 'Connect new account',
      requestMyInvite: 'Request my invite',
      github: {
        connect: 'Connect GitHub account',
        goTo: 'Go to {repository}',
        selectAccount: 'Select a GitHub account',
      },
      discord: {
        connect: 'Connect Discord account',
        open: 'Open Discord',
        selectAccount: 'Select a Discord account',
      },
      slackSharedChannel: {
        connected: 'Connected to your Slack workspace.',
        connectedChannel:
          'Connected to your Slack workspace in channel {channel}.',
        inviteSent: 'Invite sent to {email}.',
        channel: 'Channel: {channel}.',
        openLinkToAccept: 'Open the link to accept in Slack.',
        acceptFromEmail:
          'Accept it from the invite email or your Slack Connect requests.',
        openInvite: 'Open Slack invite',
        provisioning:
          'Setting up your Slack channel for {email}... You should receive an invite in your inbox shortly.',
        setupFailed:
          "We couldn't set up your Slack channel with {email}. Double-check the email and try again, or reach out to the seller if it keeps failing.",
        enterEmail:
          "Enter the email of an admin in your Slack workspace. They'll receive a Slack Connect invite for a private channel.",
        emailPlaceholder: 'slack-admin@yourcompany.com',
        tryAgain: 'Try again',
        requestInvite: 'Request Slack invite',
      },
      licenseKey: {
        copy: 'Copy',
        copiedToClipboard: 'Copied To Clipboard',
        copiedToClipboardDescription: 'License Key was copied to clipboard',
        loading: 'Loading...',
        status: 'Status',
        statusGranted: 'Granted',
        statusRevoked: 'Revoked',
        statusDisabled: 'Disabled',
        usage: 'Usage',
        validations: 'Validations',
        validatedAt: 'Validated At',
        neverValidated: 'Never Validated',
        expiryDate: 'Expiry Date',
        noExpiry: 'No Expiry',
        activations: 'Activations',
        activationDeleted: 'License Key Activation Deleted',
        activationDeletedDescription: 'Activation deleted successfully',
        activationDeactivationFailed: 'Activation Deactivation Failed',
      },
    },
    confirmation: {
      confirmPayment: 'Confirm payment',
      processingTitle: 'We are processing your order',
      successTitle: 'Thank you for your order!',
      failedTitle: 'A problem occurred while processing your order',
      processingDescription: 'Please wait while we confirm your payment.',
      successDescription: 'You now have access to {product}.',
      failedDescription: 'Please try again or contact support.',
    },
    loading: {
      processingOrder: 'Processing order...',
      processingPayment: 'Processing payment',
      paymentSuccessful: 'Payment successful! Getting your products ready...',
      confirmationTokenFailed:
        'Failed to create confirmation token, please try again later.',
    },
    cta: {
      startTrial: 'Start trial',
      subscribeNow: 'Subscribe now',
      payNow: 'Pay now',
      getFree: 'Get for free',
      paymentsUnavailable: 'Payments are currently unavailable',
    },
    trialUnavailable: {
      title: 'No free trial for this purchase',
      description:
        "You've already used a free trial for this product, so you'll be charged today. Continue below to complete your purchase.",
    },
  },
  intervals: {
    short: {
      day: {
        _mode: 'plural',
        '=1': 'dy',
        other: '# dy',
      },
      week: {
        _mode: 'plural',
        '=1': 'wk',
        other: '# wk',
      },
      month: {
        _mode: 'plural',
        '=1': 'mo',
        other: '# mo',
      },
      year: {
        _mode: 'plural',
        '=1': 'yr',
        other: '# yr',
      },
    },
  },
  benefitTypes: {
    license_keys: 'License keys',
    github_repository: 'GitHub repository access',
    discord: 'Discord invite',
    downloadables: 'File downloads',
    custom: 'Custom',
    meter_credit: 'Meter credits',
    feature_flag: 'Feature flag',
    slack_shared_channel: 'Shared Slack channel',
  },
  ordinal: {
    zero: {
      value: '',
      _llmContext:
        'Ordinal suffix for the "zero" category of Intl.PluralRules (type: ordinal). Appended to a number to form ordinals. Provide the suffix only — the number is prepended automatically. For locales where all ordinals use the same suffix (e.g. German "1.", "2."), set every key to the same value. Not used in English.',
    },
    one: {
      value: 'st',
      _llmContext:
        'Ordinal suffix for the "one" category of Intl.PluralRules (type: ordinal). Appended to a number to form ordinals (e.g. 1st, 21st, 31st in English). Provide the suffix only — the number is prepended automatically. For locales where all ordinals use the same suffix (e.g. German "1.", "2."), set every key to the same value.',
    },
    two: {
      value: 'nd',
      _llmContext:
        'Ordinal suffix for the "two" category of Intl.PluralRules (type: ordinal). Appended to a number to form ordinals (e.g. 2nd, 22nd in English). Provide the suffix only — the number is prepended automatically.',
    },
    few: {
      value: 'rd',
      _llmContext:
        'Ordinal suffix for the "few" category of Intl.PluralRules (type: ordinal). Appended to a number to form ordinals (e.g. 3rd, 23rd in English). Provide the suffix only — the number is prepended automatically.',
    },
    many: {
      value: '',
      _llmContext:
        'Ordinal suffix for the "many" category of Intl.PluralRules (type: ordinal). Appended to a number to form ordinals. Provide the suffix only — the number is prepended automatically. Not used in English.',
    },
    other: {
      value: 'th',
      _llmContext:
        'Ordinal suffix for the "other" (default/fallback) category of Intl.PluralRules (type: ordinal). Appended to a number to form ordinals (e.g. 4th, 5th, 11th in English). Provide the suffix only — the number is prepended automatically.',
    },
  },
  embedPaymentMethod: {
    title: 'Add payment method',
    close: {
      value: 'Close',
      _llmContext:
        'aria-label for the close (X) button on the embedded payment method modal.',
    },
    submit: 'Add payment method',
    processing: 'Adding payment method…',
    fallbackError: 'Something went wrong. Please try again.',
    errors: {
      invalidRequest: 'Missing required parameters.',
      unauthorized: 'Session expired.',
      processingFailed:
        'Could not process the payment method. Please try again.',
      unknown: 'Something went wrong.',
    },
  },
} as const
