"""One-time setup for the Plain triage Managed Agent.

Creates the environment, agent, and vault, then prints the IDs you need
to put in env vars. Run once per workspace; do NOT run on every deploy.

The Plain MCP credential is OAuth-based (mcp.plain.com follows the
MCP spec OAuth flow). The simplest path to a working credential:

  1. Log in to Plain as the Machine User you want the agent to act as.
     Recommended: a dedicated Machine User with scopes
        - customer:read, customer:read:email
        - thread:read, thread:search
        - note:create, note:read
        - label:create
     and explicitly NOT thread:reply or thread:edit. This gives
     server-enforced safety in addition to the client-side allowlist.

  2. Run Plain's OAuth flow manually (or via `npx mcp-remote
     https://mcp.plain.com/mcp` once to capture the tokens) to get
     access_token + refresh_token.

  3. Pass those tokens to this script via env vars:
        PLAIN_MCP_ACCESS_TOKEN
        PLAIN_MCP_REFRESH_TOKEN
        PLAIN_MCP_TOKEN_EXPIRES_AT  (ISO 8601)
        PLAIN_MCP_CLIENT_ID         (from the OAuth registration)
        PLAIN_MCP_TOKEN_ENDPOINT    (defaults to Plain's token endpoint)

If Plain's MCP server changes its auth shape, update the
`credential_payload` below — see managed-agents-tools.md → Vaults.
"""

from __future__ import annotations

import asyncio
import os

from anthropic import AsyncAnthropic

PLAIN_MCP_URL = "https://mcp.plain.com/mcp"
DEFAULT_TOKEN_ENDPOINT = "https://mcp.plain.com/oauth/token"


async def main() -> None:
    client = AsyncAnthropic()

    # 1. Environment.
    environment = await client.beta.environments.create(
        name="polar-plain-triage",
        description="Cloud sandbox for Polar's Plain support triage agent.",
        config={
            "type": "cloud",
            "networking": {
                "type": "limited",
                "allow_mcp_servers": True,
                "allow_package_managers": False,
                "allowed_hosts": ["mcp.plain.com"],
            },
        },
    )
    print(f"POLAR_MANAGED_ENV_ID={environment.id}")

    # 2. Agent. Body matches agent.yaml; keep them in sync.
    with open(
        os.path.join(os.path.dirname(__file__), "agent.yaml"),
        encoding="utf-8",
    ) as f:
        agent_yaml = f.read()
    # We don't depend on PyYAML here — prefer applying via `ant
    # beta:agents create < agent.yaml`. This script provides a
    # programmatic fallback by reading the YAML through PyYAML if
    # available.
    try:
        import yaml  # type: ignore[import-not-found]

        agent_config = yaml.safe_load(agent_yaml)
    except ImportError as exc:
        raise SystemExit(
            "PyYAML is required to apply agent.yaml programmatically. "
            "Either `uv add pyyaml --dev` or apply via "
            "`ant beta:agents create < agent.yaml`."
        ) from exc

    agent = await client.beta.agents.create(**agent_config)
    print(f"POLAR_MANAGED_AGENT_ID={agent.id}")
    print(f"POLAR_MANAGED_AGENT_VERSION={agent.version}")

    # 3. Vault + Plain MCP credential.
    vault = await client.beta.vaults.create(
        display_name="polar-plain-triage",
    )

    access_token = os.environ.get("PLAIN_MCP_ACCESS_TOKEN")
    if not access_token:
        print(
            f"POLAR_MANAGED_VAULT_ID={vault.id}\n"
            f"# Vault created but no Plain credential added. Set "
            f"PLAIN_MCP_ACCESS_TOKEN / PLAIN_MCP_REFRESH_TOKEN / "
            f"PLAIN_MCP_TOKEN_EXPIRES_AT / PLAIN_MCP_CLIENT_ID and re-run, "
            f"or add the credential via the Console."
        )
        return

    credential_payload: dict = {
        "display_name": "Plain MCP (polar-plain-triage)",
        "auth": {
            "type": "mcp_oauth",
            "mcp_server_url": PLAIN_MCP_URL,
            "access_token": access_token,
            "expires_at": os.environ["PLAIN_MCP_TOKEN_EXPIRES_AT"],
            "refresh": {
                "refresh_token": os.environ["PLAIN_MCP_REFRESH_TOKEN"],
                "client_id": os.environ["PLAIN_MCP_CLIENT_ID"],
                "token_endpoint": os.environ.get(
                    "PLAIN_MCP_TOKEN_ENDPOINT", DEFAULT_TOKEN_ENDPOINT
                ),
                "token_endpoint_auth": {"type": "none"},
            },
        },
    }
    credential = await client.beta.vaults.credentials.create(
        vault.id, **credential_payload
    )
    print(f"POLAR_MANAGED_VAULT_ID={vault.id}")
    print(f"# credential added: {credential.id}")


if __name__ == "__main__":
    asyncio.run(main())
