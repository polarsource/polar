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
      taxes: 'Belasting',
      free: 'Gratis',
      total: 'Totaal',
      everyInterval: 'Elke {interval}',
      additionalMeteredUsage: 'Extra verbruik op basis van gebruik',
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
    cta: {
      startTrial: 'Proefperiode starten',
      subscribeNow: 'Nu abonneren',
      payNow: 'Nu betalen',
      getFree: 'Verzenden',
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
