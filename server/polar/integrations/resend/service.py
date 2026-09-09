import typing
from uuid import UUID

from polar.config import settings
from polar.exceptions import PolarError
from polar.models import User
from polar.postgres import AsyncSession
from polar.user.repository import UserRepository
from polar.worker import enqueue_job

from .client import ContactDoesNotExist, InvalidIdentifier, client


class ResendServiceError(PolarError): ...


class UserDoesNotExist(ResendServiceError):
    def __init__(self, user_id: UUID) -> None:
        self.user_id = user_id
        super().__init__(f"The user with id {user_id} does not exist.", 404)


class ResendService:
    def enqueue_sync_user(
        self, user_id: UUID, *, previous_email: str | None = None
    ) -> None:
        if settings.RESEND_ACTIVE_USERS_SEGMENT_ID is None:
            return
        enqueue_job("resend.sync_user", user_id=user_id, previous_email=previous_email)

    async def sync_user(
        self,
        session: AsyncSession,
        user_id: UUID,
        *,
        previous_email: str | None = None,
    ) -> User:
        repository = UserRepository.from_session(session)
        user = await repository.get_by_id(
            user_id, include_deleted=True, for_update=True
        )
        if user is None:
            raise UserDoesNotExist(user_id)

        segment_id = settings.RESEND_ACTIVE_USERS_SEGMENT_ID
        if segment_id is None:
            return user

        if user.is_deleted:
            contact_ids: set[str] = set()
            for identifier in (user.resend_id, previous_email or user.email):
                if identifier is None:
                    continue
                try:
                    contact = await client.get_contact(identifier)
                except ContactDoesNotExist, InvalidIdentifier:
                    continue
                contact_ids.add(contact["id"])
            for contact_id in contact_ids:
                await client.delete_contact(contact_id)
            return await repository.update(user, update_dict={"resend_id": None})

        previous_contact: dict[str, typing.Any] | None = None
        previous_identifiers: list[str] = []
        if previous_email is not None:
            previous_identifiers.append(previous_email)
        if user.resend_id is not None and user.resend_id != previous_email:
            previous_identifiers.append(user.resend_id)
        for identifier in previous_identifiers:
            try:
                previous_contact = await client.get_contact(identifier)
                break
            except ContactDoesNotExist, InvalidIdentifier:
                pass

        if (
            previous_contact is not None
            and previous_contact["email"].lower() == user.email.lower()
        ):
            contact = previous_contact
        else:
            unsubscribed = (
                previous_contact["unsubscribed"] if previous_contact else False
            )
            try:
                contact = await client.get_contact(user.email)
            except ContactDoesNotExist:
                contact = await client.create_contact(
                    user.email, unsubscribed=unsubscribed
                )
            except InvalidIdentifier:
                return user
            else:
                if unsubscribed != contact["unsubscribed"]:
                    await client.update_contact(
                        contact["id"], unsubscribed=unsubscribed
                    )

        await client.add_contact_to_segment(contact["id"], segment_id)
        if previous_contact is not None and previous_contact["id"] != contact["id"]:
            await client.delete_contact(previous_contact["id"])
        return await repository.update(user, update_dict={"resend_id": contact["id"]})


resend = ResendService()
