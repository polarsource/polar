#!/usr/bin/env python3
"""Sync the Polar OpenAPI source and MCP toolset config to Gram.

Driven by sdk/gram/polar-mcp.yaml. Two stages:

  1. Source  — push the generated OpenAPI document to the Gram source
               (`gram stage openapi` + `gram push --method merge`), once.
  2. Toolsets — for each target MCP (resolved by mcp_slug), set the exposed
               tool set (toolsets.update) and the per-tool name/description
               overrides (variations.upsertGlobal), applying the same manifest
               to every target.

Safe by default: prints the planned changes and does nothing. Pass --apply to
mutate Gram. After changing the tool set it re-reads the toolset and fails if
any requested tool did not resolve (e.g. a rename), rather than silently
shipping a smaller MCP.

Env:
  <api_key_env>   (required) Gram API key, scoped "Provider". The manifest's
                  `api_key_env` names which variable to read (default GRAM_API_KEY).
  GRAM_API_URL    Base URL (default https://app.getgram.ai).

Usage:
  ./sdk/gram/sync.py --apply
  ./sdk/gram/sync.py --only tools --target polar-sandbox     # dry-run one MCP
  ./sdk/gram/sync.py --only source --spec docs/openapi/2026-04.openapi.json
"""

from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
import tempfile
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

import yaml

HERE = Path(__file__).resolve().parent
REPO_ROOT = HERE.parents[1]
DEFAULT_MANIFEST = HERE / "polar-mcp.yaml"
DEFAULT_BASE_URL = "https://app.getgram.ai"


def log(msg: str = "") -> None:
    print(msg, file=sys.stderr)


def die(msg: str) -> "None":
    log(f"error: {msg}")
    raise SystemExit(1)


# --------------------------------------------------------------------------- #
# Manifest + spec resolution
# --------------------------------------------------------------------------- #
def load_manifest(path: Path) -> dict:
    manifest = yaml.safe_load(path.read_text())
    for key in ("org", "project", "source_slug", "targets", "tools"):
        if key not in manifest:
            die(f"manifest missing required key: {key}")
    return manifest


def current_api_version() -> str:
    """Read CURRENT_API_VERSION from server/polar/version.py without importing."""
    text = (REPO_ROOT / "server" / "polar" / "version.py").read_text()
    match = re.search(r"CURRENT_API_VERSION\s*=\s*V(\d{4})_(\d{2})", text)
    if not match:
        die("could not resolve CURRENT_API_VERSION from server/polar/version.py")
    return f"{match.group(1)}-{match.group(2)}"


def resolve_spec(explicit: str | None) -> Path:
    if explicit:
        spec = Path(explicit)
    else:
        spec = REPO_ROOT / "docs" / "openapi" / f"{current_api_version()}.openapi.json"
    if not spec.is_file():
        die(f"OpenAPI spec not found: {spec}")
    return spec


def tool_urn(source_slug: str, name: str) -> str:
    return f"tools:http:{source_slug}:{name}"


# --------------------------------------------------------------------------- #
# Gram API client (API-key auth)
# --------------------------------------------------------------------------- #
class GramClient:
    def __init__(self, base_url: str, api_key: str, project: str) -> None:
        self.base_url = base_url.rstrip("/")
        self.headers = {
            "Gram-Key": api_key,
            "Gram-Project": project,
            "Accept": "application/json",
        }

    def _request(self, method: str, path: str, params: dict | None, body: dict | None) -> dict:
        url = f"{self.base_url}{path}"
        if params:
            url += "?" + urllib.parse.urlencode(params)
        data = None
        headers = dict(self.headers)
        if body is not None:
            data = json.dumps(body).encode()
            headers["Content-Type"] = "application/json"
        req = urllib.request.Request(url, data=data, headers=headers, method=method)
        try:
            with urllib.request.urlopen(req) as resp:
                raw = resp.read()
        except urllib.error.HTTPError as exc:
            detail = exc.read().decode(errors="replace")[:500]
            die(f"{method} {path} -> HTTP {exc.code}: {detail}")
        return json.loads(raw) if raw else {}

    def list_toolsets(self) -> list[dict]:
        return self._request("GET", "/rpc/toolsets.list", None, None).get("toolsets", [])

    def get_toolset(self, slug: str) -> dict:
        return self._request("GET", "/rpc/toolsets.get", {"slug": slug}, None)

    def update_toolset(self, slug: str, tool_urns: list[str], resource_urns: list[str]) -> dict:
        body = {"tool_urns": tool_urns, "resource_urns": resource_urns}
        return self._request("POST", "/rpc/toolsets.update", {"slug": slug}, body)

    def upsert_variation(self, form: dict) -> dict:
        return self._request("POST", "/rpc/variations.upsertGlobal", None, form)


# --------------------------------------------------------------------------- #
# Stage 1: OpenAPI source
# --------------------------------------------------------------------------- #
def sync_source(manifest: dict, spec: Path, api_key: str, apply: bool) -> None:
    log(f"\n== source: {manifest['source_slug']} <- {spec.relative_to(REPO_ROOT)} ==")
    env = {
        **os.environ,
        "GRAM_API_KEY": api_key,
        "GRAM_ORG": manifest["org"],
        "GRAM_PROJECT": manifest["project"],
    }
    with tempfile.TemporaryDirectory() as tmp:
        config = Path(tmp) / "gram.deploy.json"
        stage = [
            "gram", "stage", "--config", str(config), "openapi",
            "--slug", manifest["source_slug"], "--location", str(spec),
        ]
        push = ["gram", "push", "--config", str(config), "--method", "merge"]
        if not apply:
            log("DRY-RUN would run:\n  " + " ".join(stage) + "\n  " + " ".join(push))
            return
        subprocess.run(stage, check=True, env=env)
        subprocess.run(push, check=True, env=env)
    log("source pushed")


# --------------------------------------------------------------------------- #
# Stage 2: toolsets + variations
# --------------------------------------------------------------------------- #
def resolve_toolset_slug(client: GramClient, mcp_slug: str) -> str:
    for entry in client.list_toolsets():
        if entry.get("mcp_slug") == mcp_slug:
            return entry["slug"]
    die(f"no toolset found for mcp_slug={mcp_slug!r} in project")


def current_variation(defn: dict) -> dict:
    var = defn.get("variation") or {}
    return {"title": var.get("title"), "description": var.get("description")}


def sync_target(
    client: GramClient, manifest: dict, mcp_slug: str, apply: bool
) -> bool:
    log(f"\n== mcp: {mcp_slug} ==")
    slug = resolve_toolset_slug(client, mcp_slug)
    toolset = client.get_toolset(slug)
    source_slug = manifest["source_slug"]

    desired = [tool_urn(source_slug, name) for name in manifest["tools"]]
    current = list(toolset.get("tool_urns", []))
    add = [u for u in desired if u not in set(current)]
    remove = [u for u in current if u not in set(desired)]

    changed = False
    if add or remove:
        changed = True
        for u in add:
            log(f"  + tool {u.rsplit(':', 1)[-1]}")
        for u in remove:
            log(f"  - tool {u.rsplit(':', 1)[-1]}")
        if apply:
            client.update_toolset(slug, desired, list(toolset.get("resource_urns", [])))
            after = client.get_toolset(slug)
            got = set(after.get("tool_urns", []))
            missing = [u for u in desired if u not in got]
            if missing:
                die("tools did not resolve after update (renamed/removed upstream?): "
                    + ", ".join(u.rsplit(":", 1)[-1] for u in missing))
    else:
        log("  tools: up to date (42)")

    # Variations (name/description overrides)
    by_name = {
        d["name"]: d
        for t in toolset.get("tools", [])
        if (d := t.get("http_tool_definition"))
    }
    overrides = manifest.get("overrides", {})
    for name, override in overrides.items():
        defn = by_name.get(name)
        cur = current_variation(defn) if defn else {"title": None, "description": None}
        want = {"title": override.get("title"), "description": override.get("description")}
        if {k: v for k, v in want.items() if v is not None} != {
            k: cur[k] for k in want if want[k] is not None
        }:
            changed = True
            log(f"  ~ variation {name}: {want}")
            if apply:
                form = {"src_tool_urn": tool_urn(source_slug, name), "src_tool_name": name}
                for key in ("title", "description"):
                    if override.get(key) is not None:
                        form[key] = override[key]
                client.upsert_variation(form)
    if not changed:
        log("  variations: up to date")
    return changed


# --------------------------------------------------------------------------- #
def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--manifest", type=Path, default=DEFAULT_MANIFEST)
    parser.add_argument("--apply", action="store_true", help="mutate Gram (default: dry-run)")
    parser.add_argument("--only", choices=["source", "tools"], help="run only one stage")
    parser.add_argument("--target", help="limit tools stage to one mcp_slug")
    parser.add_argument("--spec", help="OpenAPI file to push (default: current API version)")
    args = parser.parse_args()

    manifest = load_manifest(args.manifest)
    api_key_env = manifest.get("api_key_env", "GRAM_API_KEY")
    api_key = os.environ.get(api_key_env)
    if not api_key:
        die(f"{api_key_env} is not set (Provider-scoped Gram API key)")

    mode = "APPLY" if args.apply else "DRY-RUN"
    log(f"gram sync [{mode}] — project {manifest['org']}/{manifest['project']}")

    if args.only != "tools":
        sync_source(manifest, resolve_spec(args.spec), api_key, args.apply)

    if args.only != "source":
        base_url = os.environ.get("GRAM_API_URL", DEFAULT_BASE_URL)
        client = GramClient(base_url, api_key, manifest["project"])
        targets = [t["mcp_slug"] for t in manifest["targets"]]
        if args.target:
            if args.target not in targets:
                die(f"--target {args.target!r} not in manifest targets {targets}")
            targets = [args.target]
        for mcp_slug in targets:
            sync_target(client, manifest, mcp_slug, args.apply)

    log(f"\ndone ({mode}).")


if __name__ == "__main__":
    main()
