export default {
  checkout: {
    footer: {
      poweredBy: 'Oferit de',
      merchantOfRecord:
        'Această comandă este procesată de revânzătorul nostru online și Merchant of Record, Polar, care se ocupă și de solicitările și returnările legate de comandă.',
      mandateSubscriptionTrial:
        'Prin clic pe „{buttonLabel}”, autorizați Polar Software, Inc., revânzătorul nostru online și merchant of record, să debiteze metoda de plată selectată în suma afișată mai sus la sfârșitul perioadei de probă și la fiecare dată de facturare ulterioară până când anulați și sunteți de acord cu {buyerTermsLink}. Puteți anula oricând înainte de sfârșitul perioadei de probă pentru a evita taxarea.',
      mandateSubscription:
        'Prin clic pe „{buttonLabel}”, autorizați Polar Software, Inc., revânzătorul nostru online și merchant of record, să debiteze imediat metoda de plată selectată în suma afișată mai sus și să debiteze aceeași sumă la fiecare dată de facturare ulterioară până când anulați și sunteți de acord cu {buyerTermsLink}.',
      mandateOneTime:
        'Prin clic pe „{buttonLabel}”, autorizați Polar Software, Inc., revânzătorul nostru online și merchant of record, să debiteze metoda de plată selectată în suma afișată mai sus și sunteți de acord cu {buyerTermsLink}. Aceasta este o plată unică.',
      mandateSubscriptionTrialDiscounted:
        'Prin clic pe „{buttonLabel}”, autorizați Polar Software, Inc., revânzătorul nostru online și merchant of record, să debiteze metoda de plată selectată în suma redusă afișată mai sus la sfârșitul perioadei de probă și prețul obișnuit la fiecare dată de facturare după expirarea reducerii, până când anulați, și sunteți de acord cu {buyerTermsLink}. Puteți anula oricând înainte de sfârșitul perioadei de probă pentru a evita taxarea.',
      mandateSubscriptionDiscounted:
        'Prin clic pe „{buttonLabel}”, autorizați Polar Software, Inc., revânzătorul nostru online și merchant of record, să debiteze imediat metoda de plată selectată în suma redusă afișată mai sus și prețul obișnuit la fiecare dată de facturare după expirarea reducerii, până când anulați, și sunteți de acord cu {buyerTermsLink}.',
      buyerTermsLink: 'Termenii cumpărătorului',
    },
    form: {
      email: 'E-mail',
      cardholderName: 'Numele titularului cardului',
      purchasingAsBusiness: 'Cumpăr în calitate de companie',
      businessName: 'Denumirea companiei',
      billingDetails: 'Detalii companie',
      billingAddress: {
        label: 'Adresa de facturare',
        line1: 'Adresa străzii',
        line2: 'Apartament sau unitate',
        postalCode: 'Cod poștal',
        city: 'Oraș',
        country: 'Țară',
        state: 'Stat',
        province: 'Județ',
        stateProvince: 'Stat / Județ',
      },
      taxId: 'Cod de identificare fiscală',
      discountCode: 'Cod de reducere',
      addDiscountCode: 'Adăugați codul de reducere',
      optional: 'Opțional',
      apply: 'Aplicați',
      fieldRequired: 'Acest câmp este obligatoriu',
    },
    orderSummary: 'Rezumatul comenzii',
    pricing: {
      subtotal: 'Subtotal',
      taxableAmount: 'Bază de impozitare',
      taxes: 'TVA',
      inclTax: 'TVA (inclus)',
      free: 'Gratuit',
      payWhatYouWant: 'Plătiți cât doriți',
      total: 'Total',
      everyInterval: {
        day: {
          '=1': 'Zilnic',
          '=2': 'La fiecare două zile',
          other: 'La fiecare # de zile',
          few: 'La fiecare # zile',
          _mode: 'plural',
        },
        week: {
          '=1': 'Săptămânal',
          '=2': 'La fiecare două săptămâni',
          other: 'La fiecare # de săptămâni',
          few: 'La fiecare # săptămâni',
          _mode: 'plural',
        },
        month: {
          '=1': 'Lunar',
          '=2': 'La fiecare două luni',
          other: 'La fiecare # de luni',
          few: 'La fiecare # luni',
          _mode: 'plural',
        },
        year: {
          '=1': 'Anual',
          '=2': 'La fiecare doi ani',
          other: 'La fiecare # de ani',
          few: 'La fiecare # ani',
          _mode: 'plural',
        },
      },
      additionalMeteredUsage:
        'Utilizare suplimentară cu plată în funcție de consum',
      meteredChargesMayApply: 'Pot fi aplicate taxe suplimentare pentru consum',
      meteredIncluded: '{units} incluse',
      meterUnits: {
        token: 'tokenuri',
        scalar: 'unități',
      },
      tiers: {
        from: 'De la',
        range: '{from}–{to}',
        andAbove: '{from}+',
        volumeExplainer:
          'Toată utilizarea este facturată la prețul intervalului în care se încadrează',
      },
      dueToday: 'Scadent astăzi',
      firstPayment: 'Prima plată',
      totalAfterTrial: 'Total după perioada de probă',
      perSeat: 'per loc',
      basePrice: 'Preț de bază',
      seats: {
        label: 'Locuri',
        numberOfSeats: 'Număr de locuri',
        count: {
          '=1': '# loc',
          other: '# de locuri',
          few: '# locuri',
          _mode: 'plural',
        },
        included: {
          '=1': 'Un loc inclus',
          other: '# de locuri incluse',
          few: '# locuri incluse',
          _mode: 'plural',
        },
        range: '{min} - {max} locuri',
        minimum: 'Minim {min} locuri',
        maximum: 'Maxim {max} locuri',
        updateFailed: 'Nu s-a putut actualiza numărul de locuri',
      },
      perUnit: 'pe {unitLabel}',
      units: {
        label: '{unitLabelPlural}',
        numberOfUnits: 'Număr de {unitLabelPlural}',
        count: {
          '=1': '# {unitLabel}',
          other: '# de {unitLabelPlural}',
          few: '# {unitLabelPlural}',
          _mode: 'plural',
        },
        updateFailed: 'Nu s-a putut actualiza numărul de unități',
      },
      discount: {
        until: 'Până la {date}',
      },
    },
    trial: {
      hero: {
        free: {
          day: {
            '=1': '# zi gratuită',
            other: '# de zile gratuite',
            few: '# zile gratuite',
            _mode: 'plural',
          },
          month: {
            '=1': '# lună gratuită',
            other: '# de luni gratuite',
            few: '# luni gratuite',
            _mode: 'plural',
          },
          year: {
            '=1': '# an gratuit',
            other: '# de ani gratuiți',
            few: '# ani gratuiți',
            _mode: 'plural',
          },
        },
        intervalSuffix: {
          day: '/zi',
          week: '/săptămână',
          month: '/lună',
          year: '/an',
        },
        then: 'Apoi',
        startingDate: 'începând cu {date}',
        freeUntil: 'Gratuit până la {date}',
      },
    },
    pwywForm: {
      label: 'Stabiliți un preț corect',
      minimum: 'minim {amount}',
      amountMinimum: 'Suma trebuie să fie de cel puțin {min}',
      amountFreeOrMinimum: 'Suma trebuie să fie {zero} sau de cel puțin {min}',
    },
    productSwitcher: {
      billedRecurring: 'Facturat {frequency}',
      oneTimePurchase: 'Achiziție unică',
      fromPrefix: 'De la',
    },
    productDescription: {
      readMore: 'Citiți mai mult',
    },
    benefits: {
      granting: 'Se acordă beneficiile...',
      requestNewInvite: 'Solicitați o nouă invitație',
      retryIn: {
        '=1': 'Încercați din nou peste # secundă',
        other: 'Încercați din nou peste # de secunde',
        few: 'Încercați din nou peste # secunde',
        _mode: 'plural',
      },
      connectNewAccount: 'Conectați un cont nou',
      requestMyInvite: 'Solicitați invitația mea',
      github: {
        connect: 'Conectați contul GitHub',
        goTo: 'Mergeți la {repository}',
        selectAccount: 'Selectați un cont GitHub',
      },
      discord: {
        connect: 'Conectați contul Discord',
        open: 'Deschideți Discord',
        selectAccount: 'Selectați un cont Discord',
      },
      slackSharedChannel: {
        connected: 'Conectat la spațiul de lucru Slack.',
        connectedChannel:
          'Conectat la spațiul de lucru Slack, în canalul {channel}.',
        inviteSent: 'Invitație trimisă la {email}.',
        channel: 'Canal: {channel}.',
        openLinkToAccept: 'Deschideți linkul pentru a accepta în Slack.',
        acceptFromEmail:
          'Acceptați din e-mailul de invitație sau din solicitările Slack Connect.',
        openInvite: 'Deschideți invitația Slack',
        provisioning:
          'Se configurează canalul Slack pentru {email}... Ar trebui să primiți în curând o invitație în căsuța de e-mail.',
        setupFailed:
          'Nu am putut configura canalul Slack cu {email}. Verificați adresa de e-mail și încercați din nou sau contactați vânzătorul dacă problema persistă.',
        enterEmail:
          'Introduceți e-mailul unui administrator din spațiul dvs. de lucru Slack. Acesta va primi o invitație Slack Connect pentru un canal privat.',
        emailPlaceholder: 'slack-admin@yourcompany.com',
        tryAgain: 'Încercați din nou',
        requestInvite: 'Solicitați invitația Slack',
      },
      licenseKey: {
        copy: 'Copiați',
        copiedToClipboard: 'Copiat în clipboard',
        copiedToClipboardDescription:
          'Cheia de licență a fost copiată în clipboard',
        loading: 'Se încarcă...',
        status: 'Stare',
        statusGranted: 'Acordată',
        statusRevoked: 'Revocată',
        statusDisabled: 'Dezactivată',
        usage: 'Utilizare',
        validations: 'Validări',
        validatedAt: 'Validată la',
        neverValidated: 'Niciodată validată',
        expiryDate: 'Data expirării',
        noExpiry: 'Fără expirare',
        activations: 'Activări',
        activationDeleted: 'Activarea cheii de licență a fost ștearsă',
        activationDeletedDescription: 'Activarea a fost ștearsă cu succes',
        activationDeactivationFailed: 'Dezactivarea activării a eșuat',
      },
    },
    confirmation: {
      confirmPayment: 'Confirmați plata',
      processingTitle: 'Comanda dvs. este în curs de procesare',
      successTitle: 'Vă mulțumim pentru comandă!',
      failedTitle: 'A apărut o problemă la procesarea comenzii dvs.',
      processingDescription: 'Vă rugăm așteptați cât confirmăm plata.',
      successDescription: 'Acum aveți acces la {product}.',
      failedDescription:
        'Vă rugăm încercați din nou sau contactați serviciul de asistență.',
    },
    loading: {
      processingOrder: 'Se procesează comanda...',
      processingPayment: 'Se procesează plata',
      paymentSuccessful: 'Plată reușită! Se pregătesc produsele dvs...',
      confirmationTokenFailed:
        'Nu s-a putut crea tokenul de confirmare, încercați din nou mai târziu.',
      paymentNotCompleted:
        'Plata nu a fost finalizată. Vă rugăm încercați din nou.',
      paymentFormNotLoaded:
        'Formularul de plată nu s-a încărcat. Reîmprospătați pagina și încercați din nou.',
    },
    cta: {
      startTrial: 'Începeți proba',
      subscribeNow: 'Abonați-vă acum',
      payNow: 'Plătiți acum',
      getFree: 'Obțineți gratuit',
      paymentsUnavailable: 'Plățile nu sunt disponibile momentan',
    },
    trialUnavailable: {
      title: 'Nicio perioadă de probă gratuită pentru această achiziție',
      description:
        'Ați folosit deja o perioadă de probă gratuită pentru acest produs, așa că vi se va factura astăzi. Continuați mai jos pentru a finaliza achiziția.',
    },
  },
  intervals: {
    short: {
      day: {
        '=1': 'zi',
        other: '# de zile',
        few: '# zile',
        _mode: 'plural',
      },
      week: {
        '=1': 'săpt.',
        other: '# săpt.',
        _mode: 'plural',
      },
      month: {
        '=1': 'lună',
        other: '# de luni',
        few: '# luni',
        _mode: 'plural',
      },
      year: {
        '=1': 'an',
        other: '# de ani',
        few: '# ani',
        _mode: 'plural',
      },
    },
  },
  benefitTypes: {
    license_keys: 'Chei de licență',
    github_repository: 'Acces la depozitul GitHub',
    discord: 'Invitație Discord',
    downloadables: 'Descărcări de fișiere',
    custom: 'Personalizat',
    meter_credit: 'Credite de consum',
    feature_flag: 'Feature flag',
    slack_shared_channel: 'Canal Slack partajat',
  },
  ordinal: {
    zero: '',
    one: '-lea',
    two: '-lea',
    few: '-lea',
    many: '',
    other: '-lea',
  },
  embedPaymentMethod: {
    title: 'Adăugați metoda de plată',
    close: 'Închideți',
    submit: 'Adăugați metoda de plată',
    processing: 'Se adaugă metoda de plată…',
    fallbackError: 'A apărut o eroare. Vă rugăm încercați din nou.',
    errors: {
      invalidRequest: 'Parametri obligatorii lipsă.',
      unauthorized: 'Sesiunea a expirat.',
      processingFailed:
        'Metoda de plată nu a putut fi procesată. Vă rugăm încercați din nou.',
      unknown: 'A apărut o eroare.',
    },
  },
} as const
