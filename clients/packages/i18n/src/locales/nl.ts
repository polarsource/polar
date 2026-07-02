export default {
  checkout: {
    footer: {
      poweredBy: 'Mogelijk gemaakt door',
      merchantOfRecord:
        'Deze bestelling wordt verwerkt door onze online wederverkoper & Merchant of Record, Polar, die ook bestelgerelateerde vragen en terugbetalingen afhandelt.',
      mandateSubscriptionTrial:
        'Door op "{buttonLabel}" te klikken, machtig je Polar Software, Inc., onze online wederverkoper en geregistreerde verkoper, om het hierboven getoonde bedrag aan het einde van je proefperiode en op elke volgende factuurdatum af te schrijven van je gekozen betaalmethode totdat je annuleert, en ga je akkoord met de {buyerTermsLink}. Je kunt op elk moment voor het einde van je proefperiode annuleren om te voorkomen dat er kosten in rekening worden gebracht.',
      mandateSubscription:
        'Door op "{buttonLabel}" te klikken, machtig je Polar Software, Inc., onze online wederverkoper en geregistreerde verkoper, om het hierboven getoonde bedrag onmiddellijk af te schrijven van je gekozen betaalmethode en ditzelfde bedrag op elke volgende factuurdatum af te schrijven totdat je annuleert, en ga je akkoord met de {buyerTermsLink}.',
      buyerTermsLink: 'Kopersvoorwaarden',
      mandateOneTime:
        'Door op "{buttonLabel}" te klikken, machtig je Polar Software, Inc., onze online wederverkoper en officiële verkoper, om het hierboven getoonde bedrag via je gekozen betaalmethode in rekening te brengen, en ga je akkoord met de {buyerTermsLink}. Dit is een eenmalige betaling.',
    },
    form: {
      email: 'E-mailadres',
      cardholderName: 'Naam kaarthouder',
      purchasingAsBusiness: 'Ik koop als bedrijf',
      businessName: 'Bedrijfsnaam',
      billingAddress: {
        label: 'Factuuradres',
        postalCode: 'Postcode',
        city: 'Plaats',
        country: 'Land',
        state: 'Staat',
        province: 'Provincie',
        stateProvince: 'Staat / Provincie',
        line1: 'Straatnaam en huisnummer',
        line2: 'Appartement of busnummer',
      },
      taxId: 'Btw-nummer',
      discountCode: 'Kortingscode',
      optional: 'Optioneel',
      apply: 'Toepassen',
      fieldRequired: 'Dit veld is verplicht',
      billingDetails: 'Bedrijfsgegevens',
      addDiscountCode: 'Kortingscode toevoegen',
    },
    pricing: {
      subtotal: 'Subtotaal',
      taxableAmount: 'Belastbaar bedrag',
      taxes: 'BTW',
      free: 'Gratis',
      payWhatYouWant: 'Betaal wat je wilt',
      total: 'Totaal',
      additionalMeteredUsage: 'Extra verbruikskosten',
      discount: {
        until: 'Tot {date}',
      },
      everyInterval: {
        day: {
          '=1': 'Dagelijks',
          other: 'Elke # dagen',
          '=2': 'Elke twee dagen',
          _mode: 'plural',
        },
        week: {
          '=1': 'Wekelijks',
          other: 'Elke # weken',
          '=2': 'Elke twee weken',
          _mode: 'plural',
        },
        month: {
          '=1': 'Maandelijks',
          other: 'Elke # maanden',
          '=2': 'Elke twee maanden',
          _mode: 'plural',
        },
        year: {
          '=1': 'Jaarlijks',
          other: 'Elke # jaar',
          '=2': 'Elke twee jaar',
          _mode: 'plural',
        },
      },
      perSeat: 'per gebruiker',
      seats: {
        label: 'Gebruikers',
        numberOfSeats: 'Aantal gebruikers',
        count: {
          '=1': '# gebruiker',
          other: '# gebruikers',
          _mode: 'plural',
        },
        range: '{min} - {max} gebruikers',
        minimum: 'Minimaal {min} gebruikers',
        maximum: 'Maximaal {max} gebruikers',
        updateFailed: 'Gebruikers bijwerken mislukt',
        included: {
          '=1': 'Eén gebruiker inbegrepen',
          other: '# gebruikers inbegrepen',
          _mode: 'plural',
        },
      },
      inclTax: 'Btw (inbegrepen)',
      basePrice: 'Basisprijs',
    },
    trial: {
      hero: {
        free: {
          day: {
            '=1': '# dag gratis',
            other: '# dagen gratis',
            _mode: 'plural',
          },
          month: {
            '=1': '# maand gratis',
            other: '# maanden gratis',
            _mode: 'plural',
          },
          year: {
            '=1': '# jaar gratis',
            other: '# jaar gratis',
            _mode: 'plural',
          },
        },
        intervalSuffix: {
          day: '/dag',
          week: '/week',
          month: '/maand',
          year: '/jaar',
        },
        then: 'Daarna',
        startingDate: 'vanaf {date}',
      },
    },
    pwywForm: {
      label: 'Kies een eerlijke prijs',
      minimum: 'minimaal {amount}',
      amountMinimum: 'Bedrag moet minimaal {min} zijn',
      amountFreeOrMinimum: 'Bedrag moet {zero} of minimaal {min} zijn',
    },
    productSwitcher: {
      billedRecurring: '{frequency} gefactureerd',
      oneTimePurchase: 'Eenmalige aankoop',
      fromPrefix: 'Vanaf',
    },
    benefits: {
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
        open: 'Discord openen',
        selectAccount: 'Selecteer een Discord-account',
      },
      licenseKey: {
        copy: 'Kopiëren',
        copiedToClipboard: 'Gekopieerd naar klembord',
        copiedToClipboardDescription:
          'Licentiesleutel is gekopieerd naar klembord',
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
        noExpiry: 'Verloopt niet',
        activations: 'Activaties',
        activationDeleted: 'Licentiesleutelactivatie verwijderd',
        activationDeletedDescription: 'Activatie succesvol verwijderd',
        activationDeactivationFailed: 'Deactiveren mislukt',
      },
      slackSharedChannel: {
        connected: 'Verbonden met je Slack-werkruimte.',
        connectedChannel:
          'Verbonden met je Slack-werkruimte in kanaal {channel}.',
        inviteSent: 'Uitnodiging verzonden naar {email}.',
        channel: 'Kanaal: {channel}.',
        openLinkToAccept: 'Open de link om deze in Slack te accepteren.',
        acceptFromEmail:
          'Accepteer via de uitnodigingsmail of je Slack Connect-verzoeken.',
        openInvite: 'Open Slack-uitnodiging',
        provisioning:
          'Je Slack-kanaal voor {email} wordt ingesteld... Je ontvangt binnenkort een uitnodiging in je inbox.',
        setupFailed:
          'We konden je Slack-kanaal met {email} niet instellen. Controleer het e-mailadres en probeer het opnieuw, of neem contact op met de verkoper als het blijft mislukken.',
        enterEmail:
          'Voer het e-mailadres in van een beheerder in je Slack-werkruimte. Die ontvangt een Slack Connect-uitnodiging voor een privékanaal.',
        emailPlaceholder: 'slack-admin@yourcompany.com',
        tryAgain: 'Opnieuw proberen',
        requestInvite: 'Slack-uitnodiging aanvragen',
      },
    },
    confirmation: {
      confirmPayment: 'Betaling bevestigen',
      processingTitle: 'We verwerken je bestelling',
      failedTitle:
        'Er is een probleem opgetreden bij het verwerken van je bestelling',
      processingDescription:
        'Een ogenblik geduld terwijl we je betaling bevestigen.',
      failedDescription: 'Probeer het opnieuw of neem contact op met support.',
      successTitle: 'Bedankt voor je bestelling!',
      successDescription: 'Je hebt nu toegang tot {product}.',
    },
    loading: {
      processingOrder: 'Bestelling verwerken...',
      processingPayment: 'Betaling verwerken',
      paymentSuccessful: 'Betaling geslaagd! Je producten worden klaargezet...',
      confirmationTokenFailed:
        'Bevestigingstoken aanmaken mislukt, probeer het later opnieuw.',
    },
    cta: {
      startTrial: 'Proefperiode starten',
      subscribeNow: 'Nu abonneren',
      payNow: 'Nu betalen',
      getFree: 'Gratis verkrijgen',
      paymentsUnavailable: 'Betalingen zijn momenteel niet beschikbaar',
    },
    productDescription: {
      readMore: 'Lees meer',
    },
  },
  intervals: {
    short: {
      day: 'dg',
      week: 'wk',
      month: 'mnd',
      year: 'jr',
    },
    shortCount: {
      day: {
        '=1': '# dgn',
        other: '# dgn',
        _mode: 'plural',
      },
      week: {
        '=1': '# wk',
        other: '# wk',
        _mode: 'plural',
      },
      month: {
        '=1': '# mnd',
        other: '# mnd',
        _mode: 'plural',
      },
      year: {
        '=1': '# jr',
        other: '# jr',
        _mode: 'plural',
      },
    },
  },
  benefitTypes: {
    custom: 'Aangepast',
    license_keys: 'Licentiesleutels',
    github_repository: 'Toegang tot GitHub-repository',
    discord: 'Discord-uitnodiging',
    downloadables: 'Bestandsdownloads',
    meter_credit: 'Verbruikstegoed',
    feature_flag: 'Feature flag',
    slack_shared_channel: 'Gedeeld Slack-kanaal',
  },
  ordinal: {
    zero: 'de',
    one: 'e',
    two: 'e',
    few: 'e',
    many: 'e',
    other: 'e',
  },
  embedPaymentMethod: {
    title: 'Betaalmethode toevoegen',
    close: 'Sluiten',
    submit: 'Betaalmethode toevoegen',
    processing: 'Betaalmethode toevoegen…',
    fallbackError: 'Er is iets misgegaan. Probeer het opnieuw.',
    errors: {
      invalidRequest: 'Vereiste parameters ontbreken.',
      unauthorized: 'Sessie verlopen.',
      processingFailed:
        'De betaalmethode kon niet worden verwerkt. Probeer het opnieuw.',
      unknown: 'Er is iets misgegaan.',
    },
  },
} as const
