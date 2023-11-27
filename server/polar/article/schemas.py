import datetime
from typing import Literal, Self
from uuid import UUID

from pydantic import Field

from polar.kit.schemas import Schema
from polar.models.article import Article as ArticleModel
from polar.organization.schemas import Organization


class Byline(Schema):
    name: str
    avatar_url: str | None


Visibility = Literal["private", "hidden", "public"]


class Article(Schema):
    id: UUID
    slug: str
    title: str
    body: str
    byline: Byline
    visibility: Visibility
    organization: Organization
    published_at: datetime.datetime | None

    notify_subscribers: bool | None
    email_open_count: int | None
    web_view_count: int | None

    @classmethod
    def from_db(cls, i: ArticleModel, include_admin_fields: bool) -> Self:
        byline: Byline | None = None

        if i.byline == i.Byline.organization:
            byline = Byline(
                name=i.organization.name,
                avatar_url=i.organization.avatar_url,
            )
        if i.byline == i.Byline.user:
            byline = Byline(
                name=i.created_by_user.username,
                avatar_url=i.created_by_user.avatar_url,
            )

        if not byline:
            raise ValueError("article has no byline")

        visibility: Visibility = "private"
        match i.visibility:
            case "private":
                visibility = "private"
            case "hidden":
                visibility = "hidden"
            case "public":
                visibility = "public"

        return cls(
            id=i.id,
            slug=i.slug,
            title=i.title,
            body=i.body,
            byline=byline,
            visibility=visibility,
            organization=Organization.from_db(i.organization),
            published_at=i.published_at,
            notify_subscribers=i.notify_subscribers if include_admin_fields else None,
            email_open_count=i.email_open_count if include_admin_fields else None,
            web_view_count=i.web_view_count if include_admin_fields else None,
        )


class ArticleCreate(Schema):
    title: str = Field(
        description="Title of the article. A slug will be created automatically from the title.",
        min_length=1,
    )
    body: str
    organization_id: UUID
    byline: Literal["user", "organization"] = Field(
        default="organization",
        description="If the user or organization should be credited in the byline.",
    )
    visibility: Visibility = Field(default="private")
    paid_subscribers_only: bool = Field(
        default=False,
        description="Set to true to only make this article available for subscribers to a paid subscription tier in the organization.",
    )
    published_at: datetime.datetime | None = Field(
        default=None,
        description="Time of publishing. If this date is in the future, the post will be scheduled to publish at this time. If visibility is 'public', published_at will default to the current time.",
    )
    notify_subscribers: bool | None = Field(
        default=None,
        description="Set to true to deliver this article via email and/or notifications to subscribers.",
    )


class ArticleUpdate(Schema):
    title: str | None = None
    body: str | None = None
    byline: Literal["user", "organization"] | None = Field(
        default=None,
        description="If the user or organization should be credited in the byline.",
    )
    visibility: Visibility | None = Field(default=None)
    paid_subscribers_only: bool | None = Field(
        default=None,
        description="Set to true to only make this article available for subscribers to a paid subscription tier in the organization.",
    )
    published_at: datetime.datetime | None = Field(
        default=None,
        description="Time of publishing. If this date is in the future, the post will be scheduled to publish at this time.",
    )
    set_published_at: bool | None = Field(
        default=None,
        description="Set to true for changes to published_at to take affect.",
    )
    notify_subscribers: bool | None = Field(
        default=None,
        description="Set to true to deliver this article via email and/or notifications to subscribers.",
    )


class ArticleViewedResponse(Schema):
    ok: bool
