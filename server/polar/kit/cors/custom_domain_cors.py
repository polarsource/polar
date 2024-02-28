from polar.kit.db.postgres import create_sessionmaker
from polar.organization.service import organization as organization_service
from polar.postgres import create_engine

engine = create_engine("app")
sessionmaker = create_sessionmaker(engine)


async def is_allowed_custom_domain(origin: str) -> bool:
    hostname = origin
    if hostname.startswith("https://"):
        hostname = hostname[len("https://") :]
    if hostname.startswith("http://"):
        hostname = hostname[len("http://") :]

    async with sessionmaker() as session:
        org = await organization_service.get_by_custom_domain(session, hostname)
        if org:
            return True

    return False
