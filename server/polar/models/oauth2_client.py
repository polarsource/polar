from authlib.integrations.sqla_oauth2 import OAuth2ClientMixin

from polar.kit.db.models import RecordModel


class OAuth2Client(RecordModel, OAuth2ClientMixin):
    __tablename__ = "oauth2_clients"
