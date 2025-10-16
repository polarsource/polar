import uuid

import structlog
from pydantic import HttpUrl
from sqlalchemy import delete, select
from sqlalchemy.orm import joinedload
from sqlalchemy.orm.strategy_options import contains_eager

from polar.auth.models import AuthSubject, Organization, User
from polar.config import settings
from polar.customer.repository import CustomerRepository
from polar.enums import TokenType
from polar.exceptions import PolarRequestValidationError
from polar.kit.crypto import generate_token_hash_pair, get_token_hash
from polar.kit.services import ResourceServiceReader
from polar.kit.utils import utc_now
from polar.logging import Logger
from polar.models import Customer, CustomerSession
from polar.postgres import AsyncSession

from .schemas import CustomerSessionCreate, CustomerSessionCustomerIDCreate

log: Logger = structlog.get_logger()

CUSTOMER_SESSION_TOKEN_PREFIX = "polar_cst_"


class CustomerSessionService(ResourceServiceReader[CustomerSession]):
    async def create(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
        customer_create: CustomerSessionCreate,
    ) -> CustomerSession:
        repository = CustomerRepository.from_session(session)
        statement = repository.get_readable_statement(auth_subject).options(
            joinedload(Customer.organization),
        )

        id_field: str
        id_value: uuid.UUID | str
        if isinstance(customer_create, CustomerSessionCustomerIDCreate):
            statement = statement.where(Customer.id == customer_create.customer_id)
            id_field = "customer_id"
            id_value = customer_create.customer_id
        else:
            statement = statement.where(
                Customer.external_id == customer_create.external_customer_id
            )
            id_field = "external_customer_id"
            id_value = customer_create.external_customer_id

        customer = await repository.get_one_or_none(statement)

        if customer is None:
            raise PolarRequestValidationError(
                [
                    {
                        "loc": ("body", id_field),
                        "msg": "Customer does not exist.",
                        "type": "value_error",
                        "input": id_value,
                    }
                ]
            )

        token, customer_session = await self.create_customer_session(
            session, customer, customer_create.return_url
        )
        customer_session.raw_token = token
        return customer_session

    async def create_customer_session(
        self,
        session: AsyncSession,
        customer: Customer,
        return_url: HttpUrl | None = None,
    ) -> tuple[str, CustomerSession]:
        token, token_hash = generate_token_hash_pair(
            secret=settings.SECRET, prefix=CUSTOMER_SESSION_TOKEN_PREFIX
        )
        customer_session = CustomerSession(
            token=token_hash,
            customer=customer,
            return_url=str(return_url) if return_url else None,
        )
        session.add(customer_session)
        await session.flush()

        return token, customer_session

    async def get_by_token(
        self, session: AsyncSession, token: str, *, expired: bool = False
    ) -> CustomerSession | None:
        token_hash = get_token_hash(token, secret=settings.SECRET)
        statement = (
            select(CustomerSession)
            .join(CustomerSession.customer)
            .where(
                CustomerSession.token == token_hash,
                CustomerSession.deleted_at.is_(None),
                Customer.can_authenticate.is_(True),
            )
            .options(contains_eager(CustomerSession.customer))
        )
        if not expired:
            statement = statement.where(CustomerSession.expires_at > utc_now())

        result = await session.execute(statement)
        return result.unique().scalar_one_or_none()

    async def delete_expired(self, session: AsyncSession) -> None:
        statement = delete(CustomerSession).where(
            CustomerSession.expires_at < utc_now()
        )
        await session.execute(statement)

    async def revoke_leaked(
        self,
        session: AsyncSession,
        token: str,
        token_type: TokenType,
        *,
        notifier: str,
        url: str | None,
    ) -> bool:
        customer_session = await self.get_by_token(session, token)

        if customer_session is None:
            return False

        await session.delete(customer_session)

        log.info(
            "Revoke leaked customer session token",
            id=customer_session.id,
            notifier=notifier,
            url=url,
        )

        return True


customer_session = CustomerSessionService(CustomerSession)
