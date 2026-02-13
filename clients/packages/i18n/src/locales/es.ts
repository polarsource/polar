export default {
  checkout: {
    footer: {
      poweredBy: 'Desarrollado por',
      merchantOfRecord:
        'Este pedido es procesado por nuestro revendedor en línea y Comerciante registrado, Polar, quien también gestiona las consultas y devoluciones relacionadas con el pedido.',
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
    },
    pricing: {
      subtotal: 'Subtotal',
      taxableAmount: 'Importe imponible',
      taxes: 'Impuestos',
      free: 'Gratis',
      payWhatYouWant: 'Paga lo que quieras',
      total: 'Total',
      additionalMeteredUsage: 'Consumo adicional',
      perUnit: '/ unidad',
      discount: {
        duration: {
          months: {
            '=1': 'durante el primer mes',
            other: 'durante los primeros # meses',
            _mode: 'plural',
          },
          years: {
            '=1': 'durante el primer año',
            other: 'durante los primeros # años',
            _mode: 'plural',
          },
        },
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
    },
    trial: {
      ends: 'La prueba finaliza el {endDate}',
      duration: {
        days: {
          '=1': 'prueba de # día',
          other: 'prueba de # días',
          _mode: 'plural',
        },
        weeks: {
          '=1': 'prueba de # semana',
          other: 'prueba de # semanas',
          _mode: 'plural',
        },
        months: {
          '=1': 'prueba de # mes',
          other: 'prueba de # meses',
          _mode: 'plural',
        },
        years: {
          '=1': 'prueba de # año',
          other: 'prueba de # años',
          _mode: 'plural',
        },
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
    },
    card: {
      included: 'Incluido',
    },
    benefits: {
      moreBenefits: {
        '=1': '# beneficio más',
        other: '# beneficios más',
        _mode: 'plural',
      },
      showMoreBenefits: {
        '=1': 'Mostrar # beneficio más',
        other: 'Mostrar # beneficios más',
        _mode: 'plural',
      },
      showLess: 'Mostrar menos',
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
    },
    confirmation: {
      confirmPayment: 'Confirmar pago',
      processingTitle: 'Estamos procesando tu pedido',
      successTitle: '¡Tu pedido se realizó correctamente!',
      failedTitle: 'Ocurrió un problema al procesar tu pedido',
      processingDescription: 'Espera mientras confirmamos tu pago.',
      successDescription:
        'Ahora puedes disfrutar de los beneficios de {product}.',
      failedDescription: 'Inténtalo de nuevo o contacta con soporte.',
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
    license_keys: 'Claves de licencia',
    github_repository: 'Acceso a repositorio de GitHub',
    discord: 'Invitación a Discord',
    downloadables: 'Descargas de archivos',
    custom: 'Personalizado',
    meter_credit: 'Créditos de consumo',
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
