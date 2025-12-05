import stripe as stripe_lib


def get_dispute_balance_transaction(
    dispute: stripe_lib.Dispute,
) -> stripe_lib.BalanceTransaction | None:
    try:
        return next(
            bt
            for bt in dispute.balance_transactions
            if bt.reporting_category == "dispute"
        )
    except StopIteration:
        return None


def is_rapid_resolution_dispute(
    dispute: stripe_lib.Dispute,
) -> bool:
    """
    Determines if a Stripe dispute is a Rapid Dispute Resolution (RDR) dispute.

    Our best effort approach is to look for the associated balance transaction that
    withdraws funds, and check if the fee is zero, which is typical for RDR disputes.
    """
    balance_transaction = get_dispute_balance_transaction(dispute)
    if balance_transaction is None:
        return False
    return balance_transaction.fee == 0
