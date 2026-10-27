from collections.abc import Callable
from pathlib import Path
from string import Template

from polar.oauth2.constants import SERVICE_DOCUMENTATION

_TEMPLATE = Template((Path(__file__).parent / "auth.md").read_text())


def render_auth_md(url_for: Callable[[str], str]) -> str:
    return _TEMPLATE.substitute(
        protected_resource_metadata=url_for("well_known.oauth_protected_resource"),
        authorization_server_metadata=url_for("well_known.oauth_authorization_server"),
        identity_endpoint=url_for("agent:create_identity"),
        claim_endpoint=url_for("agent:start_claim"),
        token_endpoint=url_for("oauth2:request_token"),
        revocation_endpoint=url_for("oauth2:revoke_token"),
        api_documentation=SERVICE_DOCUMENTATION,
    )
