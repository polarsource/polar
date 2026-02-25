export default {
  checkout: {
    footer: {
      poweredBy: 'Powered by',
      merchantOfRecord:
        'This order is processed by our online reseller & Merchant of Record, Polar, who also handles order-related inquiries and returns.',
      mandateSubscriptionTrial:
        'By clicking "{buttonLabel}," you authorize Polar Software, Inc., our online reseller and merchant of record, to charge your selected payment method in the amount shown above at the end of your trial period and on each subsequent billing date until you cancel. You may cancel at any time before the end of your trial to avoid being charged.',
      mandateSubscription:
        'By clicking "{buttonLabel}," you authorize Polar Software, Inc., our online reseller and merchant of record, to immediately charge your selected payment method in the amount shown above and to charge the same amount on each subsequent billing date until you cancel.',
      mandateOneTime:
        'By clicking "{buttonLabel}," you authorize Polar Software, Inc., our online reseller and merchant of record, to charge your selected payment method the amount shown above. This is a one-time charge.',
    },
    form: {
      email: 'Email',
      cardholderName: 'Cardholder name',
      purchasingAsBusiness: "I'm purchasing as a business",
      addBusinessDetails: 'Add business details',
      removeBusinessDetails: 'Remove business details',
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
      perUnit: '/ unit',
      discount: {
        duration: {
          months: {
            _mode: 'plural',
            '=1': 'for the first month',
            other: 'for the first # months',
          },
          years: {
            _mode: 'plural',
            '=1': 'for the first year',
            other: 'for the first # years',
          },
        },
      },
    },
    trial: {
      ends: 'Trial ends {endDate}',
      duration: {
        days: {
          _mode: 'plural',
          '=1': '# day trial',
          other: '# days trial',
        },
        weeks: {
          _mode: 'plural',
          '=1': '# week trial',
          other: '# weeks trial',
        },
        months: {
          _mode: 'plural',
          '=1': '# month trial',
          other: '# months trial',
        },
        years: {
          _mode: 'plural',
          '=1': '# year trial',
          other: '# years trial',
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
    },
    productDescription: {
      readMore: 'Read more',
      readLess: 'Read less',
    },
    card: {
      included: 'Included',
    },
    benefits: {
      moreBenefits: {
        _mode: 'plural',
        '=1': '# more benefit',
        other: '# more benefits',
      },
      showMoreBenefits: {
        _mode: 'plural',
        '=1': 'Show # more benefit',
        other: 'Show # more benefits',
      },
      showLess: 'Show less',
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
      successTitle: 'Your order was successful!',
      failedTitle: 'A problem occurred while processing your order',
      processingDescription: 'Please wait while we confirm your payment.',
      successDescription: "You're now eligible for the benefits of {product}.",
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
  },
  intervals: {
    short: {
      day: 'dy',
      week: 'wk',
      month: 'mo',
      year: 'yr',
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
} as const
