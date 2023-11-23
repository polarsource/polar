from typing import Self
from uuid import UUID

from polar.kit.schemas import Schema
from polar.models.article import Article as ArticleModel


class Byline(Schema):
    name: str
    avatar_url: str


class Article(Schema):
    id: UUID
    slug: str
    title: str
    body: str
    byline: Byline

    @classmethod
    def from_db(cls, i: ArticleModel) -> Self:
        byline: Byline | None = None

        if i.byline == i.Byline.organization:
            byline = Byline(name="ORG", avatar_url="http://polar.sh")
        if i.byline == i.Byline.user:
            byline = Byline(name="USER", avatar_url="http://polar.sh")

        if not byline:
            raise ValueError("article has no byline")

        return cls(
            id=i.id,
            slug=i.slug,
            title=i.title,
            body=i.body,
            byline=byline,
        )


class ArticleCreate(Schema):
    title: str
    body: str
    organization_id: UUID
