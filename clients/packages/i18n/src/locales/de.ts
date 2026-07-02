export default {
  checkout: {
    footer: {
      poweredBy: 'Bereitgestellt von',
      merchantOfRecord:
        'Diese Bestellung wird von unserem Online-Reseller & Merchant of Record, Polar, bearbeitet, der auch Anfragen und Rücksendungen im Zusammenhang mit der Bestellung abwickelt.',
      mandateSubscriptionTrial:
        'Mit Klick auf „{buttonLabel}“ autorisieren Sie Polar Software, Inc., unseren Online-Wiederverkäufer und Vertragspartner (Merchant of Record), Ihre gewählte Zahlungsmethode am Ende Ihres Testzeitraums und an jedem darauffolgenden Abrechnungsdatum bis zu Ihrer Kündigung mit dem oben angegebenen Betrag zu belasten, und stimmen den {buyerTermsLink} zu. Sie können jederzeit vor Ablauf des Testzeitraums kündigen, um eine Belastung zu vermeiden.',
      mandateSubscription:
        'Mit Klick auf „{buttonLabel}“ autorisieren Sie Polar Software, Inc., unseren Online-Wiederverkäufer und Vertragspartner (Merchant of Record), Ihre gewählte Zahlungsmethode sofort mit dem oben angegebenen Betrag zu belasten und denselben Betrag an jedem darauffolgenden Abrechnungsdatum bis zu Ihrer Kündigung abzubuchen, und stimmen den {buyerTermsLink} zu.',
      buyerTermsLink: 'Käuferbedingungen',
      mandateOneTime:
        'Mit Klick auf "{buttonLabel}" autorisieren Sie Polar Software, Inc., unseren Online-Wiederverkäufer und Vertragspartner, Ihre ausgewählte Zahlungsmethode mit dem oben angegebenen Betrag zu belasten, und stimmen den {buyerTermsLink} zu. Dies ist eine einmalige Zahlung.',
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
      billingDetails: 'Unternehmensdaten',
      addDiscountCode: 'Rabattcode hinzufügen',
    },
    pricing: {
      subtotal: 'Zwischensumme',
      taxableAmount: 'Steuerpflichtiger Betrag',
      taxes: 'Steuern',
      free: 'Kostenlos',
      payWhatYouWant: 'Zahle, was du möchtest',
      total: 'Gesamtbetrag',
      additionalMeteredUsage: 'Zusätzliche Nutzung',
      discount: {
        until: 'Bis {date}',
      },
      everyInterval: {
        day: {
          '=1': 'Täglich',
          other: 'Alle # Tage',
          '=2': 'Alle 2 Tage',
          _mode: 'plural',
        },
        week: {
          '=1': 'Wöchentlich',
          other: 'Alle # Wochen',
          '=2': 'Alle 2 Wochen',
          _mode: 'plural',
        },
        month: {
          '=1': 'Monatlich',
          other: 'Alle # Monate',
          '=2': 'Alle 2 Monate',
          _mode: 'plural',
        },
        year: {
          '=1': 'Jährlich',
          other: 'Alle # Jahre',
          '=2': 'Alle 2 Jahre',
          _mode: 'plural',
        },
      },
      perSeat: 'pro Platz',
      seats: {
        label: 'Plätze',
        numberOfSeats: 'Anzahl der Plätze',
        count: {
          '=1': '# Platz',
          other: '# Plätze',
          _mode: 'plural',
        },
        range: '{min} - {max} Plätze',
        minimum: 'Mindestens {min} Plätze',
        maximum: 'Maximal {max} Plätze',
        updateFailed: 'Plätze konnten nicht aktualisiert werden',
        included: {
          '=1': 'Ein Platz enthalten',
          other: '# Plätze enthalten',
          _mode: 'plural',
        },
      },
      inclTax: 'MwSt. (inklusive)',
      basePrice: 'Grundpreis',
    },
    trial: {
      hero: {
        free: {
          day: {
            '=1': '# Tag kostenlos',
            other: '# Tage kostenlos',
            _mode: 'plural',
          },
          month: {
            '=1': '# Monat kostenlos',
            other: '# Monate kostenlos',
            _mode: 'plural',
          },
          year: {
            '=1': '# Jahr kostenlos',
            other: '# Jahre kostenlos',
            _mode: 'plural',
          },
        },
        intervalSuffix: {
          day: '/Tag',
          week: '/Woche',
          month: '/Monat',
          year: '/Jahr',
        },
        then: 'Danach',
        startingDate: 'ab {date}',
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
      billedRecurring: '{frequency} abgerechnet',
      oneTimePurchase: 'Einmaliger Kauf',
      fromPrefix: 'Ab',
    },
    benefits: {
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
      slackSharedChannel: {
        connected: 'Mit deinem Slack-Arbeitsbereich verbunden.',
        connectedChannel:
          'Mit deinem Slack-Arbeitsbereich im Kanal {channel} verbunden.',
        inviteSent: 'Einladung an {email} gesendet.',
        channel: 'Kanal: {channel}.',
        openLinkToAccept: 'Öffne den Link, um in Slack zu akzeptieren.',
        acceptFromEmail:
          'Akzeptiere sie über die Einladungs-E-Mail oder deine Slack-Connect-Anfragen.',
        openInvite: 'Slack-Einladung öffnen',
        provisioning:
          'Dein Slack-Kanal für {email} wird eingerichtet... Du solltest in Kürze eine Einladung in deinem Posteingang erhalten.',
        setupFailed:
          'Wir konnten deinen Slack-Kanal mit {email} nicht einrichten. Überprüfe die E-Mail-Adresse und versuche es erneut, oder wende dich an den Verkäufer, wenn es weiterhin fehlschlägt.',
        enterEmail:
          'Gib die E-Mail-Adresse eines Administrators in deinem Slack-Arbeitsbereich ein. Die Person erhält eine Slack-Connect-Einladung für einen privaten Kanal.',
        emailPlaceholder: 'slack-admin@yourcompany.com',
        tryAgain: 'Erneut versuchen',
        requestInvite: 'Slack-Einladung anfordern',
      },
    },
    confirmation: {
      confirmPayment: 'Zahlung bestätigen',
      processingTitle: 'Bestellung in Bearbeitung',
      failedTitle:
        'Bei der Bearbeitung Ihrer Bestellung ist ein Problem aufgetreten',
      processingDescription:
        'Bitte warten Sie, während wir Ihre Zahlung bestätigen.',
      failedDescription:
        'Bitte versuchen Sie es erneut oder kontaktieren Sie den Support.',
      successTitle: 'Vielen Dank für Ihre Bestellung!',
      successDescription: 'Sie haben jetzt Zugriff auf {product}.',
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
    productDescription: {
      readMore: 'Mehr anzeigen',
    },
  },
  intervals: {
    short: {
      day: 'T.',
      week: 'W.',
      month: 'M.',
      year: 'J',
    },
    shortCount: {
      day: {
        _mode: 'plural',
        '=1': '# T.',
        other: '# T.',
      },
      week: {
        _mode: 'plural',
        '=1': '# W.',
        other: '# W.',
      },
      month: {
        _mode: 'plural',
        '=1': '# M.',
        other: '# M.',
      },
      year: {
        _mode: 'plural',
        '=1': '# J.',
        other: '# J.',
      },
    },
  },
  benefitTypes: {
    custom: 'Benutzerdefiniert',
    license_keys: 'Lizenzschlüssel',
    github_repository: 'GitHub-Repository-Zugang',
    discord: 'Discord-Einladung',
    downloadables: 'Dateidownloads',
    meter_credit: 'Verbrauchsguthaben',
    feature_flag: 'Feature-Flag',
    slack_shared_channel: 'Geteilter Slack-Kanal',
  },
  ordinal: {
    zero: '.',
    one: '.',
    two: '.',
    few: '.',
    many: '.',
    other: '.',
  },
  embedPaymentMethod: {
    title: 'Zahlungsmethode hinzufügen',
    close: 'Schließen',
    submit: 'Zahlungsmethode hinzufügen',
    processing: 'Zahlungsmethode wird hinzugefügt…',
    fallbackError: 'Etwas ist schiefgelaufen. Bitte versuchen Sie es erneut.',
    errors: {
      invalidRequest: 'Erforderliche Parameter fehlen.',
      unauthorized: 'Sitzung abgelaufen.',
      processingFailed:
        'Die Zahlungsmethode konnte nicht verarbeitet werden. Bitte versuchen Sie es erneut.',
      unknown: 'Etwas ist schiefgelaufen.',
    },
  },
} as const
