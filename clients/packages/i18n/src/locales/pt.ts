export default {
  checkout: {
    footer: {
      poweredBy: 'Desenvolvido por',
      merchantOfRecord:
        'Este pedido é processado pela Polar, nossa parceira de vendas online, responsável pela cobrança, suporte ao pedido e devoluções.',
      mandateSubscriptionTrial:
        'Ao clicar em "{buttonLabel}", você autoriza a Polar Software, Inc., nossa revendedora online e comerciante responsável, a cobrar o valor mostrado acima no seu método de pagamento selecionado no final do seu período de teste e em cada data de cobrança subsequente até que você cancele, e concorda com os {buyerTermsLink}. Você pode cancelar a qualquer momento antes do final do seu teste para evitar a cobrança.',
      mandateSubscription:
        'Ao clicar em "{buttonLabel}", você autoriza a Polar Software, Inc., nossa revendedora online e comerciante responsável, a cobrar imediatamente o valor mostrado acima no seu método de pagamento selecionado e a cobrar o mesmo valor em cada data de cobrança subsequente até que você cancele, e concorda com os {buyerTermsLink}.',
      buyerTermsLink: 'Termos de Compra',
      mandateOneTime:
        'Ao clicar em "{buttonLabel}", você autoriza a Polar Software, Inc., nossa revendedora online e vendedora oficial, a cobrar o valor mostrado acima na sua forma de pagamento selecionada e concorda com os {buyerTermsLink}. Esta é uma cobrança única.',
    },
    form: {
      email: 'E-mail',
      cardholderName: 'Nome do titular',
      purchasingAsBusiness: 'Estou comprando como uma empresa',
      businessName: 'Nome da empresa',
      billingAddress: {
        label: 'Endereço de cobrança',
        line1: 'Endereço',
        line2: 'Complemento',
        postalCode: 'CEP',
        city: 'Cidade',
        country: 'País',
        state: 'Estado',
        province: 'Província',
        stateProvince: 'Estado / Província',
      },
      taxId: 'CNPJ',
      discountCode: 'Código de desconto',
      optional: 'Opcional',
      apply: 'Aplicar',
      fieldRequired: 'Este campo é obrigatório',
      addBusinessDetails: 'Adicionar dados da empresa',
      removeBusinessDetails: 'Remover dados da empresa',
      billingDetails: 'Dados da empresa',
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
      perSeat: 'por usuário',
      seats: {
        label: 'Usuários',
        numberOfSeats: 'Número de usuários',
        count: {
          '=1': '# usuário',
          other: '# usuários',
          _mode: 'plural',
        },
        range: '{min} - {max} usuários',
        minimum: 'Mínimo de {min} usuários',
        maximum: 'Máximo de {max} usuários',
        updateFailed: 'Falha ao atualizar os usuários',
        included: {
          '=1': '1 usuário incluído',
          other: '# usuários incluídos',
          _mode: 'plural',
        },
      },
      inclTax: 'Impostos (inclusos)',
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
        totalWhenTrialEnds: 'Total ao final do teste',
        totalWhenDiscountExpires: 'Total quando o desconto expirar',
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
      successTitle: 'Obrigado pela sua compra!',
      successDescription: 'Agora você tem acesso a {product}.',
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
    title: 'Adicionar forma de pagamento',
    close: 'Fechar',
    submit: 'Adicionar forma de pagamento',
    processing: 'Adicionando forma de pagamento…',
    fallbackError: 'Algo deu errado. Tente novamente.',
    errors: {
      invalidRequest: 'Parâmetros obrigatórios ausentes.',
      unauthorized: 'Sessão expirada.',
      processingFailed:
        'Não foi possível processar a forma de pagamento. Tente novamente.',
      unknown: 'Algo deu errado.',
    },
  },
  portal: {
    navigation: {
      overview: 'Visão geral',
      orders: 'Pedidos',
      usage: 'Uso',
      billing: 'Cobrança',
      selectPage: 'Selecionar página',
    },
    common: {
      cancel: 'Cancelar',
      close: 'Fechar',
      save: 'Salvar',
      saveChanges: 'Salvar alterações',
      edit: 'Editar',
      delete: 'Excluir',
      confirm: 'Confirmar',
      back: 'Voltar',
      loading: 'Carregando…',
      saving: 'Salvando…',
      download: 'Baixar',
      viewAll: 'Ver tudo',
      somethingWentWrong: 'Algo deu errado. Tente novamente.',
      date: 'Data',
      amount: 'Valor',
      status: 'Status',
      product: 'Produto',
      actions: 'Ações',
      pageOf: 'Página {page} de {totalPages}',
    },
    overview: {
      teamSeatAccess: {
        title: 'Acesso à vaga da equipe',
        description: 'Acesso fornecido por assinatura da equipe',
      },
      emptyState: {
        noActiveSubscriptions: {
          title: 'Sem assinaturas ativas',
          description: 'Você não tem nenhuma assinatura ativa no momento.',
        },
        noTeamAccess: {
          title: 'Sem acesso da equipe',
          description: 'Você não tem acesso a vagas da equipe no momento.',
        },
      },
      currentPeriod: {
        nextCharge: 'Próxima cobrança',
        nextInvoice: 'Próxima fatura',
        firstChargeAfterTrial: 'Primeira cobrança após o teste',
        trialEnds: 'Fim do teste',
        finalCharge: 'Cobrança final',
        subscriptionEnds: 'Fim da assinatura',
        notAvailable: 'N/D',
        dateLabel: '{label} — {date}',
        canceled: 'Cancelado',
        meteredCharges: 'Cobranças por uso',
        subtotal: 'Subtotal',
        discount: 'Desconto',
        taxes: 'Impostos',
        estimatedTotal: 'Total estimado',
        total: 'Total',
        finalChargeNotice:
          'Esta será a cobrança final antes do fim da assinatura.',
        finalChargeMeteredNotice:
          'O valor final pode variar conforme o uso até o fim do período de cobrança.',
        meteredNoticeActive:
          'As cobranças finais podem variar conforme o uso até o fim do período de cobrança.',
        meteredNoticeTrialing:
          'As cobranças finais podem variar conforme o uso durante o período de teste.',
        meteredNoticeDefault: 'As cobranças finais podem variar.',
      },
      latestPurchase: {
        title: 'Última compra',
        purchasedOn: 'Comprado — {date}',
        total: 'Total',
      },
      subscriptions: {
        title: 'Assinaturas',
        noSubscriptionsFound: 'Nenhuma assinatura encontrada',
        inactiveTitle: 'Assinaturas inativas',
        endedAt: 'Encerrada em',
        retryPayment: 'Tentar pagamento novamente',
        manageSubscription: 'Gerenciar assinatura',
      },
    },
    orders: {
      orderHistory: 'Histórico de pedidos',
      description: 'Descrição',
      viewOrder: 'Ver pedido',
      retryPayment: 'Tentar pagamento novamente',
      invoiceNumber: 'Número da fatura',
      orderItems: 'Itens do pedido',
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
        void: 'Cancelado',
      },
      payment: {
        orderSummary: 'Resumo do pedido',
        descriptionLabel: 'Descrição:',
        amountLabel: 'Valor:',
        paymentMethod: 'Forma de pagamento',
        payNow: 'Pagar agora',
        processing: 'Processando...',
        confirming: 'Confirmando...',
        loading: 'Carregando...',
        processingPayment: 'Processando seu pagamento...',
        processingHint:
          'Isso pode levar alguns instantes. Não feche esta janela.',
        processingPaymentShort: 'Processando pagamento...',
        usingSavedMethod: 'Usando sua forma de pagamento salva',
        tryAgain: 'Tentar novamente',
        paymentSuccessfulTitle: 'Pagamento realizado com sucesso!',
        paymentFailedTitle: 'Falha no pagamento',
        paymentSuccessfulDescription:
          'Obrigado pelo pagamento. Agora você pode fechar esta janela.',
        paymentFailedDescription:
          'Você pode tentar novamente ou entrar em contato com o suporte se o problema continuar.',
        updatePaymentMethod: 'Atualizar forma de pagamento',
        toastSuccessTitle: 'Pagamento realizado com sucesso',
        toastSuccessDescription: 'Seu pagamento foi processado com sucesso!',
        toastFailedTitle: 'Falha no pagamento',
        paymentFailed: 'Pagamento falhou',
        paymentFailedRetry: 'Pagamento falhou. Tente novamente.',
        paymentFailedTryAgain: 'Pagamento falhou, tente novamente.',
        confirmationTimeout:
          'A confirmação do pagamento está demorando mais do que o esperado. Seu pagamento ainda pode estar em processamento. Verifique o status do seu pedido ou entre em contato com o suporte, se necessário.',
        networkConfirmationError:
          'Não foi possível confirmar o status do pagamento devido a problemas de rede. Verifique o status do seu pedido ou entre em contato com o suporte.',
        stripeRequired:
          'É necessária uma instância do Stripe para ações de pagamento',
        additionalAuthenticationRequired:
          'O pagamento requer autenticação adicional',
        authenticationFailed: 'Falha na autenticação do pagamento',
        processDetailsFailed:
          'Falha ao processar os dados de pagamento. Verifique suas informações e tente novamente.',
        createTokenFailed:
          'Falha ao criar o token de pagamento. Tente novamente.',
        processPaymentFailed:
          'Falha ao processar o pagamento. Verifique suas informações de pagamento e tente novamente.',
        networkError:
          'Ocorreu um erro de rede. Verifique sua conexão e tente novamente.',
      },
    },
    subscription: {
      free: 'Gratuito',
      details: {
        startDate: 'Data de início',
        trialEnds: 'Fim do teste',
        expiryDate: 'Data de expiração',
        renewalDate: 'Data de renovação',
        expired: 'Expirada',
        meteredUsage: 'Uso medido',
        uncancel: 'Desfazer cancelamento',
        manageSubscription: 'Gerenciar assinatura',
        changePlan: 'Alterar plano',
      },
      pendingUpdate: {
        title: 'Atualização pendente',
        cancelScheduledChange: 'Cancelar alteração agendada',
        newProduct: 'Novo produto',
        seats: 'Vagas',
        effectiveFrom: 'Em vigor a partir de',
        clearConfirmDescription:
          'Sua assinatura permanecerá inalterada no próximo ciclo de cobrança. Tem certeza de que deseja cancelar esta atualização pendente?',
      },
      invoices: {
        title: 'Faturas',
      },
      cancel: {
        title: 'Cancelar assinatura',
        ariaLabel: 'Cancelar assinatura',
        heading: 'Sentiremos sua falta!',
        description:
          'Você sempre será bem-vindo de volta! Conte-nos por que está saindo para nos ajudar a melhorar nosso produto.',
        changedMind: 'Mudei de ideia',
        commentPlaceholder:
          'Tem mais alguma coisa que queira compartilhar? (Opcional)',
        reason: {
          unused: 'Uso insuficiente',
          tooExpensive: 'Muito caro',
          missingFeatures: 'Faltam recursos',
          switchedService: 'Mudei para outro serviço',
          customerService: 'Atendimento ao cliente',
          lowQuality: 'Não estou satisfeito com a qualidade',
          tooComplex: 'Muito complicado',
          other: 'Outro (conte abaixo)',
        },
        toast: {
          title: 'Assinatura cancelada',
          description: 'A assinatura foi cancelada com sucesso',
        },
      },
      changePlan: {
        title: 'Alterar plano',
        currentPlan: 'Plano atual',
        availablePlans: 'Planos disponíveis',
        noOtherPlans: 'Não há outros planos disponíveis',
        benefitsAdded: 'Você terá acesso aos seguintes benefícios',
        benefitsRemoved: 'Você perderá acesso aos seguintes benefícios',
        needPaymentMethod:
          'Você precisa adicionar uma forma de pagamento antes de atualizar seu plano. Acesse as Configurações do Portal do Cliente para adicionar uma forma de pagamento.',
        confirmEndTrial: 'Alterar plano e encerrar teste',
        invoicing: {
          trialContinues:
            'Seu teste continuará até {date}. Você não será cobrado antes disso.',
          trialEnds:
            'Isso encerrará meu teste e me cobrará imediatamente por {product}.',
          periodMonthly: 'mensal',
          periodYearly: 'anual',
          immediateCharge:
            'Serei cobrado imediatamente pelo novo plano {period}.',
          immediateCredit:
            'Meu pagamento anterior aparecerá como crédito na minha próxima fatura.',
          prorationInvoice:
            'Serei cobrado imediatamente com um valor proporcional para o mês atual.',
          prorationProrate:
            'Sua próxima fatura incluirá o novo plano mais o valor proporcional do mês atual.',
          prorationNextPeriod:
            'O novo plano será aplicado no seu próximo ciclo de cobrança.',
        },
        update: {
          failed: 'Falha ao atualizar a assinatura',
          errorTitle: 'Erro ao atualizar a assinatura',
          successTitle: 'Assinatura atualizada',
          successDescription: 'A assinatura foi atualizada com sucesso',
        },
      },
    },
    settings: {
      title: 'Configurações de cobrança',
      paymentMethods: {
        title: 'Formas de pagamento',
        description: 'Formas usadas para assinaturas e compras avulsas',
        add: 'Adicionar forma de pagamento',
        addedTitle: 'Forma de pagamento adicionada',
        addFailedTitle: 'Não foi possível adicionar a forma de pagamento',
        addFailedDescription: 'Tente novamente.',
      },
      paymentMethod: {
        defaultMethod: 'Forma padrão',
        makeDefault: 'Definir como padrão',
        deleteAriaLabel: 'Excluir forma de pagamento',
        deletedTitle: 'Forma de pagamento excluída',
        deletedDescription: 'Sua forma de pagamento foi removida com sucesso.',
        deleteFailedTitle: 'Falha ao excluir a forma de pagamento',
        deleteFailedDescription:
          'Ocorreu um erro ao excluir a forma de pagamento.',
        defaultUpdatedTitle: 'Forma de pagamento padrão atualizada',
        defaultUpdatedDescription: 'Esta forma de pagamento agora é a padrão.',
        defaultUpdateFailedTitle:
          'Falha ao atualizar a forma de pagamento padrão',
        defaultUpdateFailedDescription:
          'Ocorreu um erro ao atualizar a forma de pagamento padrão.',
      },
      savedCards: {
        title: 'Formas de pagamento salvas',
        empty: 'Nenhuma forma de pagamento salva encontrada.',
        addNewCard: 'Adicionar novo cartão',
        useDifferentCard: 'Usar outro cartão',
        expires: 'Expira em {date}',
      },
      billingDetailsSection: {
        title: 'Dados de cobrança',
        description: 'Atualize seus dados de cobrança',
      },
      billingDetails: {
        email: 'E-mail',
        billingName: 'Nome de cobrança',
        billingNamePlaceholder:
          'Nome da empresa ou nome legal para faturas (opcional)',
        billingAddress: 'Endereço de cobrança',
        line1: 'Linha 1',
        line2: 'Linha 2',
        postalCode: 'CEP',
        city: 'Cidade',
        state: 'Estado',
        province: 'Província',
        taxId: 'CPF/CNPJ',
        fieldRequired: 'Este campo é obrigatório',
        submit: 'Atualizar dados de cobrança',
      },
      emailSection: {
        title: 'Endereço de e-mail',
        description: 'Altere o e-mail associado à sua conta',
      },
      changeEmail: {
        currentEmail: 'E-mail atual',
        newEmail: 'Novo e-mail',
        newEmailPlaceholder: 'Digite o novo endereço de e-mail',
        emailRequired: 'O e-mail é obrigatório',
        requestChange: 'Solicitar alteração de e-mail',
        sendVerification: 'Enviar verificação',
        nevermind: 'Deixa pra lá',
        verificationSentPrefix: 'Enviamos um link de verificação para',
        verificationSentSuffix:
          '. Siga as instruções para confirmar seu novo e-mail.',
        verificationSentHint:
          'Mudou de ideia? Basta ignorar o e-mail e seu endereço atual continuará ativo.',
      },
      billingManagers: {
        title: 'Gerentes de cobrança',
        description:
          'Os gerentes de cobrança podem gerenciar dados de cobrança, formas de pagamento e assinaturas.',
      },
      privacy: {
        title: 'Privacidade',
        description: 'Baixe uma cópia de todos os seus dados pessoais',
        exportData: 'Exportar dados',
      },
      team: {
        roles: {
          owner: 'Proprietário',
          billingManager: 'Gerente de cobrança',
          member: 'Membro',
        },
        emailPlaceholder: 'email@example.com',
        emailRequired: 'O e-mail é obrigatório',
        invalidEmail: 'Formato de e-mail inválido',
        invite: 'Convidar gerente de cobrança',
        columnMember: 'Membro',
        columnRole: 'Função',
        you: '(você)',
        removeFromTeam: 'Remover da equipe',
        memberFallback: 'Membro',
        thisMemberFallback: 'este membro',
        genericError: 'Ocorreu um erro.',
        addedTitle: 'Gerente de cobrança adicionado',
        addedDescription: '{email} foi adicionado como gerente de cobrança.',
        addFailedTitle: 'Falha ao adicionar gerente de cobrança',
        roleUpdatedTitle: 'Função atualizada',
        roleUpdatedDescription: '{name} agora é um(a) {role}.',
        roleUpdateFailedTitle: 'Falha ao atualizar a função',
        removedTitle: 'Membro removido',
        removedDescription: '{name} foi removido da equipe.',
        removeFailedTitle: 'Falha ao remover membro',
        removeModalTitle: 'Remover membro da equipe',
        removeModalDescription:
          'Tem certeza de que deseja remover {name} da equipe? Ele(a) perderá acesso a todos os recursos da equipe.',
        removeConfirm: 'Remover',
      },
    },
    usage: {
      title: 'Uso',
      searchPlaceholder: 'Pesquisar medidor de uso',
      overview: 'Visão geral',
      columnName: 'Nome',
      columnConsumed: 'Consumido',
      columnCredited: 'Creditado',
      columnBalance: 'Saldo',
    },
    benefits: {
      title: 'Concessões de benefícios',
      searchPlaceholder: 'Pesquisar concessões de benefícios...',
      empty: 'Nenhuma concessão de benefício encontrada',
    },
    seats: {
      title: 'Gerenciamento de vagas',
      totalSeats: 'Total de vagas',
      updateSeats: 'Atualizar vagas',
      columnEmail: 'E-mail',
      statusLabel: {
        pending: 'Pendente',
        claimed: 'Resgatada',
        revoked: 'Revogada',
      },
      resendInvitation: 'Reenviar convite',
      revokeSeat: 'Revogar vaga',
      invite: 'Convidar',
      inviteMember: 'Convidar membro',
      emailRequired: 'O e-mail é obrigatório',
      emailInvalid: 'Formato de e-mail inválido',
      assignError: 'Falha ao atribuir vaga',
      invitationSendError: 'Falha ao enviar convite',
      genericError: 'Ocorreu um erro.',
      seatCount: {
        '=1': '# vaga',
        other: '# vagas',
        _mode: 'plural',
      },
      availableSeats: {
        '=1': 'Mais uma vaga disponível',
        other: '# vagas disponíveis',
        _mode: 'plural',
      },
      cannotDecrease: {
        '=1': 'Não é possível reduzir abaixo de # vaga atribuída. Revogue as vagas primeiro.',
        other:
          'Não é possível reduzir abaixo de # vagas atribuídas. Revogue as vagas primeiro.',
        _mode: 'plural',
      },
      invoicingMessage: {
        invoice:
          'Serei cobrado imediatamente com um valor proporcional para o mês atual.',
        prorate:
          'Sua próxima fatura incluirá as vagas atualizadas mais o valor proporcional do mês atual.',
        nextPeriod:
          'A atualização das vagas será aplicada no seu próximo ciclo de cobrança.',
      },
      updateSuccess: {
        title: 'Vagas atualizadas',
        invoice:
          'A assinatura agora tem {seats}. Você será cobrado imediatamente com um valor proporcional para o mês atual.',
        prorate:
          'A assinatura agora tem {seats}. Sua próxima fatura incluirá as vagas atualizadas mais o valor proporcional do mês atual.',
        nextPeriod:
          'A assinatura terá {seats} a partir do seu próximo ciclo de cobrança.',
        default: 'A assinatura agora tem {seats}.',
      },
      updateError: {
        title: 'Erro ao atualizar vagas',
        description: 'Falha ao atualizar vagas',
        unexpected: 'Ocorreu um erro inesperado',
      },
      revokeSuccess: {
        title: 'Vaga revogada com sucesso',
        description: 'A vaga foi revogada e agora está disponível.',
      },
      revokeError: {
        title: 'Falha ao revogar vaga',
      },
      resendSuccess: {
        title: 'Convite reenviado',
        description: 'O e-mail de convite foi enviado novamente.',
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
