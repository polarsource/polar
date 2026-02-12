export const de = {
  checkout: {
    footer: {
      poweredBy: 'Bereitgestellt von',
      merchantOfRecord:
        'Diese Bestellung wird von unserem Online-Reseller & Merchant of Record, Polar, bearbeitet, der auch Anfragen und Rücksendungen im Zusammenhang mit der Bestellung abwickelt.',
    },
    form: {
      email: 'E-Mail',
      cardholderName: 'Karteninhabername',
      purchasingAsBusiness: 'Als Unternehmen kaufen',
      businessName: 'Firmenname',
      billingAddress: {
        label: 'Rechnungsadresse',
        line1: 'Straße und Hausnummer',
        line2: 'Adresszusatz',
        postalCode: 'Postleitzahl',
        city: 'Ort',
        country: 'Land',
        state: 'Bundesland',
        province: 'Provinz',
        stateProvince: 'Bundesland / Provinz',
      },
      taxId: 'Steuer-ID',
      discountCode: 'Rabattcode',
      optional: 'Optional',
      apply: 'Anwenden',
      fieldRequired: 'Dieses Feld ist erforderlich',
    },
    pricing: {
      subtotal: 'Zwischensumme',
      taxableAmount: 'Steuerpflichtiger Betrag',
      taxes: 'Steuern',
      free: 'Kostenlos',
      payWhatYouWant: 'Zahle, was du möchtest',
      total: 'Gesamtbetrag',
      everyInterval: 'Alle {interval}',
      additionalMeteredUsage: 'Zusätzliche Nutzung',
      perUnit: '/ Einheit',
      discount: {
        duration: {
          months: {
            '=1': 'für den ersten Monat',
            other: 'für die ersten # Monate',
            _mode: 'plural',
          },
          years: {
            '=1': 'für das erste Jahr',
            other: 'für die ersten # Jahre',
            _mode: 'plural',
          },
        },
      },
    },
    trial: {
      ends: 'Testphase endet am {endDate}',
      duration: {
        days: {
          '=1': '# Tag Testphase',
          other: '# Tage Testphase',
          _mode: 'plural',
        },
        weeks: {
          '=1': '# Woche Testphase',
          other: '# Wochen Testphase',
          _mode: 'plural',
        },
        months: {
          '=1': '# Monat Testphase',
          other: '# Monate Testphase',
          _mode: 'plural',
        },
        years: {
          '=1': '# Jahr Testphase',
          other: '# Jahre Testphase',
          _mode: 'plural',
        },
      },
    },
    pwywForm: {
      label: 'Nenne einen fairen Preis',
      minimum: 'Mindestens {amount}',
      amountMinimum: 'Der Betrag muss mindestens {min} betragen',
      amountFreeOrMinimum:
        'Der Betrag muss {zero} oder mindestens {min} betragen',
    },
    productSwitcher: {
      billedRecurring: 'Abrechnung {frequency}',
      oneTimePurchase: 'Einmaliger Kauf',
    },
    card: {
      included: 'Inbegriffen',
    },
    benefits: {
      moreBenefits: {
        '=1': '# weiterer Vorteil',
        other: '# weitere Vorteile',
        _mode: 'plural',
      },
      showMoreBenefits: {
        '=1': '# weiteren Vorteil anzeigen',
        other: '# weitere Vorteile anzeigen',
        _mode: 'plural',
      },
      showLess: 'Weniger anzeigen',
      granting: 'Vorteile werden gewährt...',
      requestNewInvite: 'Neue Einladung anfordern',
      retryIn: {
        '=1': 'Erneut versuchen in # Sekunde',
        other: 'Erneut versuchen in # Sekunden',
        _mode: 'plural',
      },
      connectNewAccount: 'Neues Konto verbinden',
      requestMyInvite: 'Meine Einladung anfordern',
      github: {
        connect: 'GitHub-Konto verbinden',
        goTo: 'Zu {repository} gehen',
        selectAccount: 'GitHub-Konto auswählen',
      },
      discord: {
        connect: 'Discord-Konto verbinden',
        open: 'Discord öffnen',
        selectAccount: 'Discord-Konto auswählen',
      },
      licenseKey: {
        copy: 'Kopieren',
        copiedToClipboard: 'In die Zwischenablage kopiert',
        copiedToClipboardDescription:
          'Lizenzschlüssel wurde in die Zwischenablage kopiert',
        loading: 'Wird geladen...',
        status: 'Status',
        statusGranted: 'Gewährt',
        statusRevoked: 'Widerrufen',
        statusDisabled: 'Deaktiviert',
        usage: 'Nutzung',
        validations: 'Validierungen',
        validatedAt: 'Validiert am',
        neverValidated: 'Nie validiert',
        expiryDate: 'Ablaufdatum',
        noExpiry: 'Kein Ablaufdatum',
        activations: 'Aktivierungen',
        activationDeleted: 'Lizenzschlüssel-Aktivierung gelöscht',
        activationDeletedDescription: 'Aktivierung erfolgreich gelöscht',
        activationDeactivationFailed: 'Deaktivierung fehlgeschlagen',
      },
    },
    confirmation: {
      confirmPayment: 'Zahlung bestätigen',
      processingTitle: 'Bestellung in Bearbeitung',
      successTitle: 'Ihre Bestellung war erfolgreich!',
      failedTitle:
        'Bei der Bearbeitung Ihrer Bestellung ist ein Problem aufgetreten',
      processingDescription:
        'Bitte warten Sie, während wir Ihre Zahlung bestätigen.',
      successDescription:
        'Sie sind nun berechtigt, die Vorteile von {product} zu nutzen.',
      failedDescription:
        'Bitte versuchen Sie es erneut oder kontaktieren Sie den Support.',
    },
    loading: {
      processingOrder: 'Bestellung wird bearbeitet...',
      processingPayment: 'Zahlung wird bearbeitet',
      paymentSuccessful:
        'Zahlung erfolgreich! Ihre Produkte werden vorbereitet...',
      confirmationTokenFailed:
        'Bestätigungstoken konnte nicht erstellt werden, bitte versuchen Sie es später erneut.',
    },
    cta: {
      startTrial: 'Testphase starten',
      subscribeNow: 'Jetzt abonnieren',
      payNow: 'Jetzt bezahlen',
      getFree: 'Kostenlos erhalten',
      paymentsUnavailable: 'Zahlungen sind derzeit nicht verfügbar',
    },
  },
  intervals: {
    short: {
      day: 'T.',
      week: 'W.',
      month: 'M.',
      year: 'J',
    },
    long: {
      day: 'Tag',
      week: 'Woche',
      month: 'Monat',
      year: 'Jahr',
    },
    frequency: {
      day: 'täglich',
      week: 'wöchentlich',
      month: 'monatlich',
      year: 'jährlich',
      everyOrdinalInterval: 'alle {ordinal} {interval}',
    },
  },
  benefitTypes: {
    license_keys: 'Lizenzschlüssel',
    github_repository: 'GitHub-Repository-Zugang',
    discord: 'Discord-Einladung',
    downloadables: 'Dateidownloads',
    custom: 'Benutzerdefiniert',
    meter_credit: 'Verbrauchsguthaben',
  },
} as const
