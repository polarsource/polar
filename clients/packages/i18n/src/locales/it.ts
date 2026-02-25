export default {
  checkout: {
    footer: {
      poweredBy: 'Powered by',
      merchantOfRecord:
        'Questo ordine è elaborato dal nostro rivenditore online e Merchant of Record, Polar, che gestisce anche le richieste relative agli ordini e i resi.',
      mandateSubscriptionTrial:
        'Cliccando su "{buttonLabel}", autorizzi Polar Software, Inc., il nostro rivenditore online e merchant of record, ad addebitare sul metodo di pagamento selezionato l\'importo sopra indicato al termine del periodo di prova e a ogni successiva data di fatturazione fino alla disdetta. Puoi annullare in qualsiasi momento prima della fine della prova per evitare l\'addebito.',
      mandateSubscription:
        'Cliccando su "{buttonLabel}", autorizzi Polar Software, Inc., il nostro rivenditore online e merchant of record, ad addebitare immediatamente sul metodo di pagamento selezionato l\'importo sopra indicato e ad addebitare lo stesso importo a ogni successiva data di fatturazione fino alla disdetta.',
      mandateOneTime:
        'Cliccando su "{buttonLabel}", autorizzi Polar Software, Inc., il nostro rivenditore online e merchant of record, ad addebitare sul metodo di pagamento selezionato l\'importo sopra indicato. Si tratta di un addebito una tantum.',
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
      },
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
      successTitle: 'Ordine completato con successo!',
      failedTitle:
        "Si è verificato un problema durante l'elaborazione dell'ordine",
      processingDescription: 'Attendi mentre confermiamo il pagamento.',
      successDescription: 'Ora hai accesso ai vantaggi di {product}.',
      failedDescription: "Riprova o contatta l'assistenza.",
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
      readLess: 'Mostra meno',
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
    github_repository: 'Accesso al repository GitHub',
    discord: 'Invito Discord',
    downloadables: 'Download di file',
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
} as const
