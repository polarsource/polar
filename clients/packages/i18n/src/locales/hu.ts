export default {
  checkout: {
    footer: {
      poweredBy: 'Működteti',
      merchantOfRecord:
        'Ezt a megrendelést online viszonteladónk és hivatalos kereskedőnk, a Polar dolgozza fel, aki a megrendeléssel kapcsolatos kérdéseket és visszaküldéseket is kezeli.',
      mandateSubscriptionTrial:
        'A(z) „{buttonLabel}” gombra kattintva felhatalmazza a Polar Software, Inc.-t, online viszonteladónkat és bejegyzett kereskedőnket, hogy a kiválasztott fizetési módot a próbaidőszak végén, majd minden további számlázási napon megterhelje a fent látható összeggel, amíg le nem mondja az előfizetést, valamint elfogadja a(z) {buyerTermsLink} rendelkezéseit. A terhelés elkerülése érdekében a próbaidőszak vége előtt bármikor lemondhatja az előfizetést.',
      mandateSubscription:
        'A(z) „{buttonLabel}” gombra kattintva felhatalmazza a Polar Software, Inc.-t, online viszonteladónkat és bejegyzett kereskedőnket, hogy a kiválasztott fizetési módot azonnal megterhelje a fent látható összeggel, majd ugyanezt az összeget minden további számlázási napon felszámítsa, amíg le nem mondja az előfizetést, valamint elfogadja a(z) {buyerTermsLink} rendelkezéseit.',
      buyerTermsLink: 'Vásárlási feltételek',
      mandateOneTime:
        'A(z) „{buttonLabel}” gombra kattintva felhatalmazza a Polar Software, Inc.-t, online viszonteladónkat és hivatalos kereskedőnket, hogy a kiválasztott fizetési módot megterhelje a fent látható összeggel, valamint elfogadja a(z) {buyerTermsLink} rendelkezéseit. Ez egy egyszeri terhelés.',
    },
    form: {
      email: 'E-mail cím',
      cardholderName: 'Kártyabirtokos neve',
      purchasingAsBusiness: 'Vállalkozásként vásárolok',
      businessName: 'Cégnév',
      billingAddress: {
        label: 'Számlázási cím',
        line1: 'Utca, házszám',
        line2: 'Emelet, ajtó / Lakás',
        postalCode: 'Irányítószám',
        city: 'Város',
        country: 'Ország',
        state: 'Állam',
        province: 'Tartomány',
        stateProvince: 'Állam / Tartomány',
      },
      taxId: 'Adószám',
      discountCode: 'Kedvezménykód',
      optional: 'Opcionális',
      apply: 'Alkalmaz',
      fieldRequired: 'Ez a mező kötelező',
      billingDetails: 'Cégadatok',
      addDiscountCode: 'Kedvezménykód hozzáadása',
    },
    pricing: {
      subtotal: 'Részösszeg',
      taxableAmount: 'Adóköteles összeg',
      taxes: 'Adók',
      free: 'Ingyenes',
      payWhatYouWant: 'Választható ár',
      total: 'Végösszeg',
      additionalMeteredUsage: 'További mért használat',
      discount: {
        until: '{date}-ig',
      },
      everyInterval: {
        day: {
          '=1': 'Naponta',
          other: 'Minden # nap',
          '=2': 'Kétnaponta',
          _mode: 'plural',
        },
        week: {
          '=1': 'Hetente',
          other: 'Minden # hét',
          '=2': 'Kéthetente',
          _mode: 'plural',
        },
        month: {
          '=1': 'Havonta',
          other: 'Minden # hónap',
          '=2': 'Kéthavonta',
          _mode: 'plural',
        },
        year: {
          '=1': 'Évente',
          other: 'Minden # év',
          '=2': 'Kétévente',
          _mode: 'plural',
        },
      },
      perSeat: 'felhasználónként',
      seats: {
        label: 'Felhasználói helyek',
        numberOfSeats: 'Felhasználói helyek száma',
        count: {
          '=1': '# felhasználói hely',
          other: '# felhasználói hely',
          _mode: 'plural',
        },
        range: '{min} - {max} felhasználói hely',
        minimum: 'Legalább {min} felhasználói hely',
        maximum: 'Legfeljebb {max} felhasználói hely',
        updateFailed: 'A felhasználói helyek frissítése nem sikerült',
        included: {
          '=1': '1 felhasználói hely benne van',
          other: '# felhasználói hely benne van',
          _mode: 'plural',
        },
      },
      inclTax: 'ÁFA (tartalmazza)',
      basePrice: 'Alapár',
    },
    trial: {
      hero: {
        free: {
          day: {
            '=1': '# nap ingyen',
            other: '# nap ingyen',
            _mode: 'plural',
          },
          month: {
            '=1': '# hónap ingyen',
            other: '# hónap ingyen',
            _mode: 'plural',
          },
          year: {
            '=1': '# év ingyen',
            other: '# év ingyen',
            _mode: 'plural',
          },
        },
        intervalSuffix: {
          day: '/nap',
          week: '/hét',
          month: '/hó',
          year: '/év',
        },
        then: 'Ezután',
        startingDate: 'kezdés: {date}',
      },
    },
    pwywForm: {
      label: 'Adjon meg egy méltányos árat',
      minimum: 'Minimum {amount}',
      amountMinimum: 'Az összegnek legalább {min} kell lennie',
      amountFreeOrMinimum: 'Az összeg legyen {zero} vagy legalább {min}',
    },
    productSwitcher: {
      billedRecurring: '{frequency} számlázva',
      oneTimePurchase: 'Egyszeri vásárlás',
      fromPrefix: 'Kezdőár',
    },
    benefits: {
      granting: 'Előnyök biztosítása...',
      requestNewInvite: 'Új meghívó kérése',
      retryIn: {
        '=1': 'Próbálja újra # másodperc múlva',
        other: 'Próbálja újra # másodperc múlva',
        _mode: 'plural',
      },
      connectNewAccount: 'Új fiók csatlakoztatása',
      requestMyInvite: 'Meghívóm kérése',
      github: {
        connect: 'GitHub fiók csatlakoztatása',
        goTo: 'Ugrás a {repository} oldalra',
        selectAccount: 'Válasszon GitHub fiókot',
      },
      discord: {
        connect: 'Discord fiók csatlakoztatása',
        open: 'Discord megnyitása',
        selectAccount: 'Válasszon Discord fiókot',
      },
      licenseKey: {
        copy: 'Másolás',
        copiedToClipboard: 'Vágólapra másolva',
        copiedToClipboardDescription: 'A licenckulcs a vágólapra másolva',
        loading: 'Betöltés...',
        status: 'Állapot',
        statusGranted: 'Engedélyezve',
        statusRevoked: 'Visszavonva',
        statusDisabled: 'Letiltva',
        usage: 'Használat',
        validations: 'Érvényesítések',
        validatedAt: 'Érvényesítve ekkor',
        neverValidated: 'Soha nem érvényesítve',
        expiryDate: 'Lejárati dátum',
        noExpiry: 'Nincs lejárati dátum',
        activations: 'Aktiválások',
        activationDeleted: 'Licenckulcs aktiválás törölve',
        activationDeletedDescription: 'Aktiválás sikeresen törölve',
        activationDeactivationFailed: 'Aktiválás deaktiválása sikertelen',
      },
      slackSharedChannel: {
        connected: 'Csatlakoztatva a Slack munkaterületedhez.',
        connectedChannel:
          'Csatlakoztatva a Slack munkaterületedhez a(z) {channel} csatornán.',
        inviteSent: 'Meghívó elküldve ide: {email}.',
        channel: 'Csatorna: {channel}.',
        openLinkToAccept: 'Nyisd meg a linket az elfogadáshoz a Slackben.',
        acceptFromEmail:
          'Fogadd el a meghívó e-mailből vagy a Slack Connect-kérésekből.',
        openInvite: 'Slack-meghívó megnyitása',
        provisioning:
          'Slack csatorna beállítása erre: {email}... Hamarosan kapsz egy meghívót a postaládádba.',
        setupFailed:
          'Nem sikerült beállítani a Slack csatornát ehhez: {email}. Ellenőrizd az e-mail címet, és próbáld újra, vagy ha továbbra sem sikerül, vedd fel a kapcsolatot az eladóval.',
        enterEmail:
          'Add meg a Slack munkaterületed egyik adminjának e-mail címét. Ők kapnak egy Slack Connect-meghívót egy privát csatornához.',
        emailPlaceholder: 'slack-admin@yourcompany.com',
        tryAgain: 'Próbáld újra',
        requestInvite: 'Slack-meghívó kérése',
      },
    },
    confirmation: {
      confirmPayment: 'Fizetés megerősítése',
      processingTitle: 'Rendelését feldolgozzuk',
      failedTitle: 'Probléma merült fel a rendelés feldolgozása során',
      processingDescription: 'Kérjük, várjon, amíg megerősítjük a fizetését.',
      failedDescription:
        'Kérjük, próbálja újra, vagy lépjen kapcsolatba az ügyfélszolgálattal.',
      successTitle: 'Köszönjük a megrendelését!',
      successDescription: 'Mostantól hozzáférése van ehhez: {product}.',
    },
    loading: {
      processingOrder: 'Rendelés feldolgozása...',
      processingPayment: 'Fizetés feldolgozása',
      paymentSuccessful: 'Fizetés sikeres! Készítjük termékeit...',
      confirmationTokenFailed:
        'Nem sikerült megerősítő tokent létrehozni, kérjük, próbálja újra később.',
    },
    cta: {
      startTrial: 'Próbaidőszak indítása',
      subscribeNow: 'Feliratkozás most',
      payNow: 'Fizetés most',
      getFree: 'Ingyen megkapom',
      paymentsUnavailable: 'A fizetések jelenleg nem elérhetők',
    },
    productDescription: {
      readMore: 'Bővebben',
    },
  },
  intervals: {
    short: {
      day: 'nap',
      week: 'hét',
      month: 'hó',
      year: 'év',
    },
    shortCount: {
      day: {
        _mode: 'plural',
        '=1': '# nap',
        other: '# nap',
      },
      week: {
        _mode: 'plural',
        '=1': '# hét',
        other: '# hét',
      },
      month: {
        _mode: 'plural',
        '=1': '# hó',
        other: '# hó',
      },
      year: {
        _mode: 'plural',
        '=1': '# év',
        other: '# év',
      },
    },
  },
  benefitTypes: {
    custom: 'Egyedi',
    license_keys: 'Licenckulcsok',
    github_repository: 'GitHub repository hozzáférés',
    discord: 'Discord meghívó',
    downloadables: 'Fájlletöltések',
    meter_credit: 'Használat alapú kreditek',
    feature_flag: 'Feature flag',
    slack_shared_channel: 'Megosztott Slack-csatorna',
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
    title: 'Fizetési mód hozzáadása',
    close: 'Bezárás',
    submit: 'Fizetési mód hozzáadása',
    processing: 'Fizetési mód hozzáadása…',
    fallbackError: 'Valami hiba történt. Próbálja újra.',
    errors: {
      invalidRequest: 'Hiányzó kötelező paraméterek.',
      unauthorized: 'A munkamenet lejárt.',
      processingFailed:
        'A fizetési módot nem sikerült feldolgozni. Próbálja újra.',
      unknown: 'Valami hiba történt.',
    },
  },
} as const
