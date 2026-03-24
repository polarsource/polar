export default {
  checkout: {
    footer: {
      poweredBy: 'Altyapı:',
      merchantOfRecord:
        'Bu sipariş, siparişle ilgili soruları ve iadeleri de yöneten çevrimiçi satıcımız ve Kayıtlı Satıcımız (Merchant of Record) Polar tarafından işlenmektedir.',
      mandateSubscriptionTrial:
        '"{buttonLabel}" butonuna tıklayarak, çevrimiçi satıcımız ve kayıtlı satıcımız olan Polar Software, Inc.\'e, deneme sürenizin sonunda ve iptal edene kadar sonraki her fatura tarihinde seçtiğiniz ödeme yönteminden yukarıda gösterilen tutarı tahsil etmesi için yetki vermiş olursunuz. Ücretlendirilmemek için deneme süreniz sona ermeden istediğiniz zaman iptal edebilirsiniz.',
      mandateSubscription:
        '"{buttonLabel}" butonuna tıklayarak, çevrimiçi satıcımız ve kayıtlı satıcımız olan Polar Software, Inc.\'e, seçtiğiniz ödeme yönteminden yukarıda gösterilen tutarı hemen tahsil etmesi ve iptal edene kadar sonraki her fatura tarihinde aynı tutarı tahsil etmesi için yetki vermiş olursunuz.',
      mandateOneTime:
        '"{buttonLabel}" butonuna tıklayarak, çevrimiçi satıcımız ve kayıtlı satıcımız olan Polar Software, Inc.\'e, seçtiğiniz ödeme yönteminden yukarıda gösterilen tutarı tahsil etmesi için yetki vermiş olursunuz. Bu tek seferlik bir ödemedir.',
    },
    form: {
      email: 'E-posta',
      cardholderName: 'Kart sahibinin adı',
      purchasingAsBusiness: 'Kurumsal olarak satın alıyorum',
      addBusinessDetails: 'Firma bilgileri ekle',
      removeBusinessDetails: 'Firma bilgilerini kaldır',
      businessName: 'Firma adı',
      billingDetails: 'Firma Bilgileri',
      billingAddress: {
        label: 'Fatura adresi',
        line1: 'Açık adres',
        line2: 'Daire veya bina no',
        postalCode: 'Posta kodu',
        city: 'İl',
        country: 'Ülke',
        state: 'Eyalet',
        province: 'Bölge',
        stateProvince: 'Eyalet / Bölge',
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
      payWhatYouWant: 'İstediğin kadar öde',
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
      perUnit: '/ birim',
      discount: {
        duration: {
          months: {
            '=1': 'ilk ay için',
            other: 'ilk # ay için',
            _mode: 'plural',
          },
          years: {
            '=1': 'ilk yıl için',
            other: 'ilk # yıl için',
            _mode: 'plural',
          },
        },
        until: '{date} tarihine kadar',
      },
    },
    trial: {
      ends: 'Deneme süresi {endDate} tarihinde bitiyor',
      duration: {
        days: {
          '=1': '# günlük deneme',
          other: '# günlük deneme',
          _mode: 'plural',
        },
        weeks: {
          '=1': '# haftalık deneme',
          other: '# haftalık deneme',
          _mode: 'plural',
        },
        months: {
          '=1': '# aylık deneme',
          other: '# aylık deneme',
          _mode: 'plural',
        },
        years: {
          '=1': '# yıllık deneme',
          other: '# yıllık deneme',
          _mode: 'plural',
        },
      },
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
        startingDate: 'başlangıç: {date}',
      },
      summary: {
        totalWhenTrialEnds: 'Deneme süresi bittiğinde toplam',
        totalWhenDiscountExpires: 'İndirim bittiğinde toplam',
        totalDueToday: 'Bugün ödenecek toplam',
      },
    },
    pwywForm: {
      label: 'Adil bir fiyat belirleyin',
      minimum: 'Minimum {amount}',
      amountMinimum: 'Tutar en az {min} olmalıdır',
      amountFreeOrMinimum: 'Tutar {zero} veya en az {min} olmalıdır',
    },
    productSwitcher: {
      billedRecurring: '{frequency} faturalandırılır',
      oneTimePurchase: 'Tek seferlik satın alma',
    },
    productDescription: {
      readMore: 'Daha fazla oku',
      readLess: 'Daha az oku',
    },
    card: {
      included: 'Dahil',
    },
    benefits: {
      moreBenefits: {
        '=1': '# avantaj daha',
        other: '# avantaj daha',
        _mode: 'plural',
      },
      showMoreBenefits: {
        '=1': '# avantajı daha göster',
        other: '# avantajı daha göster',
        _mode: 'plural',
      },
      showLess: 'Daha az göster',
      granting: 'Avantajlar tanımlanıyor...',
      requestNewInvite: 'Yeni davet iste',
      retryIn: {
        '=1': '# saniye içinde tekrar dene',
        other: '# saniye içinde tekrar dene',
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
        copiedToClipboard: 'Panoya Kopyalandı',
        copiedToClipboardDescription: 'Lisans anahtarı panoya kopyalandı',
        loading: 'Yükleniyor...',
        status: 'Durum',
        statusGranted: 'Verildi',
        statusRevoked: 'İptal Edildi',
        statusDisabled: 'Devre Dışı',
        usage: 'Kullanım',
        validations: 'Doğrulamalar',
        validatedAt: 'Doğrulanma Tarihi',
        neverValidated: 'Hiç Doğrulanmadı',
        expiryDate: 'Bitiş Tarihi',
        noExpiry: 'Süresiz',
        activations: 'Aktivasyonlar',
        activationDeleted: 'Lisans Anahtarı Aktivasyonu Silindi',
        activationDeletedDescription: 'Aktivasyon başarıyla silindi',
        activationDeactivationFailed: 'Aktivasyon Devre Dışı Bırakılamadı',
      },
    },
    confirmation: {
      confirmPayment: 'Ödemeyi onayla',
      processingTitle: 'Siparişinizi işliyoruz',
      successTitle: 'Siparişiniz başarılı!',
      failedTitle: 'Siparişiniz işlenirken bir sorun oluştu',
      processingDescription: 'Ödemenizi onaylarken lütfen bekleyin.',
      successDescription:
        'Artık {product} avantajlarından yararlanabilirsiniz.',
      failedDescription:
        'Lütfen tekrar deneyin veya destek ekibiyle iletişime geçin.',
    },
    loading: {
      processingOrder: 'Sipariş işleniyor...',
      processingPayment: 'Ödeme işleniyor',
      paymentSuccessful: 'Ödeme başarılı! Ürünleriniz hazırlanıyor...',
      confirmationTokenFailed:
        'Onay belirteci oluşturulamadı, lütfen daha sonra tekrar deneyin.',
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
  },
  benefitTypes: {
    license_keys: 'Lisans anahtarları',
    github_repository: 'GitHub deposu erişimi',
    discord: 'Discord daveti',
    downloadables: 'Dosya indirmeleri',
    custom: 'Özel',
    meter_credit: 'Ölçüm kredileri',
    feature_flag: 'Özellik bayrağı',
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
