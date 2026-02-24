export default {
  checkout: {
    footer: {
      poweredBy: 'Obsługiwane przez',
      merchantOfRecord:
        'To zamówienie jest przetwarzane przez naszego sprzedawcę formalnego (Merchant of Record), firmę Polar, która zajmuje się również obsługą zapytań dotyczących zamówień i zwrotów.',
      mandateSubscriptionTrial:
        'Klikając „{buttonLabel}”, upoważniasz Polar Software, Inc., naszego sprzedawcę formalnego, do obciążenia wybranej metody płatności kwotą wskazaną powyżej po zakończeniu okresu próbnego oraz w każdym kolejnym terminie płatności, aż do momentu anulowania. Możesz anulować subskrypcję w dowolnym momencie przed końcem okresu próbnego, aby uniknąć opłat.',
      mandateSubscription:
        'Klikając „{buttonLabel}”, upoważniasz Polar Software, Inc., naszego sprzedawcę formalnego, do natychmiastowego obciążenia wybranej metody płatności kwotą wskazaną powyżej oraz do pobierania tej samej kwoty w każdym kolejnym terminie płatności, aż do momentu anulowania.',
      mandateOneTime:
        'Klikając „{buttonLabel}”, upoważniasz Polar Software, Inc., naszego sprzedawcę formalnego, do obciążenia wybranej metody płatności kwotą wskazaną powyżej. Jest to opłata jednorazowa.',
    },
    form: {
      email: 'E-mail',
      cardholderName: 'Imię i nazwisko posiadacza karty',
      purchasingAsBusiness: 'Kupuję jako firma',
      addBusinessDetails: 'Dodaj dane firmy',
      removeBusinessDetails: 'Usuń dane firmy',
      businessName: 'Nazwa firmy',
      billingDetails: 'Dane do faktury',
      billingAddress: {
        label: 'Adres rozliczeniowy',
        line1: 'Ulica i numer',
        line2: 'Nr lokalu / apartamentu',
        postalCode: 'Kod pocztowy',
        city: 'Miejscowość',
        country: 'Kraj',
        state: 'Stan',
        province: 'Prowincja',
        stateProvince: 'Stan / Województwo',
      },
      taxId: 'NIP / VAT ID',
      discountCode: 'Kod rabatowy',
      optional: 'Opcjonalnie',
      apply: 'Zastosuj',
      fieldRequired: 'To pole jest wymagane',
    },
    pricing: {
      subtotal: 'Suma częściowa',
      taxableAmount: 'Kwota netto',
      taxes: 'Podatek',
      free: 'Bezpłatnie',
      payWhatYouWant: 'Zapłać ile chcesz',
      total: 'Razem',
      everyInterval: {
        day: {
          '=1': 'Codziennie',
          '=2': 'Co drugi dzień',
          other: 'Co # dni',
          _mode: 'plural',
        },
        week: {
          '=1': 'Co tydzień',
          '=2': 'Co dwa tygodnie',
          other: 'Co # tygodni',
          _mode: 'plural',
        },
        month: {
          '=1': 'Co miesiąc',
          '=2': 'Co drugi miesiąc',
          other: 'Co # miesięcy',
          _mode: 'plural',
        },
        year: {
          '=1': 'Co rok',
          '=2': 'Co dwa lata',
          other: 'Co # lat',
          _mode: 'plural',
        },
      },
      additionalMeteredUsage: 'Dodatkowe opłaty wg zużycia',
      perUnit: '/ jednostka',
      discount: {
        duration: {
          months: {
            '=1': 'przez pierwszy miesiąc',
            other: 'przez pierwsze # miesięcy',
            _mode: 'plural',
          },
          years: {
            '=1': 'przez pierwszy rok',
            other: 'przez pierwsze # lat',
            _mode: 'plural',
          },
        },
      },
    },
    trial: {
      ends: 'Okres próbny kończy się {endDate}',
      duration: {
        days: {
          '=1': '#-dniowy okres próbny',
          other: '#-dniowy okres próbny',
          _mode: 'plural',
        },
        weeks: {
          '=1': '#-tygodniowy okres próbny',
          other: '#-tygodniowy okres próbny',
          _mode: 'plural',
        },
        months: {
          '=1': '#-miesięczny okres próbny',
          other: '#-miesięczny okres próbny',
          _mode: 'plural',
        },
        years: {
          '=1': '#-letni okres próbny',
          other: '#-letni okres próbny',
          _mode: 'plural',
        },
      },
    },
    pwywForm: {
      label: 'Zaproponuj uczciwą cenę',
      minimum: 'minimum {amount}',
      amountMinimum: 'Kwota musi wynosić co najmniej {min}',
      amountFreeOrMinimum: 'Kwota musi wynosić {zero} lub co najmniej {min}',
    },
    productSwitcher: {
      billedRecurring: 'Rozliczenie: {frequency}',
      oneTimePurchase: 'Płatność jednorazowa',
    },
    card: {
      included: 'W cenie',
    },
    benefits: {
      moreBenefits: {
        '=1': 'Jeszcze # korzyść',
        other: 'Jeszcze # korzyści',
        _mode: 'plural',
      },
      showMoreBenefits: {
        '=1': 'Pokaż # więcej',
        other: 'Pokaż # więcej',
        _mode: 'plural',
      },
      showLess: 'Pokaż mniej',
      granting: 'Przyznawanie dostępu...',
      requestNewInvite: 'Poproś o nowe zaproszenie',
      retryIn: {
        '=1': 'Spróbuj ponownie za # sekundę',
        other: 'Spróbuj ponownie za # sekund',
        _mode: 'plural',
      },
      connectNewAccount: 'Połącz nowe konto',
      requestMyInvite: 'Poproś o moje zaproszenie',
      github: {
        connect: 'Połącz konto GitHub',
        goTo: 'Przejdź do {repository}',
        selectAccount: 'Wybierz konto GitHub',
      },
      discord: {
        connect: 'Połącz konto Discord',
        open: 'Otwórz Discord',
        selectAccount: 'Wybierz konto Discord',
      },
      licenseKey: {
        copy: 'Kopiuj',
        copiedToClipboard: 'Skopiowano do schowka',
        copiedToClipboardDescription:
          'Klucz licencyjny został skopiowany do schowka',
        loading: 'Ładowanie...',
        status: 'Status',
        statusGranted: 'Przyznano',
        statusRevoked: 'Odebrano',
        statusDisabled: 'Wyłączono',
        usage: 'Użycie',
        validations: 'Walidacje',
        validatedAt: 'Data walidacji',
        neverValidated: 'Nigdy nie walidowano',
        expiryDate: 'Data ważności',
        noExpiry: 'Bezterminowo',
        activations: 'Aktywacje',
        activationDeleted: 'Usunięto aktywację klucza',
        activationDeletedDescription: 'Aktywacja została pomyślnie usunięta',
        activationDeactivationFailed: 'Dezaktywacja nie powiodła się',
      },
    },
    confirmation: {
      confirmPayment: 'Potwierdź płatność',
      processingTitle: 'Przetwarzamy Twoje zamówienie',
      successTitle: 'Zamówienie zrealizowane pomyślnie!',
      failedTitle: 'Wystąpił problem podczas przetwarzania zamówienia',
      processingDescription:
        'Prosimy o chwilę cierpliwości, trwa potwierdzanie płatności.',
      successDescription: 'Możesz teraz korzystać z korzyści dla: {product}.',
      failedDescription:
        'Spróbuj ponownie lub skontaktuj się z pomocą techniczną.',
    },
    loading: {
      processingOrder: 'Przetwarzanie zamówienia...',
      processingPayment: 'Przetwarzanie płatności',
      paymentSuccessful: 'Płatność udana! Przygotowujemy Twoje produkty...',
      confirmationTokenFailed:
        'Nie udało się utworzyć tokena potwierdzenia, spróbuj ponownie później.',
    },
    cta: {
      startTrial: 'Rozpocznij okres próbny',
      subscribeNow: 'Subskrybuj',
      payNow: 'Zapłać teraz',
      getFree: 'Odbierz za darmo',
      paymentsUnavailable: 'Płatności są obecnie niedostępne',
    },
  },
  intervals: {
    short: {
      day: 'dz.',
      week: 'tyg.',
      month: 'mies.',
      year: 'r.',
    },
  },
  benefitTypes: {
    license_keys: 'Klucze licencyjne',
    github_repository: 'Dostęp do repozytorium GitHub',
    discord: 'Zaproszenie na Discord',
    downloadables: 'Pliki do pobrania',
    custom: 'Niestandardowe',
    meter_credit: 'Kredyty użycia',
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
