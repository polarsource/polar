from uuid import UUID

from pydantic import HttpUrl

from polar.issue.schemas import Author
from polar.kit.schemas import Schema


class Byline(Schema):
    name: str
    avatar_url: HttpUrl


class Article(Schema):
    id: UUID
    slug: str
    title: str
    body: str
    byline: Author
