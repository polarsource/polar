from polar.kit.db.postgres import Session
from polar.models import Agent
from polar.oauth2.authorization_server import AuthorizationServer
from polar.oauth2.sub_type import SubType


class TestBearerTokenGenerator:
    def test_agent_access_token_prefix(
        self, sync_session: Session, agent: Agent
    ) -> None:
        token_generator = AuthorizationServer.build(
            sync_session
        ).create_bearer_token_generator()

        token = token_generator.generate(
            grant_type="urn:ietf:params:oauth:grant-type:jwt-bearer",
            client=agent.oauth2_client,
            user=(SubType.agent, agent),
            scope="products:write",
            include_refresh_token=False,
        )

        assert token["access_token"].startswith("polar_at_a_")
