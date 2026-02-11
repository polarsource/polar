export const fr = {
  checkout: {
    footer: {
      poweredBy: 'Propulsé par',
      merchantOfRecord:
        'Cette commande est traitée par notre revendeur en ligne et commerçant enregistré, Polar, qui gère également les demandes et les retours liés à la commande.',
    },
    form: {
      email: 'E-mail',
      cardholderName: 'Nom du titulaire de la carte',
      purchasingAsBusiness: "J'achète en tant qu'entreprise",
      businessName: "Nom de l'entreprise",
      billingAddress: {
        label: 'Adresse de facturation',
        postalCode: 'Code postal',
        city: 'Ville',
        country: 'Pays',
        state: 'État',
        province: 'Province',
        stateProvince: 'État / Province',
        line1: 'Adresse',
        line2: "Complément d'adresse",
      },
      taxId: 'ID fiscal',
      discountCode: 'Code de réduction',
      optional: 'Facultatif',
      apply: 'Appliquer',
      fieldRequired: 'Ce champ est obligatoire',
    },
    pricing: {
      subtotal: 'Sous-total',
      taxableAmount: 'Montant imposable',
      taxes: 'Taxes',
      free: 'Gratuit',
      payWhatYouWant: 'Payez ce que vous voulez',
      total: 'Total',
      everyInterval: 'Tous les {interval}',
      additionalMeteredUsage: 'Consommation supplémentaire',
      perUnit: '/ unité',
      discount: {
        duration: {
          months: {
            '=1': 'pour le premier mois',
            other: 'pour les # premiers mois',
            _mode: 'plural',
          },
          years: {
            '=1': 'pour la première année',
            other: 'pour les # premières années',
            _mode: 'plural',
          },
        },
      },
    },
    trial: {
      ends: "L'essai se termine le {endDate}",
      duration: {
        days: {
          '=1': 'Essai de # jour',
          other: 'Essai de # jours',
          _mode: 'plural',
        },
        weeks: {
          '=1': 'Essai de # semaine',
          other: 'Essai de # semaines',
          _mode: 'plural',
        },
        months: {
          '=1': 'Essai de # mois',
          other: 'Essai de # mois',
          _mode: 'plural',
        },
        years: {
          '=1': 'Essai de # an',
          other: 'Essai de # ans',
          _mode: 'plural',
        },
      },
    },
    pwywForm: {
      label: 'Définissez un prix juste',
      minimum: '{amount} minimum',
      amountMinimum: "Le montant doit être d'au moins {min}",
      amountFreeOrMinimum: "Le montant doit être de 0 $ ou d'au moins {min}",
    },
    productSwitcher: {
      billedRecurring: 'Facturé {frequency}',
      oneTimePurchase: 'Achat unique',
    },
    card: {
      included: 'Inclus',
    },
    benefits: {
      moreBenefits: {
        '=1': '# avantage supplémentaire',
        other: '# avantages supplémentaires',
        _mode: 'plural',
      },
      showMoreBenefits: {
        '=1': 'Afficher # avantage supplémentaire',
        other: 'Afficher # avantages supplémentaires',
        _mode: 'plural',
      },
      showLess: 'Afficher moins',
      granting: 'Octroi des avantages...',
      requestNewInvite: 'Demander une nouvelle invitation',
      retryIn: {
        '=1': 'Réessayer dans # seconde',
        other: 'Réessayer dans # secondes',
        _mode: 'plural',
      },
      connectNewAccount: 'Connecter un nouveau compte',
      requestMyInvite: 'Demander mon invitation',
      github: {
        connect: 'Connecter un compte GitHub',
        goTo: 'Accéder à {repository}',
        selectAccount: 'Sélectionner un compte GitHub',
      },
      discord: {
        connect: 'Connecter un compte Discord',
        open: 'Ouvrir Discord',
        selectAccount: 'Sélectionner un compte Discord',
      },
      licenseKey: {
        copy: 'Copier',
        copiedToClipboard: 'Copié dans le presse-papiers',
        copiedToClipboardDescription:
          'La clé de licence a été copiée dans le presse-papiers',
        loading: 'Chargement...',
        status: 'Statut',
        statusGranted: 'Accordé',
        statusRevoked: 'Révoqué',
        statusDisabled: 'Désactivé',
        usage: 'Utilisation',
        validations: 'Validations',
        validatedAt: 'Validé le',
        neverValidated: 'Jamais validé',
        expiryDate: "Date d'expiration",
        noExpiry: "Pas d'expiration",
        activations: 'Activations',
        activationDeleted: 'Activation de la clé de licence supprimée',
        activationDeletedDescription: 'Activation supprimée avec succès',
        activationDeactivationFailed:
          "Échec de la désactivation de l'activation",
      },
    },
    confirmation: {
      confirmPayment: 'Confirmer le paiement',
      processingTitle: 'Nous traitons votre commande',
      successTitle: 'Votre commande a été effectuée avec succès !',
      failedTitle:
        'Un problème est survenu lors du traitement de votre commande',
      processingDescription:
        'Veuillez patienter pendant que nous confirmons votre paiement.',
      successDescription:
        'Vous êtes maintenant éligible aux avantages de {product}.',
      failedDescription: 'Veuillez réessayer ou contacter le support.',
    },
    loading: {
      processingOrder: 'Traitement de la commande...',
      processingPayment: 'Traitement du paiement',
      paymentSuccessful: 'Paiement réussi ! Préparation de vos produits...',
      confirmationTokenFailed:
        'Échec de la création du jeton de confirmation, veuillez réessayer plus tard.',
    },
    cta: {
      startTrial: "Commencer l'essai",
      subscribeNow: "S'abonner maintenant",
      payNow: 'Payer maintenant',
      getFree: 'Obtenir gratuitement',
      paymentsUnavailable: 'Les paiements sont actuellement indisponibles',
    },
  },
  intervals: {
    short: {
      day: 'j',
      week: 'sem',
      month: 'mois',
      year: 'an',
    },
    long: {
      day: 'jour',
      week: 'semaine',
      month: 'mois',
      year: 'an',
    },
    frequency: {
      day: 'quotidiennement',
      week: 'hebdomadairement',
      month: 'mensuellement',
      year: 'annuellement',
      everyOrdinalInterval: 'tous les {ordinal} {interval}',
    },
  },
  benefitTypes: {
    usage: 'Utilisation',
    license_keys: 'Clés de licence',
    github_repository: 'Accès au dépôt GitHub',
    discord: 'Invitation Discord',
    downloadables: 'Téléchargements de fichiers',
    custom: 'Personnalisé',
    meter_credit: 'Crédits de consommation',
  },
} as const
