"""
Mercury API Client.

Handles all HTTP interactions with Mercury's REST API.
API Reference: https://docs.mercury.com/reference/
"""

from datetime import datetime
from enum import StrEnum
from typing import Any

import httpx
import structlog

from polar.config import settings
from polar.exceptions import PolarError
from polar.logging import Logger

log: Logger = structlog.get_logger()


class MercuryAPIError(PolarError):
    """Base exception for Mercury API errors."""

    def __init__(self, message: str, status_code: int | None = None, response: dict | None = None):
        self.status_code = status_code
        self.response = response
        super().__init__(message, status_code or 500)


class MercuryRateLimitError(MercuryAPIError):
    """Rate limit exceeded."""

    pass


class MercuryValidationError(MercuryAPIError):
    """Validation error from Mercury."""

    pass


class PaymentMethod(StrEnum):
    """Mercury payment methods."""

    ACH = "ach"
    SAME_DAY_ACH = "sameDayAch"
    RTP = "rtp"
    WIRE = "wire"
    CHECK = "check"


class TransactionStatus(StrEnum):
    """Mercury transaction statuses."""

    PENDING = "pending"
    SENT = "sent"
    CANCELLED = "cancelled"
    FAILED = "failed"
    COMPLETED = "completed"


class RecipientPaymentMethod(StrEnum):
    """Mercury recipient payment methods."""

    ELECTRONIC = "electronic"
    CHECK = "check"


class MercuryClient:
    """
    Low-level client for Mercury API.

    All methods are async and handle HTTP errors consistently.
    """

    def __init__(
        self,
        api_key: str | None = None,
        account_id: str | None = None,
        base_url: str | None = None,
    ):
        self.api_key = api_key or settings.MERCURY_API_KEY
        self.account_id = account_id or settings.MERCURY_ACCOUNT_ID
        self.base_url = (base_url or settings.MERCURY_BASE_URL).rstrip("/")

        if not self.api_key:
            raise ValueError("Mercury API key is required")
        if not self.account_id:
            raise ValueError("Mercury account ID is required")

    def _get_headers(self) -> dict[str, str]:
        return {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            "Accept": "application/json",
        }

    async def _request(
        self,
        method: str,
        path: str,
        *,
        json: dict | None = None,
        params: dict | None = None,
        idempotency_key: str | None = None,
    ) -> dict[str, Any]:
        """Make an HTTP request to Mercury API."""
        url = f"{self.base_url}{path}"
        headers = self._get_headers()

        if idempotency_key:
            headers["Idempotency-Key"] = idempotency_key

        log.info(
            "mercury.api.request",
            method=method,
            path=path,
            idempotency_key=idempotency_key,
        )

        async with httpx.AsyncClient(timeout=30.0) as client:
            try:
                response = await client.request(
                    method,
                    url,
                    headers=headers,
                    json=json,
                    params=params,
                )

                # Log response
                log.info(
                    "mercury.api.response",
                    status_code=response.status_code,
                    path=path,
                )

                # Handle rate limiting
                if response.status_code == 429:
                    retry_after = response.headers.get("Retry-After", "60")
                    raise MercuryRateLimitError(
                        f"Rate limit exceeded. Retry after {retry_after} seconds.",
                        status_code=429,
                    )

                # Handle validation errors
                if response.status_code == 400:
                    error_data = response.json() if response.content else {}
                    raise MercuryValidationError(
                        error_data.get("message", "Validation error"),
                        status_code=400,
                        response=error_data,
                    )

                # Handle other errors
                if response.status_code >= 400:
                    error_data = response.json() if response.content else {}
                    raise MercuryAPIError(
                        error_data.get("message", f"Mercury API error: {response.status_code}"),
                        status_code=response.status_code,
                        response=error_data,
                    )

                return response.json() if response.content else {}

            except httpx.RequestError as e:
                log.error("mercury.api.request_error", error=str(e), path=path)
                raise MercuryAPIError(f"Network error: {str(e)}") from e

    # -------------------------------------------------------------------------
    # Recipients API
    # -------------------------------------------------------------------------

    async def create_recipient(
        self,
        *,
        name: str,
        routing_number: str,
        account_number: str,
        account_type: str = "checking",
        idempotency_key: str | None = None,
    ) -> dict[str, Any]:
        """
        Create a new recipient for ACH/RTP transfers.

        Args:
            name: Recipient's name (individual or business)
            routing_number: 9-digit ABA routing number
            account_number: Bank account number
            account_type: "checking" or "savings"
            idempotency_key: Unique key to prevent duplicate creation

        Returns:
            Mercury recipient object with id, name, status, etc.
        """
        return await self._request(
            "POST",
            "/recipients",
            json={
                "name": name,
                "paymentMethod": RecipientPaymentMethod.ELECTRONIC.value,
                "electronicRoutingInfo": {
                    "routingNumber": routing_number,
                    "accountNumber": account_number,
                    "accountType": account_type,
                },
            },
            idempotency_key=idempotency_key,
        )

    async def get_recipient(self, recipient_id: str) -> dict[str, Any]:
        """Get a recipient by ID."""
        return await self._request("GET", f"/recipients/{recipient_id}")

    async def list_recipients(
        self,
        *,
        limit: int = 100,
        offset: int = 0,
    ) -> dict[str, Any]:
        """List all recipients."""
        return await self._request(
            "GET",
            "/recipients",
            params={"limit": limit, "offset": offset},
        )

    async def delete_recipient(self, recipient_id: str) -> dict[str, Any]:
        """Delete a recipient."""
        return await self._request("DELETE", f"/recipients/{recipient_id}")

    # -------------------------------------------------------------------------
    # Transactions API
    # -------------------------------------------------------------------------

    async def create_transaction(
        self,
        *,
        recipient_id: str,
        amount: float,  # Mercury uses dollars, not cents
        payment_method: PaymentMethod = PaymentMethod.ACH,
        note: str | None = None,
        external_memo: str | None = None,
        idempotency_key: str | None = None,
    ) -> dict[str, Any]:
        """
        Create a new outbound transaction (payout).

        Args:
            recipient_id: Mercury recipient ID
            amount: Amount in dollars (e.g., 100.50 for $100.50)
            payment_method: ach, sameDayAch, rtp, wire, or check
            note: Internal note (visible to you)
            external_memo: Memo visible to recipient on bank statement
            idempotency_key: Unique key to prevent duplicate transactions

        Returns:
            Mercury transaction object
        """
        payload: dict[str, Any] = {
            "recipientId": recipient_id,
            "amount": amount,
            "paymentMethod": payment_method.value,
        }

        if note:
            payload["note"] = note
        if external_memo:
            payload["externalMemo"] = external_memo

        return await self._request(
            "POST",
            f"/account/{self.account_id}/transactions",
            json=payload,
            idempotency_key=idempotency_key,
        )

    async def get_transaction(self, transaction_id: str) -> dict[str, Any]:
        """Get a transaction by ID."""
        return await self._request(
            "GET",
            f"/account/{self.account_id}/transactions/{transaction_id}",
        )

    async def list_transactions(
        self,
        *,
        limit: int = 100,
        offset: int = 0,
        status: TransactionStatus | None = None,
        start_date: datetime | None = None,
        end_date: datetime | None = None,
    ) -> dict[str, Any]:
        """List transactions with optional filters."""
        params: dict[str, Any] = {"limit": limit, "offset": offset}

        if status:
            params["status"] = status.value
        if start_date:
            params["start"] = start_date.isoformat()
        if end_date:
            params["end"] = end_date.isoformat()

        return await self._request(
            "GET",
            f"/account/{self.account_id}/transactions",
            params=params,
        )

    # -------------------------------------------------------------------------
    # Account API
    # -------------------------------------------------------------------------

    async def get_account(self) -> dict[str, Any]:
        """Get account details including balance."""
        return await self._request("GET", f"/account/{self.account_id}")

    async def get_account_balance(self) -> dict[str, Any]:
        """Get current account balance."""
        account = await self.get_account()
        return {
            "available_balance": account.get("availableBalance", 0),
            "current_balance": account.get("currentBalance", 0),
            "currency": "USD",
        }
