import { schemas } from '@polar-sh/client'

// The backend checklist stores state only. All wording lives here, keyed by
// step key, so we can reword a step without a data migration.

export interface StepInputField {
  name: string
  label: string
  placeholder?: string
  hint?: string
  required: boolean
}

export interface StepCopy {
  title: string
  description: string
  guidance?: string[]
  warning?: string
  inputs?: StepInputField[]
  action?: string
  showsDestinationAccount?: boolean
}

export const STRIPE_MIGRATION_ID_FIELD = 'stripe_migration_request_id'

export const STRIPE_COPY_STATUS_URL =
  'https://dashboard.stripe.com/acct_1LzIVeDG1jUQrXwC/copy-status/shared'

const STRIPE_MIGRATION_ID_RE = /^migreq_[A-Za-z0-9_]+$/

export function isValidStripeMigrationId(value: string): boolean {
  return STRIPE_MIGRATION_ID_RE.test(value)
}

export function stripeMigrationIdError(value: string): string | null {
  const trimmed = value.trim()
  if (!trimmed) {
    return null
  }
  if (!isValidStripeMigrationId(trimmed)) {
    return 'Must start with migreq_ followed by letters, numbers, or underscores.'
  }
  return null
}

const STRIPE_MIGRATION_ID_INPUT: StepInputField = {
  name: STRIPE_MIGRATION_ID_FIELD,
  label: 'Stripe migration ID',
  placeholder: 'migreq_…',
  hint: 'Starts with migreq_. Find it on the Stripe copy status page.',
  required: false,
}

export const STEP_COPY: Record<string, StepCopy> = {
  share_destination_account: {
    title: 'Get the Polar account ID',
    description:
      'This is the Stripe account your cards move into. You need it for the next step.',
  },
  start_copy: {
    title: 'Start the copy in Stripe',
    description: 'Ask Stripe to copy your saved cards over to Polar.',
    guidance: [
      'In Stripe, open Customers and choose Copy customers.',
      'Upload the CSV, paste the Polar account ID as the recipient, then confirm.',
    ],
    warning:
      'Only the account owner can start a copy. Wallet cards, Bacs and old SEPA mandates do not copy.',
    inputs: [STRIPE_MIGRATION_ID_INPUT],
    action: 'I started the copy',
    showsDestinationAccount: true,
  },
  authorize_copy: {
    title: 'Polar accepts the copy',
    description:
      'We accept the incoming copy on our Stripe account. This usually takes one business day.',
  },
  stripe_copy: {
    title: 'Stripe copies the cards',
    description:
      'Stripe moves the card data. This takes a few hours, and up to 72 hours.',
  },
  open_stripe_request: {
    title: 'Polar opens the Stripe request',
    description:
      'We open a migration request with Stripe and share our PCI documents.',
    // Ops fills this in, but the merchant is the one who has to quote it to
    // their provider on the next step, so it has to stay readable afterwards.
    inputs: [
      {
        ...STRIPE_MIGRATION_ID_INPUT,
        required: true,
      },
    ],
  },
  request_provider_export: {
    title: 'Ask your provider for the card export',
    description:
      'Your provider sends the encrypted card data to Stripe. Only you can ask them for it.',
    guidance: [
      'Open a ticket with your provider and ask for a PCI card data migration to Stripe.',
      'Give them the Stripe recipient details from our migration request.',
      'Ask them to include the network transaction IDs and the full billing address.',
    ],
    warning:
      'Most providers allow only two exports. Keep the second one for the cutover.',
    inputs: [
      {
        name: 'provider_reference',
        label: 'Ticket or request reference',
        placeholder: 'The reference your provider gave you',
        required: true,
      },
      {
        name: 'provider_contact',
        label: 'Contact at your provider',
        placeholder: 'Email address',
        required: false,
      },
    ],
    action: 'I asked my provider',
  },
  provider_export: {
    title: 'Your provider prepares the export',
    description:
      'This takes around two weeks. Your provider sends the encrypted file straight to Stripe.',
  },
  map_customers: {
    title: 'Polar maps your customers',
    description:
      'We send Stripe a map of your old customer IDs, so every card lands on the right customer.',
  },
  stripe_review: {
    title: 'Stripe reviews the file',
    description:
      'Stripe checks the file and sends back a summary. Errors come back here if something needs fixing.',
  },
  approve_import: {
    title: 'Polar approves the import',
    description: 'We review the summary from Stripe and approve it.',
  },
  stripe_import: {
    title: 'Stripe imports the cards',
    description:
      'This takes around ten business days once Stripe has correct data.',
  },
  verify_cards: {
    title: 'Polar checks the cards',
    description:
      'We check that every imported subscription has a card it can charge, and tell you which ones do not.',
  },
  resolve_uncovered: {
    title: 'Handle customers without a card',
    description:
      'Some customers have to add a card again. Ask them to do it, or run the copy again to pick up new cards.',
    action: 'I handled these customers',
  },
  cutover: {
    title: 'Switch billing to Polar',
    description:
      'Pick the subscriptions to switch. Polar starts billing them and stops them on Stripe.',
    warning: 'You cannot undo this. Charges start on Polar from now on.',
    action: 'Switch subscriptions',
  },
  move_subscriptions: {
    title: 'Polar switches your subscriptions',
    description:
      'We start billing the subscriptions you picked. They are charged on their next renewal date.',
  },
}

type Owner = schemas['PanStepOwner']

// Polar Ops and the Polar app are the same party to a merchant. The split only
// matters to us.
const OWNER_LABEL: Record<Owner, string> = {
  merchant: 'You',
  polar_ops: 'Polar',
  polar_app: 'Polar',
  stripe: 'Stripe',
  provider: 'Your provider',
}

const WAITING_LABEL: Record<Owner, string> = {
  merchant: 'Your turn',
  polar_ops: 'With Polar',
  polar_app: 'With Polar',
  stripe: 'With Stripe',
  provider: 'With your provider',
}

// An owner the backend added but this build doesn't know yet still has to read
// as something, the same way an unknown step key does.
export const ownerLabel = (owner: Owner): string =>
  OWNER_LABEL[owner] ?? 'Polar'

export const waitingLabel = (owner: Owner): string =>
  WAITING_LABEL[owner] ?? 'In progress'
