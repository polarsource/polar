from alembic_utils.pg_function import PGFunction
from alembic_utils.pg_trigger import PGTrigger
from alembic_utils.replaceable_entity import register_entities
from sqlalchemy import Index, String, Text
from sqlalchemy.dialects.postgresql import TSVECTOR
from sqlalchemy.orm import Mapped, mapped_column

from polar.kit.db.models import RecordModel


class SupportDocument(RecordModel):
    __tablename__ = "support_documents"

    slug: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    title: Mapped[str] = mapped_column(String, nullable=False)
    description: Mapped[str | None] = mapped_column(String, nullable=True)
    url: Mapped[str] = mapped_column(String, nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    search_vector: Mapped[str] = mapped_column(TSVECTOR, nullable=False, deferred=True)

    __table_args__ = (
        Index(
            "ix_support_documents_search_vector",
            "search_vector",
            postgresql_using="gin",
        ),
    )


support_documents_search_vector_update_function = PGFunction(
    schema="public",
    signature="support_documents_search_vector_update()",
    definition="""
    RETURNS trigger AS $$
    BEGIN
        NEW.search_vector := to_tsvector(
            'english',
            coalesce(NEW.title, '') || ' ' ||
            coalesce(NEW.description, '') || ' ' ||
            coalesce(NEW.content, '')
        );
        RETURN NEW;
    END
    $$ LANGUAGE plpgsql;
    """,
)

support_documents_search_vector_trigger = PGTrigger(
    schema="public",
    signature="support_documents_search_vector_trigger",
    on_entity="support_documents",
    definition="""
    BEFORE INSERT OR UPDATE ON support_documents
    FOR EACH ROW EXECUTE FUNCTION support_documents_search_vector_update();
    """,
)

register_entities(
    (
        support_documents_search_vector_update_function,
        support_documents_search_vector_trigger,
    )
)
