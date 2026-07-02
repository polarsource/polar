export default {
  checkout: {
    footer: {
      poweredBy: 'Powered by',
      merchantOfRecord:
        'この注文は、当社のオンライン再販業者兼販売元である Polar により処理されます。Polar は注文に関するお問い合わせや返品も対応します。',
      mandateSubscriptionTrial:
        '「{buttonLabel}」をクリックすると、オンライン再販業者兼販売元である Polar Software, Inc. に対し、試用期間終了時およびその後の各請求日に、上記の金額を選択した支払い方法に請求することを承認し、{buyerTermsLink} に同意したものとみなされます。請求を避けるには、試用期間終了前であればいつでもキャンセルできます。',
      mandateSubscription:
        '「{buttonLabel}」をクリックすると、オンライン再販業者兼販売元である Polar Software, Inc. に対し、上記の金額を直ちに選択した支払い方法に請求し、キャンセルするまでその後の各請求日に同額を請求することを承認し、{buyerTermsLink} に同意したものとみなされます。',
      mandateOneTime:
        '「{buttonLabel}」をクリックすると、オンライン再販業者兼販売元である Polar Software, Inc. に対し、上記の金額を選択した支払い方法に請求することを承認し、{buyerTermsLink} に同意したものとみなされます。これは1回限りの請求です。',
      buyerTermsLink: '購入者規約',
    },
    form: {
      email: 'メールアドレス',
      cardholderName: 'カード名義人',
      purchasingAsBusiness: '法人として購入します',
      businessName: '法人名',
      billingDetails: '法人情報',
      billingAddress: {
        label: '請求先住所',
        line1: '住所',
        line2: '建物名・部屋番号',
        postalCode: '郵便番号',
        city: '市区町村',
        country: '国',
        state: '都道府県',
        province: '都道府県',
        stateProvince: '都道府県',
      },
      taxId: '納税者番号',
      discountCode: '割引コード',
      addDiscountCode: '割引コードを追加',
      optional: '任意',
      apply: '適用',
      fieldRequired: 'この項目は必須です',
    },
    pricing: {
      subtotal: '小計',
      taxableAmount: '課税対象額',
      taxes: '税',
      inclTax: '税込',
      free: '無料',
      payWhatYouWant: '希望額を支払う',
      total: '合計',
      everyInterval: {
        day: {
          '=1': '毎日',
          '=2': '1日おき',
          other: '#日ごと',
          _mode: 'plural',
        },
        week: {
          '=1': '毎週',
          '=2': '2週ごと',
          other: '#週ごと',
          _mode: 'plural',
        },
        month: {
          '=1': '毎月',
          '=2': '2か月ごと',
          other: '#か月ごと',
          _mode: 'plural',
        },
        year: {
          '=1': '毎年',
          '=2': '2年ごと',
          other: '#年ごと',
          _mode: 'plural',
        },
      },
      additionalMeteredUsage: '追加の従量課金',
      perSeat: '1席あたり',
      seats: {
        label: '席数',
        numberOfSeats: '席数',
        count: {
          '=1': '#席',
          other: '#席',
          _mode: 'plural',
        },
        range: '{min} - {max}席',
        minimum: '最低 {min}席',
        maximum: '最大 {max}席',
        updateFailed: '席数の更新に失敗しました',
        included: {
          '=1': '1席分を含みます',
          other: '#席分を含みます',
          _mode: 'plural',
        },
      },
      discount: {
        until: '{date}まで',
      },
      basePrice: '基本料金',
    },
    trial: {
      hero: {
        free: {
          day: {
            '=1': '#日間無料',
            other: '#日間無料',
            _mode: 'plural',
          },
          month: {
            '=1': '#か月無料',
            other: '#か月無料',
            _mode: 'plural',
          },
          year: {
            '=1': '#年間無料',
            other: '#年間無料',
            _mode: 'plural',
          },
        },
        intervalSuffix: {
          day: '/日',
          week: '/週',
          month: '/月',
          year: '/年',
        },
        then: 'その後',
        startingDate: '{date}から',
      },
    },
    pwywForm: {
      label: 'ご希望の価格を入力',
      minimum: '最低 {amount}',
      amountMinimum: '金額は {min} 以上で入力してください',
      amountFreeOrMinimum: '金額は {zero} または {min} 以上で入力してください',
    },
    productSwitcher: {
      billedRecurring: '{frequency}ごとに請求',
      oneTimePurchase: '買い切り',
      fromPrefix: '最低',
    },
    productDescription: {
      readMore: 'もっと見る',
    },
    benefits: {
      granting: '特典を付与しています...',
      requestNewInvite: '新しい招待をリクエスト',
      retryIn: {
        '=1': '#秒後に再試行',
        other: '#秒後に再試行',
        _mode: 'plural',
      },
      connectNewAccount: '新しいアカウントを連携',
      requestMyInvite: '招待をリクエスト',
      github: {
        connect: 'GitHubアカウントを連携',
        goTo: '{repository}に移動',
        selectAccount: 'GitHubアカウントを選択',
      },
      discord: {
        connect: 'Discordアカウントを連携',
        open: 'Discordを開く',
        selectAccount: 'Discordアカウントを選択',
      },
      licenseKey: {
        copy: 'コピー',
        copiedToClipboard: 'クリップボードにコピーしました',
        copiedToClipboardDescription:
          'ライセンスキーをクリップボードにコピーしました',
        loading: '読み込み中...',
        status: 'ステータス',
        statusGranted: '付与済み',
        statusRevoked: '失効',
        statusDisabled: '無効',
        usage: '利用状況',
        validations: '検証回数',
        validatedAt: '検証日時',
        neverValidated: '未検証',
        expiryDate: '有効期限',
        noExpiry: '期限なし',
        activations: 'アクティベーション',
        activationDeleted: 'ライセンスキーのアクティベーションを削除しました',
        activationDeletedDescription: 'アクティベーションを正常に削除しました',
        activationDeactivationFailed:
          'アクティベーションの無効化に失敗しました',
      },
      slackSharedChannel: {
        connected: 'Slackワークスペースに接続済みです。',
        connectedChannel:
          'Slackワークスペースのチャンネル {channel} に接続済みです。',
        inviteSent: '{email} に招待を送信しました。',
        channel: 'チャンネル: {channel}。',
        openLinkToAccept: 'Slackでリンクを開いて承認してください。',
        acceptFromEmail:
          '招待メールまたはSlack Connectのリクエストから承認してください。',
        openInvite: 'Slack招待を開く',
        provisioning:
          '{email} 用のSlackチャンネルを設定しています... まもなく受信箱に招待が届きます。',
        setupFailed:
          '{email} でSlackチャンネルを設定できませんでした。メールアドレスを確認してもう一度お試しください。改善しない場合は販売者にお問い合わせください。',
        enterEmail:
          'Slackワークスペースの管理者のメールアドレスを入力してください。プライベートチャンネル用のSlack Connect招待が送信されます。',
        emailPlaceholder: 'slack-admin@yourcompany.com',
        tryAgain: '再試行',
        requestInvite: 'Slack招待をリクエスト',
      },
    },
    confirmation: {
      confirmPayment: '支払いを確認',
      processingTitle: 'ご注文を処理しています',
      failedTitle: 'ご注文の処理中に問題が発生しました',
      processingDescription:
        'お支払いを確認しています。しばらくお待ちください。',
      failedDescription:
        'もう一度お試しいただくか、サポートまでお問い合わせください。',
      successTitle: 'ご注文ありがとうございます！',
      successDescription: 'これで{product}をご利用いただけます。',
    },
    loading: {
      processingOrder: '注文を処理しています...',
      processingPayment: '支払い処理中',
      paymentSuccessful: '支払いが完了しました。商品を準備しています...',
      confirmationTokenFailed:
        '確認トークンの作成に失敗しました。後でもう一度お試しください。',
    },
    cta: {
      startTrial: 'トライアルを開始',
      subscribeNow: '登録する',
      payNow: '今すぐ支払う',
      getFree: '無料で入手',
      paymentsUnavailable: '現在、支払いはご利用いただけません',
    },
  },
  intervals: {
    short: {
      day: '日',
      week: '週',
      month: '月',
      year: '年',
    },
  },
  benefitTypes: {
    license_keys: 'ライセンスキー',
    github_repository: 'GitHubリポジトリへのアクセス',
    discord: 'Discord招待',
    downloadables: 'ファイルダウンロード',
    custom: 'カスタム',
    meter_credit: 'メータークレジット',
    feature_flag: '機能フラグ',
    slack_shared_channel: 'Slack共有チャンネル',
  },
  ordinal: {
    one: '番目',
    two: '番目',
    few: '番目',
    other: '番目',
    zero: '番目',
    many: '番目',
  },
  embedPaymentMethod: {
    title: '支払い方法を追加',
    close: '閉じる',
    submit: '支払い方法を追加',
    processing: '支払い方法を追加しています…',
    fallbackError: '問題が発生しました。もう一度お試しください。',
    errors: {
      invalidRequest: '必要なパラメータが不足しています。',
      unauthorized: 'セッションの有効期限が切れました。',
      processingFailed:
        '支払い方法を処理できませんでした。もう一度お試しください。',
      unknown: '問題が発生しました。',
    },
  },
} as const
