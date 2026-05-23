"""Screenshot every v2 backoffice page across statuses.

Reads /tmp/seed_out.txt (produced by seed_e2e_statuses.py) for the
cookie + run ids, then drives Chromium to capture:

  * agent-runs index (all statuses in one table)
  * inbox
  * dashboard
  * detail page for each seeded status/verdict combination

Saves PNGs to /tmp/shots/ and prints a status line per shot.
"""

from __future__ import annotations

import asyncio
import os
from pathlib import Path

os.environ["PLAYWRIGHT_BROWSERS_PATH"] = "/opt/pw-browsers"

from playwright.async_api import async_playwright  # noqa: E402

API = "http://127.0.0.1:8000"
CHROMIUM = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome"
OUT = Path("/tmp/shots")


def _load_seed() -> dict[str, str]:
    values: dict[str, str] = {}
    for line in Path("/tmp/seed_out.txt").read_text().splitlines():
        if "=" in line:
            k, _, v = line.partition("=")
            values[k.strip()] = v.strip()
    return values


async def _shot(page, url: str, name: str, *, expect: str | None = None) -> str:
    resp = await page.goto(url, wait_until="networkidle")
    status = resp.status if resp else 0
    path = OUT / f"{name}.png"
    await page.screenshot(path=str(path), full_page=True)
    ok = "?"
    if expect is not None:
        body = await page.content()
        ok = "ok" if expect in body else "MISSING"
    return f"  [{status}] {name:32s} expect={expect!r:40s} {ok}  → {path}"


async def main() -> None:
    OUT.mkdir(exist_ok=True)
    seed = _load_seed()

    async with async_playwright() as p:
        browser = await p.chromium.launch(
            executable_path=CHROMIUM, args=["--no-sandbox"]
        )
        ctx = await browser.new_context(viewport={"width": 1440, "height": 900})
        await ctx.add_cookies(
            [
                {
                    "name": seed["COOKIE_NAME"],
                    "value": seed["COOKIE_VALUE"],
                    "domain": seed["COOKIE_DOMAIN"],
                    "path": "/",
                    "httpOnly": True,
                    "secure": False,
                    "sameSite": "Lax",
                }
            ]
        )
        page = await ctx.new_page()

        lines: list[str] = []
        # Top-level pages
        lines.append(
            await _shot(
                page, f"{API}/backoffice/agent-runs/", "01_index",
                expect="Agent Runs",
            )
        )
        lines.append(
            await _shot(
                page, f"{API}/backoffice/agent-runs/inbox", "02_inbox",
                expect="Action required",
            )
        )
        lines.append(
            await _shot(
                page,
                f"{API}/backoffice/agent-runs/dashboard",
                "03_dashboard",
                expect="Agent Dashboard",
            )
        )

        # Detail pages, one per status/verdict.
        detail_specs = [
            ("PENDING", "10_detail_pending", "pending"),
            ("RUNNING", "11_detail_running", "investigate"),
            ("COMPLETED_APPROVE", "12_detail_completed_approve", "approve"),
            ("AWAITING_DENY", "13_detail_awaiting_deny", "Confirm deny"),
            (
                "AWAITING_NEEDS_HUMAN",
                "14_detail_needs_human",
                "needs_human",
            ),
            ("AWAITING_PARKED", "15_detail_parked", "Awaiting merchant reply"),
            ("FAILED", "16_detail_failed", "failed"),
            ("CANCELLED", "17_detail_cancelled", "cancelled"),
            ("PATTERN_MATCH", "18_detail_pattern_match", "pattern_match"),
        ]
        for label, name, expect in detail_specs:
            run_id = seed.get(f"RUN_{label}")
            if not run_id:
                lines.append(f"  [--] {name}: no seed id for {label}")
                continue
            lines.append(
                await _shot(
                    page,
                    f"{API}/backoffice/agent-runs/{run_id}",
                    name,
                    expect=expect,
                )
            )

        # Disagreement strip on the org detail page (classic backoffice).
        org_id = seed.get("ORG_ID")
        if org_id:
            lines.append(
                await _shot(
                    page,
                    f"{API}/backoffice/organizations/{org_id}",
                    "20_org_disagreement_strip",
                    expect="v2 Shadow Agent",
                )
            )

        await browser.close()

    print("\n".join(lines))
    missing = [l for l in lines if "MISSING" in l]
    print(f"\n{len(lines)} shots, {len(missing)} content-check failures")
    for m in missing:
        print("  FAIL:", m.strip())


if __name__ == "__main__":
    asyncio.run(main())
