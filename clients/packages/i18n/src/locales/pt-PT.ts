export default {
  checkout: {
    footer: {
      poweredBy: 'Desenvolvido por',
      merchantOfRecord:
        'Este pedido é processado pela Polar, nossa parceira de vendas online, responsável pela cobrança, suporte ao pedido e devoluções.',
      mandateSubscriptionTrial:
        'Ao clicar em "{buttonLabel}", autoriza a Polar Software, Inc., o nosso revendedor online e comerciante de registo, a cobrar o montante indicado acima no seu método de pagamento selecionado no final do seu período de teste e em cada data de faturação subsequente até que cancele, e concorda com os {buyerTermsLink}. Pode cancelar a qualquer momento antes do final do seu período de teste para evitar a cobrança.',
      mandateSubscription:
        'Ao clicar em "{buttonLabel}", autoriza a Polar Software, Inc., o nosso revendedor online e comerciante de registo, a cobrar imediatamente o montante indicado acima no seu método de pagamento selecionado e a cobrar o mesmo montante em cada data de faturação subsequente até que cancele, e concorda com os {buyerTermsLink}.',
      buyerTermsLink: 'Termos de Compra',
      mandateOneTime:
        'Ao clicar em "{buttonLabel}", autoriza a Polar Software, Inc., o nosso revendedor online e comerciante registado, a cobrar o montante indicado acima no seu método de pagamento selecionado e concorda com os {buyerTermsLink}. Esta é uma cobrança única.',
    },
    form: {
      email: 'E-mail',
      cardholderName: 'Nome do titular',
      purchasingAsBusiness: 'Estou comprando uma empresa',
      businessName: 'Nome da empresa',
      billingAddress: {
        label: 'Endereço de cobrança',
        line1: 'Endereço',
        line2: 'Complemento',
        postalCode: 'CEP',
        city: 'Cidade',
        country: 'País',
        state: 'Distrito',
        province: 'Província',
        stateProvince: 'Distrito / Província',
      },
      taxId: 'NIF',
      discountCode: 'Código de desconto',
      optional: 'Opcional',
      apply: 'Aplicar',
      fieldRequired: 'Este campo é obrigatório',
      billingDetails: 'Dados da Empresa',
      addDiscountCode: 'Adicionar código de desconto',
    },
    pricing: {
      subtotal: 'Subtotal',
      taxableAmount: 'Valor tributável',
      taxes: 'Impostos',
      free: 'Grátis',
      payWhatYouWant: 'Pague quanto quiser',
      total: 'Total',
      additionalMeteredUsage: 'Uso adicional',
      discount: {
        until: 'Até {date}',
      },
      everyInterval: {
        day: {
          '=1': 'Diário',
          '=2': 'A cada 2 dias',
          other: 'A cada # dias',
          _mode: 'plural',
        },
        week: {
          '=1': 'Semanal',
          '=2': 'A cada 2 semanas',
          other: 'A cada # semanas',
          _mode: 'plural',
        },
        month: {
          '=1': 'Mensal',
          '=2': 'A cada 2 meses',
          other: 'A cada # meses',
          _mode: 'plural',
        },
        year: {
          '=1': 'Anual',
          '=2': 'A cada 2 anos',
          other: 'A cada # anos',
          _mode: 'plural',
        },
      },
      perSeat: 'por utilizador',
      seats: {
        label: 'Licenças',
        numberOfSeats: 'Número de licenças',
        count: {
          '=1': '# licença',
          other: '# licenças',
          _mode: 'plural',
        },
        range: '{min} - {max} licenças',
        minimum: 'Mínimo de {min} licenças',
        maximum: 'Máximo de {max} licenças',
        updateFailed: 'Não foi possível atualizar as licenças',
        included: {
          '=1': '1 licença incluída',
          other: '# licenças incluídas',
          _mode: 'plural',
        },
      },
      inclTax: 'IVA (incluído)',
      basePrice: 'Preço base',
    },
    trial: {
      hero: {
        free: {
          day: {
            '=1': '# dia grátis',
            other: '# dias grátis',
            _mode: 'plural',
          },
          month: {
            '=1': '# mês grátis',
            other: '# meses grátis',
            _mode: 'plural',
          },
          year: {
            '=1': '# ano grátis',
            other: '# anos grátis',
            _mode: 'plural',
          },
        },
        intervalSuffix: {
          day: '/dia',
          week: '/semana',
          month: '/mês',
          year: '/ano',
        },
        then: 'Depois',
        startingDate: 'a partir de {date}',
      },
    },
    pwywForm: {
      label: 'Defina um preço justo',
      minimum: 'Mínimo de {amount}',
      amountMinimum: 'O valor deve ser de pelo menos {min}',
      amountFreeOrMinimum: 'O valor deve ser {zero} ou pelo menos {min}',
    },
    productSwitcher: {
      billedRecurring: 'Cobrado {frequency}',
      oneTimePurchase: 'Pagamento único',
      fromPrefix: 'A partir de',
    },
    benefits: {
      granting: 'Liberando benefícios...',
      requestNewInvite: 'Solicitar novo convite',
      retryIn: {
        '=1': 'Tente novamente em # segundo',
        other: 'Tente novamente em # segundos',
        _mode: 'plural',
      },
      connectNewAccount: 'Conectar nova conta',
      requestMyInvite: 'Solicitar meu convite',
      github: {
        connect: 'Conectar conta do GitHub',
        goTo: 'Ir para {repository}',
        selectAccount: 'Selecione uma conta do GitHub',
      },
      discord: {
        connect: 'Conectar conta do Discord',
        open: 'Abrir Discord',
        selectAccount: 'Selecione uma conta do Discord',
      },
      licenseKey: {
        copy: 'Copiar',
        copiedToClipboard: 'Copiado para a área de transferência',
        copiedToClipboardDescription:
          'A chave de licença foi copiada para a área de transferência',
        loading: 'Carregando...',
        status: 'Status',
        statusGranted: 'Concedida',
        statusRevoked: 'Revogada',
        statusDisabled: 'Desativada',
        usage: 'Uso',
        validations: 'Validações',
        validatedAt: 'Validada em',
        neverValidated: 'Nunca validada',
        expiryDate: 'Data de expiração',
        noExpiry: 'Sem expiração',
        activations: 'Ativações',
        activationDeleted: 'Ativação da chave de licença excluída',
        activationDeletedDescription: 'Ativação excluída com sucesso',
        activationDeactivationFailed: 'Falha na desativação',
      },
      slackSharedChannel: {
        connected: 'Ligado ao seu espaço de trabalho Slack.',
        connectedChannel:
          'Ligado ao seu espaço de trabalho Slack no canal {channel}.',
        inviteSent: 'Convite enviado para {email}.',
        channel: 'Canal: {channel}.',
        openLinkToAccept: 'Abra a ligação para aceitar no Slack.',
        acceptFromEmail:
          'Aceite-o a partir do email do convite ou dos seus pedidos do Slack Connect.',
        openInvite: 'Abrir convite do Slack',
        provisioning:
          'A configurar o seu canal do Slack para {email}... Deverá receber um convite na sua caixa de entrada em breve.',
        setupFailed:
          'Não foi possível configurar o seu canal do Slack com {email}. Verifique o email e tente novamente, ou contacte o vendedor se continuar a falhar.',
        enterEmail:
          'Introduza o email de um administrador no seu espaço de trabalho Slack. Ele irá receber um convite do Slack Connect para um canal privado.',
        emailPlaceholder: 'slack-admin@yourcompany.com',
        tryAgain: 'Tentar novamente',
        requestInvite: 'Pedir convite do Slack',
      },
    },
    confirmation: {
      confirmPayment: 'Confirmar pagamento',
      processingTitle: 'Estamos processando seu pedido',
      failedTitle: 'Ocorreu um problema ao processar seu pedido',
      processingDescription: 'Aguarde enquanto confirmamos seu pagamento.',
      failedDescription: 'Tente novamente ou entre em contato com o suporte.',
      successTitle: 'Obrigado pela sua encomenda!',
      successDescription: 'Agora já tem acesso a {product}.',
    },
    loading: {
      processingOrder: 'Processando pedido...',
      processingPayment: 'Processando pagamento',
      paymentSuccessful: 'Pagamento realizado! Preparando seus produtos...',
      confirmationTokenFailed:
        'Falha ao criar token de confirmação, tente novamente mais tarde.',
    },
    cta: {
      startTrial: 'Começar teste',
      subscribeNow: 'Assinar agora',
      payNow: 'Pagar agora',
      getFree: 'Obter grátis',
      paymentsUnavailable: 'Pagamentos indisponíveis no momento',
    },
    productDescription: {
      readMore: 'Ler mais',
    },
  },
  intervals: {
    short: {
      day: 'dia',
      week: 'sem',
      month: 'mês',
      year: 'ano',
    },
  },
  benefitTypes: {
    custom: 'Personalizado',
    license_keys: 'Chaves de licença',
    github_repository: 'Acesso a repositório GitHub',
    discord: 'Convite do Discord',
    downloadables: 'Download de arquivos',
    meter_credit: 'Créditos de uso',
    feature_flag: 'Feature flag',
    slack_shared_channel: 'Canal partilhado do Slack',
  },
  ordinal: {
    zero: 'º',
    one: 'º',
    two: 'º',
    few: 'º',
    many: 'º',
    other: 'º',
  },
  embedPaymentMethod: {
    title: 'Adicionar método de pagamento',
    close: 'Fechar',
    submit: 'Adicionar método de pagamento',
    processing: 'A adicionar método de pagamento…',
    fallbackError: 'Algo correu mal. Tente novamente.',
    errors: {
      invalidRequest: 'Faltam parâmetros obrigatórios.',
      unauthorized: 'Sessão expirou.',
      processingFailed:
        'Não foi possível processar o método de pagamento. Tente novamente.',
      unknown: 'Algo correu mal.',
    },
  },
} as const
