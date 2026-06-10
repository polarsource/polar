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
      addBusinessDetails: 'Adicionar dados da empresa',
      removeBusinessDetails: 'Remover dados da empresa',
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
      summary: {
        totalWhenTrialEnds: 'Total após o período experimental',
        totalWhenDiscountExpires: 'Total após o desconto expirar',
        totalDueToday: 'Total a pagar hoje',
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
      readLess: 'Ler menos',
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
  portal: {
    navigation: {
      overview: 'Visão geral',
      orders: 'Encomendas',
      usage: 'Utilização',
      billing: 'Faturação',
      selectPage: 'Selecionar página',
    },
    common: {
      cancel: 'Cancelar',
      close: 'Fechar',
      save: 'Guardar',
      saveChanges: 'Guardar alterações',
      edit: 'Editar',
      delete: 'Eliminar',
      confirm: 'Confirmar',
      back: 'Anterior',
      loading: 'A carregar…',
      saving: 'A guardar…',
      download: 'Transferir',
      viewAll: 'Ver tudo',
      somethingWentWrong: 'Ocorreu um erro. Tente novamente.',
      date: 'Data',
      amount: 'Valor',
      status: 'Estado',
      product: 'Produto',
      actions: 'Ações',
      pageOf: 'Página {page} de {totalPages}',
    },
    overview: {
      teamSeatAccess: {
        title: 'Acesso a lugares da equipa',
        description: 'Acesso fornecido através da subscrição de equipa',
      },
      emptyState: {
        noActiveSubscriptions: {
          title: 'Sem subscrições ativas',
          description: 'Não tem subscrições ativas neste momento.',
        },
        noTeamAccess: {
          title: 'Sem acesso de equipa',
          description: 'Não tem acesso a lugares da equipa neste momento.',
        },
      },
      currentPeriod: {
        nextCharge: 'Próximo pagamento',
        nextInvoice: 'Próxima fatura',
        firstChargeAfterTrial: 'Primeiro pagamento após o período experimental',
        trialEnds: 'Fim do período experimental',
        finalCharge: 'Último pagamento',
        subscriptionEnds: 'Fim da subscrição',
        notAvailable: 'N/D',
        dateLabel: '{label} — {date}',
        canceled: 'Cancelada',
        meteredCharges: 'Cobranças por utilização',
        subtotal: 'Subtotal',
        discount: 'Desconto',
        taxes: 'Impostos',
        estimatedTotal: 'Total estimado',
        total: 'Total',
        finalChargeNotice:
          'Esta será a última cobrança antes de a subscrição terminar.',
        finalChargeMeteredNotice:
          'O valor final pode variar consoante a utilização até ao fim do período de faturação.',
        meteredNoticeActive:
          'As cobranças finais podem variar consoante a utilização até ao fim do período de faturação.',
        meteredNoticeTrialing:
          'As cobranças finais podem variar consoante a utilização durante o período experimental.',
        meteredNoticeDefault: 'As cobranças finais podem variar.',
      },
      latestPurchase: {
        title: 'Compra mais recente',
        purchasedOn: 'Comprado — {date}',
        total: 'Total',
      },
      subscriptions: {
        title: 'Subscrições',
        noSubscriptionsFound: 'Sem subscrições',
        inactiveTitle: 'Subscrições inativas',
        endedAt: 'Terminado em',
        retryPayment: 'Tentar novamente o pagamento',
        manageSubscription: 'Gerir subscrição',
      },
    },
    orders: {
      orderHistory: 'Histórico de encomendas',
      description: 'Descrição',
      viewOrder: 'Ver encomenda',
      retryPayment: 'Tentar novamente o pagamento',
      invoiceNumber: 'Número da fatura',
      orderItems: 'Itens da encomenda',
      subtotal: 'Subtotal',
      discount: 'Desconto',
      netAmount: 'Valor líquido',
      tax: 'Imposto',
      total: 'Total',
      appliedBalance: 'Saldo aplicado',
      toBePaid: 'A pagar',
      refundedAmount: 'Valor reembolsado',
      statusTitle: {
        draft: 'Rascunho',
        paid: 'Pago',
        pending: 'Pendente',
        refunded: 'Reembolsado',
        partiallyRefunded: 'Parcialmente reembolsado',
        void: 'Anulado',
      },
      payment: {
        orderSummary: 'Resumo da encomenda',
        descriptionLabel: 'Descrição:',
        amountLabel: 'Valor:',
        paymentMethod: 'Método de pagamento',
        payNow: 'Pagar agora',
        processing: 'A processar...',
        confirming: 'A confirmar...',
        loading: 'A carregar...',
        processingPayment: 'A processar o seu pagamento...',
        processingHint:
          'Isto pode demorar alguns momentos. Não feche esta janela.',
        processingPaymentShort: 'A processar pagamento...',
        usingSavedMethod: 'A usar o seu método de pagamento guardado',
        tryAgain: 'Tentar novamente',
        paymentSuccessfulTitle: 'Pagamento realizado com sucesso!',
        paymentFailedTitle: 'Falha no pagamento',
        paymentSuccessfulDescription:
          'Obrigado pelo seu pagamento. Pode fechar esta janela agora.',
        paymentFailedDescription:
          'Pode tentar novamente ou contactar o apoio se o problema persistir.',
        updatePaymentMethod: 'Atualizar método de pagamento',
        toastSuccessTitle: 'Pagamento realizado com sucesso',
        toastSuccessDescription: 'O seu pagamento foi processado com sucesso!',
        toastFailedTitle: 'Falha no pagamento',
        paymentFailed: 'O pagamento falhou',
        paymentFailedRetry: 'O pagamento falhou. Tente novamente.',
        paymentFailedTryAgain: 'O pagamento falhou, tente novamente.',
        confirmationTimeout:
          'A confirmação do pagamento está a demorar mais do que o esperado. O seu pagamento pode ainda estar a ser processado. Verifique o estado da sua encomenda ou contacte o apoio, se necessário.',
        networkConfirmationError:
          'Não foi possível confirmar o estado do pagamento devido a problemas de rede. Verifique o estado da sua encomenda ou contacte o apoio.',
        stripeRequired:
          'É necessária uma instância Stripe para ações de pagamento',
        additionalAuthenticationRequired:
          'O pagamento requer autenticação adicional',
        authenticationFailed: 'Falha na autenticação do pagamento',
        processDetailsFailed:
          'Não foi possível processar os detalhes do pagamento. Verifique as suas informações e tente novamente.',
        createTokenFailed:
          'Não foi possível criar o token de pagamento. Tente novamente.',
        processPaymentFailed:
          'Não foi possível processar o pagamento. Verifique as suas informações de pagamento e tente novamente.',
        networkError:
          'Ocorreu um erro de rede. Verifique a sua ligação e tente novamente.',
      },
    },
    subscription: {
      free: 'Grátis',
      details: {
        startDate: 'Data de início',
        trialEnds: 'Fim do período experimental',
        expiryDate: 'Data de expiração',
        renewalDate: 'Data de renovação',
        expired: 'Expirada',
        meteredUsage: 'Utilização medida',
        uncancel: 'Cancelar cancelamento',
        manageSubscription: 'Gerir subscrição',
        changePlan: 'Alterar plano',
      },
      pendingUpdate: {
        title: 'Atualização pendente',
        cancelScheduledChange: 'Cancelar alteração agendada',
        newProduct: 'Novo produto',
        seats: 'Lugares',
        effectiveFrom: 'A atualização entra em vigor a partir de',
        clearConfirmDescription:
          'A sua subscrição permanecerá inalterada no próximo ciclo de faturação. Tem a certeza de que quer cancelar esta atualização pendente?',
      },
      invoices: {
        title: 'Faturas',
      },
      cancel: {
        title: 'Cancelar subscrição',
        ariaLabel: 'Cancelar subscrição',
        heading: 'Lamentamos vê-lo partir!',
        description:
          'Será sempre bem-vindo de volta! Diga-nos porque está a sair para nos ajudar a melhorar o nosso produto.',
        changedMind: 'Mudei de ideias',
        commentPlaceholder: 'Quer partilhar mais alguma coisa? (Opcional)',
        reason: {
          unused: 'Não o uso o suficiente',
          tooExpensive: 'Demasiado caro',
          missingFeatures: 'Faltam funcionalidades',
          switchedService: 'Mudei para outro serviço',
          customerService: 'Apoio ao cliente',
          lowQuality: 'Não estou satisfeito com a qualidade',
          tooComplex: 'Demasiado complicado',
          other: 'Outro (partilhe abaixo)',
        },
        toast: {
          title: 'Subscrição cancelada',
          description: 'A subscrição foi cancelada com sucesso',
        },
      },
      changePlan: {
        title: 'Alterar plano',
        currentPlan: 'Plano atual',
        availablePlans: 'Planos disponíveis',
        noOtherPlans: 'Não há outros planos disponíveis',
        benefitsAdded: 'Terá acesso aos seguintes benefícios',
        benefitsRemoved: 'Perderá acesso aos seguintes benefícios',
        needPaymentMethod:
          'Tem de adicionar um método de pagamento antes de atualizar o seu plano. Aceda às Definições do Portal do Cliente para adicionar um método de pagamento.',
        confirmEndTrial: 'Alterar plano e terminar período experimental',
        invoicing: {
          trialContinues:
            'O seu período experimental continuará até {date}. Não será cobrado antes disso.',
          trialEnds:
            'Isto terminará o meu período experimental e cobrará imediatamente {product}.',
          periodMonthly: 'mensal',
          periodYearly: 'anual',
          immediateCharge:
            'Serei cobrado imediatamente pelo novo plano {period}.',
          immediateCredit:
            'O meu pagamento anterior aparecerá como crédito na minha próxima fatura.',
          prorationInvoice:
            'Serei cobrado imediatamente com um acerto proporcional para o mês em curso.',
          prorationProrate:
            'A sua próxima fatura incluirá o novo plano mais o acerto proporcional para o mês em curso.',
          prorationNextPeriod:
            'O novo plano será aplicado no seu próximo ciclo de faturação.',
        },
        update: {
          failed: 'Não foi possível atualizar a subscrição',
          errorTitle: 'Erro ao atualizar a subscrição',
          successTitle: 'Subscrição atualizada',
          successDescription: 'A subscrição foi atualizada com sucesso',
        },
      },
    },
    settings: {
      title: 'Definições de faturação',
      paymentMethods: {
        title: 'Métodos de pagamento',
        description: 'Métodos usados para subscrições e compras únicas',
        add: 'Adicionar método de pagamento',
        addedTitle: 'Método de pagamento adicionado',
        addFailedTitle: 'Não foi possível adicionar o método de pagamento',
        addFailedDescription: 'Tente novamente.',
      },
      paymentMethod: {
        defaultMethod: 'Método predefinido',
        makeDefault: 'Tornar predefinido',
        deleteAriaLabel: 'Eliminar método de pagamento',
        deletedTitle: 'Método de pagamento eliminado',
        deletedDescription:
          'O seu método de pagamento foi removido com sucesso.',
        deleteFailedTitle: 'Falha ao eliminar o método de pagamento',
        deleteFailedDescription:
          'Ocorreu um erro ao eliminar o método de pagamento.',
        defaultUpdatedTitle: 'Método de pagamento predefinido atualizado',
        defaultUpdatedDescription:
          'Este método de pagamento é agora o seu predefinido.',
        defaultUpdateFailedTitle:
          'Falha ao atualizar o método de pagamento predefinido',
        defaultUpdateFailedDescription:
          'Ocorreu um erro ao atualizar o método de pagamento predefinido.',
      },
      savedCards: {
        title: 'Métodos de pagamento guardados',
        empty: 'Não foram encontrados métodos de pagamento guardados.',
        addNewCard: 'Adicionar novo cartão',
        useDifferentCard: 'Usar outro cartão',
        expires: 'Expira {date}',
      },
      billingDetailsSection: {
        title: 'Dados de faturação',
        description: 'Atualize os seus dados de faturação',
      },
      billingDetails: {
        email: 'Email',
        billingName: 'Nome de faturação',
        billingNamePlaceholder:
          'Nome da empresa ou nome legal para faturas (opcional)',
        billingAddress: 'Morada de faturação',
        line1: 'Linha 1',
        line2: 'Linha 2',
        postalCode: 'Código postal',
        city: 'Cidade',
        state: 'Estado',
        province: 'Província',
        taxId: 'NIF',
        fieldRequired: 'Este campo é obrigatório',
        submit: 'Atualizar dados de faturação',
      },
      emailSection: {
        title: 'Endereço de email',
        description: 'Altere o email associado à sua conta',
      },
      changeEmail: {
        currentEmail: 'Email atual',
        newEmail: 'Novo email',
        newEmailPlaceholder: 'Introduza o novo endereço de email',
        emailRequired: 'O email é obrigatório',
        requestChange: 'Pedir alteração de email',
        sendVerification: 'Enviar verificação',
        nevermind: 'Não importa',
        verificationSentPrefix: 'Enviámos um link de verificação para',
        verificationSentSuffix:
          '. Siga as instruções para confirmar o seu novo email.',
        verificationSentHint:
          'Mudou de ideias? Basta ignorar o email e o seu endereço atual continuará ativo.',
      },
      billingManagers: {
        title: 'Gestores de faturação',
        description:
          'Os gestores de faturação podem gerir dados de faturação, métodos de pagamento e subscrições.',
      },
      privacy: {
        title: 'Privacidade',
        description: 'Descarregue uma cópia de todos os seus dados pessoais',
        exportData: 'Exportar dados',
      },
      team: {
        roles: {
          owner: 'Proprietário',
          billingManager: 'Gestor de faturação',
          member: 'Membro',
        },
        emailPlaceholder: 'email@example.com',
        emailRequired: 'O email é obrigatório',
        invalidEmail: 'Formato de email inválido',
        invite: 'Convidar gestor de faturação',
        columnMember: 'Membro',
        columnRole: 'Função',
        you: '(você)',
        removeFromTeam: 'Remover da equipa',
        memberFallback: 'Membro',
        thisMemberFallback: 'este membro',
        genericError: 'Ocorreu um erro.',
        addedTitle: 'Gestor de faturação adicionado',
        addedDescription: '{email} foi adicionado como gestor de faturação.',
        addFailedTitle: 'Falha ao adicionar gestor de faturação',
        roleUpdatedTitle: 'Função atualizada',
        roleUpdatedDescription: '{name} é agora um(a) {role}.',
        roleUpdateFailedTitle: 'Falha ao atualizar a função',
        removedTitle: 'Membro removido',
        removedDescription: '{name} foi removido(a) da equipa.',
        removeFailedTitle: 'Falha ao remover membro',
        removeModalTitle: 'Remover membro da equipa',
        removeModalDescription:
          'Tem a certeza de que quer remover {name} da equipa? Essa pessoa perderá acesso a todos os recursos da equipa.',
        removeConfirm: 'Remover',
      },
    },
    usage: {
      title: 'Utilização',
      searchPlaceholder: 'Pesquisar contador de utilização',
      overview: 'Visão geral',
      columnName: 'Nome',
      columnConsumed: 'Consumido',
      columnCredited: 'Creditado',
      columnBalance: 'Saldo',
    },
    benefits: {
      title: 'Concessões de benefícios',
      searchPlaceholder: 'Pesquisar concessões de benefícios...',
      empty: 'Não foram encontradas concessões de benefícios',
    },
    seats: {
      title: 'Gestão de lugares',
      totalSeats: 'Total de lugares',
      updateSeats: 'Atualizar lugares',
      columnEmail: 'Email',
      statusLabel: {
        pending: 'Pendente',
        claimed: 'Reivindicado',
        revoked: 'Revogado',
      },
      resendInvitation: 'Reenviar convite',
      revokeSeat: 'Revogar lugar',
      invite: 'Convidar',
      inviteMember: 'Convidar membro',
      emailRequired: 'O email é obrigatório',
      emailInvalid: 'Formato de email inválido',
      assignError: 'Falha ao atribuir lugar',
      invitationSendError: 'Falha ao enviar convite',
      genericError: 'Ocorreu um erro.',
      seatCount: {
        '=1': '# lugar',
        other: '# lugares',
        _mode: 'plural',
      },
      availableSeats: {
        '=1': 'Disponível mais 1 lugar',
        other: 'Disponíveis mais # lugares',
        _mode: 'plural',
      },
      cannotDecrease: {
        '=1': 'Não é possível reduzir abaixo de # lugar atribuído. Revogue primeiro os lugares.',
        other:
          'Não é possível reduzir abaixo de # lugares atribuídos. Revogue primeiro os lugares.',
        _mode: 'plural',
      },
      invoicingMessage: {
        invoice:
          'Serei cobrado imediatamente com um acerto proporcional para o mês em curso.',
        prorate:
          'A sua próxima fatura incluirá os lugares atualizados mais o acerto proporcional para o mês em curso.',
        nextPeriod:
          'A atualização dos lugares será aplicada no seu próximo ciclo de faturação.',
      },
      updateSuccess: {
        title: 'Lugares atualizados',
        invoice:
          'A subscrição passa a ter {seats}. Serei cobrado imediatamente com um acerto proporcional para o mês em curso.',
        prorate:
          'A subscrição passa a ter {seats}. A sua próxima fatura incluirá os lugares atualizados mais o acerto proporcional para o mês em curso.',
        nextPeriod:
          'A subscrição terá {seats} a partir do seu próximo ciclo de faturação.',
        default: 'A subscrição passa a ter {seats}.',
      },
      updateError: {
        title: 'Erro ao atualizar lugares',
        description: 'Falha ao atualizar lugares',
        unexpected: 'Ocorreu um erro inesperado',
      },
      revokeSuccess: {
        title: 'Lugar revogado com sucesso',
        description: 'O lugar foi revogado e está agora disponível.',
      },
      revokeError: {
        title: 'Falha ao revogar lugar',
      },
      resendSuccess: {
        title: 'Convite reenviado',
        description: 'O email de convite foi enviado novamente.',
      },
      resendError: {
        title: 'Falha ao reenviar convite',
      },
    },
    wallet: {
      availableBalance: 'Saldo disponível',
      organization: 'Organização',
      currency: 'Moeda',
    },
  },
} as const
