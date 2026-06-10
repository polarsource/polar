export default {
  checkout: {
    footer: {
      poweredBy: 'Powered by',
      merchantOfRecord:
        'Questo ordine è elaborato dal nostro rivenditore online e Merchant of Record, Polar, che gestisce anche le richieste relative agli ordini e i resi.',
      mandateSubscriptionTrial:
        "Facendo clic su \"{buttonLabel}\", autorizzi Polar Software, Inc., il nostro rivenditore online e merchant of record, ad addebitare sul metodo di pagamento selezionato l'importo indicato sopra al termine del periodo di prova e in ogni successiva data di fatturazione fino all'annullamento, e accetti i {buyerTermsLink}. Puoi annullare in qualsiasi momento prima della fine del periodo di prova per evitare l'addebito.",
      mandateSubscription:
        'Facendo clic su "{buttonLabel}", autorizzi Polar Software, Inc., il nostro rivenditore online e merchant of record, ad addebitare immediatamente sul metodo di pagamento selezionato l\'importo indicato sopra e ad addebitare lo stesso importo in ogni successiva data di fatturazione fino all\'annullamento, e accetti i {buyerTermsLink}.',
      buyerTermsLink: 'Termini di acquisto',
      mandateOneTime:
        'Cliccando su "{buttonLabel}", autorizzi Polar Software, Inc., il nostro rivenditore online e merchant of record, ad addebitare l\'importo sopra indicato sul metodo di pagamento selezionato e accetti i {buyerTermsLink}. Questo è un addebito unico.',
    },
    form: {
      email: 'Email',
      cardholderName: 'Intestatario della carta',
      purchasingAsBusiness: 'Acquisto come azienda',
      businessName: 'Ragione sociale',
      billingAddress: {
        label: 'Indirizzo di fatturazione',
        line1: 'Indirizzo e numero civico',
        line2: 'Interno, scala, piano, ecc.',
        postalCode: 'CAP',
        city: 'Città',
        country: 'Paese',
        state: 'Stato',
        province: 'Provincia',
        stateProvince: 'Stato / Provincia',
      },
      taxId: 'Partita IVA / Codice Fiscale',
      discountCode: 'Codice sconto',
      optional: 'Opzionale',
      apply: 'Applica',
      fieldRequired: 'Questo campo è obbligatorio',
      addBusinessDetails: 'Aggiungi dati aziendali',
      removeBusinessDetails: 'Rimuovi dati aziendali',
      billingDetails: 'Dati aziendali',
      addDiscountCode: 'Aggiungi codice sconto',
    },
    pricing: {
      subtotal: 'Subtotale',
      taxableAmount: 'Importo imponibile',
      taxes: 'IVA',
      free: 'Gratis',
      payWhatYouWant: 'Paga quanto vuoi',
      total: 'Totale',
      everyInterval: {
        day: {
          '=1': 'Giornaliero',
          '=2': 'Ogni 2 giorni',
          other: 'Ogni # giorni',
          _mode: 'plural',
        },
        week: {
          '=1': 'Settimanale',
          '=2': 'Ogni 2 settimane',
          other: 'Ogni # settimane',
          _mode: 'plural',
        },
        month: {
          '=1': 'Mensile',
          '=2': 'Ogni 2 mesi',
          other: 'Ogni # mesi',
          _mode: 'plural',
        },
        year: {
          '=1': 'Annuale',
          '=2': 'Ogni 2 anni',
          other: 'Ogni # anni',
          _mode: 'plural',
        },
      },
      additionalMeteredUsage: 'Utilizzo aggiuntivo a consumo',
      perUnit: '/ unità',
      discount: {
        duration: {
          months: {
            '=1': 'per il primo mese',
            other: 'per i primi # mesi',
            _mode: 'plural',
          },
          years: {
            '=1': 'per il primo anno',
            other: 'per i primi # anni',
            _mode: 'plural',
          },
        },
        until: 'Fino al {date}',
      },
      perSeat: 'per postazione',
      seats: {
        label: 'Postazioni',
        numberOfSeats: 'Numero di postazioni',
        count: {
          '=1': '# postazione',
          other: '# postazioni',
          _mode: 'plural',
        },
        range: '{min} - {max} postazioni',
        minimum: 'Minimo {min} postazioni',
        maximum: 'Massimo {max} postazioni',
        updateFailed: 'Impossibile aggiornare le postazioni',
        included: {
          '=1': 'Una postazione inclusa',
          other: '# postazioni incluse',
          _mode: 'plural',
        },
      },
      inclTax: 'IVA (inclusa)',
      basePrice: 'Prezzo base',
    },
    trial: {
      ends: 'La prova termina il {endDate}',
      duration: {
        days: {
          '=1': 'Prova di # giorno',
          other: 'Prova di # giorni',
          _mode: 'plural',
        },
        weeks: {
          '=1': 'Prova di # settimana',
          other: 'Prova di # settimane',
          _mode: 'plural',
        },
        months: {
          '=1': 'Prova di # mese',
          other: 'Prova di # mesi',
          _mode: 'plural',
        },
        years: {
          '=1': 'Prova di # anno',
          other: 'Prova di # anni',
          _mode: 'plural',
        },
      },
      hero: {
        free: {
          day: {
            '=1': '# giorno gratis',
            other: '# giorni gratis',
            _mode: 'plural',
          },
          month: {
            '=1': '# mese gratis',
            other: '# mesi gratis',
            _mode: 'plural',
          },
          year: {
            '=1': '# anno gratis',
            other: '# anni gratis',
            _mode: 'plural',
          },
        },
        intervalSuffix: {
          day: '/giorno',
          week: '/settimana',
          month: '/mese',
          year: '/anno',
        },
        then: 'Poi',
        startingDate: 'a partire dal {date}',
      },
      summary: {
        totalWhenTrialEnds: 'Totale al termine della prova',
        totalWhenDiscountExpires: 'Totale alla scadenza dello sconto',
        totalDueToday: 'Totale da pagare oggi',
      },
    },
    pwywForm: {
      label: 'Scegli un prezzo equo',
      minimum: 'Minimo {amount}',
      amountMinimum: "L'importo deve essere almeno {min}",
      amountFreeOrMinimum: "L'importo deve essere {zero} o almeno {min}",
    },
    productSwitcher: {
      billedRecurring: 'Fatturazione {frequency}',
      oneTimePurchase: 'Acquisto una tantum',
      fromPrefix: 'Da',
    },
    card: {
      included: 'Incluso',
    },
    benefits: {
      moreBenefits: {
        '=1': '# altro vantaggio',
        other: '# altri vantaggi',
        _mode: 'plural',
      },
      showMoreBenefits: {
        '=1': 'Mostra # altro vantaggio',
        other: 'Mostra altri # vantaggi',
        _mode: 'plural',
      },
      showLess: 'Mostra meno',
      granting: 'Assegnazione vantaggi in corso...',
      requestNewInvite: 'Richiedi nuovo invito',
      retryIn: {
        '=1': 'Riprova tra # secondo',
        other: 'Riprova tra # secondi',
        _mode: 'plural',
      },
      connectNewAccount: 'Collega nuovo account',
      requestMyInvite: 'Richiedi il mio invito',
      github: {
        connect: 'Collega account GitHub',
        goTo: 'Vai a {repository}',
        selectAccount: 'Seleziona un account GitHub',
      },
      discord: {
        connect: 'Collega account Discord',
        open: 'Apri Discord',
        selectAccount: 'Seleziona un account Discord',
      },
      licenseKey: {
        copy: 'Copia',
        copiedToClipboard: 'Copiato negli appunti',
        copiedToClipboardDescription:
          'La chiave di licenza è stata copiata negli appunti',
        loading: 'Caricamento...',
        status: 'Stato',
        statusGranted: 'Assegnata',
        statusRevoked: 'Revocata',
        statusDisabled: 'Disabilitata',
        usage: 'Utilizzo',
        validations: 'Convalide',
        validatedAt: 'Convalidata il',
        neverValidated: 'Mai convalidata',
        expiryDate: 'Data di scadenza',
        noExpiry: 'Nessuna scadenza',
        activations: 'Attivazioni',
        activationDeleted: 'Attivazione chiave di licenza eliminata',
        activationDeletedDescription: 'Attivazione eliminata con successo',
        activationDeactivationFailed: 'Disattivazione fallita',
      },
    },
    confirmation: {
      confirmPayment: 'Conferma pagamento',
      processingTitle: 'Stiamo elaborando il tuo ordine',
      failedTitle:
        "Si è verificato un problema durante l'elaborazione dell'ordine",
      processingDescription: 'Attendi mentre confermiamo il pagamento.',
      failedDescription: "Riprova o contatta l'assistenza.",
      successTitle: 'Grazie per il tuo ordine!',
      successDescription: 'Ora hai accesso a {product}.',
    },
    loading: {
      processingOrder: 'Elaborazione ordine...',
      processingPayment: 'Elaborazione pagamento',
      paymentSuccessful:
        'Pagamento riuscito! Preparazione dei prodotti in corso...',
      confirmationTokenFailed:
        'Impossibile creare il token di conferma, riprova più tardi.',
    },
    cta: {
      startTrial: 'Inizia la prova',
      subscribeNow: 'Abbonati ora',
      payNow: 'Paga ora',
      getFree: 'Ottieni gratis',
      paymentsUnavailable: 'Pagamenti attualmente non disponibili',
    },
    productDescription: {
      readMore: 'Leggi di più',
      readLess: 'Leggi meno',
    },
  },
  intervals: {
    short: {
      day: 'g',
      week: 'sett',
      month: 'mese',
      year: 'anno',
    },
  },
  benefitTypes: {
    custom: 'Personalizzato',
    license_keys: 'Chiavi di licenza',
    github_repository: 'Accesso repository GitHub',
    discord: 'Invito Discord',
    downloadables: 'File scaricabili',
    meter_credit: 'Crediti a consumo',
    feature_flag: 'Feature flag',
  },
  ordinal: {
    zero: '°',
    one: '°',
    two: '°',
    few: '°',
    many: '°',
    other: '°',
  },
  embedPaymentMethod: {
    title: 'Aggiungi metodo di pagamento',
    close: 'Chiudi',
    submit: 'Aggiungi metodo di pagamento',
    processing: 'Aggiunta del metodo di pagamento…',
    fallbackError: 'Si è verificato un problema. Riprova.',
    errors: {
      invalidRequest: 'Parametri obbligatori mancanti.',
      unauthorized: 'Sessione scaduta.',
      processingFailed:
        'Impossibile elaborare il metodo di pagamento. Riprova.',
      unknown: 'Si è verificato un problema.',
    },
  },
  portal: {
    navigation: {
      overview: 'Panoramica',
      orders: 'Ordini',
      usage: 'Utilizzo',
      billing: 'Fatturazione',
      selectPage: 'Seleziona pagina',
    },
    common: {
      cancel: 'Annulla',
      close: 'Chiudi',
      save: 'Salva',
      saveChanges: 'Salva modifiche',
      edit: 'Modifica',
      delete: 'Elimina',
      confirm: 'Conferma',
      back: 'Indietro',
      loading: 'Caricamento…',
      saving: 'Salvataggio…',
      download: 'Scarica',
      viewAll: 'Visualizza tutto',
      somethingWentWrong: 'Qualcosa è andato storto. Riprova.',
      date: 'Data',
      amount: 'Importo',
      status: 'Stato',
      product: 'Prodotto',
      actions: 'Azioni',
      pageOf: 'Pagina {page} di {totalPages}',
    },
    overview: {
      teamSeatAccess: {
        title: 'Accesso ai posti del team',
        description: "Accesso fornito tramite l'abbonamento di team",
      },
      emptyState: {
        noActiveSubscriptions: {
          title: 'Nessun abbonamento attivo',
          description: 'Non hai abbonamenti attivi al momento.',
        },
        noTeamAccess: {
          title: 'Nessun accesso al team',
          description: 'Non hai accesso ai posti del team al momento.',
        },
      },
      currentPeriod: {
        nextCharge: 'Prossimo addebito',
        nextInvoice: 'Prossima fattura',
        firstChargeAfterTrial: 'Primo addebito dopo la prova',
        trialEnds: 'Fine prova',
        finalCharge: 'Addebito finale',
        subscriptionEnds: 'Fine abbonamento',
        notAvailable: 'N/D',
        dateLabel: '{label} — {date}',
        canceled: 'Annullato',
        meteredCharges: 'Addebiti a consumo',
        subtotal: 'Subtotale',
        discount: 'Sconto',
        taxes: 'Tasse',
        estimatedTotal: 'Totale stimato',
        total: 'Totale',
        finalChargeNotice:
          "Questo sarà l'addebito finale prima della scadenza dell'abbonamento.",
        finalChargeMeteredNotice:
          "L'importo finale può variare in base all'utilizzo fino alla fine del periodo di fatturazione.",
        meteredNoticeActive:
          "Gli addebiti finali possono variare in base all'utilizzo fino alla fine del periodo di fatturazione.",
        meteredNoticeTrialing:
          "Gli addebiti finali possono variare in base all'utilizzo durante il periodo di prova.",
        meteredNoticeDefault: 'Gli addebiti finali possono variare.',
      },
      latestPurchase: {
        title: 'Ultimo acquisto',
        purchasedOn: 'Acquistato — {date}',
        total: 'Totale',
      },
      subscriptions: {
        title: 'Abbonamenti',
        noSubscriptionsFound: 'Nessun abbonamento trovato',
        inactiveTitle: 'Abbonamenti inattivi',
        endedAt: 'Terminato il',
        retryPayment: 'Riprova pagamento',
        manageSubscription: 'Gestisci abbonamento',
      },
    },
    orders: {
      orderHistory: 'Cronologia ordini',
      description: 'Descrizione',
      viewOrder: 'Visualizza ordine',
      retryPayment: 'Riprova pagamento',
      invoiceNumber: 'Numero fattura',
      orderItems: "Articoli dell'ordine",
      subtotal: 'Subtotale',
      discount: 'Sconto',
      netAmount: 'Importo netto',
      tax: 'Imposta',
      total: 'Totale',
      appliedBalance: 'Saldo applicato',
      toBePaid: 'Da pagare',
      refundedAmount: 'Importo rimborsato',
      statusTitle: {
        draft: 'Bozza',
        paid: 'Pagato',
        pending: 'In attesa',
        refunded: 'Rimborsato',
        partiallyRefunded: 'Parzialmente rimborsato',
        void: 'Annullato',
      },
      payment: {
        orderSummary: 'Riepilogo ordine',
        descriptionLabel: 'Descrizione:',
        amountLabel: 'Importo:',
        paymentMethod: 'Metodo di pagamento',
        payNow: 'Paga ora',
        processing: 'Elaborazione...',
        confirming: 'Conferma...',
        loading: 'Caricamento...',
        processingPayment: 'Elaborazione del pagamento...',
        processingHint:
          'Potrebbe richiedere alcuni istanti. Non chiudere questa finestra.',
        processingPaymentShort: 'Elaborazione pagamento...',
        usingSavedMethod: 'Uso del metodo di pagamento salvato',
        tryAgain: 'Riprova',
        paymentSuccessfulTitle: 'Pagamento riuscito!',
        paymentFailedTitle: 'Pagamento non riuscito',
        paymentSuccessfulDescription:
          'Grazie per il tuo pagamento. Ora puoi chiudere questa finestra.',
        paymentFailedDescription:
          "Puoi riprovare o contattare l'assistenza se il problema persiste.",
        updatePaymentMethod: 'Aggiorna metodo di pagamento',
        toastSuccessTitle: 'Pagamento riuscito',
        toastSuccessDescription: 'Il pagamento è stato elaborato con successo!',
        toastFailedTitle: 'Pagamento non riuscito',
        paymentFailed: 'Pagamento non riuscito',
        paymentFailedRetry: 'Pagamento non riuscito. Riprova.',
        paymentFailedTryAgain: 'Pagamento non riuscito, riprova.',
        confirmationTimeout:
          "La conferma del pagamento sta richiedendo più tempo del previsto. Il pagamento potrebbe essere ancora in elaborazione. Controlla lo stato dell'ordine o contatta l'assistenza se necessario.",
        networkConfirmationError:
          "Impossibile confermare lo stato del pagamento a causa di problemi di rete. Controlla lo stato dell'ordine o contatta l'assistenza.",
        stripeRequired:
          "L'istanza di Stripe è necessaria per le azioni di pagamento",
        additionalAuthenticationRequired:
          "Il pagamento richiede un'autenticazione aggiuntiva",
        authenticationFailed: 'Autenticazione del pagamento non riuscita',
        processDetailsFailed:
          'Impossibile elaborare i dettagli del pagamento. Controlla le informazioni e riprova.',
        createTokenFailed: 'Impossibile creare il token di pagamento. Riprova.',
        processPaymentFailed:
          'Impossibile elaborare il pagamento. Controlla le informazioni di pagamento e riprova.',
        networkError:
          'Si è verificato un errore di rete. Controlla la connessione e riprova.',
      },
    },
    subscription: {
      free: 'Gratis',
      details: {
        startDate: 'Data di inizio',
        trialEnds: 'Fine prova',
        expiryDate: 'Data di scadenza',
        renewalDate: 'Data di rinnovo',
        expired: 'Scaduto',
        meteredUsage: 'Utilizzo a consumo',
        uncancel: 'Annulla annullamento',
        manageSubscription: 'Gestisci abbonamento',
        changePlan: 'Cambia piano',
      },
      pendingUpdate: {
        title: 'Aggiornamento in sospeso',
        cancelScheduledChange: 'Annulla modifica pianificata',
        newProduct: 'Nuovo prodotto',
        seats: 'Posti',
        effectiveFrom: 'Aggiornamento attivo dal',
        clearConfirmDescription:
          'Il tuo abbonamento rimarrà invariato nel prossimo ciclo di fatturazione. Vuoi davvero annullare questo aggiornamento in sospeso?',
      },
      invoices: {
        title: 'Fatture',
      },
      cancel: {
        title: 'Annulla abbonamento',
        ariaLabel: 'Annulla abbonamento',
        heading: 'Ci dispiace vederti andare!',
        description:
          'Sarai sempre il benvenuto! Facci sapere perché te ne vai per aiutarci a migliorare il nostro prodotto.',
        changedMind: 'Ho cambiato idea',
        commentPlaceholder:
          "C'è qualcos'altro che vuoi condividere? (Facoltativo)",
        reason: {
          unused: 'Lo uso troppo poco',
          tooExpensive: 'Troppo costoso',
          missingFeatures: 'Funzionalità mancanti',
          switchedService: 'Sono passato a un altro servizio',
          customerService: 'Assistenza clienti',
          lowQuality: 'Non soddisfatto della qualità',
          tooComplex: 'Troppo complicato',
          other: 'Altro (scrivi sotto)',
        },
        toast: {
          title: 'Abbonamento annullato',
          description: "L'abbonamento è stato annullato con successo",
        },
      },
      changePlan: {
        title: 'Cambia piano',
        currentPlan: 'Piano attuale',
        availablePlans: 'Piani disponibili',
        noOtherPlans: 'Non sono disponibili altri piani',
        benefitsAdded: 'Otterrai accesso ai seguenti vantaggi',
        benefitsRemoved: 'Perderai accesso ai seguenti vantaggi',
        needPaymentMethod:
          'Devi aggiungere un metodo di pagamento prima di aggiornare il piano. Vai alle Impostazioni del Customer Portal per aggiungere un metodo di pagamento.',
        confirmEndTrial: 'Cambia piano e termina la prova',
        invoicing: {
          trialContinues:
            'La tua prova continuerà fino al {date}. Non ti verrà addebitato nulla prima di allora.',
          trialEnds:
            'Questo terminerà la mia prova e mi addebiterà immediatamente {product}.',
          periodMonthly: 'mensile',
          periodYearly: 'annuale',
          immediateCharge:
            'Mi verrà addebitato immediatamente il nuovo piano {period}.',
          immediateCredit:
            'Il mio pagamento precedente apparirà come credito nella prossima fattura.',
          prorationInvoice:
            'Mi verrà addebitato immediatamente un importo proporzionale per il mese in corso.',
          prorationProrate:
            'La prossima fattura includerà il nuovo piano più il calcolo proporzionale per il mese in corso.',
          prorationNextPeriod:
            'Il nuovo piano verrà applicato al prossimo ciclo di fatturazione.',
        },
        update: {
          failed: "Impossibile aggiornare l'abbonamento",
          errorTitle: "Errore durante l'aggiornamento dell'abbonamento",
          successTitle: 'Abbonamento aggiornato',
          successDescription: "L'abbonamento è stato aggiornato con successo",
        },
      },
    },
    settings: {
      title: 'Impostazioni di fatturazione',
      paymentMethods: {
        title: 'Metodi di pagamento',
        description: 'Metodi usati per abbonamenti e acquisti una tantum',
        add: 'Aggiungi metodo di pagamento',
        addedTitle: 'Metodo di pagamento aggiunto',
        addFailedTitle: 'Impossibile aggiungere il metodo di pagamento',
        addFailedDescription: 'Riprova.',
      },
      paymentMethod: {
        defaultMethod: 'Metodo predefinito',
        makeDefault: 'Imposta come predefinito',
        deleteAriaLabel: 'Elimina metodo di pagamento',
        deletedTitle: 'Metodo di pagamento eliminato',
        deletedDescription:
          'Il tuo metodo di pagamento è stato rimosso con successo.',
        deleteFailedTitle: 'Impossibile eliminare il metodo di pagamento',
        deleteFailedDescription:
          "Si è verificato un errore durante l'eliminazione del metodo di pagamento.",
        defaultUpdatedTitle: 'Metodo di pagamento predefinito aggiornato',
        defaultUpdatedDescription:
          'Questo metodo di pagamento è ora quello predefinito.',
        defaultUpdateFailedTitle:
          'Impossibile aggiornare il metodo di pagamento predefinito',
        defaultUpdateFailedDescription:
          "Si è verificato un errore durante l'aggiornamento del metodo di pagamento predefinito.",
      },
      savedCards: {
        title: 'Metodi di pagamento salvati',
        empty: 'Nessun metodo di pagamento salvato trovato.',
        addNewCard: 'Aggiungi nuova carta',
        useDifferentCard: "Usa un'altra carta",
        expires: 'Scade il {date}',
      },
      billingDetailsSection: {
        title: 'Dati di fatturazione',
        description: 'Aggiorna i tuoi dati di fatturazione',
      },
      billingDetails: {
        email: 'Email',
        billingName: 'Nome di fatturazione',
        billingNamePlaceholder:
          'Ragione sociale o nome legale per le fatture (facoltativo)',
        billingAddress: 'Indirizzo di fatturazione',
        line1: 'Riga 1',
        line2: 'Riga 2',
        postalCode: 'CAP',
        city: 'Città',
        state: 'Stato',
        province: 'Provincia',
        taxId: 'Partita IVA',
        fieldRequired: 'Questo campo è obbligatorio',
        submit: 'Aggiorna dati di fatturazione',
      },
      emailSection: {
        title: 'Indirizzo email',
        description: "Cambia l'email associata al tuo account",
      },
      changeEmail: {
        currentEmail: 'Email attuale',
        newEmail: 'Nuova email',
        newEmailPlaceholder: 'Inserisci il nuovo indirizzo email',
        emailRequired: "L'email è obbligatoria",
        requestChange: 'Richiedi cambio email',
        sendVerification: 'Invia verifica',
        nevermind: 'Lascia perdere',
        verificationSentPrefix: 'Abbiamo inviato un link di verifica a',
        verificationSentSuffix:
          '. Segui le istruzioni per confermare la nuova email.',
        verificationSentHint:
          "Hai cambiato idea? Ti basta ignorare l'email e il tuo indirizzo attuale resterà attivo.",
      },
      billingManagers: {
        title: 'Responsabili di fatturazione',
        description:
          'I responsabili di fatturazione possono gestire i dati di fatturazione, i metodi di pagamento e gli abbonamenti.',
      },
      privacy: {
        title: 'Privacy',
        description: 'Scarica una copia di tutti i tuoi dati personali',
        exportData: 'Esporta dati',
      },
      team: {
        roles: {
          owner: 'Proprietario',
          billingManager: 'Responsabile di fatturazione',
          member: 'Membro',
        },
        emailPlaceholder: 'email@example.com',
        emailRequired: "L'email è obbligatoria",
        invalidEmail: 'Formato email non valido',
        invite: 'Invita responsabile di fatturazione',
        columnMember: 'Membro',
        columnRole: 'Ruolo',
        you: '(tu)',
        removeFromTeam: 'Rimuovi dal team',
        memberFallback: 'Membro',
        thisMemberFallback: 'questo membro',
        genericError: 'Si è verificato un errore.',
        addedTitle: 'Responsabile di fatturazione aggiunto',
        addedDescription:
          '{email} è stato aggiunto come responsabile di fatturazione.',
        addFailedTitle:
          'Impossibile aggiungere il responsabile di fatturazione',
        roleUpdatedTitle: 'Ruolo aggiornato',
        roleUpdatedDescription: '{name} è ora un {role}.',
        roleUpdateFailedTitle: 'Impossibile aggiornare il ruolo',
        removedTitle: 'Membro rimosso',
        removedDescription: '{name} è stato rimosso dal team.',
        removeFailedTitle: 'Impossibile rimuovere il membro',
        removeModalTitle: 'Rimuovi membro del team',
        removeModalDescription:
          "Vuoi davvero rimuovere {name} dal team? Perderà l'accesso a tutte le risorse del team.",
        removeConfirm: 'Rimuovi',
      },
    },
    usage: {
      title: 'Utilizzo',
      searchPlaceholder: 'Cerca metro di utilizzo',
      overview: 'Panoramica',
      columnName: 'Nome',
      columnConsumed: 'Consumati',
      columnCredited: 'Accreditati',
      columnBalance: 'Saldo',
    },
    benefits: {
      title: 'Assegnazioni vantaggi',
      searchPlaceholder: 'Cerca assegnazioni vantaggi...',
      empty: 'Nessuna assegnazione vantaggi trovata',
    },
    seats: {
      title: 'Gestione posti',
      totalSeats: 'Posti totali',
      updateSeats: 'Aggiorna posti',
      columnEmail: 'Email',
      statusLabel: {
        pending: 'In attesa',
        claimed: 'Assegnato',
        revoked: 'Revocato',
      },
      resendInvitation: "Invia di nuovo l'invito",
      revokeSeat: 'Revoca posto',
      invite: 'Invita',
      inviteMember: 'Invita membro',
      emailRequired: "L'email è obbligatoria",
      emailInvalid: 'Formato email non valido',
      assignError: 'Impossibile assegnare il posto',
      invitationSendError: "Impossibile inviare l'invito",
      genericError: 'Si è verificato un errore.',
      seatCount: {
        '=1': '# posto',
        other: '# posti',
        _mode: 'plural',
      },
      availableSeats: {
        '=1': 'Un posto in più disponibile',
        other: '# posti in più disponibili',
        _mode: 'plural',
      },
      cannotDecrease: {
        '=1': 'Impossibile ridurre sotto # posto assegnato. Revoca prima i posti.',
        other:
          'Impossibile ridurre sotto # posti assegnati. Revoca prima i posti.',
        _mode: 'plural',
      },
      invoicingMessage: {
        invoice:
          'Mi verrà addebitato immediatamente un importo proporzionale per il mese in corso.',
        prorate:
          'La prossima fattura includerà i nuovi posti più il calcolo proporzionale per il mese in corso.',
        nextPeriod:
          "L'aggiornamento dei posti verrà applicato al prossimo ciclo di fatturazione.",
      },
      updateSuccess: {
        title: 'Posti aggiornati',
        invoice:
          "L'abbonamento ora ha {seats}. Mi verrà addebitato immediatamente un importo proporzionale per il mese in corso.",
        prorate:
          "L'abbonamento ora ha {seats}. La prossima fattura includerà i nuovi posti più il calcolo proporzionale per il mese in corso.",
        nextPeriod:
          "L'abbonamento avrà {seats} a partire dal prossimo ciclo di fatturazione.",
        default: "L'abbonamento ora ha {seats}.",
      },
      updateError: {
        title: "Errore durante l'aggiornamento dei posti",
        description: 'Impossibile aggiornare i posti',
        unexpected: 'Si è verificato un errore imprevisto',
      },
      revokeSuccess: {
        title: 'Posto revocato con successo',
        description: 'Il posto è stato revocato ed è ora disponibile.',
      },
      revokeError: {
        title: 'Impossibile revocare il posto',
      },
      resendSuccess: {
        title: 'Invito reinviato',
        description: "L'email di invito è stata inviata di nuovo.",
      },
      resendError: {
        title: "Impossibile reinviare l'invito",
      },
    },
  },
} as const
