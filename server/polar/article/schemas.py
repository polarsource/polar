import datetime
import re
from typing import Literal, Self
from uuid import UUID

from pydantic import Field

from polar.kit.schemas import Schema
from polar.models.article import Article as ArticleModel
from polar.organization.schemas import Organization

paywall_regex = r"<Paywall>((.|\n)*?)<\/Paywall>"


class Byline(Schema):
    name: str
    avatar_url: str | None = None


Visibility = Literal["private", "hidden", "public"]


class Article(Schema):
    id: UUID
    slug: str
    title: str
    body: str
    byline: Byline
    visibility: Visibility
    organization: Organization

    published_at: datetime.datetime | None = None
    paid_subscribers_only: bool | None = None
    is_preview: bool
    is_pinned: bool

    notify_subscribers: bool | None = None
    notifications_sent_at: datetime.datetime | None = None
    email_sent_to_count: int | None = None
    web_view_count: int | None = None

    @classmethod
    def cut_premium_content(
        cls, body: str, paid_subscribers_only: bool, is_paid_subscriber: bool
    ) -> str:
        """
        Modifies the body for non-premium subscribers:

        * Removes paywalled content between <paywall></paywall> tags
        * Cuts the content at an arbitrary limit, so free subscribers only have a preview.

        For paying subscribers, no changes to the body are made.

        If the user is not paying, empty <Paywall></Paywall> tags are left in it's place.
        """
        if is_paid_subscriber:
            return body

        body = re.sub(paywall_regex, "<Paywall></Paywall>", body, 0, re.MULTILINE)

        if paid_subscribers_only:
            # Keep up to 4 lines, but no more than 500 characters
            return "\n".join(body[:500].splitlines()[:4])

        return body

    @classmethod
    def from_db(
        cls, i: ArticleModel, include_admin_fields: bool, is_paid_subscriber: bool
    ) -> Self:
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
            body=cls.cut_premium_content(
                i.body, i.paid_subscribers_only, is_paid_subscriber
            ),
            byline=byline,
            visibility=visibility,
            organization=Organization.from_db(i.organization),
            published_at=i.published_at,
            paid_subscribers_only=i.paid_subscribers_only,
            is_preview=i.paid_subscribers_only and not is_paid_subscriber,
            notify_subscribers=i.notify_subscribers if include_admin_fields else None,
            notifications_sent_at=i.notifications_sent_at
            if include_admin_fields
            else None,
            email_sent_to_count=i.email_sent_to_count if include_admin_fields else None,
            web_view_count=i.web_view_count if include_admin_fields else None,
            is_pinned=i.is_pinned,
        )


class ArticleCreate(Schema):
    title: str = Field(
        description="Title of the article.",
        min_length=1,
    )
    slug: str | None = Field(
        None,
        description="Slug of the article to be used in URLs. If no slug is provided one will be generated from the title.",
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
    is_pinned: bool | None = Field(
        default=None, description="If the article should be pinned"
    )


class ArticleUpdate(Schema):
    title: str | None = None
    body: str | None = None
    slug: str | None = None
    byline: Literal["user", "organization"] | None = Field(
        default=None,
        description="If the user or organization should be credited in the byline.",
        min_length=1,
        max_length=64,
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
    is_pinned: bool | None = Field(
        default=None, description="If the article should be pinned"
    )


class ArticleViewedResponse(Schema):
    ok: bool


class ArticlePreviewResponse(Schema):
    ok: bool


class ArticlePreview(Schema):
    email: str = Field(
        description="Send a preview of the article to this email address"
    )


class ArticleReceiversResponse(Schema):
    free_subscribers: int
    premium_subscribers: int
    organization_members: int


class ArticleSentResponse(Schema):
    ok: bool


class ArticleDeleteResponse(Schema):
    ok: bool


class ArticleUnsubscribeResponse(Schema):
    ok: bool
