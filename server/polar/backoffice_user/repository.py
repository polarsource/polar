from sqlalchemy import func, or_, select, update

from polar.exceptions import PolarError
from polar.kit.repository import RepositoryBase
from polar.models import BackofficeUser


class BackofficeUserRepository(RepositoryBase[BackofficeUser]):
    model = BackofficeUser

    async def provision(self, provider_id: str, email: str) -> BackofficeUser | None:
        email = email.strip().lower()
        by_provider = await self.get_one_or_none(
            select(BackofficeUser).where(BackofficeUser.provider_id == provider_id)
        )
        by_email = await self._get_by_email(email)
        if (
            by_provider is not None
            and by_email is not None
            and by_provider.id != by_email.id
        ):
            raise PolarError("Backoffice email is linked to a different identity", 409)

        user = by_provider or by_email
        if user is None:
            return await self.create(
                BackofficeUser(email=email, provider_id=provider_id), flush=True
            )
        if user.deleted_at is not None:
            return None

        statement = (
            update(BackofficeUser)
            .where(
                BackofficeUser.id == user.id,
                BackofficeUser.deleted_at.is_(None),
                or_(
                    BackofficeUser.provider_id.is_(None),
                    BackofficeUser.provider_id == provider_id,
                ),
            )
            .values(email=email, provider_id=provider_id)
            .returning(BackofficeUser)
        )
        linked_user = (await self.session.scalars(statement)).one_or_none()
        if linked_user is None:
            raise PolarError("Backoffice email is linked to a different identity", 409)
        return linked_user

    async def _get_by_email(self, email: str) -> BackofficeUser | None:
        return await self.get_one_or_none(
            select(BackofficeUser).where(
                func.lower(func.btrim(BackofficeUser.email)) == email
            )
        )
