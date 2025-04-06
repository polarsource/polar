from enum import StrEnum

from pydantic import UUID4, Field

from polar.kit.schemas import IDSchema, Schema, TimestampedSchema


class NotificationRecipientPlatform(StrEnum):
    ios = "ios"
    android = "android"


class NotificationRecipientCreate(Schema):
    platform: NotificationRecipientPlatform = Field(
        description="Platform of the notification recipient."
    )
    expo_push_token: str = Field(
        description="Expo push token for the notification recipient."
    )


class NotificationRecipientDelete(Schema):
    id: UUID4 = Field(description="ID of the notification recipient to delete.")


class NotificationRecipientSchema(IDSchema, TimestampedSchema):
    id: UUID4
    user_id: UUID4 = Field(
        description="ID of the user the notification recipient belongs to."
    )
    platform: NotificationRecipientPlatform = Field(
        description="Platform of the notification recipient."
    )
    expo_push_token: str = Field(
        description="Expo push token for the notification recipient."
    )
