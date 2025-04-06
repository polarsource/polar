from enum import StrEnum

from pydantic import UUID4, Field

from polar.kit.schemas import IDSchema, Schema, TimestampedSchema


class DevicePlatform(StrEnum):
    ios = "ios"
    android = "android"


class DeviceCreate(Schema):
    platform: DevicePlatform = Field(description="Platform of the device.")
    expo_push_token: str = Field(description="Expo push token for the device.")


class DeviceDelete(Schema):
    id: UUID4 = Field(description="ID of the device to delete.")


class DeviceSchema(IDSchema, TimestampedSchema):
    id: UUID4
    user_id: UUID4 = Field(description="ID of the user the device belongs to.")
    platform: DevicePlatform = Field(description="Platform of the device.")
    expo_push_token: str = Field(description="Expo push token for the device.")
