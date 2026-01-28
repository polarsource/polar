"""
Bank Linking API Endpoints.

Provides endpoints for:
- Creating Financial Connections sessions
- Completing bank linking
- Getting bank linking status
- Disconnecting bank accounts
"""

from uuid import UUID

import structlog
from fastapi import Depends, HTTPException

from polar.auth.dependencies import Auth
from polar.kit.routing import APIRouter
from polar.logging import Logger
from polar.postgres import AsyncSession, get_db_session

from .schemas import (
    BankAccountInfo,
    BankLinkingComplete,
    BankLinkingError,
    BankLinkingSession,
    BankLinkingSessionCreate,
    BankLinkingStatus,
)
from .service import (
    AccountNotActive,
    AccountNotFound,
    BankLinkingIncomplete,
    FinancialConnectionsAccountNotActive,
    MissingBankDetails,
)
from .service import bank_linking as bank_linking_service

log: Logger = structlog.get_logger()

router = APIRouter(prefix="/bank-linking", tags=["bank-linking"])


@router.post(
    "/sessions",
    response_model=BankLinkingSession,
    responses={
        400: {"model": BankLinkingError},
        404: {"model": BankLinkingError},
    },
)
async def create_bank_linking_session(
    body: BankLinkingSessionCreate,
    auth: Auth,
    session: AsyncSession = Depends(get_db_session),
) -> BankLinkingSession:
    """
    Create a Stripe Financial Connections session for bank linking.

    Returns the client_secret needed for Stripe.js to open the bank linking modal.
    """
    try:
        return await bank_linking_service.create_session(
            session,
            account_id=body.account_id,
            return_url=body.return_url,
        )
    except AccountNotFound as e:
        raise HTTPException(status_code=404, detail=str(e))
    except AccountNotActive as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post(
    "/complete",
    response_model=BankAccountInfo,
    responses={
        400: {"model": BankLinkingError},
        404: {"model": BankLinkingError},
    },
)
async def complete_bank_linking(
    body: BankLinkingComplete,
    auth: Auth,
    session: AsyncSession = Depends(get_db_session),
) -> BankAccountInfo:
    """
    Complete bank linking after user connects their bank.

    This endpoint:
    1. Retrieves the linked bank account from Stripe
    2. Verifies the account is active
    3. Stores encrypted bank details
    4. Creates a Mercury recipient for instant payouts
    5. Returns bank info including RTP eligibility

    Call this after stripe.collectFinancialConnectionsAccounts() succeeds.
    """
    try:
        return await bank_linking_service.complete_linking(
            session,
            account_id=body.account_id,
            financial_connections_account_id=body.financial_connections_account_id,
        )
    except AccountNotFound as e:
        raise HTTPException(status_code=404, detail=str(e))
    except AccountNotActive as e:
        raise HTTPException(status_code=400, detail=str(e))
    except FinancialConnectionsAccountNotActive as e:
        raise HTTPException(status_code=400, detail=str(e))
    except MissingBankDetails as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get(
    "/status/{account_id}",
    response_model=BankLinkingStatus,
    responses={
        404: {"model": BankLinkingError},
    },
)
async def get_bank_linking_status(
    account_id: UUID,
    auth: Auth,
    session: AsyncSession = Depends(get_db_session),
) -> BankLinkingStatus:
    """
    Get bank linking status for an account.

    Returns:
    - Whether a bank is linked
    - Bank account details (masked)
    - RTP eligibility for instant payouts
    - Mercury recipient readiness
    """
    try:
        return await bank_linking_service.get_status(
            session,
            account_id=account_id,
        )
    except AccountNotFound as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.delete(
    "/{account_id}",
    status_code=204,
    responses={
        404: {"model": BankLinkingError},
    },
)
async def disconnect_bank_account(
    account_id: UUID,
    auth: Auth,
    session: AsyncSession = Depends(get_db_session),
) -> None:
    """
    Disconnect a linked bank account.

    This will:
    1. Disconnect the account from Stripe Financial Connections
    2. Remove the stored bank details

    Note: This does NOT delete Mercury recipients, as they may be
    needed for pending payouts.
    """
    try:
        await bank_linking_service.disconnect(
            session,
            account_id=account_id,
        )
    except AccountNotFound as e:
        raise HTTPException(status_code=404, detail=str(e))
