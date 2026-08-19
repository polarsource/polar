from typing import Annotated, Any, Literal

from annotated_types import Len
from pydantic import UUID4, Field, model_validator

from polar.file.schemas import DownloadableFileRead
from polar.kit.schemas import Schema
from polar.models.benefit import BenefitType

from ..base.schemas import (
    BenefitBase,
    BenefitCreateBase,
    BenefitSubscriberBase,
    BenefitUpdateBase,
)


class BenefitDownloadablesCreateProperties(Schema):
    archived: dict[UUID4, bool] = {}
    files: Annotated[list[UUID4], Len(min_length=1)]


class BenefitDownloadablesProperties(Schema):
    archived: dict[UUID4, bool]
    files: list[UUID4]


def get_active_file_ids(properties: BenefitDownloadablesProperties) -> list[UUID4]:
    active = []
    archived_files = properties.archived
    for file_id in properties.files:
        archived = archived_files.get(file_id, False)
        if not archived:
            active.append(file_id)

    return active


class BenefitDownloadableFile(DownloadableFileRead):
    downloaders: int = Field(
        description="Number of distinct customers or members who downloaded the file."
    )
    downloads: int = Field(description="Total number of downloads for the file.")


class BenefitDownloadablesSubscriberProperties(Schema):
    active_files: list[UUID4]

    @model_validator(mode="before")
    @classmethod
    def assign_active_files(cls, data: dict[str, Any]) -> dict[str, Any]:
        if "files" not in data:
            return data

        schema = BenefitDownloadablesProperties(**data)
        actives = get_active_file_ids(schema)
        return {"active_files": actives}


class BenefitDownloadablesCreate(BenefitCreateBase):
    type: Literal[BenefitType.downloadables]
    properties: BenefitDownloadablesCreateProperties


class BenefitDownloadablesUpdate(BenefitUpdateBase):
    type: Literal[BenefitType.downloadables]
    properties: BenefitDownloadablesCreateProperties | None = None


class BenefitDownloadables(BenefitBase):
    type: Literal[BenefitType.downloadables]
    properties: BenefitDownloadablesProperties


class BenefitDownloadablesSubscriber(BenefitSubscriberBase):
    type: Literal[BenefitType.downloadables]
    properties: BenefitDownloadablesSubscriberProperties
