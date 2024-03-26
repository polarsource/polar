from polar.kit.db.postgres import create_async_sessionmaker
from polar.postgres import create_async_engine

engine = create_async_engine("backoffice")
sessionmaker = create_async_sessionmaker(engine)
