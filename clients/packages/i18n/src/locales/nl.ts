export const nl = {
  checkout: {
    footer: {
      poweredBy: 'Mogelijk gemaakt door',
      merchantOfRecord:
        'Deze bestelling wordt verwerkt door onze online reseller & Merchant of Record, Polar, die ook vragen en retourzendingen met betrekking tot bestellingen afhandelt.',
    },
    form: {
      email: 'E-mail',
      cardholderName: 'Naam kaarthouder',
      purchasingAsBusiness: 'Ik koop als bedrijf',
      businessName: 'Bedrijfsnaam',
      billingAddress: {
        label: 'Factuuradres',
        line1: 'Regel 1',
        line2: 'Regel 2',
        postalCode: 'Postcode',
        city: 'Stad',
        country: 'Land',
        state: 'Staat',
        province: 'Provincie',
        stateProvince: 'Staat / Provincie',
      },
      taxId: 'Btw-nummer',
      discountCode: 'Kortingscode',
      optional: 'Optioneel',
      apply: 'Toepassen',
      fieldRequired: 'Dit veld is verplicht',
    },
    pricing: {
      subtotal: 'Subtotaal',
      taxableAmount: 'Belastbaar bedrag',
      taxes: 'BTW',
      free: 'Gratis',
      payWhatYouWant: 'Betaal wat je wilt',
      total: 'Totaal',
      everyInterval: 'Elke {interval}',
      additionalMeteredUsage: 'Extra verbruik op basis van gebruik',
      perUnit: '/ eenheid',
      discount: {
        duration: {
          months: {
            _mode: 'plural',
            '=1': 'voor de eerste maand',
            other: 'voor de eerste # maanden',
          },
          years: {
            _mode: 'plural',
            '=1': 'voor het eerste jaar',
            other: 'voor de eerste # jaar',
          },
        },
      },
    },
    trial: {
      ends: 'Proefperiode eindigt',
      duration: {
        days: {
          _mode: 'plural',
          '=1': '# dag proefperiode',
          other: '# dagen proefperiode',
        },
        weeks: {
          _mode: 'plural',
          '=1': '# week proefperiode',
          other: '# weken proefperiode',
        },
        months: {
          _mode: 'plural',
          '=1': '# maand proefperiode',
          other: '# maanden proefperiode',
        },
        years: {
          _mode: 'plural',
          '=1': '# jaar proefperiode',
          other: '# jaar proefperiode',
        },
      },
    },
    pwywForm: {
      label: 'Noem een eerlijke prijs',
      minimum: '{amount} minimum',
      amountMinimum: 'Bedrag moet minimaal {min} zijn',
      amountFreeOrMinimum: 'Bedrag moet $0 of minimaal {min} zijn',
    },
    productSwitcher: {
      billedRecurring: '{frequency} gefactureerd',
      oneTimePurchase: 'Eenmalige aankoop',
    },
    card: {
      included: 'Inbegrepen',
    },
    benefits: {
      moreBenefits: {
        _mode: 'plural',
        '=1': '# extra voordeel',
        other: '# extra voordelen',
      },
      showMoreBenefits: {
        _mode: 'plural',
        '=1': 'Toon # extra voordeel',
        other: 'Toon # extra voordelen',
      },
      showLess: 'Toon minder',
    },
    cta: {
      startTrial: 'Proefperiode starten',
      subscribeNow: 'Nu abonneren',
      payNow: 'Nu betalen',
      getFree: 'Gratis verkrijgen',
      paymentsUnavailable: 'Betalingen zijn momenteel niet beschikbaar',
    },
  },
  intervals: {
    short: {
      day: 'dag',
      week: 'wk',
      month: 'mnd',
      year: 'jr',
    },
    long: {
      day: 'dag',
      week: 'week',
      month: 'maand',
      year: 'jaar',
    },
    frequency: {
      day: 'dagelijks',
      week: 'wekelijks',
      month: 'maandelijks',
      year: 'jaarlijks',
      everyOrdinalInterval: 'elke {ordinal} {interval}',
    },
  },
  playground: {
    interpolation: 'Dit is een {test}',
    plurals: {
      _mode: 'plural',
      '=0': 'Geen berichten',
      '=1': 'Eén bericht',
      other: '# berichten',
    },
    pluralsWithInterpolation: {
      _mode: 'plural',
      '=0': 'Geen resultaten gevonden voor {query}',
      '=1': 'Eén resultaat gevonden voor {query}',
      other: '# resultaten gevonden voor {query}',
    },
  },
} as const
