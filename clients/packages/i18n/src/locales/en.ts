export const en = {
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
        line1: 'Line 1',
        line2: 'Line 2',
        postalCode: 'Postal code',
        city: 'City',
      },
      taxId: 'Tax ID',
      discountCode: 'Discount code',
      optional: 'Optional',
      apply: 'Apply',
      fieldRequired: 'This field is required',
    },
    pricing: {
      subtotal: 'Subtotal',
      taxableAmount: 'Taxable amount',
      taxes: 'Taxes',
      free: 'Free',
      total: 'Total',
      everyInterval: 'Every {interval}',
      additionalMeteredUsage: 'Additional metered usage',
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
      ends: 'Trial ends',
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
    cta: {
      startTrial: 'Start Trial',
      subscribeNow: 'Subscribe now',
      payNow: 'Pay now',
      getFree: 'Submit',
      paymentsUnavailable: 'Payments are currently unavailable',
    },
  },
  playground: {
    interpolation: 'This is a {test}',
    plurals: {
      _mode: 'plural',
      '=0': 'No messages',
      '=1': 'One message',
      other: '# messages',
    },
    pluralsWithInterpolation: {
      _mode: 'plural',
      '=0': 'No results found for {query}',
      '=1': 'One result found for {query}',
      other: '# results found for {query}',
    },
  },
} as const
