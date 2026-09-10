from sqlalchemy import ColumnElement, Text, or_

from polar.models import Organization


def organization_ilike(term: str) -> ColumnElement[bool]:
    """Match an organization by name or slug, e.g. ``organization_ilike("%acme%")``.

    ``Organization.slug`` is ``CITEXT``, so an uncast ``ILIKE`` binds citext's
    own operator and can't use ``ix_organizations_slug_trgm`` — which also
    stops the planner from using the name index, since neither branch of the
    ``OR`` would be index-backed. Cast to ``text`` so both apply.
    """
    return or_(
        Organization.name.ilike(term),
        Organization.slug.cast(Text).ilike(term),
    )
