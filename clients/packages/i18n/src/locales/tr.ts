export default {
  checkout: {
    footer: {
      poweredBy: 'Altyapı sağlayıcı',
      merchantOfRecord:
        'Bu sipariş, çevrimiçi satıcımız ve kayıtlı tüccarımız olan Polar tarafından işlenmektedir. Sipariş ile ilgili sorular ve iadeler de Polar tarafından yönetilmektedir.',
      mandateSubscriptionTrial:
        '"{buttonLabel}" düğmesine tıklayarak, çevrimiçi satıcımız ve kayıtlı tüccarımız Polar Software, Inc.\'in deneme sürenizin sonunda ve iptal edene kadar her fatura döneminde seçtiğiniz ödeme yönteminden yukarıda gösterilen tutarı tahsil etmesine yetki vermiş olursunuz. Ücretlendirilmemek için deneme süreniz sona ermeden önce iptal edebilirsiniz.',
      mandateSubscription:
        '"{buttonLabel}" düğmesine tıklayarak, çevrimiçi satıcımız ve kayıtlı tüccarımız Polar Software, Inc.\'in seçtiğiniz ödeme yönteminden yukarıda gösterilen tutarı hemen ve iptal edene kadar her fatura döneminde aynı tutarda tahsil etmesine yetki vermiş olursunuz.',
      mandateOneTime:
        '"{buttonLabel}" düğmesine tıklayarak, çevrimiçi satıcımız ve kayıtlı tüccarımız Polar Software, Inc.\'in seçtiğiniz ödeme yönteminden yukarıda gösterilen tutarı tek seferlik olarak tahsil etmesine yetki vermiş olursunuz.',
    },
    form: {
      email: 'E-posta',
      cardholderName: 'Kart sahibinin adı soyadı',
      purchasingAsBusiness: 'Kurumsal satın alıyorum',
      addBusinessDetails: 'Kurumsal bilgi ekle',
      removeBusinessDetails: 'Kurumsal bilgileri kaldır',
      businessName: 'Şirket adı',
      billingDetails: 'Fatura Bilgileri',
      billingAddress: {
        label: 'Fatura adresi',
        line1: {
          value: 'Sokak adresi',
          _llmContext:
            'Fatura adresinin ilk satırı; sokak adı ve numara içerir. Hedef bölgede yaygın kullanılan formata göre düzenleyin.',
        },
        line2: {
          value: 'Daire / kat / iç kapı no',
          _llmContext:
            'Fatura adresinin ikinci satırı; daire, kat, ofis vb. için kullanılır. Hedef bölgede yaygın kullanılan formata göre düzenleyin.',
        },
        postalCode: 'Posta kodu',
        city: 'İlçe',
        country: 'Ülke',
        state: 'Eyalet',
        province: 'İl',
        stateProvince: 'İl / Eyalet',
      },
      taxId: 'Vergi numarası',
      discountCode: 'İndirim kodu',
      addDiscountCode: 'İndirim kodu ekle',
      optional: 'İsteğe bağlı',
      apply: {
        value: 'Uygula',
        _llmContext: 'İndirim kodu uygulamak için düğme metni.',
      },
      fieldRequired: 'Bu alan zorunludur',
    },
    pricing: {
      subtotal: 'Ara toplam',
      taxableAmount: 'Vergiye tabi tutar',
      taxes: {
        value: 'KDV',
        _llmContext:
          "Siparişe uygulanan vergi. Türkiye'de KDV (Katma Değer Vergisi) kullanılır.",
      },
      free: 'Ücretsiz',
      payWhatYouWant: {
        value: 'İstediğiniz kadar ödeyin',
        _llmContext:
          'Müşterinin ödemek istediği tutarı seçebildiği fiyatlandırma türü.',
      },
      total: 'Toplam',
      everyInterval: {
        day: {
          _mode: 'plural',
          '=1': 'Günlük',
          '=2': 'Her 2 günde bir',
          other: 'Her # günde bir',
        },
        week: {
          _mode: 'plural',
          '=1': 'Haftalık',
          '=2': 'Her 2 haftada bir',
          other: 'Her # haftada bir',
        },
        month: {
          _mode: 'plural',
          '=1': 'Aylık',
          '=2': 'Her 2 ayda bir',
          other: 'Her # ayda bir',
        },
        year: {
          _mode: 'plural',
          '=1': 'Yıllık',
          '=2': 'Her 2 yılda bir',
          other: 'Her # yılda bir',
        },
      },
      additionalMeteredUsage: 'Ek kullanım ücreti',
      perUnit: '/ adet',
      discount: {
        duration: {
          months: {
            _mode: 'plural',
            '=1': 'ilk ay için',
            other: 'ilk # ay için',
          },
          years: {
            _mode: 'plural',
            '=1': 'ilk yıl için',
            other: 'ilk # yıl için',
          },
        },
        until: {
          value: '{date} tarihine kadar',
          _llmContext:
            'İndirim adının yanında son kullanım tarihini gösterir. Görünüm: "Bahar Kampanyası (-%50) · 23 Nis tarihine kadar".',
        },
      },
    },
    trial: {
      ends: 'Deneme süresi {endDate} tarihinde sona erer',
      duration: {
        days: {
          _mode: 'plural',
          '=1': '# günlük deneme',
          other: '# günlük deneme',
        },
        weeks: {
          _mode: 'plural',
          '=1': '# haftalık deneme',
          other: '# haftalık deneme',
        },
        months: {
          _mode: 'plural',
          '=1': '# aylık deneme',
          other: '# aylık deneme',
        },
        years: {
          _mode: 'plural',
          '=1': '# yıllık deneme',
          other: '# yıllık deneme',
        },
      },
      hero: {
        free: {
          day: {
            _mode: 'plural',
            '=1': '# gün ücretsiz',
            other: '# gün ücretsiz',
          },
          month: {
            _mode: 'plural',
            '=1': '# ay ücretsiz',
            other: '# ay ücretsiz',
          },
          year: {
            _mode: 'plural',
            '=1': '# yıl ücretsiz',
            other: '# yıl ücretsiz',
          },
        },
        intervalSuffix: {
          day: '/gün',
          week: '/hafta',
          month: '/ay',
          year: '/yıl',
        },
        then: {
          value: 'Sonrasında',
          _llmContext:
            'Deneme özeti bölümündeki yinelenen fiyattan önce görünür. Örnek: "Sonrasında <bold>₺999,99/yıl</bold>, 5 Nisan 2026 itibarıyla". Fiyat ayrı bir kalın öğedir.',
        },
        startingDate: {
          value: '{date} itibarıyla',
          _llmContext:
            'Deneme bitiş tarihi bilindiğinde yinelenen fiyatın ardından görünür. Örnek: "Sonrasında ₺999,99/yıl, 5 Nisan 2026 itibarıyla". "Sonrasında" ve kalın fiyat ayrı öğelerdir.',
        },
      },
      summary: {
        totalWhenTrialEnds: 'Deneme sona erdiğinde ödenecek tutar',
        totalWhenDiscountExpires: 'İndirim sona erdiğinde ödenecek tutar',
        totalDueToday: 'Bugün ödenecek tutar',
      },
    },
    pwywForm: {
      label: 'Bir fiyat belirleyin',
      minimum: 'En az {amount}',
      amountMinimum: 'Tutar en az {min} olmalıdır',
      amountFreeOrMinimum: 'Tutar {zero} veya en az {min} olmalıdır',
    },
    productSwitcher: {
      billedRecurring: '{frequency} faturalandırılır',
      oneTimePurchase: 'Tek seferlik ödeme',
    },
    productDescription: {
      readMore: 'Devamını oku',
      readLess: 'Daha az göster',
    },
    card: {
      included: 'Dahil',
    },
    benefits: {
      moreBenefits: {
        _mode: 'plural',
        '=1': '# avantaj daha',
        other: '# avantaj daha',
      },
      showMoreBenefits: {
        _mode: 'plural',
        '=1': '# avantajı daha göster',
        other: '# avantajı daha göster',
      },
      showLess: 'Daha az göster',
      granting: 'Avantajlar tanımlanıyor...',
      requestNewInvite: 'Yeni davet talep et',
      retryIn: {
        _mode: 'plural',
        '=1': '# saniye sonra tekrar deneyin',
        other: '# saniye sonra tekrar deneyin',
      },
      connectNewAccount: 'Yeni hesap bağla',
      requestMyInvite: 'Davetimi talep et',
      github: {
        connect: 'GitHub hesabını bağla',
        goTo: '{repository} sayfasına git',
        selectAccount: 'GitHub hesabı seçin',
      },
      discord: {
        connect: 'Discord hesabını bağla',
        open: "Discord'u aç",
        selectAccount: 'Discord hesabı seçin',
      },
      licenseKey: {
        copy: 'Kopyala',
        copiedToClipboard: 'Panoya kopyalandı',
        copiedToClipboardDescription: 'Lisans anahtarı panoya kopyalandı',
        loading: 'Yükleniyor...',
        status: 'Durum',
        statusGranted: 'Aktif',
        statusRevoked: 'İptal edildi',
        statusDisabled: 'Devre dışı',
        usage: 'Kullanım',
        validations: 'Doğrulamalar',
        validatedAt: 'Doğrulanma tarihi',
        neverValidated: 'Hiç doğrulanmadı',
        expiryDate: 'Son kullanma tarihi',
        noExpiry: 'Süresiz',
        activations: 'Aktivasyonlar',
        activationDeleted: 'Aktivasyon silindi',
        activationDeletedDescription: 'Aktivasyon başarıyla silindi',
        activationDeactivationFailed: 'Aktivasyon devre dışı bırakılamadı',
      },
    },
    confirmation: {
      confirmPayment: 'Ödemeyi onayla',
      processingTitle: 'Siparişiniz işleniyor',
      successTitle: 'Siparişiniz tamamlandı!',
      failedTitle: 'Sipariş işlenirken bir hata oluştu',
      processingDescription: 'Ödemeniz onaylanırken lütfen bekleyin.',
      successDescription: '{product} avantajlarından yararlanmaya hak kazandınız.',
      failedDescription: 'Lütfen tekrar deneyin veya destek ile iletişime geçin.',
    },
    loading: {
      processingOrder: 'Sipariş işleniyor...',
      processingPayment: 'Ödeme işleniyor',
      paymentSuccessful: 'Ödeme başarılı! Ürünleriniz hazırlanıyor...',
      confirmationTokenFailed:
        'Onay jetonu oluşturulamadı, lütfen daha sonra tekrar deneyin.',
    },
    cta: {
      startTrial: 'Denemeyi başlat',
      subscribeNow: 'Abone ol',
      payNow: 'Şimdi öde',
      getFree: 'Ücretsiz edin',
      paymentsUnavailable: 'Ödemeler şu an kullanılamıyor',
    },
  },
  intervals: {
    short: {
      day: 'gn',
      week: 'hf',
      month: 'ay',
      year: 'yıl',
    },
  },
  benefitTypes: {
    license_keys: 'Lisans anahtarları',
    github_repository: 'GitHub deposuna erişim',
    discord: 'Discord daveti',
    downloadables: 'Dosya indirmeleri',
    custom: 'Özel',
    meter_credit: 'Kullanım kredileri',
    feature_flag: 'Özellik bayrağı',
  },
  ordinal: {
    zero: {
      value: '.',
      _llmContext:
        "Türkçe'de tüm sıra sayıları nokta ile gösterilir (1., 2., 3. vb.). Tüm çoğulluk kategorileri için aynı değer kullanılır.",
    },
    one: {
      value: '.',
      _llmContext:
        "Türkçe'de tüm sıra sayıları nokta ile gösterilir (1., 2., 3. vb.). Tüm çoğulluk kategorileri için aynı değer kullanılır.",
    },
    two: {
      value: '.',
      _llmContext:
        "Türkçe'de tüm sıra sayıları nokta ile gösterilir (1., 2., 3. vb.). Tüm çoğulluk kategorileri için aynı değer kullanılır.",
    },
    few: {
      value: '.',
      _llmContext:
        "Türkçe'de tüm sıra sayıları nokta ile gösterilir (1., 2., 3. vb.). Tüm çoğulluk kategorileri için aynı değer kullanılır.",
    },
    many: {
      value: '.',
      _llmContext:
        "Türkçe'de tüm sıra sayıları nokta ile gösterilir (1., 2., 3. vb.). Tüm çoğulluk kategorileri için aynı değer kullanılır.",
    },
    other: {
      value: '.',
      _llmContext:
        "Türkçe'de tüm sıra sayıları nokta ile gösterilir (1., 2., 3. vb.). Tüm çoğulluk kategorileri için aynı değer kullanılır.",
    },
  },
} as const
