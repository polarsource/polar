import typing

from authlib.oauth2.rfc6749.errors import (
    InvalidClientError,
    InvalidGrantError,
    UnauthorizedClientError,
)
from authlib.oauth2.rfc6749.grants import BaseGrant, TokenEndpointMixin
from authlib.oauth2.rfc6749.util import extract_basic_authorization
from sqlalchemy import Select, select
from sqlalchemy.orm import contains_eager, joinedload

from polar.models import Agent, OAuth2Client, User

if typing.TYPE_CHECKING:
    from ..authorization_server import AuthorizationServer


class AgentGrant(BaseGrant, TokenEndpointMixin):
    """Base for the grants that authenticate an agent by its own credential, not
    by OAuth client credentials.

    Each agent gets its own OAuth client at sign-up, and these grants find it
    through the agent. A `client_id` sent with the request must be that client's,
    so no other OAuth app can get an agent's tokens.
    """

    server: "AuthorizationServer"

    def _get_agent_statement(self) -> Select[Agent]:
        return (
            select(Agent)
            .join(Agent.oauth2_client)
            .where(~OAuth2Client.is_deleted)
            .options(
                contains_eager(Agent.oauth2_client), joinedload(Agent.claimed_by_user)
            )
        )

    def _validate_request_client(self, client: OAuth2Client) -> None:
        basic_client_id, _ = extract_basic_authorization(self.request.headers)
        for client_id in (self.request.payload.client_id, basic_client_id):
            if client_id is not None and client_id != client.client_id:
                raise InvalidClientError()

        if not client.check_grant_type(self.GRANT_TYPE):
            raise UnauthorizedClientError(
                f"The client is not authorized to use 'grant_type={self.GRANT_TYPE}'"
            )

    def _get_claiming_user(self, agent: Agent) -> User:
        user = agent.claimed_by_user
        if user is None or not user.can_authenticate:
            raise InvalidGrantError()
        return user
