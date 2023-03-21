from uuid import UUID

from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from polar.kit.db.models import TimestampedModel
from polar.kit.extensions.sqlalchemy import PostgresUUID
from polar.kit.schemas import Schema
from sqlalchemy.dialects.postgresql import JSONB


class ExternalGitHubPullRequestReference(Schema):
    organization_name: str
    repository_name: str

    title: str
    number: int

    user_login: str
    user_avatar: str

    state: str  # "open" | "closed"?
    is_merged: bool
    is_draft: bool


class ExternalGitHubCommitReference(Schema):
    organization_name: str
    repository_name: str
    commit_id: str


class IssueReference(TimestampedModel):
    __tablename__ = "issue_references"

    id: Mapped[UUID] = mapped_column(
        PostgresUUID,
        nullable=False,
        primary_key=True,
    )

    issue_id: Mapped[UUID] = mapped_column(
        PostgresUUID,
        ForeignKey("issues.id"),
        nullable=False,
    )

    # Either pull_request_id or external_source will be set
    pull_request_id: Mapped[UUID] = mapped_column(
        PostgresUUID,
        ForeignKey("pull_requests.id"),
        nullable=True,
    )

    reference_type: Mapped[str] = mapped_column(String)

    # If referenced by an external resource
    external_source: Mapped[
        ExternalGitHubPullRequestReference | ExternalGitHubCommitReference | None
    ] = mapped_column(JSONB, nullable=True, default=dict)

    # Unstructured event data
    # external_event_source: Mapped[JSONDict | None] = mapped_column(
    #    JSONB, nullable=True, default=dict
    # )
