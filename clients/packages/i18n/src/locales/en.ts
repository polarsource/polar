export default {
  checkout: {
    footer: {
      poweredBy: 'Powered by',
      merchantOfRecord:
        'This order is processed by our online reseller & Merchant of Record, Polar, who also handles order-related inquiries and returns.',
    },
    form: {
      email: 'Email',
      cardholderName: 'Cardholder name',
      purchasingAsBusiness: "I'm purchasing as a business",
      businessName: 'Business name',
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
      everyInterval: 'Every {interval}',
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
    long: {
      day: 'day',
      week: 'week',
      month: 'month',
      year: 'year',
    },
    frequency: {
      day: 'daily',
      week: 'weekly',
      month: 'monthly',
      year: 'yearly',
      everyOrdinalInterval: 'every {ordinal} {interval}',
    },
  },
  benefitTypes: {
    license_keys: 'License Keys',
    github_repository: 'GitHub Repository Access',
    discord: 'Discord Invite',
    downloadables: 'File Downloads',
    custom: 'Custom',
    meter_credit: 'Meter Credits',
  },
} as const
