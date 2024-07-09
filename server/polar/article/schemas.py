import base64
import datetime
import re
from typing import Annotated, Self

from fastapi import Path
from pydantic import UUID4, Field, FutureDatetime, HttpUrl, model_validator

from polar.kit.schemas import EmailStrDNS, Schema, SelectorWidget
from polar.models import Article as ArticleModel
from polar.models.article import ArticleByline, ArticleVisibility
from polar.organization.schemas import Organization, OrganizationID

paywall_regex = r"<Paywall>((.|\n)*?)<\/Paywall>"

ArticleID = Annotated[
    UUID4,
    Path(description="The article ID."),
    SelectorWidget("/v1/articles", "Article", "title"),
]


class BylineProfile(Schema):
    name: str
    avatar_url: str | None = None


class Article(Schema):
    id: UUID4
    slug: str
    title: str
    body: str
    byline: BylineProfile
    visibility: ArticleVisibility

    user_id: UUID4 | None = None
    organization_id: UUID4

    organization: Organization

    published_at: datetime.datetime | None = None
    paid_subscribers_only: bool | None = None
    paid_subscribers_only_ends_at: datetime.datetime | None = None
    is_preview: bool
    is_pinned: bool

    notify_subscribers: bool | None = None
    notifications_sent_at: datetime.datetime | None = None
    email_sent_to_count: int | None = None

    og_image_url: str | None = None
    og_description: str | None = None

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
            return cls.abbreviated_content(body)

        return body

    @classmethod
    def abbreviated_content(cls, body: str) -> str:
        # sync with abbreviatedContent in BrowserRender.tsx

        res: list[str] = []
        len_sum = 0

        # If the post has a <hr> within 1000 characters, use that as the limit.
        manual_boundary = -1
        idx = [
            d
            for d in [
                body.find("---"),
                body.find("<hr>"),
                body.find("<hr/>"),
                body.find("<hr />"),
            ]
            if d >= 0
        ]
        if idx:
            manual_boundary = min(idx)

        if manual_boundary >= 0 and manual_boundary < 1000:
            return body[0:manual_boundary].rstrip()

        parts = body[0:1000].replace("\r\n", "\n").split("\n\n")

        for p in parts:
            if len(p) + len_sum > 500 and len_sum > 0:
                break

            len_sum += len(p)
            res.append(p)

        return "\n\n".join(res).rstrip()

    @classmethod
    def from_db(
        cls, i: ArticleModel, include_admin_fields: bool, is_paid_subscriber: bool
    ) -> Self:
        if i.byline == ArticleByline.user and i.user:
            byline = BylineProfile(
                name=i.user.public_name,
                avatar_url=i.user.avatar_url,
            )
        else:
            byline = BylineProfile(
                name=i.organization.name,
                avatar_url=i.organization.avatar_url,
            )

        return cls(
            id=i.id,
            slug=i.slug,
            title=i.title,
            body=cls.cut_premium_content(
                i.body, i.paid_subscribers_only, is_paid_subscriber
            ),
            byline=byline,
            visibility=i.visibility,
            user_id=i.user_id,
            organization_id=i.organization_id,
            organization=Organization.from_db(i.organization),
            published_at=i.published_at,
            paid_subscribers_only=i.paid_subscribers_only,
            paid_subscribers_only_ends_at=i.paid_subscribers_only_ends_at,
            is_preview=i.paid_subscribers_only and not is_paid_subscriber,
            notify_subscribers=i.notify_subscribers if include_admin_fields else None,
            notifications_sent_at=i.notifications_sent_at
            if include_admin_fields
            else None,
            email_sent_to_count=i.email_sent_to_count if include_admin_fields else None,
            is_pinned=i.is_pinned,
            og_image_url=i.og_image_url,
            og_description=i.og_description,
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

    body: str | None = Field(
        None,
        description="Body in string format. Either one of body or body_base64 is required.",
    )
    body_base64: str | None = Field(
        None,
        description="Body in base64-encoded format. Can be helpful to bypass Web Application Firewalls (WAF). Either one of body or body_base64 is required.",
    )

    organization_id: OrganizationID | None = Field(
        default=None,
        description=(
            "The ID of the organization owning the article. "
            "**Required unless you use an organization token.**"
        ),
    )

    byline: ArticleByline = Field(
        default=ArticleByline.organization,
        description="If the user or organization should be credited in the byline.",
    )
    visibility: ArticleVisibility = Field(default=ArticleVisibility.private)
    paid_subscribers_only: bool = Field(
        default=False,
        description="Set to true to only make this article available for subscribers to a paid subscription tier in the organization.",
    )
    paid_subscribers_only_ends_at: FutureDatetime | None = Field(
        default=None,
        description=(
            "If specified, time at which the article should "
            "no longer be restricted to paid subscribers. "
            "Only relevant if `paid_subscribers_only` is true."
        ),
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
    og_image_url: HttpUrl | None = Field(
        default=None, description="Custom og:image URL value"
    )
    og_description: str | None = Field(
        default=None, description="Custom og:description value"
    )

    @model_validator(mode="after")
    def check_either_body_or_body_base64(self) -> Self:
        if self.body is not None and self.body_base64 is not None:
            raise ValueError(
                "Only one of body or body_base64 can be provided, not both."
            )
        if self.body is None and self.body_base64 is None:
            raise ValueError("Either body or body_base64 must be provided.")
        return self

    def get_body(self) -> str:
        if self.body is not None:
            return self.body
        assert self.body_base64 is not None
        return base64.b64decode(self.body_base64).decode("utf-8")


class ArticleUpdate(Schema):
    title: str | None = None

    body: str | None = Field(
        None,
        description="Body in string format. body and body_base64 are mutually exclusive.",
    )
    body_base64: str | None = Field(
        None,
        description="Body in base64-encoded format. Can be helpful to bypass Web Application Firewalls (WAF). body and body_base64 are mutually exclusive.",
    )

    slug: str | None = None
    byline: ArticleByline | None = Field(
        default=None,
        description="If the user or organization should be credited in the byline.",
    )
    visibility: ArticleVisibility | None = Field(default=None)
    paid_subscribers_only: bool | None = Field(
        default=None,
        description="Set to true to only make this article available for subscribers to a paid subscription tier in the organization.",
    )
    paid_subscribers_only_ends_at: FutureDatetime | None = Field(
        default=None,
        description=(
            "If specified, time at which the article should "
            "no longer be restricted to paid subscribers. "
            "Only relevant if `paid_subscribers_only` is true."
        ),
    )
    published_at: datetime.datetime | None = Field(
        default=None,
        description="Time of publishing. If this date is in the future, the post will be scheduled to publish at this time.",
    )
    notify_subscribers: bool | None = Field(
        default=None,
        description="Set to true to deliver this article via email and/or notifications to subscribers.",
    )
    is_pinned: bool | None = Field(
        default=None, description="If the article should be pinned"
    )
    og_image_url: HttpUrl | None = Field(
        default=None, description="Custom og:image URL value"
    )
    og_description: str | None = Field(
        default=None, description="Custom og:description value"
    )

    @model_validator(mode="after")
    def check_either_body_or_body_base64(self) -> Self:
        if self.body is not None and self.body_base64 is not None:
            raise ValueError(
                "Only one of body or body_base64 can be provided, not both."
            )
        return self

    def get_body(self) -> str | None:
        if self.body is not None:
            return self.body
        if self.body_base64 is not None:
            return base64.b64decode(self.body_base64).decode("utf-8")
        return None


class ArticlePreview(Schema):
    email: EmailStrDNS = Field(
        description="Email address to send the preview to. The user must be registered on Polar."
    )


class ArticleReceivers(Schema):
    free_subscribers: int
    premium_subscribers: int
    organization_members: int
