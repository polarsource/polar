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
      addBusinessDetails: 'Bedrijfsgegevens toevoegen',
      removeBusinessDetails: 'Bedrijfsgegevens verwijderen',
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
            other: 'voor de eerste # jaar',
            _mode: 'plural',
          },
        },
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
          other: '# jaar proefperiode',
          _mode: 'plural',
        },
      },
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
      summary: {
        totalWhenTrialEnds: 'Totaal na proefperiode',
        totalWhenDiscountExpires: 'Totaal na afloop korting',
        totalDueToday: 'Totaal vandaag te betalen',
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
      showLess: 'Toon minder',
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
      readLess: 'Lees minder',
    },
  },
  intervals: {
    short: {
      day: 'dg',
      week: 'wk',
      month: 'mnd',
      year: 'jr',
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
  portal: {
    navigation: {
      overview: 'Overzicht',
      orders: 'Bestellingen',
      usage: 'Gebruik',
      billing: 'Facturering',
      selectPage: 'Selecteer pagina',
    },
    common: {
      cancel: 'Annuleren',
      close: 'Sluiten',
      save: 'Opslaan',
      saveChanges: 'Wijzigingen opslaan',
      edit: 'Bewerken',
      delete: 'Verwijderen',
      confirm: 'Bevestigen',
      back: 'Terug',
      loading: 'Bezig met laden…',
      saving: 'Bezig met opslaan…',
      download: 'Downloaden',
      viewAll: 'Alles bekijken',
      somethingWentWrong: 'Er is iets misgegaan. Probeer het opnieuw.',
      date: 'Datum',
      amount: 'Bedrag',
      status: 'Status',
      product: 'Product',
      actions: 'Acties',
      pageOf: 'Pagina {page} van {totalPages}',
    },
    overview: {
      teamSeatAccess: {
        title: 'Toegang tot teamplaatsen',
        description: 'Toegang via teamabonnement',
      },
      emptyState: {
        noActiveSubscriptions: {
          title: 'Geen actieve abonnementen',
          description: 'Je hebt momenteel geen actieve abonnementen.',
        },
        noTeamAccess: {
          title: 'Geen teamtoegang',
          description: 'Je hebt momenteel geen toegang tot teamplaatsen.',
        },
      },
      currentPeriod: {
        nextCharge: 'Volgende afschrijving',
        nextInvoice: 'Volgende factuur',
        firstChargeAfterTrial: 'Eerste afschrijving na proefperiode',
        trialEnds: 'Proefperiode eindigt',
        finalCharge: 'Laatste afschrijving',
        subscriptionEnds: 'Abonnement eindigt',
        notAvailable: 'N.v.t.',
        dateLabel: '{label} — {date}',
        canceled: 'Geannuleerd',
        meteredCharges: 'Variabele kosten',
        subtotal: 'Subtotaal',
        discount: 'Korting',
        taxes: 'Belastingen',
        estimatedTotal: 'Geschat totaal',
        total: 'Totaal',
        finalChargeNotice:
          'Dit is de laatste afschrijving voordat het abonnement eindigt.',
        finalChargeMeteredNotice:
          'Het uiteindelijke bedrag kan variëren op basis van gebruik tot het einde van de factureringsperiode.',
        meteredNoticeActive:
          'De uiteindelijke kosten kunnen variëren op basis van gebruik tot het einde van de factureringsperiode.',
        meteredNoticeTrialing:
          'De uiteindelijke kosten kunnen variëren op basis van gebruik tijdens de proefperiode.',
        meteredNoticeDefault: 'De uiteindelijke kosten kunnen variëren.',
      },
      latestPurchase: {
        title: 'Laatste aankoop',
        purchasedOn: 'Aangeschaft — {date}',
        total: 'Totaal',
      },
      subscriptions: {
        title: 'Abonnementen',
        noSubscriptionsFound: 'Geen abonnementen gevonden',
        inactiveTitle: 'Inactieve abonnementen',
        endedAt: 'Einddatum',
        retryPayment: 'Betaling opnieuw proberen',
        manageSubscription: 'Abonnement beheren',
      },
    },
    orders: {
      orderHistory: 'Bestelgeschiedenis',
      description: 'Beschrijving',
      viewOrder: 'Bestelling bekijken',
      retryPayment: 'Betaling opnieuw proberen',
      invoiceNumber: 'Factuurnummer',
      orderItems: 'Bestelitems',
      subtotal: 'Subtotaal',
      discount: 'Korting',
      netAmount: 'Netto bedrag',
      tax: 'Belasting',
      total: 'Totaal',
      appliedBalance: 'Toegepast tegoed',
      toBePaid: 'Te betalen',
      refundedAmount: 'Terugbetaald bedrag',
      statusTitle: {
        draft: 'Concept',
        paid: 'Betaald',
        pending: 'In afwachting',
        refunded: 'Terugbetaald',
        partiallyRefunded: 'Gedeeltelijk terugbetaald',
        void: 'Ongeldig',
      },
      payment: {
        orderSummary: 'Bestellingsoverzicht',
        descriptionLabel: 'Beschrijving:',
        amountLabel: 'Bedrag:',
        paymentMethod: 'Betaalmethode',
        payNow: 'Nu betalen',
        processing: 'Bezig...',
        confirming: 'Bezig met bevestigen...',
        loading: 'Bezig met laden...',
        processingPayment: 'We verwerken je betaling...',
        processingHint: 'Dit kan even duren. Sluit dit venster niet.',
        processingPaymentShort: 'Betaling verwerken...',
        usingSavedMethod: 'Je opgeslagen betaalmethode wordt gebruikt',
        tryAgain: 'Opnieuw proberen',
        paymentSuccessfulTitle: 'Betaling geslaagd!',
        paymentFailedTitle: 'Betaling mislukt',
        paymentSuccessfulDescription:
          'Bedankt voor je betaling. Je kunt dit venster nu sluiten.',
        paymentFailedDescription:
          'Je kunt het opnieuw proberen of contact opnemen met support als het probleem aanhoudt.',
        updatePaymentMethod: 'Betaalmethode bijwerken',
        toastSuccessTitle: 'Betaling geslaagd',
        toastSuccessDescription: 'Je betaling is succesvol verwerkt!',
        toastFailedTitle: 'Betaling mislukt',
        paymentFailed: 'Betaling mislukt',
        paymentFailedRetry: 'Betaling mislukt. Probeer het opnieuw.',
        paymentFailedTryAgain: 'Betaling mislukt, probeer het opnieuw.',
        confirmationTimeout:
          'De betalingsbevestiging duurt langer dan verwacht. Je betaling wordt mogelijk nog verwerkt. Controleer je bestelstatus of neem contact op met support als dat nodig is.',
        networkConfirmationError:
          'Kan de betalingsstatus niet bevestigen vanwege netwerkproblemen. Controleer je bestelstatus of neem contact op met support.',
        stripeRequired: 'Een Stripe-instantie is vereist voor betalingsacties',
        additionalAuthenticationRequired:
          'De betaling vereist extra verificatie',
        authenticationFailed: 'Betalingsverificatie mislukt',
        processDetailsFailed:
          'Kan betalingsgegevens niet verwerken. Controleer je gegevens en probeer het opnieuw.',
        createTokenFailed:
          'Kan betalingstoken niet aanmaken. Probeer het opnieuw.',
        processPaymentFailed:
          'Kan betaling niet verwerken. Controleer je betalingsgegevens en probeer het opnieuw.',
        networkError:
          'Netwerkfout opgetreden. Controleer je verbinding en probeer het opnieuw.',
      },
    },
    subscription: {
      free: 'Gratis',
      details: {
        startDate: 'Startdatum',
        trialEnds: 'Proefperiode eindigt',
        expiryDate: 'Vervaldatum',
        renewalDate: 'Vernieuwingsdatum',
        expired: 'Verlopen',
        meteredUsage: 'Variabel gebruik',
        uncancel: 'Annulering ongedaan maken',
        manageSubscription: 'Abonnement beheren',
        changePlan: 'Abonnement wijzigen',
      },
      pendingUpdate: {
        title: 'In afwachting van wijziging',
        cancelScheduledChange: 'Geplande wijziging annuleren',
        newProduct: 'Nieuw product',
        seats: 'Plaatsen',
        effectiveFrom: 'Wijziging van kracht vanaf',
        clearConfirmDescription:
          'Je abonnement blijft ongewijzigd in de volgende factureringscyclus. Weet je zeker dat je deze geplande wijziging wilt annuleren?',
      },
      invoices: {
        title: 'Facturen',
      },
      cancel: {
        title: 'Abonnement annuleren',
        ariaLabel: 'Abonnement annuleren',
        heading: 'Jammer dat je weggaat!',
        description:
          'Je bent altijd welkom terug! Laat ons weten waarom je vertrekt, zodat we ons product kunnen verbeteren.',
        changedMind: 'Ik ben van gedachten veranderd',
        commentPlaceholder: 'Wil je nog iets delen? (Optioneel)',
        reason: {
          unused: 'Gebruik het niet genoeg',
          tooExpensive: 'Te duur',
          missingFeatures: 'Ontbrekende functies',
          switchedService: 'Overgestapt naar een andere dienst',
          customerService: 'Klantenservice',
          lowQuality: 'Niet tevreden over de kwaliteit',
          tooComplex: 'Te ingewikkeld',
          other: 'Anders (geef hieronder toelichting)',
        },
        toast: {
          title: 'Abonnement geannuleerd',
          description: 'Abonnement is succesvol geannuleerd',
        },
      },
      changePlan: {
        title: 'Abonnement wijzigen',
        currentPlan: 'Huidig abonnement',
        availablePlans: 'Beschikbare abonnementen',
        noOtherPlans: 'Geen andere abonnementen beschikbaar',
        benefitsAdded: 'Je krijgt toegang tot de volgende voordelen',
        benefitsRemoved: 'Je verliest toegang tot de volgende voordelen',
        needPaymentMethod:
          'Je moet een betaalmethode toevoegen voordat je je abonnement bijwerkt. Ga naar de instellingen van het klantportaal om een betaalmethode toe te voegen.',
        confirmEndTrial: 'Abonnement wijzigen en proefperiode beëindigen',
        invoicing: {
          trialContinues:
            'Je proefperiode loopt door tot {date}. Je wordt daarvoor niet belast.',
          trialEnds:
            'Hiermee beëindig ik mijn proefperiode en wordt {product} direct in rekening gebracht.',
          periodMonthly: 'maandelijks',
          periodYearly: 'jaarlijks',
          immediateCharge:
            'Voor het nieuwe {period}-abonnement wordt direct kosten in rekening gebracht.',
          immediateCredit:
            'Mijn vorige betaling verschijnt als tegoed op mijn volgende factuur.',
          prorationInvoice:
            'Ik word direct in rekening gebracht met verrekening voor de huidige maand.',
          prorationProrate:
            'Je volgende factuur bevat het nieuwe abonnement plus de verrekening voor de huidige maand.',
          prorationNextPeriod:
            'Het nieuwe abonnement wordt toegepast in je volgende factureringscyclus.',
        },
        update: {
          failed: 'Kan abonnement niet bijwerken',
          errorTitle: 'Fout bij het bijwerken van abonnement',
          successTitle: 'Abonnement bijgewerkt',
          successDescription: 'Abonnement is succesvol bijgewerkt',
        },
      },
    },
    settings: {
      title: 'Factureringsinstellingen',
      paymentMethods: {
        title: 'Betaalmethoden',
        description:
          'Methoden die worden gebruikt voor abonnementen en eenmalige aankopen',
        add: 'Betaalmethode toevoegen',
        addedTitle: 'Betaalmethode toegevoegd',
        addFailedTitle: 'Kan betaalmethode niet toevoegen',
        addFailedDescription: 'Probeer het opnieuw.',
      },
      paymentMethod: {
        defaultMethod: 'Standaardmethode',
        makeDefault: 'Als standaard instellen',
        deleteAriaLabel: 'Betaalmethode verwijderen',
        deletedTitle: 'Betaalmethode verwijderd',
        deletedDescription: 'Je betaalmethode is succesvol verwijderd.',
        deleteFailedTitle: 'Kan betaalmethode niet verwijderen',
        deleteFailedDescription:
          'Er is een fout opgetreden bij het verwijderen van de betaalmethode.',
        defaultUpdatedTitle: 'Standaardbetaalmethode bijgewerkt',
        defaultUpdatedDescription:
          'Deze betaalmethode is nu je standaardmethode.',
        defaultUpdateFailedTitle: 'Kan standaardbetaalmethode niet bijwerken',
        defaultUpdateFailedDescription:
          'Er is een fout opgetreden bij het bijwerken van de standaardbetaalmethode.',
      },
      savedCards: {
        title: 'Opgeslagen betaalmethoden',
        empty: 'Geen opgeslagen betaalmethoden gevonden.',
        addNewCard: 'Nieuwe kaart toevoegen',
        useDifferentCard: 'Andere kaart gebruiken',
        expires: 'Verloopt {date}',
      },
      billingDetailsSection: {
        title: 'Factuurgegevens',
        description: 'Werk je factuurgegevens bij',
      },
      billingDetails: {
        email: 'E-mail',
        billingName: 'Factuurnaam',
        billingNamePlaceholder:
          'Bedrijfsnaam of wettelijke naam voor facturen (optioneel)',
        billingAddress: 'Factuuradres',
        line1: 'Regel 1',
        line2: 'Regel 2',
        postalCode: 'Postcode',
        city: 'Plaats',
        state: 'Staat',
        province: 'Provincie',
        taxId: 'Btw-nummer',
        fieldRequired: 'Dit veld is verplicht',
        submit: 'Factuurgegevens bijwerken',
      },
      emailSection: {
        title: 'E-mailadres',
        description: 'Wijzig het e-mailadres dat aan je account is gekoppeld',
      },
      changeEmail: {
        currentEmail: 'Huidig e-mailadres',
        newEmail: 'Nieuw e-mailadres',
        newEmailPlaceholder: 'Voer nieuw e-mailadres in',
        emailRequired: 'E-mail is verplicht',
        requestChange: 'E-mailwijziging aanvragen',
        sendVerification: 'Verificatie verzenden',
        nevermind: 'Laat maar',
        verificationSentPrefix: 'We hebben een verificatielink gestuurd naar',
        verificationSentSuffix:
          '. Volg de instructies om je nieuwe e-mailadres te bevestigen.',
        verificationSentHint:
          'Van gedachten veranderd? Negeer de e-mail gewoon en je huidige adres blijft actief.',
      },
      billingManagers: {
        title: 'Factureringsbeheerders',
        description:
          'Factureringsbeheerders kunnen factuurgegevens, betaalmethoden en abonnementen beheren.',
      },
      privacy: {
        title: 'Privacy',
        description: 'Download een kopie van al je persoonlijke gegevens',
        exportData: 'Gegevens exporteren',
      },
      team: {
        roles: {
          owner: 'Eigenaar',
          billingManager: 'Factureringsbeheerder',
          member: 'Lid',
        },
        emailPlaceholder: 'email@voorbeeld.com',
        emailRequired: 'E-mail is verplicht',
        invalidEmail: 'Ongeldig e-mailadres',
        invite: 'Factureringsbeheerder uitnodigen',
        columnMember: 'Lid',
        columnRole: 'Rol',
        you: '(jij)',
        removeFromTeam: 'Uit team verwijderen',
        memberFallback: 'Lid',
        thisMemberFallback: 'dit lid',
        genericError: 'Er is een fout opgetreden.',
        addedTitle: 'Factureringsbeheerder toegevoegd',
        addedDescription: '{email} is toegevoegd als factureringsbeheerder.',
        addFailedTitle: 'Kan factureringsbeheerder niet toevoegen',
        roleUpdatedTitle: 'Rol bijgewerkt',
        roleUpdatedDescription: '{name} is nu een {role}.',
        roleUpdateFailedTitle: 'Kan rol niet bijwerken',
        removedTitle: 'Lid verwijderd',
        removedDescription: '{name} is uit het team verwijderd.',
        removeFailedTitle: 'Kan lid niet verwijderen',
        removeModalTitle: 'Teamlid verwijderen',
        removeModalDescription:
          'Weet je zeker dat je {name} uit het team wilt verwijderen? Die persoon verliest toegang tot alle teambronnen.',
        removeConfirm: 'Verwijderen',
      },
    },
    usage: {
      title: 'Gebruik',
      searchPlaceholder: 'Gebruiksmeter zoeken',
      overview: 'Overzicht',
      columnName: 'Naam',
      columnConsumed: 'Verbruikt',
      columnCredited: 'Gecorrigeerd',
      columnBalance: 'Saldo',
    },
    benefits: {
      title: 'Toegekende voordelen',
      searchPlaceholder: 'Toegekende voordelen zoeken...',
      empty: 'Geen toegekende voordelen gevonden',
    },
    seats: {
      title: 'Plaatsen beheren',
      totalSeats: 'Totaal aantal plaatsen',
      updateSeats: 'Plaatsen bijwerken',
      columnEmail: 'E-mail',
      statusLabel: {
        pending: 'In afwachting',
        claimed: 'Geclaimd',
        revoked: 'Ingetrokken',
      },
      resendInvitation: 'Uitnodiging opnieuw verzenden',
      revokeSeat: 'Plaats intrekken',
      invite: 'Uitnodigen',
      inviteMember: 'Lid uitnodigen',
      emailRequired: 'E-mail is verplicht',
      emailInvalid: 'Ongeldig e-mailadres',
      assignError: 'Kan plaats niet toewijzen',
      invitationSendError: 'Kan uitnodiging niet verzenden',
      genericError: 'Er is een fout opgetreden.',
      seatCount: {
        '=1': '# plaats',
        other: '# plaatsen',
        _mode: 'plural',
      },
      availableSeats: {
        '=1': 'Nog één plaats beschikbaar',
        other: '# plaatsen beschikbaar',
        _mode: 'plural',
      },
      cannotDecrease: {
        '=1': 'Kan niet verlagen onder # toegewezen plaats. Trek eerst plaatsen in.',
        other:
          'Kan niet verlagen onder # toegewezen plaatsen. Trek eerst plaatsen in.',
        _mode: 'plural',
      },
      invoicingMessage: {
        invoice:
          'Ik word direct in rekening gebracht met verrekening voor de huidige maand.',
        prorate:
          'Je volgende factuur bevat de bijgewerkte plaatsen plus de verrekening voor de huidige maand.',
        nextPeriod:
          'De plaatswijziging wordt toegepast in je volgende factureringscyclus.',
      },
      updateSuccess: {
        title: 'Plaatsen bijgewerkt',
        invoice:
          'Abonnement heeft nu {seats}. Ik word direct in rekening gebracht met verrekening voor de huidige maand.',
        prorate:
          'Abonnement heeft nu {seats}. Je volgende factuur bevat de bijgewerkte plaatsen plus de verrekening voor de huidige maand.',
        nextPeriod:
          'Abonnement heeft {seats} vanaf je volgende factureringscyclus.',
        default: 'Abonnement heeft nu {seats}.',
      },
      updateError: {
        title: 'Fout bij het bijwerken van plaatsen',
        description: 'Kan plaatsen niet bijwerken',
        unexpected: 'Er is een onverwachte fout opgetreden',
      },
      revokeSuccess: {
        title: 'Plaats succesvol ingetrokken',
        description: 'De plaats is ingetrokken en is nu beschikbaar.',
      },
      revokeError: {
        title: 'Kan plaats niet intrekken',
      },
      resendSuccess: {
        title: 'Uitnodiging opnieuw verzonden',
        description: 'De uitnodigingsmail is opnieuw verzonden.',
      },
      resendError: {
        title: 'Kan uitnodiging niet opnieuw verzenden',
      },
    },
    wallet: {
      availableBalance: 'Beschikbaar saldo',
      organization: 'Organisatie',
      currency: 'Valuta',
    },
  },
} as const
