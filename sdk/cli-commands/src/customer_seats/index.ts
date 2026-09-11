// Generated CLI resource command. Do not edit.
import { Command } from 'effect/unstable/cli'
import { command as assignSeatCustomerSeats } from './assign_seat'
import { command as claimSeatCustomerSeats } from './claim_seat'
import { command as getClaimInfoCustomerSeats } from './get_claim_info'
import { command as listSeatsCustomerSeats } from './list_seats'
import { command as resendInvitationCustomerSeats } from './resend_invitation'
import { command as revokeSeatCustomerSeats } from './revoke_seat'

export const command = Command.make('customer_seats').pipe(
  Command.withSubcommands([
    assignSeatCustomerSeats,
    claimSeatCustomerSeats,
    getClaimInfoCustomerSeats,
    listSeatsCustomerSeats,
    resendInvitationCustomerSeats,
    revokeSeatCustomerSeats,
  ]),
)
