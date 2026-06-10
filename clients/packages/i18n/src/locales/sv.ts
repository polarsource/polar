export default {
  checkout: {
    footer: {
      poweredBy: 'Drivs av',
      merchantOfRecord:
        'Denna beställning behandlas av vår online-återförsäljare & Merchant of Record, Polar, som också hanterar beställningsrelaterade frågor och returer.',
      mandateSubscriptionTrial:
        'Genom att klicka på "{buttonLabel}" godkänner du att Polar Software, Inc., vår online-återförsäljare och registrerade säljare, debiterar din valda betalningsmetod med beloppet som visas ovan i slutet av din provperiod och vid varje efterföljande faktureringsdatum tills du avslutar prenumerationen, samt godkänner våra {buyerTermsLink}. Du kan när som helst avsluta prenumerationen innan provperioden löper ut för att undvika att bli debiterad.',
      mandateSubscription:
        'Genom att klicka på "{buttonLabel}" godkänner du att Polar Software, Inc., vår online-återförsäljare och registrerade säljare, omedelbart debiterar din valda betalningsmetod med beloppet som visas ovan och debiterar samma belopp vid varje efterföljande faktureringsdatum tills du avslutar prenumerationen, samt godkänner våra {buyerTermsLink}.',
      buyerTermsLink: 'Köpvillkor',
      mandateOneTime:
        'Genom att klicka på "{buttonLabel}" godkänner du att Polar Software, Inc., vår onlineåterförsäljare och registrerade handlare, debiterar din valda betalningsmetod med beloppet som visas ovan, samt accepterar {buyerTermsLink}. Detta är en engångsavgift.',
    },
    form: {
      email: 'Email',
      cardholderName: 'Kortinnehavare',
      purchasingAsBusiness: 'Jag köper som företag',
      businessName: 'Företagsnamn',
      billingAddress: {
        label: 'Faktureringsadress',
        postalCode: 'Postnummer',
        city: 'Stad',
        country: 'Land',
        state: 'Delstat',
        province: 'Län',
        stateProvince: 'Delstat / Län',
        line1: 'Gatuadress',
        line2: 'Lägenhetsnummer',
      },
      taxId: 'Momsregistreringsnummer',
      discountCode: 'Rabattkod',
      optional: 'Valfritt',
      apply: 'Lägg till',
      fieldRequired: 'Detta fält är obligatoriskt',
      addBusinessDetails: 'Lägg till företagsuppgifter',
      removeBusinessDetails: 'Ta bort företagsuppgifter',
      billingDetails: 'Företagsuppgifter',
      addDiscountCode: 'Lägg till rabattkod',
    },
    pricing: {
      subtotal: 'Delsumma',
      taxableAmount: 'Momspliktigt belopp',
      taxes: 'Moms',
      free: 'Gratis',
      payWhatYouWant: 'Betala vad du vill',
      total: 'Totalt',
      additionalMeteredUsage: 'Ytterligare mätbaserad användning',
      perUnit: '/ enhet',
      discount: {
        duration: {
          months: {
            '=1': 'för den första månaden',
            other: 'för de första # månaderna',
            _mode: 'plural',
          },
          years: {
            '=1': 'för det första året',
            other: 'för de första # åren',
            _mode: 'plural',
          },
        },
        until: 'T.o.m. {date}',
      },
      everyInterval: {
        day: {
          '=1': 'Dagligen',
          other: 'Var #:e dag',
          '=2': 'Varannan dag',
          _mode: 'plural',
        },
        week: {
          '=1': 'Veckovis',
          other: 'Var #:e vecka',
          '=2': 'Varannan vecka',
          _mode: 'plural',
        },
        month: {
          '=1': 'Månadsvis',
          other: 'Var #:e månad',
          '=2': 'Varannan månad',
          _mode: 'plural',
        },
        year: {
          '=1': 'Årsvis',
          other: 'Var #:e år',
          '=2': 'Vartannat år',
          _mode: 'plural',
        },
      },
      perSeat: 'per plats',
      seats: {
        label: 'Platser',
        numberOfSeats: 'Antal platser',
        count: {
          '=1': '# plats',
          other: '# platser',
          _mode: 'plural',
        },
        range: '{min} - {max} platser',
        minimum: 'Minst {min} platser',
        maximum: 'Högst {max} platser',
        updateFailed: 'Det gick inte att uppdatera platserna',
        included: {
          '=1': 'En plats ingår',
          other: '# platser ingår',
          _mode: 'plural',
        },
      },
      inclTax: 'Moms (ingår)',
      basePrice: 'Grundavgift',
    },
    trial: {
      ends: 'Testperioden slutar {endDate}',
      duration: {
        days: {
          '=1': '# dagars testperiod',
          other: '# dagars testperiod',
          _mode: 'plural',
        },
        weeks: {
          '=1': '# veckas testperiod',
          other: '# veckors testperiod',
          _mode: 'plural',
        },
        months: {
          '=1': '# månads testperiod',
          other: '# månaders testperiod',
          _mode: 'plural',
        },
        years: {
          '=1': '# års testperiod',
          other: '# års testperiod',
          _mode: 'plural',
        },
      },
      hero: {
        free: {
          day: {
            '=1': '# dag gratis',
            other: '# dagar gratis',
            _mode: 'plural',
          },
          month: {
            '=1': '# månad gratis',
            other: '# månader gratis',
            _mode: 'plural',
          },
          year: {
            '=1': '# år gratis',
            other: '# år gratis',
            _mode: 'plural',
          },
        },
        intervalSuffix: {
          day: '/dag',
          week: '/vecka',
          month: '/månad',
          year: '/år',
        },
        then: 'Därefter',
        startingDate: 'från {date}',
      },
      summary: {
        totalWhenTrialEnds: 'Totalt efter provperioden',
        totalWhenDiscountExpires: 'Totalt när rabatten löper ut',
        totalDueToday: 'Att betala idag',
      },
    },
    pwywForm: {
      label: 'Ange pris',
      minimum: 'Minst {amount}',
      amountMinimum: 'Beloppet måste vara minst {min}',
      amountFreeOrMinimum: 'Beloppet måste vara {zero} eller minst {min}',
    },
    productSwitcher: {
      billedRecurring: 'Faktureras {frequency}',
      oneTimePurchase: 'Engångsköp',
      fromPrefix: 'Från',
    },
    card: {
      included: 'Ingår',
    },
    benefits: {
      moreBenefits: {
        '=1': '# ytterligare förmån',
        other: '# ytterligare förmåner',
        _mode: 'plural',
      },
      showMoreBenefits: {
        '=1': 'Visa # ytterligare förmån',
        other: 'Visa # ytterligare förmåner',
        _mode: 'plural',
      },
      showLess: 'Visa mindre',
      granting: 'Tilldelar förmåner...',
      requestNewInvite: 'Begär ny inbjudan',
      retryIn: {
        '=1': 'Försök igen om # sekund',
        other: 'Försök igen om # sekunder',
        _mode: 'plural',
      },
      connectNewAccount: 'Anslut nytt konto',
      requestMyInvite: 'Begär min inbjudan',
      github: {
        connect: 'Anslut GitHub-konto',
        goTo: 'Gå till {repository}',
        selectAccount: 'Välj ett GitHub-konto',
      },
      discord: {
        connect: 'Anslut Discord-konto',
        open: 'Öppna Discord',
        selectAccount: 'Välj ett Discord-konto',
      },
      licenseKey: {
        copy: 'Kopiera',
        copiedToClipboard: 'Kopierat',
        copiedToClipboardDescription: 'Licensnyckeln är kopierad',
        loading: 'Laddar...',
        status: 'Status',
        statusGranted: 'Tilldelad',
        statusRevoked: 'Återkallad',
        statusDisabled: 'Inaktiverad',
        usage: 'Användning',
        validations: 'Valideringar',
        validatedAt: 'Validerad den',
        neverValidated: 'Aldrig validerad',
        expiryDate: 'Utgångsdatum',
        noExpiry: 'Inget utgångsdatum',
        activations: 'Aktiveringar',
        activationDeleted: 'Licensnyckelaktivering borttagen',
        activationDeletedDescription: 'Aktivering borttagen',
        activationDeactivationFailed: 'Avaktivering misslyckades',
      },
    },
    confirmation: {
      confirmPayment: 'Bekräfta betalning',
      processingTitle: 'Vi behandlar din beställning',
      failedTitle: 'Ett problem uppstod vid behandlingen av din beställning',
      processingDescription: 'Vänta medan vi bekräftar din betalning.',
      failedDescription: 'Försök igen eller kontakta supporten.',
      successTitle: 'Tack för din order!',
      successDescription: 'Du har nu tillgång till {product}.',
    },
    loading: {
      processingOrder: 'Behandlar beställning...',
      processingPayment: 'Behandlar betalning',
      paymentSuccessful: 'Betalning lyckades! Förbereder dina produkter...',
      confirmationTokenFailed:
        'Kunde inte skapa bekräftelsetoken, försök igen senare.',
    },
    cta: {
      startTrial: 'Starta testperiod',
      subscribeNow: 'Prenumerera nu',
      payNow: 'Betala nu',
      getFree: 'Skaffa gratis',
      paymentsUnavailable: 'Betalningar är för närvarande otillgängliga',
    },
    productDescription: {
      readMore: 'Läs mer',
      readLess: 'Läs mindre',
    },
  },
  intervals: {
    short: {
      day: 'd',
      week: 'v',
      month: 'mån',
      year: 'år',
    },
  },
  benefitTypes: {
    custom: 'Anpassad',
    license_keys: 'Licensnycklar',
    github_repository: 'Åtkomst till GitHub-repository',
    discord: 'Discord-inbjudan',
    downloadables: 'Filnedladdningar',
    meter_credit: 'Mätarkrediter',
    feature_flag: 'Feature flag',
  },
  ordinal: {
    zero: ':e',
    one: ':a',
    two: ':a',
    few: ':e',
    many: ':e',
    other: ':e',
  },
  embedPaymentMethod: {
    title: 'Lägg till betalningsmetod',
    close: 'Stäng',
    submit: 'Lägg till betalningsmetod',
    processing: 'Lägger till betalningsmetod…',
    fallbackError: 'Något gick fel. Försök igen.',
    errors: {
      invalidRequest: 'Saknar obligatoriska parametrar.',
      unauthorized: 'Sessionen har gått ut.',
      processingFailed:
        'Det gick inte att behandla betalningsmetoden. Försök igen.',
      unknown: 'Något gick fel.',
    },
  },
  portal: {
    navigation: {
      overview: 'Översikt',
      orders: 'Beställningar',
      usage: 'Användning',
      billing: 'Fakturering',
      selectPage: 'Välj sida',
    },
    common: {
      cancel: 'Avbryt',
      close: 'Stäng',
      save: 'Spara',
      saveChanges: 'Spara ändringar',
      edit: 'Redigera',
      delete: 'Ta bort',
      confirm: 'Bekräfta',
      back: 'Tillbaka',
      loading: 'Laddar…',
      saving: 'Sparar…',
      download: 'Ladda ner',
      viewAll: 'Visa alla',
      somethingWentWrong: 'Något gick fel. Försök igen.',
      date: 'Datum',
      amount: 'Belopp',
      status: 'Status',
      product: 'Produkt',
      actions: 'Åtgärder',
      pageOf: 'Sida {page} av {totalPages}',
    },
    overview: {
      teamSeatAccess: {
        title: 'Åtkomst till teamplats',
        description: 'Åtkomst via teamprenumeration',
      },
      emptyState: {
        noActiveSubscriptions: {
          title: 'Inga aktiva prenumerationer',
          description: 'Du har inga aktiva prenumerationer just nu.',
        },
        noTeamAccess: {
          title: 'Ingen teamåtkomst',
          description: 'Du har ingen åtkomst till teamplats just nu.',
        },
      },
      currentPeriod: {
        nextCharge: 'Nästa debitering',
        nextInvoice: 'Nästa faktura',
        firstChargeAfterTrial: 'Första debitering efter provperiod',
        trialEnds: 'Provperioden slutar',
        finalCharge: 'Slutlig debitering',
        subscriptionEnds: 'Prenumerationen avslutas',
        notAvailable: 'Ej tillgängligt',
        dateLabel: '{label} — {date}',
        canceled: 'Avbruten',
        meteredCharges: 'Rörliga avgifter',
        subtotal: 'Delsumma',
        discount: 'Rabatt',
        taxes: 'Skatter',
        estimatedTotal: 'Beräknat totalbelopp',
        total: 'Totalt',
        finalChargeNotice:
          'Det här blir den sista debiteringen innan prenumerationen avslutas.',
        finalChargeMeteredNotice:
          'Slutbeloppet kan variera beroende på användning fram till slutet av faktureringsperioden.',
        meteredNoticeActive:
          'Slutliga avgifter kan variera beroende på användning fram till slutet av faktureringsperioden.',
        meteredNoticeTrialing:
          'Slutliga avgifter kan variera beroende på användning under provperioden.',
        meteredNoticeDefault: 'Slutliga avgifter kan variera.',
      },
      latestPurchase: {
        title: 'Senaste köp',
        purchasedOn: 'Köpt — {date}',
        total: 'Totalt',
      },
      subscriptions: {
        title: 'Prenumerationer',
        noSubscriptionsFound: 'Inga prenumerationer hittades',
        inactiveTitle: 'Inaktiva prenumerationer',
        endedAt: 'Slutade',
        retryPayment: 'Försök igen med betalningen',
        manageSubscription: 'Hantera prenumeration',
      },
    },
    orders: {
      orderHistory: 'Orderhistorik',
      description: 'Beskrivning',
      viewOrder: 'Visa order',
      retryPayment: 'Försök igen med betalningen',
      invoiceNumber: 'Fakturanummer',
      orderItems: 'Orderrader',
      subtotal: 'Delsumma',
      discount: 'Rabatt',
      netAmount: 'Nettobelopp',
      tax: 'Moms',
      total: 'Totalt',
      appliedBalance: 'Använt saldo',
      toBePaid: 'Att betala',
      refundedAmount: 'Återbetalat belopp',
      statusTitle: {
        draft: 'Utkast',
        paid: 'Betald',
        pending: 'Väntar',
        refunded: 'Återbetald',
        partiallyRefunded: 'Delvis återbetald',
        void: 'Ogiltig',
      },
      payment: {
        orderSummary: 'Ordersammanfattning',
        descriptionLabel: 'Beskrivning:',
        amountLabel: 'Belopp:',
        paymentMethod: 'Betalningsmetod',
        payNow: 'Betala nu',
        processing: 'Bearbetar...',
        confirming: 'Bekräftar...',
        loading: 'Laddar...',
        processingPayment: 'Bearbetar din betalning...',
        processingHint:
          'Detta kan ta några ögonblick. Stäng inte det här fönstret.',
        processingPaymentShort: 'Bearbetar betalning...',
        usingSavedMethod: 'Använder din sparade betalningsmetod',
        tryAgain: 'Försök igen',
        paymentSuccessfulTitle: 'Betalningen lyckades!',
        paymentFailedTitle: 'Betalningen misslyckades',
        paymentSuccessfulDescription:
          'Tack för din betalning. Du kan nu stänga det här fönstret.',
        paymentFailedDescription:
          'Du kan försöka igen eller kontakta support om problemet kvarstår.',
        updatePaymentMethod: 'Uppdatera betalningsmetod',
        toastSuccessTitle: 'Betalningen lyckades',
        toastSuccessDescription: 'Din betalning har bearbetats সফলly!',
        toastFailedTitle: 'Betalningen misslyckades',
        paymentFailed: 'Betalningen misslyckades',
        paymentFailedRetry: 'Betalningen misslyckades. Försök igen.',
        paymentFailedTryAgain: 'Betalningen misslyckades, försök igen.',
        confirmationTimeout:
          'Det tar längre tid än väntat att bekräfta betalningen. Din betalning kan fortfarande behandlas. Kontrollera orderstatus eller kontakta support vid behov.',
        networkConfirmationError:
          'Det gick inte att bekräfta betalningsstatus på grund av nätverksproblem. Kontrollera orderstatus eller kontakta support.',
        stripeRequired: 'En Stripe-instans krävs för betalningsåtgärder',
        additionalAuthenticationRequired:
          'Betalningen kräver ytterligare autentisering',
        authenticationFailed: 'Autentiseringen för betalningen misslyckades',
        processDetailsFailed:
          'Det gick inte att bearbeta betalningsuppgifterna. Kontrollera dina uppgifter och försök igen.',
        createTokenFailed:
          'Det gick inte att skapa betalningstoken. Försök igen.',
        processPaymentFailed:
          'Det gick inte att bearbeta betalningen. Kontrollera dina betalningsuppgifter och försök igen.',
        networkError:
          'Ett nätverksfel inträffade. Kontrollera din anslutning och försök igen.',
      },
    },
    subscription: {
      free: 'Gratis',
      details: {
        startDate: 'Startdatum',
        trialEnds: 'Provperioden slutar',
        expiryDate: 'Utgångsdatum',
        renewalDate: 'Förnyelsedatum',
        expired: 'Utgången',
        meteredUsage: 'Mätarbaserad användning',
        uncancel: 'Ångra avbokning',
        manageSubscription: 'Hantera prenumeration',
        changePlan: 'Byt plan',
      },
      pendingUpdate: {
        title: 'Väntande uppdatering',
        cancelScheduledChange: 'Avbryt schemalagd ändring',
        newProduct: 'Ny produkt',
        seats: 'Platser',
        effectiveFrom: 'Uppdateringen gäller från',
        clearConfirmDescription:
          'Din prenumeration förblir oförändrad vid nästa faktureringscykel. Är du säker på att du vill avbryta den här väntande uppdateringen?',
      },
      invoices: {
        title: 'Fakturor',
      },
      cancel: {
        title: 'Avsluta prenumeration',
        ariaLabel: 'Avsluta prenumeration',
        heading: 'Vi är ledsna att se dig lämna oss!',
        description:
          'Du är alltid välkommen tillbaka! Berätta gärna varför du lämnar oss så att vi kan förbättra vår produkt.',
        changedMind: 'Jag har ångrat mig',
        commentPlaceholder:
          'Är det något mer du vill dela med dig av? (Valfritt)',
        reason: {
          unused: 'Använder det inte tillräckligt mycket',
          tooExpensive: 'För dyrt',
          missingFeatures: 'Saknar funktioner',
          switchedService: 'Bytt till en annan tjänst',
          customerService: 'Kundtjänst',
          lowQuality: 'Nöjd inte med kvaliteten',
          tooComplex: 'För komplicerat',
          other: 'Annat (vänligen dela nedan)',
        },
        toast: {
          title: 'Prenumerationen avslutad',
          description: 'Prenumerationen har avslutats',
        },
      },
      changePlan: {
        title: 'Byt plan',
        currentPlan: 'Nuvarande plan',
        availablePlans: 'Tillgängliga planer',
        noOtherPlans: 'Inga andra planer tillgängliga',
        benefitsAdded: 'Du får tillgång till följande fördelar',
        benefitsRemoved: 'Du förlorar tillgång till följande fördelar',
        needPaymentMethod:
          'Du behöver lägga till en betalningsmetod innan du uppdaterar din plan. Gå till inställningarna i kundportalen för att lägga till en betalningsmetod.',
        confirmEndTrial: 'Byt plan och avsluta provperiod',
        invoicing: {
          trialContinues:
            'Din provperiod fortsätter till {date}. Du debiteras inte före dess.',
          trialEnds:
            'Detta avslutar min provperiod och debiterar mig direkt för {product}.',
          periodMonthly: 'månadsvis',
          periodYearly: 'årsvis',
          immediateCharge: 'Jag debiteras direkt för den nya {period}-planen.',
          immediateCredit:
            'Min tidigare betalning visas som en kredit på nästa faktura.',
          prorationInvoice:
            'Jag debiteras direkt med en proportionering för den här månaden.',
          prorationProrate:
            'Din nästa faktura kommer att inkludera den nya planen plus proportionering för den här månaden.',
          prorationNextPeriod:
            'Den nya planen börjar gälla vid nästa faktureringscykel.',
        },
        update: {
          failed: 'Det gick inte att uppdatera prenumerationen',
          errorTitle: 'Fel vid uppdatering av prenumeration',
          successTitle: 'Prenumerationen uppdaterad',
          successDescription: 'Prenumerationen har uppdaterats',
        },
      },
    },
    settings: {
      title: 'Fakturainställningar',
      paymentMethods: {
        title: 'Betalningsmetoder',
        description: 'Metoder som används för prenumerationer och engångsköp',
        add: 'Lägg till betalningsmetod',
        addedTitle: 'Betalningsmetod tillagd',
        addFailedTitle: 'Det gick inte att lägga till betalningsmetod',
        addFailedDescription: 'Försök igen.',
      },
      paymentMethod: {
        defaultMethod: 'Standardmetod',
        makeDefault: 'Använd som standard',
        deleteAriaLabel: 'Ta bort betalningsmetod',
        deletedTitle: 'Betalningsmetod borttagen',
        deletedDescription: 'Din betalningsmetod har tagits bort.',
        deleteFailedTitle: 'Det gick inte att ta bort betalningsmetod',
        deleteFailedDescription:
          'Ett fel uppstod när betalningsmetoden togs bort.',
        defaultUpdatedTitle: 'Standardbetalningsmetod uppdaterad',
        defaultUpdatedDescription:
          'Den här betalningsmetoden är nu din standard.',
        defaultUpdateFailedTitle:
          'Det gick inte att uppdatera standardbetalningsmetod',
        defaultUpdateFailedDescription:
          'Ett fel uppstod när standardbetalningsmetoden uppdaterades.',
      },
      savedCards: {
        title: 'Sparade betalningsmetoder',
        empty: 'Inga sparade betalningsmetoder hittades.',
        addNewCard: 'Lägg till nytt kort',
        useDifferentCard: 'Använd ett annat kort',
        expires: 'Utgår {date}',
      },
      billingDetailsSection: {
        title: 'Fakturauppgifter',
        description: 'Uppdatera dina fakturauppgifter',
      },
      billingDetails: {
        email: 'E-post',
        billingName: 'Faktureringsnamn',
        billingNamePlaceholder:
          'Företags- eller juridiskt namn för fakturor (valfritt)',
        billingAddress: 'Faktureringsadress',
        line1: 'Rad 1',
        line2: 'Rad 2',
        postalCode: 'Postnummer',
        city: 'Ort',
        state: 'Delstat',
        province: 'Provins',
        taxId: 'Skatte-ID',
        fieldRequired: 'Detta fält är obligatoriskt',
        submit: 'Uppdatera fakturauppgifter',
      },
      emailSection: {
        title: 'E-postadress',
        description: 'Ändra e-postadressen som är kopplad till ditt konto',
      },
      changeEmail: {
        currentEmail: 'Nuvarande e-post',
        newEmail: 'Ny e-post',
        newEmailPlaceholder: 'Ange ny e-postadress',
        emailRequired: 'E-post är obligatoriskt',
        requestChange: 'Begär e-poständring',
        sendVerification: 'Skicka verifiering',
        nevermind: 'Avbryt',
        verificationSentPrefix: 'Vi skickade en verifieringslänk till',
        verificationSentSuffix:
          '. Följ instruktionerna för att bekräfta din nya e-postadress.',
        verificationSentHint:
          'Ändrat dig? Ignorera bara mejlet så förblir din nuvarande adress aktiv.',
      },
      billingManagers: {
        title: 'Fakturahanterare',
        description:
          'Fakturahanterare kan hantera fakturauppgifter, betalningsmetoder och prenumerationer.',
      },
      privacy: {
        title: 'Integritet',
        description: 'Ladda ner en kopia av alla dina personuppgifter',
        exportData: 'Exportera data',
      },
      team: {
        roles: {
          owner: 'Ägare',
          billingManager: 'Fakturahanterare',
          member: 'Medlem',
        },
        emailPlaceholder: 'email@example.com',
        emailRequired: 'E-post är obligatoriskt',
        invalidEmail: 'Ogiltigt e-postformat',
        invite: 'Bjud in fakturahanterare',
        columnMember: 'Medlem',
        columnRole: 'Roll',
        you: '(du)',
        removeFromTeam: 'Ta bort från teamet',
        memberFallback: 'Medlem',
        thisMemberFallback: 'den här medlemmen',
        genericError: 'Ett fel uppstod.',
        addedTitle: 'Fakturahanterare tillagd',
        addedDescription: '{email} har lagts till som fakturahanterare.',
        addFailedTitle: 'Det gick inte att lägga till fakturahanterare',
        roleUpdatedTitle: 'Rollen uppdaterad',
        roleUpdatedDescription: '{name} är nu en {role}.',
        roleUpdateFailedTitle: 'Det gick inte att uppdatera rollen',
        removedTitle: 'Medlem borttagen',
        removedDescription: '{name} har tagits bort från teamet.',
        removeFailedTitle: 'Det gick inte att ta bort medlem',
        removeModalTitle: 'Ta bort teammedlem',
        removeModalDescription:
          'Är du säker på att du vill ta bort {name} från teamet? Personen kommer att förlora åtkomst till alla teamresurser.',
        removeConfirm: 'Ta bort',
      },
    },
    usage: {
      title: 'Användning',
      searchPlaceholder: 'Sök användningsmätare',
      overview: 'Översikt',
      columnName: 'Namn',
      columnConsumed: 'Förbrukat',
      columnCredited: 'Tillgodoräknat',
      columnBalance: 'Saldo',
    },
    benefits: {
      title: 'Förmåner',
      searchPlaceholder: 'Sök förmåner...',
      empty: 'Inga förmåner hittades',
    },
    seats: {
      title: 'Platshantering',
      totalSeats: 'Totalt antal platser',
      updateSeats: 'Uppdatera platser',
      columnEmail: 'E-post',
      statusLabel: {
        pending: 'Väntar',
        claimed: 'Anspråk gjord',
        revoked: 'Återkallad',
      },
      resendInvitation: 'Skicka inbjudan igen',
      revokeSeat: 'Återkalla plats',
      invite: 'Bjud in',
      inviteMember: 'Bjud in medlem',
      emailRequired: 'E-post är obligatoriskt',
      emailInvalid: 'Ogiltigt e-postformat',
      assignError: 'Det gick inte att tilldela plats',
      invitationSendError: 'Det gick inte att skicka inbjudan',
      genericError: 'Ett fel uppstod.',
      seatCount: {
        '=1': '# plats',
        other: '# platser',
        _mode: 'plural',
      },
      availableSeats: {
        '=1': 'En plats tillgänglig',
        other: '# platser tillgängliga',
        _mode: 'plural',
      },
      cannotDecrease: {
        '=1': 'Kan inte minska under # tilldelad plats. Återkalla platser först.',
        other:
          'Kan inte minska under # tilldelade platser. Återkalla platser först.',
        _mode: 'plural',
      },
      invoicingMessage: {
        invoice:
          'Jag debiteras direkt med en proportionering för den här månaden.',
        prorate:
          'Din nästa faktura kommer att inkludera de uppdaterade platserna plus proportionering för den här månaden.',
        nextPeriod:
          'Platsuppdateringen börjar gälla vid nästa faktureringscykel.',
      },
      updateSuccess: {
        title: 'Platserna har uppdaterats',
        invoice:
          'Prenumerationen har nu {seats}. Du debiteras direkt med en proportionering för den här månaden.',
        prorate:
          'Prenumerationen har nu {seats}. Din nästa faktura kommer att inkludera de uppdaterade platserna plus proportionering för den här månaden.',
        nextPeriod:
          'Prenumerationen får {seats} från och med nästa faktureringscykel.',
        default: 'Prenumerationen har nu {seats}.',
      },
      updateError: {
        title: 'Fel vid uppdatering av platser',
        description: 'Det gick inte att uppdatera platser',
        unexpected: 'Ett oväntat fel uppstod',
      },
      revokeSuccess: {
        title: 'Platsen har återkallats',
        description: 'Platsen har återkallats och är nu tillgänglig.',
      },
      revokeError: {
        title: 'Det gick inte att återkalla plats',
      },
      resendSuccess: {
        title: 'Inbjudan skickad igen',
        description: 'E-postmeddelandet med inbjudan har skickats igen.',
      },
      resendError: {
        title: 'Det gick inte att skicka inbjudan igen',
      },
    },
    wallet: {
      availableBalance: 'Tillgängligt saldo',
      organization: 'Organisation',
      currency: 'Valuta',
    },
  },
} as const
