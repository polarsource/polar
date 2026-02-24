export default {
  checkout: {
    footer: {
      poweredBy: 'Működteti',
      merchantOfRecord:
        'Ezt a megrendelést online viszonteladónk és hivatalos kereskedőnk, a Polar dolgozza fel, aki a megrendeléssel kapcsolatos kérdéseket és visszaküldéseket is kezeli.',
      mandateSubscriptionTrial:
        'A(z) „{buttonLabel}” gombra kattintva Ön felhatalmazza a Polar Software, Inc.-et, online viszonteladónkat és hivatalos kereskedőnket, hogy a próbaidőszak végén, majd azt követően minden számlázási napon megterhelje a kiválasztott fizetési módot a fent feltüntetett összeggel, amíg le nem mondja az előfizetést. A terhelés elkerülése érdekében a próbaidőszak vége előtt bármikor lemondhatja a szolgáltatást.',
      mandateSubscription:
        'A(z) „{buttonLabel}” gombra kattintva Ön felhatalmazza a Polar Software, Inc.-et, online viszonteladónkat és hivatalos kereskedőnket, hogy azonnal megterhelje a kiválasztott fizetési módot a fent feltüntetett összeggel, majd ezt követően minden számlázási napon levonja ugyanezt az összeget, amíg le nem mondja az előfizetést.',
      mandateOneTime:
        'A(z) „{buttonLabel}” gombra kattintva Ön felhatalmazza a Polar Software, Inc.-et, online viszonteladónkat és hivatalos kereskedőnket, hogy megterhelje a kiválasztott fizetési módot a fent feltüntetett összeggel. Ez egy egyszeri terhelés.',
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
      addBusinessDetails: 'Céges adatok hozzáadása',
      removeBusinessDetails: 'Céges adatok eltávolítása',
      billingDetails: 'Cégadatok',
    },
    pricing: {
      subtotal: 'Részösszeg',
      taxableAmount: 'Adóköteles összeg',
      taxes: 'Adók',
      free: 'Ingyenes',
      payWhatYouWant: 'Választható ár',
      total: 'Végösszeg',
      additionalMeteredUsage: 'További mért használat',
      perUnit: '/ egység',
      discount: {
        duration: {
          months: {
            '=1': 'az első hónapra',
            other: 'az első # hónapra',
            _mode: 'plural',
          },
          years: {
            '=1': 'az első évre',
            other: 'az első # évre',
            _mode: 'plural',
          },
        },
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
    },
    trial: {
      ends: 'A próbaidőszak ekkor jár le: {endDate}',
      duration: {
        days: {
          '=1': '# napos próbaidőszak',
          other: '# napos próbaidőszak',
          _mode: 'plural',
        },
        weeks: {
          '=1': '# hetes próbaidőszak',
          other: '# hetes próbaidőszak',
          _mode: 'plural',
        },
        months: {
          '=1': '# hónapos próbaidőszak',
          other: '# hónapos próbaidőszak',
          _mode: 'plural',
        },
        years: {
          '=1': '# éves próbaidőszak',
          other: '# éves próbaidőszak',
          _mode: 'plural',
        },
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
    },
    card: {
      included: 'Tartalmazza',
    },
    benefits: {
      moreBenefits: {
        '=1': '# további előny',
        other: '# további előny',
        _mode: 'plural',
      },
      showMoreBenefits: {
        '=1': 'Mutasson # további előnyt',
        other: 'Mutasson # további előnyt',
        _mode: 'plural',
      },
      showLess: 'Kevesebb megjelenítése',
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
    },
    confirmation: {
      confirmPayment: 'Fizetés megerősítése',
      processingTitle: 'Rendelését feldolgozzuk',
      successTitle: 'Rendelése sikeres volt!',
      failedTitle: 'Probléma merült fel a rendelés feldolgozása során',
      processingDescription: 'Kérjük, várjon, amíg megerősítjük a fizetését.',
      successDescription: 'Mostantól jogosult a {product} előnyeire.',
      failedDescription:
        'Kérjük, próbálja újra, vagy lépjen kapcsolatba az ügyfélszolgálattal.',
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
      readLess: 'Kevesebb',
    },
  },
  intervals: {
    short: {
      day: 'nap',
      week: 'hét',
      month: 'hó',
      year: 'év',
    },
  },
  benefitTypes: {
    license_keys: 'Licenckulcsok',
    github_repository: 'GitHub tároló hozzáférés',
    discord: 'Discord meghívó',
    downloadables: 'Fájlletöltések',
    custom: 'Egyedi',
    meter_credit: 'Használat alapú kreditek',
  },
  ordinal: {
    zero: '.',
    one: '.',
    two: '.',
    few: '.',
    many: '.',
    other: '.',
  },
} as const
