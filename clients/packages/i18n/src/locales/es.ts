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
      addBusinessDetails: 'Añadir datos de empresa',
      removeBusinessDetails: 'Eliminar datos de empresa',
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
      summary: {
        totalWhenTrialEnds: 'Total al finalizar la prueba',
        totalWhenDiscountExpires: 'Total al finalizar el descuento',
        totalDueToday: 'Total a pagar hoy',
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
      readLess: 'Leer menos',
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
  portal: {
    navigation: {
      overview: 'Resumen',
      orders: 'Pedidos',
      usage: 'Uso',
      billing: 'Facturación',
      selectPage: 'Seleccionar página',
    },
    common: {
      cancel: 'Cancelar',
      close: 'Cerrar',
      save: 'Guardar',
      saveChanges: 'Guardar cambios',
      edit: 'Editar',
      delete: 'Eliminar',
      confirm: 'Confirmar',
      back: 'Atrás',
      loading: 'Cargando…',
      saving: 'Guardando…',
      download: 'Descargar',
      viewAll: 'Ver todo',
      somethingWentWrong: 'Ha ocurrido un error. Inténtalo de nuevo.',
      date: 'Fecha',
      amount: 'Importe',
      status: 'Estado',
      product: 'Producto',
      actions: 'Acciones',
      pageOf: 'Página {page} de {totalPages}',
    },
    overview: {
      teamSeatAccess: {
        title: 'Acceso a plazas del equipo',
        description:
          'Acceso proporcionado a través de la suscripción del equipo',
      },
      emptyState: {
        noActiveSubscriptions: {
          title: 'No hay suscripciones activas',
          description: 'No tienes ninguna suscripción activa en este momento.',
        },
        noTeamAccess: {
          title: 'Sin acceso de equipo',
          description:
            'No tienes acceso a ninguna plaza de equipo en este momento.',
        },
      },
      currentPeriod: {
        nextCharge: 'Próximo cobro',
        nextInvoice: 'Próxima factura',
        firstChargeAfterTrial: 'Primer cobro tras la prueba',
        trialEnds: 'La prueba termina',
        finalCharge: 'Cobro final',
        subscriptionEnds: 'La suscripción termina',
        notAvailable: 'N/D',
        dateLabel: '{label} — {date}',
        canceled: 'Cancelada',
        meteredCharges: 'Cargos por uso',
        subtotal: 'Subtotal',
        discount: 'Descuento',
        taxes: 'Impuestos',
        estimatedTotal: 'Total estimado',
        total: 'Total',
        finalChargeNotice:
          'Este será el último cobro antes de que finalice la suscripción.',
        finalChargeMeteredNotice:
          'El importe final puede variar según el uso hasta el final del periodo de facturación.',
        meteredNoticeActive:
          'Los cargos finales pueden variar según el uso hasta el final del periodo de facturación.',
        meteredNoticeTrialing:
          'Los cargos finales pueden variar según el uso durante el periodo de prueba.',
        meteredNoticeDefault: 'Los cargos finales pueden variar.',
      },
      latestPurchase: {
        title: 'Última compra',
        purchasedOn: 'Comprado — {date}',
        total: 'Total',
      },
      subscriptions: {
        title: 'Suscripciones',
        noSubscriptionsFound: 'No se encontraron suscripciones',
        inactiveTitle: 'Suscripciones inactivas',
        endedAt: 'Fecha de fin',
        retryPayment: 'Reintentar pago',
        manageSubscription: 'Gestionar suscripción',
      },
    },
    orders: {
      orderHistory: 'Historial de pedidos',
      description: 'Descripción',
      viewOrder: 'Ver pedido',
      retryPayment: 'Reintentar pago',
      invoiceNumber: 'Número de factura',
      orderItems: 'Artículos del pedido',
      subtotal: 'Subtotal',
      discount: 'Descuento',
      netAmount: 'Importe neto',
      tax: 'Impuesto',
      total: 'Total',
      appliedBalance: 'Saldo aplicado',
      toBePaid: 'Pendiente de pago',
      refundedAmount: 'Importe reembolsado',
      statusTitle: {
        draft: 'Borrador',
        paid: 'Pagado',
        pending: 'Pendiente',
        refunded: 'Reembolsado',
        partiallyRefunded: 'Reembolsado parcialmente',
        void: 'Anulado',
      },
      payment: {
        orderSummary: 'Resumen del pedido',
        descriptionLabel: 'Descripción:',
        amountLabel: 'Importe:',
        paymentMethod: 'Método de pago',
        payNow: 'Pagar ahora',
        processing: 'Procesando...',
        confirming: 'Confirmando...',
        loading: 'Cargando...',
        processingPayment: 'Procesando tu pago...',
        processingHint:
          'Esto puede tardar unos momentos. No cierres esta ventana.',
        processingPaymentShort: 'Procesando el pago...',
        usingSavedMethod: 'Usando tu método de pago guardado',
        tryAgain: 'Intentar de nuevo',
        paymentSuccessfulTitle: '¡Pago realizado con éxito!',
        paymentFailedTitle: 'El pago ha fallado',
        paymentSuccessfulDescription:
          'Gracias por tu pago. Ahora puedes cerrar esta ventana.',
        paymentFailedDescription:
          'Puedes intentarlo de nuevo o contactar con soporte si el problema continúa.',
        updatePaymentMethod: 'Actualizar método de pago',
        toastSuccessTitle: 'Pago realizado con éxito',
        toastSuccessDescription: '¡Tu pago se ha procesado correctamente!',
        toastFailedTitle: 'El pago ha fallado',
        paymentFailed: 'El pago ha fallado',
        paymentFailedRetry: 'El pago ha fallado. Inténtalo de nuevo.',
        paymentFailedTryAgain: 'El pago ha fallado. Inténtalo de nuevo.',
        confirmationTimeout:
          'La confirmación del pago está tardando más de lo esperado. Es posible que tu pago aún se esté procesando. Revisa el estado de tu pedido o contacta con soporte si lo necesitas.',
        networkConfirmationError:
          'No se puede confirmar el estado del pago debido a problemas de red. Revisa el estado de tu pedido o contacta con soporte.',
        stripeRequired:
          'Se requiere una instancia de Stripe para las acciones de pago',
        additionalAuthenticationRequired:
          'El pago requiere autenticación adicional',
        authenticationFailed: 'La autenticación del pago ha fallado',
        processDetailsFailed:
          'No se han podido procesar los datos de pago. Revisa tu información e inténtalo de nuevo.',
        createTokenFailed:
          'No se ha podido crear el token de pago. Inténtalo de nuevo.',
        processPaymentFailed:
          'No se ha podido procesar el pago. Revisa tu información de pago e inténtalo de nuevo.',
        networkError:
          'Se ha producido un error de red. Revisa tu conexión e inténtalo de nuevo.',
      },
    },
    subscription: {
      free: 'Gratis',
      details: {
        startDate: 'Fecha de inicio',
        trialEnds: 'La prueba termina',
        expiryDate: 'Fecha de vencimiento',
        renewalDate: 'Fecha de renovación',
        expired: 'Caducada',
        meteredUsage: 'Uso medido',
        uncancel: 'Reactivar',
        manageSubscription: 'Gestionar suscripción',
        changePlan: 'Cambiar plan',
      },
      pendingUpdate: {
        title: 'Actualización pendiente',
        cancelScheduledChange: 'Cancelar cambio programado',
        newProduct: 'Nuevo producto',
        seats: 'Plazas',
        effectiveFrom: 'La actualización entra en vigor a partir de',
        clearConfirmDescription:
          'Tu suscripción permanecerá sin cambios en el próximo ciclo de facturación. ¿Seguro que quieres cancelar esta actualización pendiente?',
      },
      invoices: {
        title: 'Facturas',
      },
      cancel: {
        title: 'Cancelar suscripción',
        ariaLabel: 'Cancelar suscripción',
        heading: '¡Lamentamos que te vayas!',
        description:
          '¡Siempre serás bienvenido de vuelta! Cuéntanos por qué te vas para ayudarnos a mejorar nuestro producto.',
        changedMind: 'He cambiado de opinión',
        commentPlaceholder: '¿Hay algo más que quieras compartir? (Opcional)',
        reason: {
          unused: 'No lo uso lo suficiente',
          tooExpensive: 'Demasiado caro',
          missingFeatures: 'Faltan funciones',
          switchedService: 'Me he cambiado a otro servicio',
          customerService: 'Atención al cliente',
          lowQuality: 'No estoy satisfecho con la calidad',
          tooComplex: 'Demasiado complicado',
          other: 'Otro (cuéntanoslo abajo)',
        },
        toast: {
          title: 'Suscripción cancelada',
          description: 'La suscripción se ha cancelado correctamente',
        },
      },
      changePlan: {
        title: 'Cambiar plan',
        currentPlan: 'Plan actual',
        availablePlans: 'Planes disponibles',
        noOtherPlans: 'No hay otros planes disponibles',
        benefitsAdded: 'Tendrás acceso a las siguientes ventajas',
        benefitsRemoved: 'Perderás acceso a las siguientes ventajas',
        needPaymentMethod:
          'Debes añadir un método de pago antes de actualizar tu plan. Ve a la configuración del portal de cliente para añadir un método de pago.',
        confirmEndTrial: 'Cambiar plan y terminar prueba',
        invoicing: {
          trialContinues:
            'Tu prueba continuará hasta el {date}. No se te cobrará antes de esa fecha.',
          trialEnds:
            'Esto terminará mi prueba y se me cobrará inmediatamente {product}.',
          periodMonthly: 'mensual',
          periodYearly: 'anual',
          immediateCharge:
            'Se me cobrará inmediatamente por el nuevo plan {period}.',
          immediateCredit:
            'Mi pago anterior aparecerá como saldo a favor en mi próxima factura.',
          prorationInvoice:
            'Se me cobrará inmediatamente con un prorrateo por el mes en curso.',
          prorationProrate:
            'Tu próxima factura incluirá el nuevo plan más el prorrateo por el mes en curso.',
          prorationNextPeriod:
            'El nuevo plan se aplicará en tu próximo ciclo de facturación.',
        },
        update: {
          failed: 'No se ha podido actualizar la suscripción',
          errorTitle: 'Error al actualizar la suscripción',
          successTitle: 'Suscripción actualizada',
          successDescription: 'La suscripción se ha actualizado correctamente',
        },
      },
    },
    settings: {
      title: 'Configuración de facturación',
      paymentMethods: {
        title: 'Métodos de pago',
        description: 'Métodos usados para suscripciones y compras únicas',
        add: 'Añadir método de pago',
        addedTitle: 'Método de pago añadido',
        addFailedTitle: 'No se ha podido añadir el método de pago',
        addFailedDescription: 'Inténtalo de nuevo.',
      },
      paymentMethod: {
        defaultMethod: 'Método predeterminado',
        makeDefault: 'Establecer como predeterminado',
        deleteAriaLabel: 'Eliminar método de pago',
        deletedTitle: 'Método de pago eliminado',
        deletedDescription: 'Tu método de pago se ha eliminado correctamente.',
        deleteFailedTitle: 'No se ha podido eliminar el método de pago',
        deleteFailedDescription:
          'Se ha producido un error al eliminar el método de pago.',
        defaultUpdatedTitle: 'Método de pago predeterminado actualizado',
        defaultUpdatedDescription:
          'Este método de pago es ahora tu método predeterminado.',
        defaultUpdateFailedTitle:
          'No se ha podido actualizar el método de pago predeterminado',
        defaultUpdateFailedDescription:
          'Se ha producido un error al actualizar el método de pago predeterminado.',
      },
      savedCards: {
        title: 'Métodos de pago guardados',
        empty: 'No se han encontrado métodos de pago guardados.',
        addNewCard: 'Añadir nueva tarjeta',
        useDifferentCard: 'Usar otra tarjeta',
        expires: 'Caduca el {date}',
      },
      billingDetailsSection: {
        title: 'Datos de facturación',
        description: 'Actualiza tus datos de facturación',
      },
      billingDetails: {
        email: 'Correo electrónico',
        billingName: 'Nombre de facturación',
        billingNamePlaceholder:
          'Nombre de la empresa o fiscal para las facturas (opcional)',
        billingAddress: 'Dirección de facturación',
        line1: 'Línea 1',
        line2: 'Línea 2',
        postalCode: 'Código postal',
        city: 'Ciudad',
        state: 'Estado',
        province: 'Provincia',
        taxId: 'NIF/CIF',
        fieldRequired: 'Este campo es obligatorio',
        submit: 'Actualizar datos de facturación',
      },
      emailSection: {
        title: 'Dirección de correo electrónico',
        description: 'Cambia el correo electrónico asociado a tu cuenta',
      },
      changeEmail: {
        currentEmail: 'Correo actual',
        newEmail: 'Nuevo correo',
        newEmailPlaceholder: 'Introduce el nuevo correo electrónico',
        emailRequired: 'El correo electrónico es obligatorio',
        requestChange: 'Solicitar cambio de correo',
        sendVerification: 'Enviar verificación',
        nevermind: 'No importa',
        verificationSentPrefix: 'Hemos enviado un enlace de verificación a',
        verificationSentSuffix:
          '. Sigue las instrucciones para confirmar tu nuevo correo electrónico.',
        verificationSentHint:
          '¿Has cambiado de opinión? Simplemente ignora el correo y tu dirección actual seguirá activa.',
      },
      billingManagers: {
        title: 'Gestores de facturación',
        description:
          'Los gestores de facturación pueden gestionar los datos de facturación, los métodos de pago y las suscripciones.',
      },
      privacy: {
        title: 'Privacidad',
        description: 'Descarga una copia de todos tus datos personales',
        exportData: 'Exportar datos',
      },
      team: {
        roles: {
          owner: 'Propietario',
          billingManager: 'Gestor de facturación',
          member: 'Miembro',
        },
        emailPlaceholder: 'email@example.com',
        emailRequired: 'El correo electrónico es obligatorio',
        invalidEmail: 'Formato de correo electrónico no válido',
        invite: 'Invitar gestor de facturación',
        columnMember: 'Miembro',
        columnRole: 'Rol',
        you: '(tú)',
        removeFromTeam: 'Eliminar del equipo',
        memberFallback: 'Miembro',
        thisMemberFallback: 'este miembro',
        genericError: 'Ha ocurrido un error.',
        addedTitle: 'Gestor de facturación añadido',
        addedDescription: '{email} se ha añadido como gestor de facturación.',
        addFailedTitle: 'No se ha podido añadir el gestor de facturación',
        roleUpdatedTitle: 'Rol actualizado',
        roleUpdatedDescription: '{name} ahora es {role}.',
        roleUpdateFailedTitle: 'No se ha podido actualizar el rol',
        removedTitle: 'Miembro eliminado',
        removedDescription: '{name} ha sido eliminado del equipo.',
        removeFailedTitle: 'No se ha podido eliminar al miembro',
        removeModalTitle: 'Eliminar miembro del equipo',
        removeModalDescription:
          '¿Seguro que quieres eliminar a {name} del equipo? Perderá acceso a todos los recursos del equipo.',
        removeConfirm: 'Eliminar',
      },
    },
    usage: {
      title: 'Uso',
      searchPlaceholder: 'Buscar medidor de uso',
      overview: 'Resumen',
      columnName: 'Nombre',
      columnConsumed: 'Consumido',
      columnCredited: 'Acreditado',
      columnBalance: 'Saldo',
    },
    benefits: {
      title: 'Concesiones de ventajas',
      searchPlaceholder: 'Buscar concesiones de ventajas...',
      empty: 'No se han encontrado concesiones de ventajas',
    },
    seats: {
      title: 'Gestión de plazas',
      totalSeats: 'Plazas totales',
      updateSeats: 'Actualizar plazas',
      columnEmail: 'Correo electrónico',
      statusLabel: {
        pending: 'Pendiente',
        claimed: 'Asignada',
        revoked: 'Revocada',
      },
      resendInvitation: 'Reenviar invitación',
      revokeSeat: 'Revocar plaza',
      invite: 'Invitar',
      inviteMember: 'Invitar miembro',
      emailRequired: 'El correo electrónico es obligatorio',
      emailInvalid: 'Formato de correo electrónico no válido',
      assignError: 'No se ha podido asignar la plaza',
      invitationSendError: 'No se ha podido enviar la invitación',
      genericError: 'Ha ocurrido un error.',
      seatCount: {
        '=1': '# plaza',
        other: '# plazas',
        _mode: 'plural',
      },
      availableSeats: {
        '=1': 'Queda 1 plaza disponible',
        other: 'Quedan # plazas disponibles',
        _mode: 'plural',
      },
      cannotDecrease: {
        '=1': 'No se puede reducir por debajo de # plaza asignada. Revoca primero las plazas.',
        other:
          'No se puede reducir por debajo de # plazas asignadas. Revoca primero las plazas.',
        _mode: 'plural',
      },
      invoicingMessage: {
        invoice:
          'Se me cobrará inmediatamente con un prorrateo por el mes en curso.',
        prorate:
          'Tu próxima factura incluirá las plazas actualizadas más el prorrateo por el mes en curso.',
        nextPeriod:
          'La actualización de plazas se aplicará en tu próximo ciclo de facturación.',
      },
      updateSuccess: {
        title: 'Plazas actualizadas',
        invoice:
          'La suscripción ahora tiene {seats}. Se te cobrará inmediatamente con un prorrateo por el mes en curso.',
        prorate:
          'La suscripción ahora tiene {seats}. Tu próxima factura incluirá las plazas actualizadas más el prorrateo por el mes en curso.',
        nextPeriod:
          'La suscripción tendrá {seats} a partir de tu próximo ciclo de facturación.',
        default: 'La suscripción ahora tiene {seats}.',
      },
      updateError: {
        title: 'Error al actualizar las plazas',
        description: 'No se han podido actualizar las plazas',
        unexpected: 'Se ha producido un error inesperado',
      },
      revokeSuccess: {
        title: 'Plaza revocada correctamente',
        description: 'La plaza ha sido revocada y ahora está disponible.',
      },
      revokeError: {
        title: 'No se ha podido revocar la plaza',
      },
      resendSuccess: {
        title: 'Invitación reenviada',
        description: 'El correo de invitación se ha enviado de nuevo.',
      },
      resendError: {
        title: 'No se ha podido reenviar la invitación',
      },
    },
    wallet: {
      availableBalance: 'Saldo disponible',
      organization: 'Organización',
      currency: 'Moneda',
    },
  },
} as const
