export default {
  checkout: {
    footer: {
      poweredBy: 'Altyapı:',
      merchantOfRecord:
        'Bu sipariş, siparişle ilgili soruları ve iadeleri de yöneten çevrimiçi satıcımız ve Kayıtlı Satıcımız (Merchant of Record) Polar tarafından işlenmektedir.',
      mandateSubscriptionTrial:
        '"{buttonLabel}" düğmesine tıklayarak, çevrimiçi satıcımız ve kayıtlı satıcı olarak Polar Software, Inc.\'in, deneme sürenizin sonunda ve sonraki her fatura tarihinde, siz iptal edene kadar seçtiğiniz ödeme yönteminden yukarıda gösterilen tutarı tahsil etmesine yetki vermiş ve {buyerTermsLink} koşullarını kabul etmiş olursunuz. Tahsilat yapılmaması için deneme süreniz sona ermeden istediğiniz zaman iptal edebilirsiniz.',
      mandateSubscription:
        '"{buttonLabel}" düğmesine tıklayarak, çevrimiçi satıcımız ve kayıtlı satıcı olarak Polar Software, Inc.\'in, seçtiğiniz ödeme yönteminden yukarıda gösterilen tutarı derhal tahsil etmesine ve siz iptal edene kadar sonraki her fatura tarihinde aynı tutarı tahsil etmesine yetki vermiş ve {buyerTermsLink} koşullarını kabul etmiş olursunuz.',
      mandateOneTime:
        '"{buttonLabel}" düğmesine tıklayarak, çevrimiçi satıcımız ve kayıtlı satıcı olarak Polar Software, Inc.\'in, seçtiğiniz ödeme yönteminden yukarıda gösterilen tutarı tahsil etmesine yetki vermiş ve {buyerTermsLink} koşullarını kabul etmiş olursunuz. Bu tek seferlik bir tahsilattır.',
      buyerTermsLink: 'Alıcı Koşulları',
    },
    form: {
      email: 'E-posta',
      cardholderName: 'Kart sahibinin adı',
      purchasingAsBusiness: 'Kurumsal olarak satın alıyorum',
      businessName: 'Firma adı',
      billingDetails: 'Fatura Bilgileri',
      billingAddress: {
        label: 'Fatura adresi',
        line1: 'Açık adres',
        line2: 'Daire veya bina no',
        postalCode: 'Posta kodu',
        city: 'Şehir',
        country: 'Ülke',
        state: 'Eyalet',
        province: 'İlçe',
        stateProvince: 'Eyalet / İlçe',
      },
      taxId: 'Vergi numarası',
      discountCode: 'İndirim kodu',
      addDiscountCode: 'İndirim kodu ekle',
      optional: 'İsteğe bağlı',
      apply: 'Uygula',
      fieldRequired: 'Bu alan zorunludur',
    },
    pricing: {
      subtotal: 'Ara toplam',
      taxableAmount: 'Vergiye tabi tutar',
      taxes: 'KDV',
      free: 'Ücretsiz',
      payWhatYouWant: 'İstediğiniz kadar ödeyin',
      total: 'Toplam',
      everyInterval: {
        day: {
          '=1': 'Günlük',
          '=2': 'İki günde bir',
          other: '# günde bir',
          _mode: 'plural',
        },
        week: {
          '=1': 'Haftalık',
          '=2': 'İki haftada bir',
          other: '# haftada bir',
          _mode: 'plural',
        },
        month: {
          '=1': 'Aylık',
          '=2': 'İki ayda bir',
          other: '# ayda bir',
          _mode: 'plural',
        },
        year: {
          '=1': 'Yıllık',
          '=2': 'İki yılda bir',
          other: '# yılda bir',
          _mode: 'plural',
        },
      },
      additionalMeteredUsage: 'Ek kullanım',
      discount: {
        until: '{date} tarihine kadar',
      },
      inclTax: 'Vergiler dahil',
      perSeat: 'koltuk başına',
      seats: {
        label: 'Koltuk sayısı',
        numberOfSeats: 'Koltuk sayısı',
        count: {
          '=1': '# koltuk',
          other: '# koltuk',
          _mode: 'plural',
        },
        included: {
          '=1': '1 koltuk dahil',
          other: '# koltuk dahil',
          _mode: 'plural',
        },
        range: '{min} - {max} koltuk',
        minimum: 'En az {min} koltuk',
        maximum: 'En fazla {max} koltuk',
        updateFailed: 'Koltuklar güncellenemedi',
      },
      basePrice: 'Temel fiyat',
    },
    trial: {
      hero: {
        free: {
          day: {
            '=1': '# gün ücretsiz',
            other: '# gün ücretsiz',
            _mode: 'plural',
          },
          month: {
            '=1': '# ay ücretsiz',
            other: '# ay ücretsiz',
            _mode: 'plural',
          },
          year: {
            '=1': '# yıl ücretsiz',
            other: '# yıl ücretsiz',
            _mode: 'plural',
          },
        },
        intervalSuffix: {
          day: '/gün',
          week: '/hafta',
          month: '/ay',
          year: '/yıl',
        },
        then: 'Sonrasında',
        startingDate: '{date} itibarıyla',
      },
    },
    pwywForm: {
      label: 'Adil bir fiyat belirleyin',
      minimum: 'En az {amount}',
      amountMinimum: 'Tutar en az {min} olmalıdır',
      amountFreeOrMinimum: 'Tutar {zero} veya en az {min} olmalıdır',
    },
    productSwitcher: {
      billedRecurring: '{frequency} faturalandırılır',
      oneTimePurchase: 'Tek seferlik satın alma',
      fromPrefix: 'Başlayan',
    },
    productDescription: {
      readMore: 'Daha fazla oku',
    },
    benefits: {
      granting: 'Avantajlar tanımlanıyor...',
      requestNewInvite: 'Yeni davet iste',
      retryIn: {
        '=1': '# saniye sonra tekrar deneyin',
        other: '# saniye sonra tekrar deneyin',
        _mode: 'plural',
      },
      connectNewAccount: 'Yeni hesap bağla',
      requestMyInvite: 'Davetimi iste',
      github: {
        connect: 'GitHub hesabını bağla',
        goTo: '{repository} deposuna git',
        selectAccount: 'Bir GitHub hesabı seçin',
      },
      discord: {
        connect: 'Discord hesabını bağla',
        open: "Discord'u aç",
        selectAccount: 'Bir Discord hesabı seçin',
      },
      licenseKey: {
        copy: 'Kopyala',
        copiedToClipboard: 'Panoya kopyalandı',
        copiedToClipboardDescription: 'Lisans anahtarı panoya kopyalandı',
        loading: 'Yükleniyor...',
        status: 'Durum',
        statusGranted: 'Verildi',
        statusRevoked: 'İptal edildi',
        statusDisabled: 'Devre dışı',
        usage: 'Kullanım',
        validations: 'Doğrulamalar',
        validatedAt: 'Doğrulanma tarihi',
        neverValidated: 'Hiç doğrulanmadı',
        expiryDate: 'Son kullanma tarihi',
        noExpiry: 'Süresiz',
        activations: 'Aktivasyonlar',
        activationDeleted: 'Lisans anahtarı aktivasyonu silindi',
        activationDeletedDescription: 'Aktivasyon başarıyla silindi',
        activationDeactivationFailed: 'Aktivasyon devre dışı bırakılamadı',
      },
      slackSharedChannel: {
        connected: 'Slack çalışma alanınıza bağlandı.',
        connectedChannel:
          '{channel} kanalındaki Slack çalışma alanınıza bağlandı.',
        inviteSent: '{email} adresine davet gönderildi.',
        channel: 'Kanal: {channel}.',
        openLinkToAccept: 'Slack’te kabul etmek için bağlantıyı açın.',
        acceptFromEmail:
          'Daveti e-posta davetinden veya Slack Connect isteklerinizden kabul edin.',
        openInvite: 'Slack davetini aç',
        provisioning:
          '{email} için Slack kanalınız hazırlanıyor... Kısa süre içinde gelen kutunuza bir davet ulaşmalıdır.',
        setupFailed:
          '{email} ile Slack kanalınız kurulamadı. E-postayı kontrol edip tekrar deneyin veya sorun devam ederse satıcıyla iletişime geçin.',
        enterEmail:
          'Slack çalışma alanınızdaki bir yöneticinin e-postasını girin. Özel bir kanal için bir Slack Connect daveti alacaklar.',
        emailPlaceholder: 'slack-admin@sirketiniz.com',
        tryAgain: 'Tekrar dene',
        requestInvite: 'Slack daveti iste',
      },
    },
    confirmation: {
      confirmPayment: 'Ödemeyi onayla',
      processingTitle: 'Siparişinizi işliyoruz',
      failedTitle: 'Siparişiniz işlenirken bir sorun oluştu',
      processingDescription: 'Ödemenizi onaylarken lütfen bekleyin.',
      failedDescription:
        'Lütfen tekrar deneyin veya destek ekibiyle iletişime geçin.',
      successTitle: 'Siparişiniz için teşekkürler!',
      successDescription: '{product} erişiminiz artık hazır.',
    },
    loading: {
      processingOrder: 'Sipariş işleniyor...',
      processingPayment: 'Ödeme işleniyor',
      paymentSuccessful: 'Ödeme başarılı! Ürünleriniz hazırlanıyor...',
      confirmationTokenFailed:
        'Onay anahtarı oluşturulamadı, lütfen daha sonra tekrar deneyin.',
    },
    cta: {
      startTrial: 'Denemeyi başlat',
      subscribeNow: 'Şimdi abone ol',
      payNow: 'Şimdi öde',
      getFree: 'Ücretsiz al',
      paymentsUnavailable: 'Ödemeler şu anda kullanılamıyor',
    },
  },
  intervals: {
    short: {
      day: 'g',
      week: 'h',
      month: 'a',
      year: 'y',
    },
    shortCount: {
      day: {
        '=1': '# gün',
        other: '# gün',
        _mode: 'plural',
      },
      week: {
        '=1': '# hf',
        other: '# hf',
        _mode: 'plural',
      },
      month: {
        '=1': '# ay',
        other: '# ay',
        _mode: 'plural',
      },
      year: {
        '=1': '# yıl',
        other: '# yıl',
        _mode: 'plural',
      },
    },
  },
  benefitTypes: {
    license_keys: 'Lisans anahtarları',
    github_repository: 'GitHub deposu erişimi',
    discord: 'Discord daveti',
    downloadables: 'Dosya indirmeleri',
    custom: 'Özel',
    meter_credit: 'Ölçüm kredileri',
    feature_flag: 'Özellik bayrağı',
    slack_shared_channel: 'Paylaşılan Slack kanalı',
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
    title: 'Ödeme yöntemi ekle',
    close: 'Kapat',
    submit: 'Ödeme yöntemi ekle',
    processing: 'Ödeme yöntemi ekleniyor…',
    fallbackError: 'Bir sorun oluştu. Lütfen tekrar deneyin.',
    errors: {
      invalidRequest: 'Gerekli parametreler eksik.',
      unauthorized: 'Oturumun süresi doldu.',
      processingFailed: 'Ödeme yöntemi işlenemedi. Lütfen tekrar deneyin.',
      unknown: 'Bir sorun oluştu.',
    },
  },
} as const
