export default {
  checkout: {
    footer: {
      poweredBy: 'Propulsé par',
      merchantOfRecord:
        'Cette commande est traitée par notre revendeur en ligne et commerçant enregistré, Polar, qui gère également les demandes et les retours liés à la commande.',
      mandateSubscriptionTrial:
        "En cliquant sur \"{buttonLabel}\", vous autorisez Polar Software, Inc., notre revendeur en ligne et marchand officiel, à débiter votre moyen de paiement sélectionné du montant indiqué ci-dessus à la fin de votre période d'essai et à chaque date de facturation ultérieure jusqu'à votre résiliation, et vous acceptez les {buyerTermsLink}. Vous pouvez annuler à tout moment avant la fin de votre essai pour éviter d'être facturé.",
      mandateSubscription:
        'En cliquant sur "{buttonLabel}", vous autorisez Polar Software, Inc., notre revendeur en ligne et marchand officiel, à débiter immédiatement votre moyen de paiement sélectionné du montant indiqué ci-dessus et à débiter ce même montant à chaque date de facturation ultérieure jusqu\'à votre résiliation, et vous acceptez les {buyerTermsLink}.',
      buyerTermsLink: "Conditions d'achat",
      mandateOneTime:
        'En cliquant sur "{buttonLabel}", vous autorisez Polar Software, Inc., notre revendeur en ligne et marchand officiel, à prélever le montant indiqué ci-dessus sur le moyen de paiement sélectionné, et vous acceptez les {buyerTermsLink}. Il s\'agit d\'un paiement unique.',
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
      addDiscountCode: 'Ajouter un code de réduction',
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
        until: "Jusqu'au {date}",
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
      perSeat: 'par siège',
      seats: {
        label: 'Sièges',
        numberOfSeats: 'Nombre de sièges',
        count: {
          '=1': '# siège',
          other: '# sièges',
          _mode: 'plural',
        },
        range: '{min} - {max} sièges',
        minimum: 'Minimum {min} sièges',
        maximum: 'Maximum {max} sièges',
        updateFailed: 'Échec de la mise à jour des sièges',
        included: {
          '=1': 'Un siège inclus',
          other: '# sièges inclus',
          _mode: 'plural',
        },
      },
      inclTax: 'TVA (incluse)',
      basePrice: 'Prix de base',
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
      hero: {
        free: {
          day: {
            '=1': '# jour gratuit',
            other: '# jours gratuits',
            _mode: 'plural',
          },
          month: {
            '=1': '# mois gratuit',
            other: '# mois gratuits',
            _mode: 'plural',
          },
          year: {
            '=1': '# an gratuit',
            other: '# ans gratuits',
            _mode: 'plural',
          },
        },
        intervalSuffix: {
          day: '/jour',
          week: '/semaine',
          month: '/mois',
          year: '/an',
        },
        then: 'Puis',
        startingDate: 'à partir du {date}',
      },
      summary: {
        totalWhenTrialEnds: "Total à la fin de l'essai",
        totalWhenDiscountExpires: 'Total à la fin de la réduction',
        totalDueToday: "Total à payer aujourd'hui",
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
      fromPrefix: 'À partir de',
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
      failedTitle:
        'Un problème est survenu lors du traitement de votre commande',
      processingDescription:
        'Veuillez patienter pendant que nous confirmons votre paiement.',
      failedDescription: 'Veuillez réessayer ou contacter le support.',
      successTitle: 'Merci pour votre commande !',
      successDescription: 'Vous avez désormais accès à {product}.',
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
    custom: 'Personnalisé',
    license_keys: 'Clés de licence',
    github_repository: 'Accès au dépôt GitHub',
    discord: 'Invitation Discord',
    downloadables: 'Fichiers',
    meter_credit: 'Crédits prépayés',
    feature_flag: 'Accès à une fonctionnalité',
  },
  ordinal: {
    zero: 'e',
    one: 'er',
    two: 'e',
    few: 'e',
    many: 'e',
    other: 'e',
  },
  embedPaymentMethod: {
    title: 'Ajouter un moyen de paiement',
    close: 'Fermer',
    submit: 'Ajouter un moyen de paiement',
    processing: 'Ajout du moyen de paiement…',
    fallbackError: 'Une erreur s’est produite. Veuillez réessayer.',
    errors: {
      invalidRequest: 'Paramètres obligatoires manquants.',
      unauthorized: 'La session a expiré.',
      processingFailed:
        'Impossible de traiter le moyen de paiement. Veuillez réessayer.',
      unknown: 'Une erreur s’est produite.',
    },
  },
  portal: {
    navigation: {
      overview: 'Aperçu',
      orders: 'Commandes',
      usage: 'Utilisation',
      billing: 'Facturation',
      selectPage: 'Sélectionner une page',
    },
    common: {
      cancel: 'Annuler',
      close: 'Fermer',
      save: 'Enregistrer',
      saveChanges: 'Enregistrer les modifications',
      edit: 'Modifier',
      delete: 'Supprimer',
      confirm: 'Confirmer',
      back: 'Retour',
      loading: 'Chargement…',
      saving: 'Enregistrement…',
      download: 'Télécharger',
      viewAll: 'Tout afficher',
      somethingWentWrong: "Une erreur s'est produite. Veuillez réessayer.",
      date: 'Date',
      amount: 'Montant',
      status: 'Statut',
      product: 'Produit',
      actions: 'Actions',
      pageOf: 'Page {page} sur {totalPages}',
    },
    overview: {
      teamSeatAccess: {
        title: 'Accès aux sièges d’équipe',
        description: 'Accès fourni via un abonnement d’équipe',
      },
      emptyState: {
        noActiveSubscriptions: {
          title: 'Aucun abonnement actif',
          description: 'Vous n’avez aucun abonnement actif pour le moment.',
        },
        noTeamAccess: {
          title: 'Aucun accès d’équipe',
          description:
            'Vous n’avez aucun accès à un siège d’équipe pour le moment.',
        },
      },
      currentPeriod: {
        nextCharge: 'Prochain prélèvement',
        nextInvoice: 'Prochaine facture',
        firstChargeAfterTrial: 'Premier prélèvement après l’essai',
        trialEnds: 'Fin de l’essai',
        finalCharge: 'Dernier prélèvement',
        subscriptionEnds: 'Fin de l’abonnement',
        notAvailable: 'N/D',
        dateLabel: '{label} — {date}',
        canceled: 'Annulé',
        meteredCharges: 'Frais à l’usage',
        subtotal: 'Sous-total',
        discount: 'Remise',
        taxes: 'Taxes',
        estimatedTotal: 'Total estimé',
        total: 'Total',
        finalChargeNotice:
          'Ce sera le dernier prélèvement avant la fin de l’abonnement.',
        finalChargeMeteredNotice:
          'Le montant final peut varier selon l’utilisation jusqu’à la fin de la période de facturation.',
        meteredNoticeActive:
          'Les frais finaux peuvent varier selon l’utilisation jusqu’à la fin de la période de facturation.',
        meteredNoticeTrialing:
          'Les frais finaux peuvent varier selon l’utilisation pendant la période d’essai.',
        meteredNoticeDefault: 'Les frais finaux peuvent varier.',
      },
      latestPurchase: {
        title: 'Dernier achat',
        purchasedOn: 'Acheté — {date}',
        total: 'Total',
      },
      subscriptions: {
        title: 'Abonnements',
        noSubscriptionsFound: 'Aucun abonnement trouvé',
        inactiveTitle: 'Abonnements inactifs',
        endedAt: 'Date de fin',
        retryPayment: 'Réessayer le paiement',
        manageSubscription: 'Gérer l’abonnement',
      },
    },
    orders: {
      orderHistory: 'Historique des commandes',
      description: 'Description',
      viewOrder: 'Voir la commande',
      retryPayment: 'Réessayer le paiement',
      invoiceNumber: 'Numéro de facture',
      orderItems: 'Articles de la commande',
      subtotal: 'Sous-total',
      discount: 'Remise',
      netAmount: 'Montant net',
      tax: 'Taxe',
      total: 'Total',
      appliedBalance: 'Solde appliqué',
      toBePaid: 'À payer',
      refundedAmount: 'Montant remboursé',
      statusTitle: {
        draft: 'Brouillon',
        paid: 'Payé',
        pending: 'En attente',
        refunded: 'Remboursé',
        partiallyRefunded: 'Partiellement remboursé',
        void: 'Annulé',
      },
      payment: {
        orderSummary: 'Récapitulatif de la commande',
        descriptionLabel: 'Description :',
        amountLabel: 'Montant :',
        paymentMethod: 'Moyen de paiement',
        payNow: 'Payer maintenant',
        processing: 'Traitement...',
        confirming: 'Confirmation...',
        loading: 'Chargement...',
        processingPayment: 'Traitement de votre paiement...',
        processingHint:
          'Cela peut prendre quelques instants. Veuillez ne pas fermer cette fenêtre.',
        processingPaymentShort: 'Traitement du paiement...',
        usingSavedMethod: 'Utilisation de votre moyen de paiement enregistré',
        tryAgain: 'Réessayer',
        paymentSuccessfulTitle: 'Paiement effectué avec succès !',
        paymentFailedTitle: 'Échec du paiement',
        paymentSuccessfulDescription:
          'Merci pour votre paiement. Vous pouvez maintenant fermer cette fenêtre.',
        paymentFailedDescription:
          'Vous pouvez réessayer ou contacter l’assistance si le problème persiste.',
        updatePaymentMethod: 'Mettre à jour le moyen de paiement',
        toastSuccessTitle: 'Paiement effectué avec succès',
        toastSuccessDescription: 'Votre paiement a été traité avec succès !',
        toastFailedTitle: 'Échec du paiement',
        paymentFailed: 'Paiement échoué',
        paymentFailedRetry: 'Paiement échoué. Veuillez réessayer.',
        paymentFailedTryAgain: 'Paiement échoué, veuillez réessayer.',
        confirmationTimeout:
          'La confirmation du paiement prend plus de temps que prévu. Votre paiement est peut-être encore en cours de traitement. Veuillez vérifier le statut de votre commande ou contacter l’assistance si nécessaire.',
        networkConfirmationError:
          'Impossible de confirmer le statut du paiement en raison d’un problème réseau. Veuillez vérifier le statut de votre commande ou contacter l’assistance.',
        stripeRequired:
          'Une instance Stripe est requise pour les actions de paiement',
        additionalAuthenticationRequired:
          'Le paiement nécessite une authentification supplémentaire',
        authenticationFailed: 'Échec de l’authentification du paiement',
        processDetailsFailed:
          'Impossible de traiter les détails du paiement. Veuillez vérifier vos informations et réessayer.',
        createTokenFailed:
          'Impossible de créer le jeton de paiement. Veuillez réessayer.',
        processPaymentFailed:
          'Impossible de traiter le paiement. Veuillez vérifier vos informations de paiement et réessayer.',
        networkError:
          'Une erreur réseau s’est produite. Veuillez vérifier votre connexion et réessayer.',
      },
    },
    subscription: {
      free: 'Gratuit',
      details: {
        startDate: 'Date de début',
        trialEnds: 'Fin de l’essai',
        expiryDate: 'Date d’expiration',
        renewalDate: 'Date de renouvellement',
        expired: 'Expiré',
        meteredUsage: 'Utilisation à l’usage',
        uncancel: 'Annuler la résiliation',
        manageSubscription: 'Gérer l’abonnement',
        changePlan: 'Changer d’offre',
      },
      pendingUpdate: {
        title: 'Modification en attente',
        cancelScheduledChange: 'Annuler la modification planifiée',
        newProduct: 'Nouveau produit',
        seats: 'Sièges',
        effectiveFrom: 'Modification applicable à partir du',
        clearConfirmDescription:
          'Votre abonnement restera inchangé lors du prochain cycle de facturation. Voulez-vous vraiment annuler cette modification en attente ?',
      },
      invoices: {
        title: 'Factures',
      },
      cancel: {
        title: 'Résilier l’abonnement',
        ariaLabel: 'Résilier l’abonnement',
        heading: 'Nous sommes désolés de vous voir partir !',
        description:
          'Vous serez toujours le bienvenu ! Dites-nous pourquoi vous partez pour nous aider à améliorer notre produit.',
        changedMind: 'J’ai changé d’avis',
        commentPlaceholder: 'Autre chose à partager ? (Facultatif)',
        reason: {
          unused: 'Pas assez utilisé',
          tooExpensive: 'Trop cher',
          missingFeatures: 'Fonctionnalités manquantes',
          switchedService: 'Passé à un autre service',
          customerService: 'Service client',
          lowQuality: 'Pas satisfait de la qualité',
          tooComplex: 'Trop compliqué',
          other: 'Autre (veuillez préciser ci-dessous)',
        },
        toast: {
          title: 'Abonnement annulé',
          description: 'L’abonnement a été annulé avec succès',
        },
      },
      changePlan: {
        title: 'Changer d’offre',
        currentPlan: 'Offre actuelle',
        availablePlans: 'Offres disponibles',
        noOtherPlans: 'Aucune autre offre disponible',
        benefitsAdded: 'Vous aurez accès aux avantages suivants',
        benefitsRemoved: 'Vous perdrez l’accès aux avantages suivants',
        needPaymentMethod:
          'Vous devez ajouter un moyen de paiement avant de mettre à jour votre offre. Rendez-vous dans les paramètres du portail client pour ajouter un moyen de paiement.',
        confirmEndTrial: 'Changer d’offre et mettre fin à l’essai',
        invoicing: {
          trialContinues:
            'Votre essai se poursuivra jusqu’au {date}. Vous ne serez pas facturé avant cette date.',
          trialEnds:
            'Cela mettra fin à mon essai et me facturera immédiatement {product}.',
          periodMonthly: 'mensuel',
          periodYearly: 'annuel',
          immediateCharge:
            'Je serai facturé immédiatement pour la nouvelle offre {period}.',
          immediateCredit:
            'Mon paiement précédent apparaîtra comme un avoir sur ma prochaine facture.',
          prorationInvoice:
            'Je serai facturé immédiatement au prorata pour le mois en cours.',
          prorationProrate:
            'Votre prochaine facture inclura la nouvelle offre ainsi que le prorata pour le mois en cours.',
          prorationNextPeriod:
            'La nouvelle offre sera appliquée lors de votre prochain cycle de facturation.',
        },
        update: {
          failed: 'Impossible de mettre à jour l’abonnement',
          errorTitle: 'Erreur lors de la mise à jour de l’abonnement',
          successTitle: 'Abonnement mis à jour',
          successDescription: 'L’abonnement a été mis à jour avec succès',
        },
      },
    },
    settings: {
      title: 'Paramètres de facturation',
      paymentMethods: {
        title: 'Moyens de paiement',
        description:
          'Moyens utilisés pour les abonnements et les achats ponctuels',
        add: 'Ajouter un moyen de paiement',
        addedTitle: 'Moyen de paiement ajouté',
        addFailedTitle: 'Impossible d’ajouter le moyen de paiement',
        addFailedDescription: 'Veuillez réessayer.',
      },
      paymentMethod: {
        defaultMethod: 'Moyen par défaut',
        makeDefault: 'Définir par défaut',
        deleteAriaLabel: 'Supprimer le moyen de paiement',
        deletedTitle: 'Moyen de paiement supprimé',
        deletedDescription:
          'Votre moyen de paiement a été supprimé avec succès.',
        deleteFailedTitle: 'Impossible de supprimer le moyen de paiement',
        deleteFailedDescription:
          'Une erreur s’est produite lors de la suppression du moyen de paiement.',
        defaultUpdatedTitle: 'Moyen de paiement par défaut mis à jour',
        defaultUpdatedDescription:
          'Ce moyen de paiement est maintenant votre moyen par défaut.',
        defaultUpdateFailedTitle:
          'Impossible de mettre à jour le moyen de paiement par défaut',
        defaultUpdateFailedDescription:
          'Une erreur s’est produite lors de la mise à jour du moyen de paiement par défaut.',
      },
      savedCards: {
        title: 'Moyens de paiement enregistrés',
        empty: 'Aucun moyen de paiement enregistré trouvé.',
        addNewCard: 'Ajouter une nouvelle carte',
        useDifferentCard: 'Utiliser une autre carte',
        expires: 'Expire le {date}',
      },
      billingDetailsSection: {
        title: 'Coordonnées de facturation',
        description: 'Mettre à jour vos coordonnées de facturation',
      },
      billingDetails: {
        email: 'E-mail',
        billingName: 'Nom de facturation',
        billingNamePlaceholder:
          'Nom de l’entreprise ou nom légal pour les factures (facultatif)',
        billingAddress: 'Adresse de facturation',
        line1: 'Ligne 1',
        line2: 'Ligne 2',
        postalCode: 'Code postal',
        city: 'Ville',
        state: 'État',
        province: 'Province',
        taxId: 'Numéro de TVA',
        fieldRequired: 'Ce champ est requis',
        submit: 'Mettre à jour les coordonnées de facturation',
      },
      emailSection: {
        title: 'Adresse e-mail',
        description: 'Modifier l’e-mail associé à votre compte',
      },
      changeEmail: {
        currentEmail: 'E-mail actuel',
        newEmail: 'Nouvel e-mail',
        newEmailPlaceholder: 'Saisissez une nouvelle adresse e-mail',
        emailRequired: 'L’e-mail est requis',
        requestChange: 'Demander le changement d’e-mail',
        sendVerification: 'Envoyer la vérification',
        nevermind: 'Laisser tomber',
        verificationSentPrefix: 'Nous avons envoyé un lien de vérification à',
        verificationSentSuffix:
          '. Suivez les instructions pour confirmer votre nouvelle adresse e-mail.',
        verificationSentHint:
          'Vous avez changé d’avis ? Ignorez simplement l’e-mail et votre adresse actuelle restera active.',
      },
      billingManagers: {
        title: 'Gestionnaires de facturation',
        description:
          'Les gestionnaires de facturation peuvent gérer les coordonnées de facturation, les moyens de paiement et les abonnements.',
      },
      privacy: {
        title: 'Confidentialité',
        description: 'Télécharger une copie de toutes vos données personnelles',
        exportData: 'Exporter les données',
      },
      team: {
        roles: {
          owner: 'Propriétaire',
          billingManager: 'Gestionnaire de facturation',
          member: 'Membre',
        },
        emailPlaceholder: 'email@example.com',
        emailRequired: 'L’e-mail est requis',
        invalidEmail: 'Format d’e-mail invalide',
        invite: 'Inviter le gestionnaire de facturation',
        columnMember: 'Membre',
        columnRole: 'Rôle',
        you: '(vous)',
        removeFromTeam: 'Retirer de l’équipe',
        memberFallback: 'Membre',
        thisMemberFallback: 'ce membre',
        genericError: 'Une erreur s’est produite.',
        addedTitle: 'Gestionnaire de facturation ajouté',
        addedDescription:
          '{email} a été ajouté en tant que gestionnaire de facturation.',
        addFailedTitle: 'Impossible d’ajouter le gestionnaire de facturation',
        roleUpdatedTitle: 'Rôle mis à jour',
        roleUpdatedDescription: '{name} est maintenant un(e) {role}.',
        roleUpdateFailedTitle: 'Impossible de mettre à jour le rôle',
        removedTitle: 'Membre retiré',
        removedDescription: '{name} a été retiré(e) de l’équipe.',
        removeFailedTitle: 'Impossible de retirer le membre',
        removeModalTitle: 'Retirer un membre de l’équipe',
        removeModalDescription:
          'Voulez-vous vraiment retirer {name} de l’équipe ? Cette personne perdra l’accès à toutes les ressources de l’équipe.',
        removeConfirm: 'Retirer',
      },
    },
    usage: {
      title: 'Utilisation',
      searchPlaceholder: 'Rechercher un compteur d’utilisation',
      overview: 'Aperçu',
      columnName: 'Nom',
      columnConsumed: 'Consommé',
      columnCredited: 'Crédité',
      columnBalance: 'Solde',
    },
    benefits: {
      title: 'Octrois d’avantages',
      searchPlaceholder: 'Rechercher des octrois d’avantages...',
      empty: 'Aucun octroi d’avantages trouvé',
    },
    seats: {
      title: 'Gestion des sièges',
      totalSeats: 'Sièges totaux',
      updateSeats: 'Mettre à jour les sièges',
      columnEmail: 'E-mail',
      statusLabel: {
        pending: 'En attente',
        claimed: 'Réclamé',
        revoked: 'Révoqué',
      },
      resendInvitation: 'Renvoyer l’invitation',
      revokeSeat: 'Révoquer le siège',
      invite: 'Inviter',
      inviteMember: 'Inviter un membre',
      emailRequired: 'L’e-mail est requis',
      emailInvalid: 'Format d’e-mail invalide',
      assignError: 'Impossible d’attribuer le siège',
      invitationSendError: 'Impossible d’envoyer l’invitation',
      genericError: 'Une erreur s’est produite.',
      seatCount: {
        '=1': '# siège',
        other: '# sièges',
        _mode: 'plural',
      },
      availableSeats: {
        '=1': 'Un siège supplémentaire disponible',
        other: '# sièges supplémentaires disponibles',
        _mode: 'plural',
      },
      cannotDecrease: {
        '=1': 'Impossible de descendre en dessous de # siège attribué. Révoquez d’abord des sièges.',
        other:
          'Impossible de descendre en dessous de # sièges attribués. Révoquez d’abord des sièges.',
        _mode: 'plural',
      },
      invoicingMessage: {
        invoice:
          'Je serai facturé immédiatement au prorata pour le mois en cours.',
        prorate:
          'Votre prochaine facture inclura les nouveaux sièges ainsi que le prorata pour le mois en cours.',
        nextPeriod:
          'La mise à jour des sièges sera appliquée lors de votre prochain cycle de facturation.',
      },
      updateSuccess: {
        title: 'Sièges mis à jour',
        invoice:
          'L’abonnement a maintenant {seats}. Je serai facturé immédiatement au prorata pour le mois en cours.',
        prorate:
          'L’abonnement a maintenant {seats}. Votre prochaine facture inclura les nouveaux sièges ainsi que le prorata pour le mois en cours.',
        nextPeriod:
          'L’abonnement aura {seats} à partir de votre prochain cycle de facturation.',
        default: 'L’abonnement a maintenant {seats}.',
      },
      updateError: {
        title: 'Erreur lors de la mise à jour des sièges',
        description: 'Impossible de mettre à jour les sièges',
        unexpected: 'Une erreur inattendue s’est produite',
      },
      revokeSuccess: {
        title: 'Siège révoqué avec succès',
        description: 'Le siège a été révoqué et est maintenant disponible.',
      },
      revokeError: {
        title: 'Impossible de révoquer le siège',
      },
      resendSuccess: {
        title: 'Invitation renvoyée',
        description: 'L’e-mail d’invitation a été envoyé à nouveau.',
      },
      resendError: {
        title: 'Impossible de renvoyer l’invitation',
      },
    },
    wallet: {
      availableBalance: 'Solde disponible',
      organization: 'Organisation',
      currency: 'Devise',
    },
  },
} as const
