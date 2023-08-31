from uuid import UUID

from sqlalchemy import Boolean, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column

from polar.kit.db.models import TimestampedModel
from polar.kit.extensions.sqlalchemy import PostgresUUID


class UserOrganizationSettings(TimestampedModel):
    __tablename__ = "user_organization_settings"

    user_id: Mapped[UUID] = mapped_column(
        PostgresUUID,
        ForeignKey("users.id"),
        nullable=False,
        primary_key=True,
    )

    organization_id: Mapped[UUID] = mapped_column(
        PostgresUUID,
        ForeignKey("organizations.id", ondelete="CASCADE"),
        nullable=False,
        primary_key=True,
    )

    email_notification_maintainer_issue_receives_backing: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True
    )

    email_notification_maintainer_issue_branch_created: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False
    )

    email_notification_maintainer_pull_request_created: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False
    )

    email_notification_maintainer_pull_request_merged: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False
    )

    email_notification_backed_issue_branch_created: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True
    )

    email_notification_backed_issue_pull_request_created: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True
    )

    email_notification_backed_issue_pull_request_merged: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=True
    )
