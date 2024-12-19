from sqlalchemy import delete, select

from polar.auth.models import AuthSubject, Organization, User
from polar.config import settings
from polar.customer.service import customer as customer_service
from polar.exceptions import PolarRequestValidationError
from polar.kit.crypto import generate_token_hash_pair, get_token_hash
from polar.kit.services import ResourceServiceReader
from polar.kit.utils import utc_now
from polar.models import Customer, CustomerSession
from polar.postgres import AsyncSession

from .schemas import CustomerSessionCreate

CUSTOMER_SESSION_TOKEN_PREFIX = "polar_cst_"


class CustomerSessionService(ResourceServiceReader[CustomerSession]):
    async def create(
        self,
        session: AsyncSession,
        auth_subject: AuthSubject[User | Organization],
        customer_create: CustomerSessionCreate,
    ) -> CustomerSession:
        customer = await customer_service.get_by_id(
            session, auth_subject, customer_create.customer_id
        )
        if customer is None:
            raise PolarRequestValidationError(
                [
                    {
                        "loc": ("body", "customer_id"),
                        "msg": "Customer does not exist.",
                        "type": "value_error",
                        "input": customer_create.customer_id,
                    }
                ]
            )

        token, customer_session = await self.create_customer_session(session, customer)
        customer_session.raw_token = token
        return customer_session

    async def create_customer_session(
        self, session: AsyncSession, customer: Customer
    ) -> tuple[str, CustomerSession]:
        token, token_hash = generate_token_hash_pair(
            secret=settings.SECRET, prefix=CUSTOMER_SESSION_TOKEN_PREFIX
        )
        customer_session = CustomerSession(token=token_hash, customer=customer)
        session.add(customer_session)
        await session.flush()

        return token, customer_session

    async def get_by_token(
        self, session: AsyncSession, token: str, *, expired: bool = False
    ) -> CustomerSession | None:
        token_hash = get_token_hash(token, secret=settings.SECRET)
        statement = select(CustomerSession).where(
            CustomerSession.token == token_hash,
            CustomerSession.deleted_at.is_(None),
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


customer_session = CustomerSessionService(CustomerSession)
