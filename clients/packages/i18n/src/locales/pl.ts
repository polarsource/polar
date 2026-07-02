export default {
  checkout: {
    footer: {
      poweredBy: 'Obsługiwane przez',
      merchantOfRecord:
        'To zamówienie jest przetwarzane przez naszego sprzedawcę formalnego (Merchant of Record), firmę Polar, która zajmuje się również obsługą zapytań dotyczących zamówień i zwrotów.',
      mandateSubscriptionTrial:
        'Klikając „{buttonLabel}," upoważniasz Polar Software, Inc., naszego sprzedawcę internetowego i podmiot rozliczający, do obciążenia wybranej metody płatności kwotą pokazana powyżej po zakończeniu okresu próbnego oraz w każdym kolejnym dniu rozliczeniowym, aż do anulowania, oraz zgadzasz się na warunki {buyerTermsLink}. Możesz anulować w dowolnym momencie przed końcem okresu próbnego, aby uniknąć obciążenia.',
      mandateSubscription:
        'Klikając „{buttonLabel}," upoważniasz Polar Software, Inc., naszego sprzedawcę internetowego i podmiot rozliczający, do natychmiastowego obciążenia wybranej metody płatności kwotą pokazana powyżej oraz do obciążania tą samą kwotą w każdym kolejnym dniu rozliczeniowym, aż do anulowania, oraz zgadzasz się na warunki {buyerTermsLink}.',
      mandateOneTime:
        'Klikając „{buttonLabel}," upoważniasz Polar Software, Inc., naszego sprzedawcę internetowego i podmiot rozliczający, do obciążenia wybranej metody płatności kwotą pokazana powyżej oraz zgadzasz się na warunki {buyerTermsLink}. Jest to jednorazowa opłata.',
      buyerTermsLink: 'Warunki zakupu',
    },
    form: {
      email: 'E-mail',
      cardholderName: 'Imię i nazwisko posiadacza karty',
      purchasingAsBusiness: 'Kupuję jako firma',
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
      addDiscountCode: 'Dodaj kod rabatowy',
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
      discount: {
        until: 'Do {date}',
      },
      perSeat: 'za stanowisko',
      seats: {
        label: 'Stanowiska',
        numberOfSeats: 'Liczba stanowisk',
        count: {
          '=1': '# stanowisko',
          other: '# stanowisk',
          _mode: 'plural',
        },
        range: '{min} - {max} stanowisk',
        minimum: 'Minimum {min} stanowisk',
        maximum: 'Maksimum {max} stanowisk',
        updateFailed: 'Nie udało się zaktualizować liczby stanowisk',
        included: {
          '=1': 'Jedno miejsce w cenie',
          other: '# miejsc w cenie',
          _mode: 'plural',
        },
      },
      inclTax: 'Podatki (w cenie)',
      basePrice: 'Cena bazowa',
    },
    trial: {
      hero: {
        free: {
          day: {
            '=1': '# dzień gratis',
            other: '# dni gratis',
            _mode: 'plural',
          },
          month: {
            '=1': '# miesiąc gratis',
            other: '# miesięcy gratis',
            _mode: 'plural',
          },
          year: {
            '=1': '# rok gratis',
            other: '# lat gratis',
            _mode: 'plural',
          },
        },
        intervalSuffix: {
          day: '/dzień',
          week: '/tydzień',
          month: '/miesiąc',
          year: '/rok',
        },
        then: 'Następnie',
        startingDate: 'od {date}',
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
      fromPrefix: 'Od',
    },
    benefits: {
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
      slackSharedChannel: {
        connected: 'Połączono z Twoim obszarem roboczym Slack.',
        connectedChannel:
          'Połączono z Twoim obszarem roboczym Slack w kanale {channel}.',
        inviteSent: 'Zaproszenie wysłane na {email}.',
        channel: 'Kanał: {channel}.',
        openLinkToAccept: 'Otwórz link, aby zaakceptować w Slacku.',
        acceptFromEmail:
          'Zaakceptuj w e-mailu z zaproszeniem albo w prośbach Slack Connect.',
        openInvite: 'Otwórz zaproszenie Slack',
        provisioning:
          'Konfigurujemy Twój kanał Slack dla {email}... Wkrótce powinieneś otrzymać zaproszenie na skrzynkę odbiorczą.',
        setupFailed:
          'Nie udało się skonfigurować kanału Slack dla {email}. Sprawdź adres e-mail i spróbuj ponownie, albo skontaktuj się ze sprzedawcą, jeśli problem nadal występuje.',
        enterEmail:
          'Wprowadź adres e-mail administratora w swoim obszarze roboczym Slack. Otrzyma on zaproszenie Slack Connect do prywatnego kanału.',
        emailPlaceholder: 'slack-admin@yourcompany.com',
        tryAgain: 'Spróbuj ponownie',
        requestInvite: 'Poproś o zaproszenie Slack',
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
    productDescription: {
      readMore: 'Czytaj więcej',
    },
  },
  intervals: {
    short: {
      day: 'dz.',
      week: 'tyg.',
      month: 'mies.',
      year: 'r.',
    },
    shortCount: {
      day: {
        _mode: 'plural',
        '=1': '# dz.',
        other: '# dz.',
      },
      week: {
        _mode: 'plural',
        '=1': '# tyg.',
        other: '# tyg.',
      },
      month: {
        _mode: 'plural',
        '=1': '# mies.',
        other: '# mies.',
      },
      year: {
        _mode: 'plural',
        '=1': '# r.',
        other: '# l.',
      },
    },
  },
  benefitTypes: {
    custom: 'Niestandardowe',
    license_keys: 'Klucze licencyjne',
    github_repository: 'Dostęp do repozytorium GitHub',
    discord: 'Zaproszenie na Discord',
    downloadables: 'Pliki do pobrania',
    meter_credit: 'Kredyty',
    feature_flag: 'Flaga funkcji',
    slack_shared_channel: 'Wspólny kanał Slack',
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
    title: 'Dodaj metodę płatności',
    close: 'Zamknij',
    submit: 'Dodaj metodę płatności',
    processing: 'Dodawanie metody płatności…',
    fallbackError: 'Coś poszło nie tak. Spróbuj ponownie.',
    errors: {
      invalidRequest: 'Brak wymaganych parametrów.',
      unauthorized: 'Sesja wygasła.',
      processingFailed:
        'Nie udało się przetworzyć metody płatności. Spróbuj ponownie.',
      unknown: 'Coś poszło nie tak.',
    },
  },
} as const
