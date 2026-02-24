export default {
  checkout: {
    footer: {
      poweredBy: 'Desenvolvido por',
      merchantOfRecord:
        'Este pedido é processado pela Polar, nossa parceira de vendas online, responsável pela cobrança, suporte ao pedido e devoluções.',
      mandateSubscriptionTrial:
        'Ao clicar em "{buttonLabel}", autoriza a Polar Software, Inc., nossa parceira de vendas online, a cobrar o método de pagamento selecionado pelo valor indicado acima no final do seu período experimental e em cada data de faturação subsequente até cancelar. Pode cancelar a qualquer momento antes do fim do período experimental para evitar a cobrança.',
      mandateSubscription:
        'Ao clicar em "{buttonLabel}", autoriza a Polar Software, Inc., nossa parceira de vendas online, a cobrar imediatamente o método de pagamento selecionado pelo valor indicado acima e a cobrar o mesmo valor em cada data de faturação subsequente até cancelar.',
      mandateOneTime:
        'Ao clicar em "{buttonLabel}", autoriza a Polar Software, Inc., nossa parceira de vendas online, a cobrar o método de pagamento selecionado pelo valor indicado acima. Esta é uma cobrança única.',
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
      addBusinessDetails: 'Adicionar dados da empresa',
      removeBusinessDetails: 'Remover dados da empresa',
      billingDetails: 'Dados da Empresa',
    },
    pricing: {
      subtotal: 'Subtotal',
      taxableAmount: 'Valor tributável',
      taxes: 'Impostos',
      free: 'Grátis',
      payWhatYouWant: 'Pague quanto quiser',
      total: 'Total',
      additionalMeteredUsage: 'Uso adicional',
      perUnit: '/ unidade',
      discount: {
        duration: {
          months: {
            '=1': 'no primeiro mês',
            other: 'nos primeiros # meses',
            _mode: 'plural',
          },
          years: {
            '=1': 'no primeiro ano',
            other: 'nos primeiros # anos',
            _mode: 'plural',
          },
        },
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
    },
    trial: {
      ends: 'Teste termina a {endDate}',
      duration: {
        days: {
          '=1': 'Teste de # dia',
          other: 'Teste de # dias',
          _mode: 'plural',
        },
        weeks: {
          '=1': 'Teste de # semana',
          other: 'Teste de # semanas',
          _mode: 'plural',
        },
        months: {
          '=1': 'Teste de # mês',
          other: 'Teste de # meses',
          _mode: 'plural',
        },
        years: {
          '=1': 'Teste de # ano',
          other: 'Teste de # anos',
          _mode: 'plural',
        },
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
    },
    card: {
      included: 'Incluso',
    },
    benefits: {
      moreBenefits: {
        '=1': 'mais # benefício',
        other: 'mais # benefícios',
        _mode: 'plural',
      },
      showMoreBenefits: {
        '=1': 'Mostrar mais # benefício',
        other: 'Mostrar mais # benefícios',
        _mode: 'plural',
      },
      showLess: 'Mostrar menos',
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
    },
    confirmation: {
      confirmPayment: 'Confirmar pagamento',
      processingTitle: 'Estamos processando seu pedido',
      successTitle: 'Seu pedido foi realizado com sucesso!',
      failedTitle: 'Ocorreu um problema ao processar seu pedido',
      processingDescription: 'Aguarde enquanto confirmamos seu pagamento.',
      successDescription: 'Agora você tem acesso aos benefícios de {product}.',
      failedDescription: 'Tente novamente ou entre em contato com o suporte.',
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
    license_keys: 'Chaves de licença',
    github_repository: 'Acesso a repositório GitHub',
    discord: 'Convite do Discord',
    downloadables: 'Download de arquivos',
    custom: 'Personalizado',
    meter_credit: 'Créditos de uso',
  },
  ordinal: {
    zero: 'º',
    one: 'º',
    two: 'º',
    few: 'º',
    many: 'º',
    other: 'º',
  },
} as const
