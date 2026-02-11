export const es = {
  checkout: {
    footer: {
      poweredBy: 'Desarrollado por',
      merchantOfRecord:
        'Este pedido es procesado por nuestro distribuidor en línea y comerciante oficial, Polar, quien también gestiona las consultas y devoluciones relacionadas con el pedido.',
    },
    form: {
      email: 'Correo electrónico',
      cardholderName: 'Nombre del titular de la tarjeta',
      purchasingAsBusiness: 'Compro como empresa',
      businessName: 'Nombre de la empresa',
      billingAddress: {
        label: 'Dirección de facturación',
        line1: 'Línea 1',
        line2: 'Línea 2',
        postalCode: 'Código postal',
        city: 'Ciudad',
        country: 'País',
        state: 'Estado',
        province: 'Provincia',
        stateProvince: 'Estado / Provincia',
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
      everyInterval: 'Cada {interval}',
      additionalMeteredUsage: 'Uso medido adicional',
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
      amountFreeOrMinimum: 'El importe debe ser $0 o al menos {min}',
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
        '=1': 'Intentar de nuevo en # segundo',
        other: 'Intentar de nuevo en # segundos',
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
      processingTitle: 'Estamos procesando su pedido',
      successTitle: '¡Su pedido se realizó con éxito!',
      failedTitle: 'Ocurrió un problema al procesar su pedido',
      processingDescription: 'Espere mientras confirmamos su pago.',
      successDescription: 'Ahora es elegible para los beneficios de {product}.',
      failedDescription:
        'Por favor, inténtelo de nuevo o póngase en contacto con soporte.',
    },
    loading: {
      processingOrder: 'Procesando pedido...',
      processingPayment: 'Procesando pago',
      paymentSuccessful:
        '¡Pago realizado con éxito! Preparando sus productos...',
      confirmationTokenFailed:
        'No se pudo crear el token de confirmación, inténtelo de nuevo más tarde.',
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
      day: 'día',
      week: 'sem',
      month: 'mes',
      year: 'año',
    },
    long: {
      day: 'día',
      week: 'semana',
      month: 'mes',
      year: 'año',
    },
    frequency: {
      day: 'diariamente',
      week: 'semanalmente',
      month: 'mensualmente',
      year: 'anualmente',
      everyOrdinalInterval: 'cada {ordinal} {interval}',
    },
  },
  benefitTypes: {
    usage: {
      displayName: 'Uso',
    },
    license_keys: {
      displayName: 'Claves de licencia',
    },
    github_repository: {
      displayName: 'Acceso a repositorio de GitHub',
    },
    discord: {
      displayName: 'Invitación a Discord',
    },
    downloadables: {
      displayName: 'Descargas de archivos',
    },
    custom: {
      displayName: 'Personalizado',
    },
    meter_credit: {
      displayName: 'Créditos de medición',
    },
  },
} as const
