import enum
from uuid import UUID

from sqlalchemy import ForeignKey, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, declared_attr, mapped_column, relationship

from polar.kit.db.models import TimestampedModel
from polar.kit.extensions.sqlalchemy import PostgresUUID
from polar.kit.extensions.sqlalchemy.types import StringEnum
from polar.kit.schemas import Schema
from polar.models.pull_request import PullRequest
from polar.types import JSONAny


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

    user_login: str
    user_avatar: str

    commit_id: str
    branch_name: str | None = None
    message: str | None = None


class ReferenceType(str, enum.Enum):
    # external_id is a pull_requests.id UUID
    PULL_REQUEST = "pull_request"

    # external_id is a HREF
    EXTERNAL_GITHUB_PULL_REQUEST = "external_github_pull_request"

    # external_id is a SHA1
    EXTERNAL_GITHUB_COMMIT = "external_github_commit"


class IssueReference(TimestampedModel):
    __tablename__ = "issue_references"

    issue_id: Mapped[UUID] = mapped_column(
        PostgresUUID,
        ForeignKey("issues.id"),
        nullable=False,
        primary_key=True,
        index=True,
    )

    reference_type: Mapped[str] = mapped_column(
        StringEnum(ReferenceType),
        primary_key=True,
    )

    external_id: Mapped[str] = mapped_column(
        String,
        nullable=False,
        primary_key=True,
    )

    # Either pull_request_id or external_source will be set
    pull_request_id: Mapped[UUID | None] = mapped_column(
        PostgresUUID,
        ForeignKey("pull_requests.id"),
        nullable=True,
        default=None,
    )

    @declared_attr
    def pull_request(cls) -> Mapped[PullRequest | None]:
        return relationship(
            PullRequest,
            lazy="raise",
        )

    # If referenced by an external resource
    external_source: Mapped[JSONAny] = mapped_column(JSONB, nullable=True, default=None)
