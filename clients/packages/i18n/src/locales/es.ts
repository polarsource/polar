export default {
  checkout: {
    footer: {
      poweredBy: 'Desarrollado por',
      merchantOfRecord:
        'Este pedido es procesado por nuestro revendedor en línea y Comerciante registrado, Polar, quien también gestiona las consultas y devoluciones relacionadas con el pedido.',
      mandateSubscriptionTrial:
        'Al hacer clic en "{buttonLabel}", autorizas a Polar Software, Inc., nuestro revendedor en línea y comerciante registrado, a realizar un cargo en tu método de pago seleccionado por el importe mostrado arriba al final de tu período de prueba y en cada fecha de facturación posterior hasta que canceles, y aceptas los {buyerTermsLink}. Puedes cancelar en cualquier momento antes de que finalice tu prueba para evitar cargos.',
      mandateSubscription:
        'Al hacer clic en "{buttonLabel}", autorizas a Polar Software, Inc., nuestro revendedor en línea y comerciante registrado, a realizar un cargo inmediato en tu método de pago seleccionado por el importe mostrado arriba y a cobrar el mismo importe en cada fecha de facturación posterior hasta que canceles, y aceptas los {buyerTermsLink}.',
      buyerTermsLink: 'Términos del comprador',
      mandateOneTime:
        'Al hacer clic en "{buttonLabel}", autorizas a Polar Software, Inc., nuestro revendedor en línea y vendedor oficial, a cobrar el importe mostrado arriba en tu método de pago seleccionado, y aceptas los {buyerTermsLink}. Este es un cargo único.',
    },
    form: {
      email: 'Email',
      cardholderName: 'Nombre del titular de la tarjeta',
      purchasingAsBusiness: 'Compro como empresa',
      businessName: 'Nombre de la empresa',
      billingAddress: {
        label: 'Dirección de facturación',
        postalCode: 'Código postal',
        city: 'Ciudad',
        country: 'País',
        state: 'Estado',
        province: 'Provincia',
        stateProvince: 'Estado / Provincia',
        line1: 'Dirección',
        line2: 'Apartamento, unidad, piso, etc.',
      },
      taxId: 'ID fiscal',
      discountCode: 'Código de descuento',
      optional: 'Opcional',
      apply: 'Aplicar',
      fieldRequired: 'Este campo es obligatorio',
      billingDetails: 'Datos de la empresa',
      addDiscountCode: 'Añadir código de descuento',
    },
    pricing: {
      subtotal: 'Subtotal',
      taxableAmount: 'Importe imponible',
      taxes: 'Impuestos',
      free: 'Gratis',
      payWhatYouWant: 'Paga lo que quieras',
      total: 'Total',
      additionalMeteredUsage: 'Consumo adicional',
      discount: {
        until: 'Hasta {date}',
      },
      everyInterval: {
        day: {
          '=1': 'Diario',
          other: 'Cada # días',
          '=2': 'Cada dos días',
          _mode: 'plural',
        },
        week: {
          '=1': 'Semanal',
          other: 'Cada # semanas',
          '=2': 'Cada dos semanas',
          _mode: 'plural',
        },
        month: {
          '=1': 'Mensual',
          other: 'Cada # meses',
          '=2': 'Cada dos meses',
          _mode: 'plural',
        },
        year: {
          '=1': 'Anual',
          other: 'Cada # años',
          '=2': 'Cada dos años',
          _mode: 'plural',
        },
      },
      perSeat: 'por usuario',
      seats: {
        label: 'Usuarios',
        numberOfSeats: 'Número de usuarios',
        count: {
          '=1': '# usuario',
          other: '# usuarios',
          _mode: 'plural',
        },
        range: '{min} - {max} usuarios',
        minimum: 'Mínimo {min} usuarios',
        maximum: 'Máximo {max} usuarios',
        updateFailed: 'No se pudieron actualizar los usuarios',
        included: {
          '=1': 'Incluye 1 usuario',
          other: 'Incluye # usuarios',
          _mode: 'plural',
        },
      },
      inclTax: 'Impuestos (incluidos)',
      basePrice: 'Precio base',
    },
    trial: {
      hero: {
        free: {
          day: {
            '=1': '# día gratis',
            other: '# días gratis',
            _mode: 'plural',
          },
          month: {
            '=1': '# mes gratis',
            other: '# meses gratis',
            _mode: 'plural',
          },
          year: {
            '=1': '# año gratis',
            other: '# años gratis',
            _mode: 'plural',
          },
        },
        intervalSuffix: {
          day: '/día',
          week: '/semana',
          month: '/mes',
          year: '/año',
        },
        then: 'Después',
        startingDate: 'a partir del {date}',
      },
    },
    pwywForm: {
      label: 'Pon un precio justo',
      minimum: '{amount} mínimo',
      amountMinimum: 'El importe debe ser al menos {min}',
      amountFreeOrMinimum: 'El importe debe ser {zero} o al menos {min}',
    },
    productSwitcher: {
      billedRecurring: 'Facturado {frequency}',
      oneTimePurchase: 'Compra única',
      fromPrefix: 'Desde',
    },
    benefits: {
      granting: 'Concediendo beneficios...',
      requestNewInvite: 'Solicitar nueva invitación',
      retryIn: {
        '=1': 'Inténtalo de nuevo en # segundo',
        other: 'Inténtalo de nuevo en # segundos',
        _mode: 'plural',
      },
      connectNewAccount: 'Conectar nueva cuenta',
      requestMyInvite: 'Solicitar mi invitación',
      github: {
        connect: 'Conectar cuenta de GitHub',
        goTo: 'Ir a {repository}',
        selectAccount: 'Seleccionar una cuenta de GitHub',
      },
      discord: {
        connect: 'Conectar cuenta de Discord',
        open: 'Abrir Discord',
        selectAccount: 'Seleccionar una cuenta de Discord',
      },
      licenseKey: {
        copy: 'Copiar',
        copiedToClipboard: 'Copiado al portapapeles',
        copiedToClipboardDescription:
          'La clave de licencia se copió al portapapeles',
        loading: 'Cargando...',
        status: 'Estado',
        statusGranted: 'Concedida',
        statusRevoked: 'Revocada',
        statusDisabled: 'Deshabilitada',
        usage: 'Uso',
        validations: 'Validaciones',
        validatedAt: 'Validado el',
        neverValidated: 'Nunca validado',
        expiryDate: 'Fecha de caducidad',
        noExpiry: 'Sin caducidad',
        activations: 'Activaciones',
        activationDeleted: 'Activación de clave de licencia eliminada',
        activationDeletedDescription: 'Activación eliminada correctamente',
        activationDeactivationFailed: 'Error al desactivar la activación',
      },
      slackSharedChannel: {
        connected: 'Conectado a tu espacio de trabajo de Slack.',
        connectedChannel:
          'Conectado a tu espacio de trabajo de Slack en el canal {channel}.',
        inviteSent: 'Invitación enviada a {email}.',
        channel: 'Canal: {channel}.',
        openLinkToAccept: 'Abre el enlace para aceptarlo en Slack.',
        acceptFromEmail:
          'Acéptalo desde el correo de invitación o desde tus solicitudes de Slack Connect.',
        openInvite: 'Abrir invitación de Slack',
        provisioning:
          'Configurando tu canal de Slack para {email}... Deberías recibir una invitación en tu bandeja de entrada en breve.',
        setupFailed:
          'No pudimos configurar tu canal de Slack con {email}. Revisa el correo y vuelve a intentarlo, o contacta con el vendedor si sigue fallando.',
        enterEmail:
          'Introduce el correo electrónico de un administrador de tu espacio de trabajo de Slack. Recibirá una invitación de Slack Connect para un canal privado.',
        emailPlaceholder: 'slack-admin@yourcompany.com',
        tryAgain: 'Intentar de nuevo',
        requestInvite: 'Solicitar invitación de Slack',
      },
    },
    confirmation: {
      confirmPayment: 'Confirmar pago',
      processingTitle: 'Estamos procesando tu pedido',
      failedTitle: 'Ocurrió un problema al procesar tu pedido',
      processingDescription: 'Espera mientras confirmamos tu pago.',
      failedDescription: 'Inténtalo de nuevo o contacta con soporte.',
      successTitle: '¡Gracias por tu pedido!',
      successDescription: 'Ahora tienes acceso a {product}.',
    },
    loading: {
      processingOrder: 'Procesando pedido...',
      processingPayment: 'Procesando pago',
      paymentSuccessful:
        '¡Pago realizado con éxito! Preparando tus productos...',
      confirmationTokenFailed:
        'Error al crear el token de confirmación, inténtalo de nuevo más tarde.',
    },
    cta: {
      startTrial: 'Iniciar prueba',
      subscribeNow: 'Suscribirse ahora',
      payNow: 'Pagar ahora',
      getFree: 'Obtener gratis',
      paymentsUnavailable: 'Los pagos no están disponibles actualmente',
    },
    productDescription: {
      readMore: 'Leer más',
    },
  },
  intervals: {
    short: {
      day: 'd',
      week: 'sem',
      month: 'm',
      year: 'a',
    },
  },
  benefitTypes: {
    custom: 'Personalizado',
    license_keys: 'Claves de licencia',
    github_repository: 'Acceso a repositorio de GitHub',
    discord: 'Invitación a Discord',
    downloadables: 'Descargas de archivos',
    meter_credit: 'Créditos de consumo',
    feature_flag: 'Feature flag',
    slack_shared_channel: 'Canal compartido de Slack',
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
    title: 'Añadir método de pago',
    close: 'Cerrar',
    submit: 'Añadir método de pago',
    processing: 'Añadiendo método de pago…',
    fallbackError: 'Algo ha ido mal. Inténtalo de nuevo.',
    errors: {
      invalidRequest: 'Faltan parámetros obligatorios.',
      unauthorized: 'La sesión ha caducado.',
      processingFailed:
        'No se ha podido procesar el método de pago. Inténtalo de nuevo.',
      unknown: 'Algo ha ido mal.',
    },
  },
} as const
