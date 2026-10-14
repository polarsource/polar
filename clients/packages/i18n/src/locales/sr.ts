export default {
  checkout: {
    footer: {
      poweredBy: 'Omogućava',
      merchantOfRecord:
        'Ovu porudžbinu obrađuje naš onlajn prodavac i Merchant of Record, Polar, koji se takođe bavi upitima u vezi sa porudžbinom i povraćajima.',
      mandateSubscriptionTrial:
        'Klikom na „{buttonLabel},” ovlašćujete kompaniju Polar Software, Inc., našeg onlajn prodavca i Merchant of Record, da na kraju probnog perioda i na svaki naredni datum naplate naplati izabrani način plaćanja u iznosu prikazanom iznad, sve dok ne otkažete, i saglasni ste sa {buyerTermsLink}. Možete otkazati u bilo kom trenutku pre kraja probnog perioda kako ne biste bili naplaćeni.',
      mandateSubscription:
        'Klikom na „{buttonLabel},” ovlašćujete kompaniju Polar Software, Inc., našeg onlajn prodavca i Merchant of Record, da odmah naplati izabrani način plaćanja u iznosu prikazanom iznad i da naplati isti iznos na svaki naredni datum naplate, sve dok ne otkažete, i saglasni ste sa {buyerTermsLink}.',
      mandateOneTime:
        'Klikom na „{buttonLabel},” ovlašćujete kompaniju Polar Software, Inc., našeg onlajn prodavca i Merchant of Record, da naplati izabrani način plaćanja u iznosu prikazanom iznad, i saglasni ste sa {buyerTermsLink}. Ovo je jednokratna naplata.',
      mandateSubscriptionTrialDiscounted:
        'Klikom na „{buttonLabel},” ovlašćujete kompaniju Polar Software, Inc., našeg onlajn prodavca i Merchant of Record, da na kraju probnog perioda naplati izabrani način plaćanja sniženi iznos prikazan iznad, a na svaki naredni datum naplate nakon isteka popusta redovnu cenu, sve dok ne otkažete, i saglasni ste sa {buyerTermsLink}. Možete otkazati u bilo kom trenutku pre kraja probnog perioda kako ne biste bili naplaćeni.',
      mandateSubscriptionDiscounted:
        'Klikom na „{buttonLabel},” ovlašćujete kompaniju Polar Software, Inc., našeg onlajn prodavca i Merchant of Record, da odmah naplati izabrani način plaćanja sniženi iznos prikazan iznad, a na svaki naredni datum naplate nakon isteka popusta redovnu cenu, sve dok ne otkažete, i saglasni ste sa {buyerTermsLink}.',
      buyerTermsLink: 'Uslovi za kupce',
    },
    form: {
      email: 'E-pošta',
      cardholderName: 'Ime vlasnika kartice',
      purchasingAsBusiness: 'Kupujem kao poslovni subjekt',
      businessName: 'Naziv firme',
      billingDetails: 'Poslovni podaci',
      billingAddress: {
        label: 'Adresa za naplatu',
        line1: 'Ulica i broj',
        line2: 'Stan ili sprat',
        postalCode: 'Poštanski broj',
        city: 'Grad',
        country: 'Zemlja',
        state: 'Savezna država',
        province: 'Pokrajina',
        stateProvince: 'Savezna država / pokrajina',
      },
      taxId: 'PIB',
      discountCode: 'Kod za popust',
      addDiscountCode: 'Dodaj kod za popust',
      optional: 'Opciono',
      apply: 'Primeni',
      fieldRequired: 'Ovo polje je obavezno',
    },
    orderSummary: 'Pregled porudžbine',
    pricing: {
      subtotal: 'Međuzbir',
      taxableAmount: 'Oporezivi iznos',
      taxes: 'PDV',
      inclTax: 'PDV (uključen)',
      free: 'Besplatno',
      payWhatYouWant: 'Platite koliko želite',
      total: 'Ukupno',
      everyInterval: {
        day: {
          '=1': 'Dnevno',
          '=2': 'Svaki drugi dan',
          other: 'Svakih # dana',
          _mode: 'plural',
        },
        week: {
          '=1': 'Nedeljno',
          '=2': 'Svake druge nedelje',
          other: 'Svakih # nedelja',
          _mode: 'plural',
        },
        month: {
          '=1': 'Mesečno',
          '=2': 'Svakog drugog meseca',
          other: 'Svakih # meseci',
          _mode: 'plural',
        },
        year: {
          '=1': 'Godišnje',
          '=2': 'Svake druge godine',
          other: 'Svakih # godina',
          _mode: 'plural',
        },
      },
      additionalMeteredUsage: 'Dodatna merena potrošnja',
      meteredChargesMayApply: 'Mogu se naplatiti dodatne merene naknade',
      meteredIncluded: '{units} uključeno',
      meterUnits: {
        token: 'tokena',
        scalar: 'jedinica',
      },
      tiers: {
        from: 'Od',
        range: '{from}–{to}',
        andAbove: '{from}+',
        volumeExplainer:
          'Sva potrošnja se naplaćuje po ceni opsega u koji spada',
      },
      dueToday: 'Dospeva danas',
      firstPayment: 'Prvo plaćanje',
      totalAfterTrial: 'Ukupno nakon probnog perioda',
      perSeat: 'po korisniku',
      basePrice: 'Osnovna cena',
      seats: {
        label: 'Korisnici',
        numberOfSeats: 'Broj korisnika',
        count: {
          '=1': '# korisnik',
          other: '# korisnika',
          _mode: 'plural',
        },
        included: {
          '=1': 'Uključen jedan korisnik',
          other: '# korisnika uključeno',
          _mode: 'plural',
        },
        range: '{min} – {max} korisnika',
        minimum: 'Najmanje {min} korisnika',
        maximum: 'Najviše {max} korisnika',
        updateFailed: 'Ažuriranje broja korisnika nije uspelo',
      },
      perUnit: 'po {unitLabel}',
      units: {
        label: '{unitLabelPlural}',
        numberOfUnits: 'Broj: {unitLabelPlural}',
        count: {
          '=1': '# {unitLabel}',
          other: '# {unitLabelPlural}',
          _mode: 'plural',
        },
        updateFailed: 'Ažuriranje jedinica nije uspelo',
      },
      discount: {
        until: 'Do {date}',
      },
    },
    trial: {
      hero: {
        free: {
          day: {
            '=1': '# dan besplatno',
            other: '# dana besplatno',
            _mode: 'plural',
          },
          month: {
            '=1': '# mesec besplatno',
            other: '# meseci besplatno',
            _mode: 'plural',
          },
          year: {
            '=1': '# godina besplatno',
            other: '# godina besplatno',
            _mode: 'plural',
          },
        },
        intervalSuffix: {
          day: '/dan',
          week: '/nedelja',
          month: '/mesec',
          year: '/godina',
        },
        then: 'Zatim',
        startingDate: 'počevši od {date}',
        freeUntil: 'Besplatno do {date}',
      },
    },
    pwywForm: {
      label: 'Unesite cenu po izboru',
      minimum: 'Minimum {amount}',
      amountMinimum: 'Iznos mora biti najmanje {min}',
      amountFreeOrMinimum: 'Iznos mora biti {zero} ili najmanje {min}',
    },
    productSwitcher: {
      billedRecurring: 'Naplaćuje se {frequency}',
      oneTimePurchase: 'Jednokratna kupovina',
      fromPrefix: 'Od',
    },
    productDescription: {
      readMore: 'Pročitajte više',
    },
    benefits: {
      granting: 'Dodeljujemo pogodnosti...',
      requestNewInvite: 'Zatražite novi poziv',
      retryIn: {
        '=1': 'Pokušajte ponovo za # sekundu',
        other: 'Pokušajte ponovo za # sekundi',
        _mode: 'plural',
      },
      connectNewAccount: 'Povežite novi nalog',
      requestMyInvite: 'Zatražite moj poziv',
      github: {
        connect: 'Povežite GitHub nalog',
        goTo: 'Idi na {repository}',
        selectAccount: 'Izaberite GitHub nalog',
      },
      discord: {
        connect: 'Povežite Discord nalog',
        open: 'Otvori Discord',
        selectAccount: 'Izaberite Discord nalog',
      },
      slackSharedChannel: {
        connected: 'Povezano sa vašim Slack radnim prostorom.',
        connectedChannel:
          'Povezano sa vašim Slack radnim prostorom u kanalu {channel}.',
        inviteSent: 'Poziv je poslat na {email}.',
        channel: 'Kanal: {channel}.',
        openLinkToAccept: 'Otvorite link da biste ga prihvatili u Slack-u.',
        acceptFromEmail:
          'Prihvatite ga iz poziva poslatog e-poštom ili u zahtevima Slack Connect.',
        openInvite: 'Otvori Slack poziv',
        provisioning:
          'Podešavamo Slack kanal za {email}... Poziv bi uskoro trebalo da stigne u vaše sanduče.',
        setupFailed:
          'Nismo uspeli da podesimo Slack kanal sa {email}. Proverite e-adresu i pokušajte ponovo ili se obratite prodavcu ako problem i dalje postoji.',
        enterEmail:
          'Unesite e-poštu administratora vašeg Slack radnog prostora. Dobiće poziv Slack Connect za privatni kanal.',
        emailPlaceholder: 'slack-admin@vasakompanija.com',
        tryAgain: 'Pokušajte ponovo',
        requestInvite: 'Zatražite Slack poziv',
      },
      licenseKey: {
        copy: 'Kopiraj',
        copiedToClipboard: 'Kopirano u privremenu memoriju',
        copiedToClipboardDescription:
          'Licencni ključ je kopiran u privremenu memoriju',
        loading: 'Učitavanje...',
        status: 'Status',
        statusGranted: 'Odobreno',
        statusRevoked: 'Opozvano',
        statusDisabled: 'Onemogućeno',
        usage: 'Upotreba',
        validations: 'Provere',
        validatedAt: 'Provereno',
        neverValidated: 'Nikad nije proveravano',
        expiryDate: 'Datum isteka',
        noExpiry: 'Bez isteka',
        activations: 'Aktivacije',
        activationDeleted: 'Aktivacija licencnog ključa je obrisana',
        activationDeletedDescription: 'Aktivacija je uspešno obrisana',
        activationDeactivationFailed: 'Deaktivacija aktivacije nije uspela',
      },
    },
    confirmation: {
      confirmPayment: 'Potvrdi plaćanje',
      processingTitle: 'Obrađujemo vašu porudžbinu',
      successTitle: 'Hvala vam na porudžbini!',
      failedTitle: 'Došlo je do problema prilikom obrade porudžbine',
      processingDescription: 'Sačekajte dok potvrđujemo vaše plaćanje.',
      successDescription: 'Sada imate pristup proizvodu {product}.',
      failedDescription: 'Pokušajte ponovo ili kontaktirajte podršku.',
    },
    loading: {
      processingOrder: 'Obrađujemo porudžbinu...',
      processingPayment: 'Obrada plaćanja',
      paymentSuccessful: 'Plaćanje je uspešno! Pripremamo vaše proizvode...',
      confirmationTokenFailed:
        'Nije uspelo kreiranje potvrdnog tokena. Pokušajte ponovo kasnije.',
      paymentNotCompleted: 'Plaćanje nije završeno. Pokušajte ponovo.',
      paymentFormNotLoaded:
        'Obrazac za plaćanje nije uspeo da se učita. Osvežite stranicu i pokušajte ponovo.',
    },
    cta: {
      startTrial: 'Započni probni period',
      subscribeNow: 'Pretplati se odmah',
      payNow: 'Plati odmah',
      getFree: 'Uzmi besplatno',
      paymentsUnavailable: 'Plaćanja trenutno nisu dostupna',
    },
    trialUnavailable: {
      title: 'Besplatni probni period nije dostupan za ovu kupovinu',
      description:
        'Već ste iskoristili besplatni probni period za ovaj proizvod, pa ćete danas biti naplaćeni. Nastavite ispod da biste završili kupovinu.',
    },
  },
  intervals: {
    short: {
      day: {
        '=1': 'd',
        other: '# d',
        _mode: 'plural',
      },
      week: {
        '=1': 'ned',
        other: '# ned',
        _mode: 'plural',
      },
      month: {
        '=1': 'mes',
        other: '# mes',
        _mode: 'plural',
      },
      year: {
        '=1': 'god',
        other: '# god',
        _mode: 'plural',
      },
    },
  },
  benefitTypes: {
    license_keys: 'Licencni ključevi',
    github_repository: 'Pristup GitHub repozitorijumu',
    discord: 'Poziv na Discord',
    downloadables: 'Preuzimanje datoteka',
    custom: 'Prilagođeno',
    meter_credit: 'Krediti za potrošnju',
    feature_flag: 'Oznaka funkcije',
    slack_shared_channel: 'Deljeni Slack kanal',
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
    title: 'Dodajte način plaćanja',
    close: 'Zatvori',
    submit: 'Dodaj način plaćanja',
    processing: 'Dodavanje načina plaćanja…',
    fallbackError: 'Došlo je do greške. Pokušajte ponovo.',
    errors: {
      invalidRequest: 'Nedostaju obavezni parametri.',
      unauthorized: 'Sesija je istekla.',
      processingFailed:
        'Nije moguće obraditi način plaćanja. Pokušajte ponovo.',
      unknown: 'Došlo je do greške.',
    },
  },
} as const
