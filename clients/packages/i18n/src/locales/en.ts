export default {
  checkout: {
    footer: {
      poweredBy: 'Powered by',
      merchantOfRecord:
        'This order is processed by our online reseller & Merchant of Record, Polar, who also handles order-related inquiries and returns.',
      mandateSubscriptionTrial:
        'By clicking "{buttonLabel}," you authorize Polar Software, Inc., our online reseller and merchant of record, to charge your selected payment method in the amount shown above at the end of your trial period and on each subsequent billing date until you cancel, and agree to the {buyerTermsLink}. You may cancel at any time before the end of your trial to avoid being charged.',
      mandateSubscription:
        'By clicking "{buttonLabel}," you authorize Polar Software, Inc., our online reseller and merchant of record, to immediately charge your selected payment method in the amount shown above and to charge the same amount on each subsequent billing date until you cancel, and agree to the {buyerTermsLink}.',
      mandateOneTime:
        'By clicking "{buttonLabel}," you authorize Polar Software, Inc., our online reseller and merchant of record, to charge your selected payment method the amount shown above, and agree to the {buyerTermsLink}. This is a one-time charge.',
      buyerTermsLink: 'Buyer Terms',
    },
    form: {
      email: 'Email',
      cardholderName: 'Cardholder name',
      purchasingAsBusiness: "I'm purchasing as a business",
      addBusinessDetails: 'Add business details',
      removeBusinessDetails: 'Remove business details',
      businessName: 'Business name',
      billingDetails: 'Business Details',
      billingAddress: {
        label: 'Billing address',
        line1: {
          value: 'Street address',
          _llmContext:
            'The first line of the billing address, typically including street address and number. Adjust to fit the most common format for the target locale.',
        },
        line2: {
          value: 'Apartment or unit number',
          _llmContext:
            'The second line of the billing address, typically used for apartment, suite, unit, building, floor, etc. Adjust to fit the most common format for the target locale.',
        },
        postalCode: 'Postal code',
        city: 'City',
        country: 'Country',
        state: 'State',
        province: 'Province',
        stateProvince: 'State / Province',
      },
      taxId: 'Tax ID',
      discountCode: 'Discount code',
      addDiscountCode: 'Add discount code',
      optional: 'Optional',
      apply: {
        value: 'Apply',
        _llmContext: 'Button text for applying a discount code.',
      },
      fieldRequired: 'This field is required',
    },
    pricing: {
      subtotal: 'Subtotal',
      taxableAmount: 'Taxable amount',
      taxes: {
        value: 'Taxes',
        _llmContext:
          'Taxes applied to the order. This is VAT or sales tax. Prefer the specific term used in the target locale over a generic taxes (e.g. TVA in French, BTW in Dutch, etc.)',
      },
      inclTax: {
        value: 'Taxes (included)',
        _llmContext:
          'Label for the tax line in the pricing breakdown when tax is already included in the displayed price. Prefer the specific tax term used in the target locale (e.g. TVA (incluse) in French, BTW (inbegrepen) in Dutch, Moms (inkluderad) in Swedish, etc.)',
      },
      free: 'Free',
      payWhatYouWant: {
        value: 'Pay what you want',
        _llmContext:
          'A pricing type where the customer can choose how much to pay.',
      },
      total: 'Total',
      everyInterval: {
        day: {
          _mode: 'plural',
          '=1': 'Daily',
          '=2': 'Every other day',
          other: 'Every # days',
        },
        week: {
          _mode: 'plural',
          '=1': 'Weekly',
          '=2': 'Every other week',
          other: 'Every # weeks',
        },
        month: {
          _mode: 'plural',
          '=1': 'Monthly',
          '=2': 'Every other month',
          other: 'Every # months',
        },
        year: {
          _mode: 'plural',
          '=1': 'Yearly',
          '=2': 'Every other year',
          other: 'Every # years',
        },
      },
      additionalMeteredUsage: 'Additional metered usage',
      perUnit: '/ unit',
      perSeat: 'per seat',
      basePrice: {
        value: 'Base price',
        _llmContext:
          'Label for the flat, fixed portion of a product that combines a fixed base fee with per-seat pricing. Shown as a line item above the per-seat rows in the checkout pricing breakdown.',
      },
      seats: {
        label: 'Seats',
        numberOfSeats: 'Number of seats',
        count: {
          _mode: 'plural',
          '=1': '# seat',
          other: '# seats',
        },
        included: {
          _mode: 'plural',
          '=1': 'One seat included',
          other: '# seats included',
        },
        range: {
          value: '{min} - {max} seats',
          _llmContext:
            'Shown when a seat-based product has both a minimum and maximum seat count. Displayed as: "5 - 100 seats". Always plural.',
        },
        minimum: {
          value: 'Minimum {min} seats',
          _llmContext:
            'Shown when a seat-based product has a minimum seat count but no maximum. The {min} value is always > 1 in this context, so the noun is always plural.',
        },
        maximum: {
          value: 'Maximum {max} seats',
          _llmContext:
            'Shown when a seat-based product has a maximum seat count but no minimum constraint. The {max} value can be any number, but the message is always rendered with the plural noun.',
        },
        updateFailed: 'Failed to update seats',
      },
      discount: {
        duration: {
          months: {
            _mode: 'plural',
            '=1': 'for the first month',
            other: 'for the first # months',
          },
          years: {
            _mode: 'plural',
            '=1': 'for the first year',
            other: 'for the first # years',
          },
        },
        until: {
          value: 'Until {date}',
          _llmContext:
            'Shown next to the discount name to indicate when the discount expires. Displayed as: "Spring Sale (-50%) · Until Apr 23".',
        },
      },
    },
    trial: {
      ends: 'Trial ends {endDate}',
      duration: {
        days: {
          _mode: 'plural',
          '=1': '# day trial',
          other: '# days trial',
        },
        weeks: {
          _mode: 'plural',
          '=1': '# week trial',
          other: '# weeks trial',
        },
        months: {
          _mode: 'plural',
          '=1': '# month trial',
          other: '# months trial',
        },
        years: {
          _mode: 'plural',
          '=1': '# year trial',
          other: '# years trial',
        },
      },
      hero: {
        free: {
          day: {
            _mode: 'plural',
            '=1': '# day free',
            other: '# days free',
          },
          month: {
            _mode: 'plural',
            '=1': '# month free',
            other: '# months free',
          },
          year: {
            _mode: 'plural',
            '=1': '# year free',
            other: '# years free',
          },
        },
        intervalSuffix: {
          day: '/day',
          week: '/week',
          month: '/month',
          year: '/year',
        },
        then: {
          value: 'Then',
          _llmContext:
            'Prefix before the recurring price in the trial hero subtitle. Displayed as: "Then <bold>$99.99/year</bold> starting April 5, 2026". The price is a separate bold element.',
        },
        startingDate: {
          value: 'starting {date}',
          _llmContext:
            'Suffix after the recurring price when a trial end date is known. Displayed as: "Then $99.99/year starting April 5, 2026". The "Then" prefix and bold price are separate elements.',
        },
      },
      summary: {
        totalWhenTrialEnds: 'Total when trial ends',
        totalWhenDiscountExpires: 'Total when discount expires',
        totalDueToday: 'Total due today',
      },
    },
    pwywForm: {
      label: 'Name a fair price',
      minimum: '{amount} minimum',
      amountMinimum: 'Amount must be at least {min}',
      amountFreeOrMinimum: 'Amount must be {zero} or at least {min}',
    },
    productSwitcher: {
      billedRecurring: 'Billed {frequency}',
      oneTimePurchase: 'One-time purchase',
      fromPrefix: 'From',
    },
    productDescription: {
      readMore: 'Read more',
      readLess: 'Read less',
    },
    card: {
      included: 'Included',
    },
    benefits: {
      moreBenefits: {
        _mode: 'plural',
        '=1': '# more benefit',
        other: '# more benefits',
      },
      showMoreBenefits: {
        _mode: 'plural',
        '=1': 'Show # more benefit',
        other: 'Show # more benefits',
      },
      showLess: 'Show less',
      granting: 'Granting benefits...',
      requestNewInvite: 'Request new invite',
      retryIn: {
        _mode: 'plural',
        '=1': 'Try again in # second',
        other: 'Try again in # seconds',
      },
      connectNewAccount: 'Connect new account',
      requestMyInvite: 'Request my invite',
      github: {
        connect: 'Connect GitHub account',
        goTo: 'Go to {repository}',
        selectAccount: 'Select a GitHub account',
      },
      discord: {
        connect: 'Connect Discord account',
        open: 'Open Discord',
        selectAccount: 'Select a Discord account',
      },
      licenseKey: {
        copy: 'Copy',
        copiedToClipboard: 'Copied To Clipboard',
        copiedToClipboardDescription: 'License Key was copied to clipboard',
        loading: 'Loading...',
        status: 'Status',
        statusGranted: 'Granted',
        statusRevoked: 'Revoked',
        statusDisabled: 'Disabled',
        usage: 'Usage',
        validations: 'Validations',
        validatedAt: 'Validated At',
        neverValidated: 'Never Validated',
        expiryDate: 'Expiry Date',
        noExpiry: 'No Expiry',
        activations: 'Activations',
        activationDeleted: 'License Key Activation Deleted',
        activationDeletedDescription: 'Activation deleted successfully',
        activationDeactivationFailed: 'Activation Deactivation Failed',
      },
    },
    confirmation: {
      confirmPayment: 'Confirm payment',
      processingTitle: 'We are processing your order',
      successTitle: 'Thank you for your order!',
      failedTitle: 'A problem occurred while processing your order',
      processingDescription: 'Please wait while we confirm your payment.',
      successDescription: 'You now have access to {product}.',
      failedDescription: 'Please try again or contact support.',
    },
    loading: {
      processingOrder: 'Processing order...',
      processingPayment: 'Processing payment',
      paymentSuccessful: 'Payment successful! Getting your products ready...',
      confirmationTokenFailed:
        'Failed to create confirmation token, please try again later.',
    },
    cta: {
      startTrial: 'Start trial',
      subscribeNow: 'Subscribe now',
      payNow: 'Pay now',
      getFree: 'Get for free',
      paymentsUnavailable: 'Payments are currently unavailable',
    },
  },
  intervals: {
    short: {
      day: 'dy',
      week: 'wk',
      month: 'mo',
      year: 'yr',
    },
  },
  benefitTypes: {
    license_keys: 'License keys',
    github_repository: 'GitHub repository access',
    discord: 'Discord invite',
    downloadables: 'File downloads',
    custom: 'Custom',
    meter_credit: 'Meter credits',
    feature_flag: 'Feature flag',
  },
  ordinal: {
    zero: {
      value: '',
      _llmContext:
        'Ordinal suffix for the "zero" category of Intl.PluralRules (type: ordinal). Appended to a number to form ordinals. Provide the suffix only — the number is prepended automatically. For locales where all ordinals use the same suffix (e.g. German "1.", "2."), set every key to the same value. Not used in English.',
    },
    one: {
      value: 'st',
      _llmContext:
        'Ordinal suffix for the "one" category of Intl.PluralRules (type: ordinal). Appended to a number to form ordinals (e.g. 1st, 21st, 31st in English). Provide the suffix only — the number is prepended automatically. For locales where all ordinals use the same suffix (e.g. German "1.", "2."), set every key to the same value.',
    },
    two: {
      value: 'nd',
      _llmContext:
        'Ordinal suffix for the "two" category of Intl.PluralRules (type: ordinal). Appended to a number to form ordinals (e.g. 2nd, 22nd in English). Provide the suffix only — the number is prepended automatically.',
    },
    few: {
      value: 'rd',
      _llmContext:
        'Ordinal suffix for the "few" category of Intl.PluralRules (type: ordinal). Appended to a number to form ordinals (e.g. 3rd, 23rd in English). Provide the suffix only — the number is prepended automatically.',
    },
    many: {
      value: '',
      _llmContext:
        'Ordinal suffix for the "many" category of Intl.PluralRules (type: ordinal). Appended to a number to form ordinals. Provide the suffix only — the number is prepended automatically. Not used in English.',
    },
    other: {
      value: 'th',
      _llmContext:
        'Ordinal suffix for the "other" (default/fallback) category of Intl.PluralRules (type: ordinal). Appended to a number to form ordinals (e.g. 4th, 5th, 11th in English). Provide the suffix only — the number is prepended automatically.',
    },
  },
  embedPaymentMethod: {
    title: 'Add payment method',
    close: {
      value: 'Close',
      _llmContext:
        'aria-label for the close (X) button on the embedded payment method modal.',
    },
    submit: 'Add payment method',
    processing: 'Adding payment method…',
    fallbackError: 'Something went wrong. Please try again.',
    errors: {
      invalidRequest: 'Missing required parameters.',
      unauthorized: 'Session expired.',
      processingFailed:
        'Could not process the payment method. Please try again.',
      unknown: 'Something went wrong.',
    },
  },
  portal: {
    navigation: {
      overview: 'Overview',
      orders: 'Orders',
      usage: 'Usage',
      billing: 'Billing',
      selectPage: {
        value: 'Select page',
        _llmContext:
          'Placeholder for the mobile dropdown used to navigate between customer portal sections.',
      },
    },
    common: {
      cancel: 'Cancel',
      close: 'Close',
      save: 'Save',
      saveChanges: 'Save changes',
      edit: 'Edit',
      delete: 'Delete',
      confirm: 'Confirm',
      back: 'Back',
      loading: 'Loading…',
      saving: 'Saving…',
      download: 'Download',
      viewAll: 'View all',
      somethingWentWrong: 'Something went wrong. Please try again.',
      date: 'Date',
      amount: 'Amount',
      status: 'Status',
      product: 'Product',
      actions: 'Actions',
      pageOf: {
        value: 'Page {page} of {totalPages}',
        _llmContext:
          'Pagination indicator, e.g. "Page 2 of 5". {page} is the current page, {totalPages} the total.',
      },
    },
    overview: {
      teamSeatAccess: {
        title: 'Team Seat Access',
        description: 'Access provided through team subscription',
      },
      emptyState: {
        noActiveSubscriptions: {
          title: 'No Active Subscriptions',
          description: "You don't have any active subscriptions at the moment.",
        },
        noTeamAccess: {
          title: 'No Team Access',
          description: "You don't have any team seat access at the moment.",
        },
      },
      currentPeriod: {
        nextCharge: 'Next Charge',
        nextInvoice: 'Next Invoice',
        firstChargeAfterTrial: 'First Charge After Trial',
        trialEnds: 'Trial Ends',
        finalCharge: 'Final Charge',
        subscriptionEnds: 'Subscription Ends',
        notAvailable: {
          value: 'N/A',
          _llmContext:
            'Shown in place of a date when the charge date is unknown, e.g. "Next Invoice — N/A".',
        },
        dateLabel: {
          value: '{label} — {date}',
          _llmContext:
            'Combines a label like "Next Invoice" with a formatted date, shown as the meta text of the upcoming-charge card.',
        },
        canceled: 'Canceled',
        meteredCharges: 'Metered Charges',
        subtotal: 'Subtotal',
        discount: 'Discount',
        taxes: 'Taxes',
        estimatedTotal: 'Estimated Total',
        total: 'Total',
        finalChargeNotice:
          'This will be the final charge before the subscription ends.',
        finalChargeMeteredNotice:
          'Final amount may vary based on usage until the end of the billing period.',
        meteredNoticeActive:
          'Final charges may vary based on usage until the end of the billing period.',
        meteredNoticeTrialing:
          'Final charges may vary based on usage during the trial period.',
        meteredNoticeDefault: 'Final charges may vary.',
      },
      latestPurchase: {
        title: 'Latest Purchase',
        purchasedOn: {
          value: 'Purchased — {date}',
          _llmContext:
            'Meta text on the latest-purchase card showing when the order was placed.',
        },
        total: 'Total',
      },
      subscriptions: {
        title: 'Subscriptions',
        noSubscriptionsFound: 'No Subscriptions Found',
        inactiveTitle: 'Inactive Subscriptions',
        endedAt: {
          value: 'Ended At',
          _llmContext: 'Table column header for the date a subscription ended.',
        },
        retryPayment: 'Retry payment',
        manageSubscription: 'Manage subscription',
      },
    },
    orders: {
      orderHistory: 'Order History',
      description: 'Description',
      viewOrder: 'View Order',
      retryPayment: 'Retry payment',
      invoiceNumber: 'Invoice number',
      orderItems: 'Order Items',
      subtotal: 'Subtotal',
      discount: 'Discount',
      netAmount: 'Net amount',
      tax: 'Tax',
      total: 'Total',
      appliedBalance: 'Applied balance',
      toBePaid: 'To be paid',
      refundedAmount: 'Refunded amount',
      statusTitle: {
        draft: 'Draft',
        paid: 'Paid',
        pending: 'Pending',
        refunded: 'Refunded',
        partiallyRefunded: 'Partially Refunded',
        void: {
          value: 'Void',
          _llmContext:
            'Order status label meaning the order was voided/cancelled before payment.',
        },
      },
      payment: {
        orderSummary: 'Order Summary',
        descriptionLabel: 'Description:',
        amountLabel: 'Amount:',
        paymentMethod: 'Payment Method',
        payNow: 'Pay Now',
        processing: 'Processing...',
        confirming: 'Confirming...',
        loading: {
          value: 'Loading...',
          _llmContext:
            'Visually-hidden text inside a loading spinner, read by screen readers.',
        },
        processingPayment: 'Processing your payment...',
        processingHint:
          "This may take a few moments. Please don't close this window.",
        processingPaymentShort: 'Processing payment...',
        usingSavedMethod: 'Using your saved payment method',
        tryAgain: 'Try Again',
        paymentSuccessfulTitle: 'Payment Successful!',
        paymentFailedTitle: 'Payment Failed',
        paymentSuccessfulDescription:
          'Thank you for your payment. You can now close this window.',
        paymentFailedDescription:
          'You can try again or contact support if the issue persists.',
        updatePaymentMethod: 'Update Payment Method',
        toastSuccessTitle: 'Payment Successful',
        toastSuccessDescription:
          'Your payment has been processed successfully!',
        toastFailedTitle: 'Payment Failed',
        paymentFailed: 'Payment failed',
        paymentFailedRetry: 'Payment failed. Please try again.',
        paymentFailedTryAgain: 'Payment failed, please try again.',
        confirmationTimeout:
          'Payment confirmation is taking longer than expected. Your payment may still be processing. Please check your order status or contact support if needed.',
        networkConfirmationError:
          'Unable to confirm payment status due to network issues. Please check your order status or contact support.',
        stripeRequired: {
          value: 'Stripe instance is required for payment actions',
          _llmContext:
            'Error shown when the Stripe payment library failed to load before a payment action.',
        },
        additionalAuthenticationRequired:
          'Payment requires additional authentication',
        authenticationFailed: 'Payment authentication failed',
        processDetailsFailed:
          'Failed to process payment details. Please check your information and try again.',
        createTokenFailed: 'Failed to create payment token. Please try again.',
        processPaymentFailed:
          'Failed to process payment. Please check your payment information and try again.',
        networkError:
          'Network error occurred. Please check your connection and try again.',
      },
    },
    subscription: {
      free: {
        value: 'Free',
        _llmContext: 'Shown as the price of a subscription that has no cost.',
      },
      details: {
        startDate: 'Start Date',
        trialEnds: 'Trial Ends',
        expiryDate: {
          value: 'Expiry Date',
          _llmContext: 'Label for the date a cancelled subscription will end.',
        },
        renewalDate: {
          value: 'Renewal Date',
          _llmContext:
            'Label for the date the subscription renews and is charged again.',
        },
        expired: {
          value: 'Expired',
          _llmContext: 'Label for the date a subscription ended.',
        },
        meteredUsage: 'Metered Usage',
        uncancel: {
          value: 'Uncancel',
          _llmContext:
            'Button to undo a scheduled cancellation and keep the subscription active.',
        },
        manageSubscription: 'Manage subscription',
        changePlan: 'Change plan',
      },
      pendingUpdate: {
        title: {
          value: 'Pending Update',
          _llmContext:
            'Heading for a subscription change that is scheduled to take effect later.',
        },
        cancelScheduledChange: 'Cancel scheduled change',
        newProduct: 'New Product',
        seats: 'Seats',
        effectiveFrom: 'Update in effect from',
        clearConfirmDescription:
          'Your subscription will remain unchanged on the next billing cycle. Are you sure you want to cancel this pending update?',
      },
      invoices: {
        title: 'Invoices',
      },
      cancel: {
        title: 'Cancel Subscription',
        ariaLabel: {
          value: 'Cancel subscription',
          _llmContext:
            'Accessibility label for the button that opens the cancellation flow.',
        },
        heading: "We're sorry to see you go!",
        description:
          "You're always welcome back! Let us know why you're leaving to help us improve our product.",
        changedMind: {
          value: "I've changed my mind",
          _llmContext:
            'Button to dismiss the cancellation flow and keep the subscription.',
        },
        commentPlaceholder: 'Anything else you want to share? (Optional)',
        reason: {
          unused: 'Not using it enough',
          tooExpensive: 'Too expensive',
          missingFeatures: 'Missing features',
          switchedService: 'Switched to another service',
          customerService: 'Customer service',
          lowQuality: 'Not satisfied with the quality',
          tooComplex: 'Too complicated',
          other: 'Other (please share below)',
        },
        toast: {
          title: 'Subscription Cancelled',
          description: 'Subscription was cancelled successfully',
        },
      },
      changePlan: {
        title: 'Change Plan',
        currentPlan: 'Current Plan',
        availablePlans: 'Available Plans',
        noOtherPlans: 'No other plans available',
        benefitsAdded: "You'll get access to the following benefits",
        benefitsRemoved: "You'll lose access to the following benefits",
        needPaymentMethod:
          'You need to add a payment method before updating your plan. Head to the Customer Portal Settings to add a payment method.',
        confirmEndTrial: 'Change Plan & End Trial',
        invoicing: {
          trialContinues:
            "Your trial will continue until {date}. You won't be charged before then.",
          trialEnds:
            'This will end my trial and charge me immediately for {product}.',
          periodMonthly: {
            value: 'monthly',
            _llmContext:
              'Billing period word inserted into "I\'ll be charged immediately for the new {period} plan."',
          },
          periodYearly: {
            value: 'yearly',
            _llmContext:
              'Billing period word inserted into "I\'ll be charged immediately for the new {period} plan."',
          },
          immediateCharge:
            "I'll be charged immediately for the new {period} plan.",
          immediateCredit:
            'My previous payment will appear as a credit on my next invoice.',
          prorationInvoice:
            "I'll be charged immediately with a proration for the current month.",
          prorationProrate:
            'Your next invoice will include the new plan plus the proration for the current month.',
          prorationNextPeriod:
            'The new plan will be applied on your next billing cycle.',
        },
        update: {
          failed: 'Failed to update subscription',
          errorTitle: 'Error updating subscription',
          successTitle: 'Subscription Updated',
          successDescription: 'Subscription was updated successfully',
        },
      },
    },
    settings: {
      title: 'Billing Settings',
      paymentMethods: {
        title: 'Payment Methods',
        description: 'Methods used for subscriptions & one-time purchases',
        add: 'Add Payment Method',
        addedTitle: 'Payment method added',
        addFailedTitle: 'Could not add payment method',
        addFailedDescription: 'Please try again.',
      },
      paymentMethod: {
        defaultMethod: {
          value: 'Default Method',
          _llmContext:
            'Badge shown on the payment method that is currently set as the default.',
        },
        makeDefault: 'Make default',
        deleteAriaLabel: {
          value: 'Delete payment method',
          _llmContext:
            'Accessible label for the icon-only button that removes a saved payment method.',
        },
        deletedTitle: 'Payment method deleted',
        deletedDescription:
          'Your payment method has been successfully removed.',
        deleteFailedTitle: 'Failed to delete payment method',
        deleteFailedDescription:
          'An error occurred while deleting the payment method.',
        defaultUpdatedTitle: 'Default payment method updated',
        defaultUpdatedDescription: 'This payment method is now your default.',
        defaultUpdateFailedTitle: 'Failed to update default payment method',
        defaultUpdateFailedDescription:
          'An error occurred while updating the default payment method.',
      },
      savedCards: {
        title: 'Saved Payment Methods',
        empty: 'No saved payment methods found.',
        addNewCard: 'Add New Card',
        useDifferentCard: 'Use a Different Card',
        expires: {
          value: 'Expires {date}',
          _llmContext:
            'Card expiry shown below a saved card. {date} is a MM/YYYY string, e.g. "09/2027".',
        },
      },
      billingDetailsSection: {
        title: 'Billing Details',
        description: 'Update your billing details',
      },
      billingDetails: {
        email: 'Email',
        billingName: 'Billing Name',
        billingNamePlaceholder: 'Company or legal name for invoices (optional)',
        billingAddress: 'Billing address',
        line1: {
          value: 'Line 1',
          _llmContext: 'Placeholder for the first line of a billing address.',
        },
        line2: {
          value: 'Line 2',
          _llmContext: 'Placeholder for the second line of a billing address.',
        },
        postalCode: 'Postal code',
        city: 'City',
        state: 'State',
        province: 'Province',
        taxId: 'Tax ID',
        fieldRequired: 'This field is required',
        submit: 'Update Billing Details',
      },
      emailSection: {
        title: 'Email Address',
        description: 'Change the email associated with your account',
      },
      changeEmail: {
        currentEmail: 'Current email',
        newEmail: 'New email',
        newEmailPlaceholder: 'Enter new email address',
        emailRequired: 'Email is required',
        requestChange: 'Request Email Change',
        sendVerification: 'Send Verification',
        nevermind: 'Nevermind',
        verificationSentPrefix: {
          value: 'We sent a verification link to',
          _llmContext:
            'Start of a sentence; immediately followed by the email address in bold, then verificationSentSuffix. The email is appended after this text.',
        },
        verificationSentSuffix: {
          value: '. Follow the instructions to confirm your new email.',
          _llmContext:
            'End of the sentence that begins with verificationSentPrefix and a bold email address. Starts with a period that follows the email.',
        },
        verificationSentHint:
          'Changed your mind? Simply ignore the email and your current address will remain active.',
      },
      billingManagers: {
        title: 'Billing Managers',
        description:
          'Billing Managers can manage billing details, payment methods, and subscriptions.',
      },
      privacy: {
        title: 'Privacy',
        description: 'Download a copy of all your personal data',
        exportData: 'Export Data',
      },
      team: {
        roles: {
          owner: 'Owner',
          billingManager: 'Billing Manager',
          member: 'Member',
        },
        emailPlaceholder: {
          value: 'email@example.com',
          _llmContext:
            'Placeholder in the email input for inviting a billing manager. Usually kept as a literal example address.',
        },
        emailRequired: 'Email is required',
        invalidEmail: 'Invalid email format',
        invite: 'Invite billing manager',
        columnMember: {
          value: 'Member',
          _llmContext: 'Table column header listing team members.',
        },
        columnRole: {
          value: 'Role',
          _llmContext: "Table column header for a member's role.",
        },
        you: {
          value: '(you)',
          _llmContext:
            'Shown next to the current user in the team members table.',
        },
        removeFromTeam: 'Remove from Team',
        memberFallback: {
          value: 'Member',
          _llmContext:
            'Fallback name used in toasts when a member has no name, e.g. "Member is now a Owner."',
        },
        thisMemberFallback: {
          value: 'this member',
          _llmContext:
            'Fallback used in the removal confirmation when the member has no name or email.',
        },
        genericError: 'An error occurred.',
        addedTitle: 'Billing manager added',
        addedDescription: '{email} has been added as a billing manager.',
        addFailedTitle: 'Failed to add billing manager',
        roleUpdatedTitle: 'Role updated',
        roleUpdatedDescription: '{name} is now a {role}.',
        roleUpdateFailedTitle: 'Failed to update role',
        removedTitle: 'Member removed',
        removedDescription: '{name} has been removed from the team.',
        removeFailedTitle: 'Failed to remove member',
        removeModalTitle: 'Remove Team Member',
        removeModalDescription:
          'Are you sure you want to remove {name} from the team? They will lose access to all team resources.',
        removeConfirm: 'Remove',
      },
    },
    usage: {
      title: 'Usage',
      searchPlaceholder: 'Search Usage Meter',
      overview: 'Overview',
      columnName: {
        value: 'Name',
        _llmContext: 'Table column header for the usage meter name.',
      },
      columnConsumed: {
        value: 'Consumed',
        _llmContext:
          'Table column header for the number of consumed meter units.',
      },
      columnCredited: {
        value: 'Credited',
        _llmContext:
          'Table column header for the number of credited meter units.',
      },
      columnBalance: {
        value: 'Balance',
        _llmContext:
          'Table column header for the remaining meter unit balance.',
      },
    },
    benefits: {
      title: 'Benefit Grants',
      searchPlaceholder: 'Search benefit grants...',
      empty: 'No benefit grants found',
    },
    seats: {
      title: 'Seat Management',
      totalSeats: 'Total seats',
      updateSeats: 'Update seats',
      columnEmail: 'Email',
      statusLabel: {
        pending: 'Pending',
        claimed: 'Claimed',
        revoked: 'Revoked',
      },
      resendInvitation: 'Resend Invitation',
      revokeSeat: 'Revoke Seat',
      invite: 'Invite',
      inviteMember: 'Invite member',
      emailRequired: 'Email is required',
      emailInvalid: 'Invalid email format',
      assignError: 'Failed to assign seat',
      invitationSendError: 'Failed to send invitation',
      genericError: 'An error occurred.',
      seatCount: {
        _mode: 'plural',
        '=1': '# seat',
        other: '# seats',
      },
      availableSeats: {
        _mode: 'plural',
        '=1': 'One more seat available',
        other: '# more seats available',
      },
      cannotDecrease: {
        _mode: 'plural',
        '=1': 'Cannot decrease below # assigned seat. Revoke seats first.',
        other: 'Cannot decrease below # assigned seats. Revoke seats first.',
      },
      invoicingMessage: {
        invoice:
          "I'll be charged immediately with a proration for the current month.",
        prorate:
          'Your next invoice will include the updated seats plus the proration for the current month.',
        nextPeriod:
          'The seat update will be applied on your next billing cycle.',
      },
      updateSuccess: {
        title: 'Seats updated',
        invoice:
          "Subscription now has {seats}. You'll be charged immediately with a proration for the current month.",
        prorate:
          'Subscription now has {seats}. Your next invoice will include the updated seats plus the proration for the current month.',
        nextPeriod:
          'Subscription will have {seats} starting on your next billing cycle.',
        default: 'Subscription now has {seats}.',
      },
      updateError: {
        title: 'Error updating seats',
        description: 'Failed to update seats',
        unexpected: 'An unexpected error occurred',
      },
      revokeSuccess: {
        title: 'Seat revoked successfully',
        description: 'The seat has been revoked and is now available.',
      },
      revokeError: {
        title: 'Failed to revoke seat',
      },
      resendSuccess: {
        title: 'Invitation resent',
        description: 'The invitation email has been sent again.',
      },
      resendError: {
        title: 'Failed to resend invitation',
      },
    },
  },
} as const
