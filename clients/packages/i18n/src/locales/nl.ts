export const nl = {
  checkout: {
    footer: {
      poweredBy: 'Mogelijk gemaakt door',
      merchantOfRecord:
        'Deze bestelling wordt verwerkt door onze online wederverkoper & Merchant of Record, Polar, die ook vragen over bestellingen en retouren afhandelt.',
    },
    form: {
      email: 'E-mailadres',
      cardholderName: 'Naam kaarthouder',
      purchasingAsBusiness: 'Ik koop als bedrijf',
      businessName: 'Bedrijfsnaam',
      billingAddress: {
        label: 'Factuuradres',
        line1: 'Adresregel 1',
        line2: 'Adresregel 2',
        postalCode: 'Postcode',
        city: 'Plaats',
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
      taxes: 'Btw',
      free: 'Gratis',
      payWhatYouWant: 'Betaal wat je wilt',
      total: 'Totaal',
      everyInterval: 'Elke {interval}',
      additionalMeteredUsage: 'Extra gemeten gebruik',
      perUnit: '/ eenheid',
      discount: {
        duration: {
          months: {
            '=1': 'voor de eerste maand',
            other: 'voor de eerste # maanden',
            _mode: 'plural',
          },
          years: {
            '=1': 'voor het eerste jaar',
            other: 'voor de eerste # jaren',
            _mode: 'plural',
          },
        },
      },
    },
    trial: {
      ends: 'Proefperiode eindigt op {endDate}',
      duration: {
        days: {
          '=1': '# dag proefperiode',
          other: '# dagen proefperiode',
          _mode: 'plural',
        },
        weeks: {
          '=1': '# week proefperiode',
          other: '# weken proefperiode',
          _mode: 'plural',
        },
        months: {
          '=1': '# maand proefperiode',
          other: '# maanden proefperiode',
          _mode: 'plural',
        },
        years: {
          '=1': '# jaar proefperiode',
          other: '# jaren proefperiode',
          _mode: 'plural',
        },
      },
    },
    pwywForm: {
      label: 'Noem een eerlijke prijs',
      minimum: '{amount} minimaal',
      amountMinimum: 'Bedrag moet minimaal {min} zijn',
      amountFreeOrMinimum: 'Bedrag moet $0 of minimaal {min} zijn',
    },
    productSwitcher: {
      billedRecurring: 'Wordt {frequency} gefactureerd',
      oneTimePurchase: 'Eenmalige aankoop',
    },
    card: {
      included: 'Inbegrepen',
    },
    benefits: {
      moreBenefits: {
        '=1': '# extra voordeel',
        other: '# extra voordelen',
        _mode: 'plural',
      },
      showMoreBenefits: {
        '=1': 'Toon # extra voordeel',
        other: 'Toon # extra voordelen',
        _mode: 'plural',
      },
      showLess: 'Minder tonen',
      granting: 'Voordelen toekennen...',
      requestNewInvite: 'Nieuwe uitnodiging aanvragen',
      retryIn: {
        '=1': 'Probeer opnieuw over # seconde',
        other: 'Probeer opnieuw over # seconden',
        _mode: 'plural',
      },
      connectNewAccount: 'Nieuw account koppelen',
      requestMyInvite: 'Mijn uitnodiging aanvragen',
      github: {
        connect: 'GitHub-account koppelen',
        goTo: 'Ga naar {repository}',
        selectAccount: 'Selecteer een GitHub-account',
      },
      discord: {
        connect: 'Discord-account koppelen',
        open: 'Open Discord',
        selectAccount: 'Selecteer een Discord-account',
      },
      licenseKey: {
        copy: 'Kopiëren',
        copiedToClipboard: 'Gekopieerd naar klembord',
        copiedToClipboardDescription:
          'Licentiesleutel is gekopieerd naar het klembord',
        loading: 'Laden...',
        status: 'Status',
        statusGranted: 'Toegekend',
        statusRevoked: 'Ingetrokken',
        statusDisabled: 'Uitgeschakeld',
        usage: 'Gebruik',
        validations: 'Validaties',
        validatedAt: 'Gevalideerd op',
        neverValidated: 'Nooit gevalideerd',
        expiryDate: 'Vervaldatum',
        noExpiry: 'Geen vervaldatum',
        activations: 'Activaties',
        activationDeleted: 'Activering licentiesleutel verwijderd',
        activationDeletedDescription: 'Activering succesvol verwijderd',
        activationDeactivationFailed: 'Deactivering activering mislukt',
      },
    },
    confirmation: {
      confirmPayment: 'Betaling bevestigen',
      processingTitle: 'We verwerken uw bestelling',
      successTitle: 'Uw bestelling is succesvol!',
      failedTitle:
        'Er is een probleem opgetreden bij het verwerken van uw bestelling',
      processingDescription: 'Even geduld terwijl we uw betaling bevestigen.',
      successDescription:
        'U komt nu in aanmerking voor de voordelen van {product}.',
      failedDescription:
        'Probeer het opnieuw of neem contact op met de ondersteuning.',
    },
    loading: {
      processingOrder: 'Bestelling verwerken...',
      processingPayment: 'Betaling verwerken',
      paymentSuccessful:
        'Betaling succesvol! Uw producten worden klaargemaakt...',
      confirmationTokenFailed:
        'Het aanmaken van een bevestigingstoken is mislukt, probeer het later opnieuw.',
    },
    cta: {
      startTrial: 'Start proefperiode',
      subscribeNow: 'Nu abonneren',
      payNow: 'Nu betalen',
      getFree: 'Gratis krijgen',
      paymentsUnavailable: 'Betalingen zijn momenteel niet beschikbaar',
    },
  },
  intervals: {
    short: {
      day: 'dg',
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
  benefitTypes: {
    usage: {
      displayName: 'Gebruik',
    },
    license_keys: {
      displayName: 'Licentiesleutels',
    },
    github_repository: {
      displayName: 'Toegang tot GitHub-repository',
    },
    discord: {
      displayName: 'Discord-uitnodiging',
    },
    downloadables: {
      displayName: 'Bestandsdownloads',
    },
    custom: {
      displayName: 'Aangepast',
    },
    meter_credit: {
      displayName: 'Metertegoed',
    },
  },
} as const
