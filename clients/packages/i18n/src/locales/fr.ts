export default {
  checkout: {
    footer: {
      poweredBy: 'Propulsé par',
      merchantOfRecord:
        'Cette commande est traitée par notre revendeur en ligne et commerçant enregistré, Polar, qui gère également les demandes et les retours liés à la commande.',
      mandateSubscriptionTrial:
        "En cliquant sur « {buttonLabel} », vous autorisez Polar Software, Inc., notre revendeur en ligne et marchand officiel, à débiter votre moyen de paiement sélectionné du montant indiqué ci-dessus à la fin de votre période d'essai et à chaque date de facturation ultérieure jusqu'à annulation. Vous pouvez annuler à tout moment avant la fin de votre essai pour éviter d'être débité.",
      mandateSubscription:
        "En cliquant sur « {buttonLabel} », vous autorisez Polar Software, Inc., notre revendeur en ligne et marchand officiel, à débiter immédiatement votre moyen de paiement sélectionné du montant indiqué ci-dessus et à débiter le même montant à chaque date de facturation ultérieure jusqu'à annulation.",
      mandateOneTime:
        "En cliquant sur « {buttonLabel} », vous autorisez Polar Software, Inc., notre revendeur en ligne et marchand officiel, à débiter votre moyen de paiement sélectionné du montant indiqué ci-dessus. Il s'agit d'un paiement unique.",
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
      taxId: 'Numéro de TVA intracommunautaire',
      discountCode: 'Code de réduction',
      optional: 'Facultatif',
      apply: 'Valider',
      fieldRequired: 'Ce champ est obligatoire',
      addBusinessDetails: 'Ajouter les informations de facturation',
      removeBusinessDetails: 'Supprimer les informations de facturation',
      billingDetails: "Informations sur l'entreprise",
    },
    pricing: {
      subtotal: 'Sous-total',
      taxableAmount: 'Total HT',
      taxes: 'TVA',
      free: 'Gratuit',
      payWhatYouWant: 'Payez ce que vous voulez',
      total: 'Total',
      additionalMeteredUsage: "Facturation à l'usage",
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
      everyInterval: {
        day: {
          '=1': 'Quotidien',
          other: 'Tous les # jours',
          '=2': 'Tous les deux jours',
          _mode: 'plural',
        },
        week: {
          '=1': 'Hebdomadaire',
          other: 'Toutes les # semaines',
          '=2': 'Toutes les deux semaines',
          _mode: 'plural',
        },
        month: {
          '=1': 'Mensuel',
          other: 'Tous les # mois',
          '=2': 'Tous les deux mois',
          _mode: 'plural',
        },
        year: {
          '=1': 'Annuel',
          other: 'Tous les # ans',
          '=2': 'Tous les deux ans',
          _mode: 'plural',
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
      amountFreeOrMinimum: 'Le montant doit être {zero} ou au moins {min}',
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
      granting: 'Activation des avantages...',
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
    productDescription: {
      readMore: 'Lire la suite',
      readLess: 'Réduire',
    },
  },
  intervals: {
    short: {
      day: 'j',
      week: 'sem',
      month: 'mois',
      year: 'an',
    },
  },
  benefitTypes: {
    license_keys: 'Clés de licence',
    github_repository: 'Accès au dépôt GitHub',
    discord: 'Invitation Discord',
    downloadables: 'Fichiers',
    custom: 'Personnalisé',
    meter_credit: 'Crédits prépayés',
  },
  ordinal: {
    zero: 'e',
    one: 'er',
    two: 'e',
    few: 'e',
    many: 'e',
    other: 'e',
  },
} as const
