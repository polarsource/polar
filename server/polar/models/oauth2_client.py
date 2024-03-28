from authlib.integrations.sqla_oauth2 import OAuth2ClientMixin
from sqlalchemy import UniqueConstraint

from polar.kit.db.models import RecordModel


class OAuth2Client(RecordModel, OAuth2ClientMixin):
    __tablename__ = "oauth2_clients"
    __table_args__ = (UniqueConstraint("client_id"),)
