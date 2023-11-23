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

    @classmethod
    def from_db(cls, i: ArticleModel) -> Self:
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
        )


class ArticleCreate(Schema):
    title: str
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
