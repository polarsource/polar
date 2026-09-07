from uuid import UUID

from polar.config import settings
from polar.exceptions import PolarError
from polar.models import User
from polar.postgres import AsyncSession
from polar.user.repository import UserRepository
from polar.worker import enqueue_job

from .client import client


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

        contact_identifier = (
            (user.resend_id or previous_email or user.email)
            if user.is_deleted
            else (previous_email or user.resend_id or user.email)
        )
        contact = await client.get_contact(contact_identifier)
        if user.is_deleted:
            if contact is not None:
                await client.delete_contact(contact["id"])
            return await repository.update(user, update_dict={"resend_id": None})

        previous_contact = contact
        if contact is None or contact["email"].lower() != user.email.lower():
            if contact_identifier.lower() != user.email.lower():
                contact = await client.get_contact(user.email)
            if contact is None:
                contact = await client.create_contact(
                    user.email,
                    unsubscribed=bool(
                        previous_contact and previous_contact["unsubscribed"]
                    ),
                )

        if (
            previous_contact is not None
            and previous_contact.get("unsubscribed")
            and contact.get("unsubscribed") is False
        ):
            await client.update_contact(contact["id"], unsubscribed=True)

        await client.add_contact_to_segment(contact["id"], segment_id)
        # Resend contact emails are immutable; replace the contact on email changes.
        if previous_contact is not None and previous_contact["id"] != contact["id"]:
            await client.delete_contact(previous_contact["id"])
        return await repository.update(user, update_dict={"resend_id": contact["id"]})


resend = ResendService()
