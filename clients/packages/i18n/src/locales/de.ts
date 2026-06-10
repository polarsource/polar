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
      addBusinessDetails: 'Firmendaten hinzufügen',
      removeBusinessDetails: 'Firmendaten entfernen',
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
      summary: {
        totalWhenTrialEnds: 'Gesamtbetrag nach Testzeitraum',
        totalWhenDiscountExpires: 'Gesamtbetrag nach Ablauf des Rabatts',
        totalDueToday: 'Heute fälliger Betrag',
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
      readLess: 'Weniger anzeigen',
    },
  },
  intervals: {
    short: {
      day: 'T.',
      week: 'W.',
      month: 'M.',
      year: 'J',
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
  portal: {
    navigation: {
      overview: 'Übersicht',
      orders: 'Bestellungen',
      usage: 'Nutzung',
      billing: 'Abrechnung',
      selectPage: 'Seite auswählen',
    },
    common: {
      cancel: 'Abbrechen',
      close: 'Schließen',
      save: 'Speichern',
      saveChanges: 'Änderungen speichern',
      edit: 'Bearbeiten',
      delete: 'Löschen',
      confirm: 'Bestätigen',
      back: 'Zurück',
      loading: 'Wird geladen…',
      saving: 'Wird gespeichert…',
      download: 'Herunterladen',
      viewAll: 'Alle anzeigen',
      somethingWentWrong:
        'Etwas ist schiefgelaufen. Bitte versuchen Sie es erneut.',
      date: 'Datum',
      amount: 'Betrag',
      status: 'Status',
      product: 'Produkt',
      actions: 'Aktionen',
      pageOf: 'Seite {page} von {totalPages}',
    },
    overview: {
      teamSeatAccess: {
        title: 'Team-Sitzplatzzugang',
        description: 'Zugang über Team-Abonnement',
      },
      emptyState: {
        noActiveSubscriptions: {
          title: 'Keine aktiven Abonnements',
          description: 'Sie haben derzeit keine aktiven Abonnements.',
        },
        noTeamAccess: {
          title: 'Kein Teamzugang',
          description: 'Sie haben derzeit keinen Team-Sitzplatzzugang.',
        },
      },
      currentPeriod: {
        nextCharge: 'Nächste Abbuchung',
        nextInvoice: 'Nächste Rechnung',
        firstChargeAfterTrial: 'Erste Abbuchung nach Testphase',
        trialEnds: 'Testphase endet',
        finalCharge: 'Letzte Abbuchung',
        subscriptionEnds: 'Abonnement endet',
        notAvailable: 'N/V',
        dateLabel: '{label} — {date}',
        canceled: 'Storniert',
        meteredCharges: 'Nutzungsabhängige Kosten',
        subtotal: 'Zwischensumme',
        discount: 'Rabatt',
        taxes: 'Steuern',
        estimatedTotal: 'Geschätzter Gesamtbetrag',
        total: 'Gesamtbetrag',
        finalChargeNotice:
          'Dies ist die letzte Abbuchung vor dem Ende des Abonnements.',
        finalChargeMeteredNotice:
          'Der Endbetrag kann je nach Nutzung bis zum Ende des Abrechnungszeitraums variieren.',
        meteredNoticeActive:
          'Der Endbetrag kann je nach Nutzung bis zum Ende des Abrechnungszeitraums variieren.',
        meteredNoticeTrialing:
          'Der Endbetrag kann je nach Nutzung während der Testphase variieren.',
        meteredNoticeDefault: 'Der Endbetrag kann variieren.',
      },
      latestPurchase: {
        title: 'Letzter Kauf',
        purchasedOn: 'Gekauft — {date}',
        total: 'Gesamtbetrag',
      },
      subscriptions: {
        title: 'Abonnements',
        noSubscriptionsFound: 'Keine Abonnements gefunden',
        inactiveTitle: 'Inaktive Abonnements',
        endedAt: 'Ende am',
        retryPayment: 'Zahlung erneut versuchen',
        manageSubscription: 'Abonnement verwalten',
      },
    },
    orders: {
      orderHistory: 'Bestellverlauf',
      description: 'Beschreibung',
      viewOrder: 'Bestellung anzeigen',
      retryPayment: 'Zahlung erneut versuchen',
      invoiceNumber: 'Rechnungsnummer',
      orderItems: 'Bestellpositionen',
      subtotal: 'Zwischensumme',
      discount: 'Rabatt',
      netAmount: 'Nettobetrag',
      tax: 'Steuer',
      total: 'Gesamtbetrag',
      appliedBalance: 'Angerechnetes Guthaben',
      toBePaid: 'Zu zahlen',
      refundedAmount: 'Erstatteter Betrag',
      statusTitle: {
        draft: 'Entwurf',
        paid: 'Bezahlt',
        pending: 'Ausstehend',
        refunded: 'Erstattet',
        partiallyRefunded: 'Teilweise erstattet',
        void: 'Ungültig',
      },
      payment: {
        orderSummary: 'Bestellübersicht',
        descriptionLabel: 'Beschreibung:',
        amountLabel: 'Betrag:',
        paymentMethod: 'Zahlungsmethode',
        payNow: 'Jetzt bezahlen',
        processing: 'Wird verarbeitet...',
        confirming: 'Wird bestätigt...',
        loading: 'Wird geladen...',
        processingPayment: 'Ihre Zahlung wird verarbeitet...',
        processingHint:
          'Das kann einige Augenblicke dauern. Bitte schließen Sie dieses Fenster nicht.',
        processingPaymentShort: 'Zahlung wird verarbeitet...',
        usingSavedMethod: 'Ihre gespeicherte Zahlungsmethode wird verwendet',
        tryAgain: 'Erneut versuchen',
        paymentSuccessfulTitle: 'Zahlung erfolgreich!',
        paymentFailedTitle: 'Zahlung fehlgeschlagen',
        paymentSuccessfulDescription:
          'Vielen Dank für Ihre Zahlung. Sie können dieses Fenster jetzt schließen.',
        paymentFailedDescription:
          'Sie können es erneut versuchen oder den Support kontaktieren, wenn das Problem weiterhin besteht.',
        updatePaymentMethod: 'Zahlungsmethode aktualisieren',
        toastSuccessTitle: 'Zahlung erfolgreich',
        toastSuccessDescription: 'Ihre Zahlung wurde erfolgreich verarbeitet!',
        toastFailedTitle: 'Zahlung fehlgeschlagen',
        paymentFailed: 'Zahlung fehlgeschlagen',
        paymentFailedRetry:
          'Zahlung fehlgeschlagen. Bitte versuchen Sie es erneut.',
        paymentFailedTryAgain:
          'Zahlung fehlgeschlagen, bitte versuchen Sie es erneut.',
        confirmationTimeout:
          'Die Zahlungsbestätigung dauert länger als erwartet. Ihre Zahlung wird möglicherweise noch verarbeitet. Bitte prüfen Sie Ihren Bestellstatus oder kontaktieren Sie bei Bedarf den Support.',
        networkConfirmationError:
          'Der Zahlungsstatus konnte aufgrund von Netzwerkproblemen nicht bestätigt werden. Bitte prüfen Sie Ihren Bestellstatus oder kontaktieren Sie den Support.',
        stripeRequired:
          'Für Zahlungsaktionen ist eine Stripe-Instanz erforderlich',
        additionalAuthenticationRequired:
          'Für die Zahlung ist eine zusätzliche Authentifizierung erforderlich',
        authenticationFailed: 'Zahlungsauthentifizierung fehlgeschlagen',
        processDetailsFailed:
          'Die Zahlungsdaten konnten nicht verarbeitet werden. Bitte prüfen Sie Ihre Angaben und versuchen Sie es erneut.',
        createTokenFailed:
          'Das Zahlungstoken konnte nicht erstellt werden. Bitte versuchen Sie es erneut.',
        processPaymentFailed:
          'Die Zahlung konnte nicht verarbeitet werden. Bitte prüfen Sie Ihre Zahlungsinformationen und versuchen Sie es erneut.',
        networkError:
          'Es ist ein Netzwerkfehler aufgetreten. Bitte prüfen Sie Ihre Verbindung und versuchen Sie es erneut.',
      },
    },
    subscription: {
      free: 'Kostenlos',
      details: {
        startDate: 'Startdatum',
        trialEnds: 'Testphase endet',
        expiryDate: 'Ablaufdatum',
        renewalDate: 'Verlängerungsdatum',
        expired: 'Abgelaufen',
        meteredUsage: 'Nutzungsabhängige Nutzung',
        uncancel: 'Kündigung zurücknehmen',
        manageSubscription: 'Abonnement verwalten',
        changePlan: 'Tarif ändern',
      },
      pendingUpdate: {
        title: 'Ausstehende Änderung',
        cancelScheduledChange: 'Geplante Änderung abbrechen',
        newProduct: 'Neues Produkt',
        seats: 'Sitzplätze',
        effectiveFrom: 'Änderung wirksam ab',
        clearConfirmDescription:
          'Ihr Abonnement bleibt im nächsten Abrechnungszeitraum unverändert. Möchten Sie diese ausstehende Änderung wirklich abbrechen?',
      },
      invoices: {
        title: 'Rechnungen',
      },
      cancel: {
        title: 'Abonnement kündigen',
        ariaLabel: 'Abonnement kündigen',
        heading: 'Schade, dass Sie gehen!',
        description:
          'Sie sind jederzeit wieder willkommen! Teilen Sie uns bitte mit, warum Sie kündigen, damit wir unser Produkt verbessern können.',
        changedMind: 'Ich habe es mir anders überlegt',
        commentPlaceholder: 'Möchten Sie uns noch etwas mitteilen? (Optional)',
        reason: {
          unused: 'Nutze es nicht genug',
          tooExpensive: 'Zu teuer',
          missingFeatures: 'Fehlende Funktionen',
          switchedService: 'Zu einem anderen Dienst gewechselt',
          customerService: 'Kundenservice',
          lowQuality: 'Mit der Qualität nicht zufrieden',
          tooComplex: 'Zu kompliziert',
          other: 'Anderes (bitte unten angeben)',
        },
        toast: {
          title: 'Abonnement gekündigt',
          description: 'Das Abonnement wurde erfolgreich gekündigt',
        },
      },
      changePlan: {
        title: 'Tarif ändern',
        currentPlan: 'Aktueller Tarif',
        availablePlans: 'Verfügbare Tarife',
        noOtherPlans: 'Keine weiteren Tarife verfügbar',
        benefitsAdded: 'Sie erhalten Zugriff auf die folgenden Vorteile',
        benefitsRemoved: 'Sie verlieren den Zugriff auf die folgenden Vorteile',
        needPaymentMethod:
          'Sie müssen vor der Aktualisierung Ihres Tarifs eine Zahlungsmethode hinzufügen. Gehen Sie zu den Einstellungen des Kundenportals, um eine Zahlungsmethode hinzuzufügen.',
        confirmEndTrial: 'Tarif ändern & Testphase beenden',
        invoicing: {
          trialContinues:
            'Ihre Testphase läuft bis {date} weiter. Bis dahin werden Ihnen keine Kosten berechnet.',
          trialEnds:
            'Dadurch endet meine Testphase und mir wird {product} sofort berechnet.',
          periodMonthly: 'monatlich',
          periodYearly: 'jährlich',
          immediateCharge: 'Mir wird der neue {period}-Tarif sofort berechnet.',
          immediateCredit:
            'Meine vorherige Zahlung wird auf meiner nächsten Rechnung als Guthaben angezeigt.',
          prorationInvoice:
            'Mir wird der anteilige Betrag für den laufenden Monat sofort berechnet.',
          prorationProrate:
            'Ihre nächste Rechnung enthält den neuen Tarif plus den anteiligen Betrag für den laufenden Monat.',
          prorationNextPeriod:
            'Der neue Tarif wird in Ihrem nächsten Abrechnungszeitraum angewendet.',
        },
        update: {
          failed: 'Abonnement konnte nicht aktualisiert werden',
          errorTitle: 'Fehler bei der Abonnementaktualisierung',
          successTitle: 'Abonnement aktualisiert',
          successDescription: 'Das Abonnement wurde erfolgreich aktualisiert',
        },
      },
    },
    settings: {
      title: 'Abrechnungseinstellungen',
      paymentMethods: {
        title: 'Zahlungsmethoden',
        description: 'Verwendete Methoden für Abonnements und Einmalkäufe',
        add: 'Zahlungsmethode hinzufügen',
        addedTitle: 'Zahlungsmethode hinzugefügt',
        addFailedTitle: 'Zahlungsmethode konnte nicht hinzugefügt werden',
        addFailedDescription: 'Bitte versuchen Sie es erneut.',
      },
      paymentMethod: {
        defaultMethod: 'Standardmethode',
        makeDefault: 'Als Standard festlegen',
        deleteAriaLabel: 'Zahlungsmethode löschen',
        deletedTitle: 'Zahlungsmethode gelöscht',
        deletedDescription: 'Ihre Zahlungsmethode wurde erfolgreich entfernt.',
        deleteFailedTitle: 'Zahlungsmethode konnte nicht gelöscht werden',
        deleteFailedDescription:
          'Beim Löschen der Zahlungsmethode ist ein Fehler aufgetreten.',
        defaultUpdatedTitle: 'Standard-Zahlungsmethode aktualisiert',
        defaultUpdatedDescription:
          'Diese Zahlungsmethode ist jetzt Ihre Standardmethode.',
        defaultUpdateFailedTitle:
          'Standard-Zahlungsmethode konnte nicht aktualisiert werden',
        defaultUpdateFailedDescription:
          'Beim Aktualisieren der Standard-Zahlungsmethode ist ein Fehler aufgetreten.',
      },
      savedCards: {
        title: 'Gespeicherte Zahlungsmethoden',
        empty: 'Keine gespeicherten Zahlungsmethoden gefunden.',
        addNewCard: 'Neue Karte hinzufügen',
        useDifferentCard: 'Andere Karte verwenden',
        expires: 'Läuft ab {date}',
      },
      billingDetailsSection: {
        title: 'Abrechnungsdaten',
        description: 'Aktualisieren Sie Ihre Abrechnungsdaten',
      },
      billingDetails: {
        email: 'E-Mail',
        billingName: 'Rechnungsname',
        billingNamePlaceholder:
          'Firmen- oder rechtlicher Name für Rechnungen (optional)',
        billingAddress: 'Rechnungsadresse',
        line1: 'Zeile 1',
        line2: 'Zeile 2',
        postalCode: 'Postleitzahl',
        city: 'Ort',
        state: 'Bundesland',
        province: 'Provinz',
        taxId: 'Steuernummer',
        fieldRequired: 'Dieses Feld ist erforderlich',
        submit: 'Abrechnungsdaten aktualisieren',
      },
      emailSection: {
        title: 'E-Mail-Adresse',
        description: 'Ändern Sie die mit Ihrem Konto verknüpfte E-Mail-Adresse',
      },
      changeEmail: {
        currentEmail: 'Aktuelle E-Mail',
        newEmail: 'Neue E-Mail',
        newEmailPlaceholder: 'Neue E-Mail-Adresse eingeben',
        emailRequired: 'E-Mail ist erforderlich',
        requestChange: 'E-Mail-Änderung anfordern',
        sendVerification: 'Bestätigung senden',
        nevermind: 'Doch nicht',
        verificationSentPrefix: 'Wir haben einen Bestätigungslink gesendet an',
        verificationSentSuffix:
          '. Folgen Sie den Anweisungen, um Ihre neue E-Mail zu bestätigen.',
        verificationSentHint:
          'Umentschieden? Ignorieren Sie einfach die E-Mail, und Ihre aktuelle Adresse bleibt aktiv.',
      },
      billingManagers: {
        title: 'Abrechnungsmanager',
        description:
          'Abrechnungsmanager können Abrechnungsdaten, Zahlungsmethoden und Abonnements verwalten.',
      },
      privacy: {
        title: 'Datenschutz',
        description: 'Eine Kopie aller Ihrer persönlichen Daten herunterladen',
        exportData: 'Daten exportieren',
      },
      team: {
        roles: {
          owner: 'Inhaber',
          billingManager: 'Abrechnungsmanager',
          member: 'Mitglied',
        },
        emailPlaceholder: 'email@example.com',
        emailRequired: 'E-Mail ist erforderlich',
        invalidEmail: 'Ungültiges E-Mail-Format',
        invite: 'Abrechnungsmanager einladen',
        columnMember: 'Mitglied',
        columnRole: 'Rolle',
        you: '(Sie)',
        removeFromTeam: 'Aus Team entfernen',
        memberFallback: 'Mitglied',
        thisMemberFallback: 'dieses Mitglied',
        genericError: 'Ein Fehler ist aufgetreten.',
        addedTitle: 'Abrechnungsmanager hinzugefügt',
        addedDescription: '{email} wurde als Abrechnungsmanager hinzugefügt.',
        addFailedTitle: 'Abrechnungsmanager konnte nicht hinzugefügt werden',
        roleUpdatedTitle: 'Rolle aktualisiert',
        roleUpdatedDescription: '{name} ist jetzt ein {role}.',
        roleUpdateFailedTitle: 'Rolle konnte nicht aktualisiert werden',
        removedTitle: 'Mitglied entfernt',
        removedDescription: '{name} wurde aus dem Team entfernt.',
        removeFailedTitle: 'Mitglied konnte nicht entfernt werden',
        removeModalTitle: 'Teammitglied entfernen',
        removeModalDescription:
          'Möchten Sie {name} wirklich aus dem Team entfernen? Dadurch verliert die Person den Zugriff auf alle Team-Ressourcen.',
        removeConfirm: 'Entfernen',
      },
    },
    usage: {
      title: 'Nutzung',
      searchPlaceholder: 'Nutzungszähler suchen',
      overview: 'Übersicht',
      columnName: 'Name',
      columnConsumed: 'Verbraucht',
      columnCredited: 'Gutgeschrieben',
      columnBalance: 'Kontostand',
    },
    benefits: {
      title: 'Leistungszuschüsse',
      searchPlaceholder: 'Leistungszuschüsse suchen...',
      empty: 'Keine Leistungszuschüsse gefunden',
    },
    seats: {
      title: 'Sitzplatzverwaltung',
      totalSeats: 'Sitzplätze gesamt',
      updateSeats: 'Sitzplätze aktualisieren',
      columnEmail: 'E-Mail',
      statusLabel: {
        pending: 'Ausstehend',
        claimed: 'Beansprucht',
        revoked: 'Widerrufen',
      },
      resendInvitation: 'Einladung erneut senden',
      revokeSeat: 'Sitzplatz widerrufen',
      invite: 'Einladen',
      inviteMember: 'Mitglied einladen',
      emailRequired: 'E-Mail ist erforderlich',
      emailInvalid: 'Ungültiges E-Mail-Format',
      assignError: 'Sitzplatz konnte nicht zugewiesen werden',
      invitationSendError: 'Einladung konnte nicht gesendet werden',
      genericError: 'Ein Fehler ist aufgetreten.',
      seatCount: {
        '=1': '# Sitzplatz',
        other: '# Sitzplätze',
        _mode: 'plural',
      },
      availableSeats: {
        '=1': 'Noch ein Sitzplatz verfügbar',
        other: 'Noch # Sitzplätze verfügbar',
        _mode: 'plural',
      },
      cannotDecrease: {
        '=1': 'Kann nicht unter # zugewiesenen Sitzplatz reduziert werden. Bitte zuerst Sitzplätze widerrufen.',
        other:
          'Kann nicht unter # zugewiesene Sitzplätze reduziert werden. Bitte zuerst Sitzplätze widerrufen.',
        _mode: 'plural',
      },
      invoicingMessage: {
        invoice:
          'Mir wird der anteilige Betrag für den laufenden Monat sofort berechnet.',
        prorate:
          'Ihre nächste Rechnung enthält die aktualisierten Sitzplätze plus den anteiligen Betrag für den laufenden Monat.',
        nextPeriod:
          'Die Sitzplatzänderung wird in Ihrem nächsten Abrechnungszeitraum angewendet.',
      },
      updateSuccess: {
        title: 'Sitzplätze aktualisiert',
        invoice:
          'Das Abonnement hat jetzt {seats}. Mir wird der anteilige Betrag für den laufenden Monat sofort berechnet.',
        prorate:
          'Das Abonnement hat jetzt {seats}. Ihre nächste Rechnung enthält die aktualisierten Sitzplätze plus den anteiligen Betrag für den laufenden Monat.',
        nextPeriod:
          'Das Abonnement hat ab Ihrem nächsten Abrechnungszeitraum {seats}.',
        default: 'Das Abonnement hat jetzt {seats}.',
      },
      updateError: {
        title: 'Fehler beim Aktualisieren der Sitzplätze',
        description: 'Sitzplätze konnten nicht aktualisiert werden',
        unexpected: 'Ein unerwarteter Fehler ist aufgetreten',
      },
      revokeSuccess: {
        title: 'Sitzplatz erfolgreich widerrufen',
        description: 'Der Sitzplatz wurde widerrufen und ist jetzt verfügbar.',
      },
      revokeError: {
        title: 'Sitzplatz konnte nicht widerrufen werden',
      },
      resendSuccess: {
        title: 'Einladung erneut gesendet',
        description: 'Die Einladungs-E-Mail wurde erneut gesendet.',
      },
      resendError: {
        title: 'Einladung konnte nicht erneut gesendet werden',
      },
    },
    wallet: {
      availableBalance: 'Verfügbares Guthaben',
      organization: 'Organisation',
      currency: 'Währung',
    },
  },
} as const
