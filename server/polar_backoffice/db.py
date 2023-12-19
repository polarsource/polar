from polar.kit.db.postgres import create_sessionmaker
from polar.postgres import create_engine

engine = create_engine("backoffice")
sessionmaker = create_sessionmaker(engine)
