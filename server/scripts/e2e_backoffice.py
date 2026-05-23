"""End-to-end Playwright smoke test for the v2 agent backoffice flow.

Drives a real browser against a running API (started separately):

  1. Seed an admin user + org + AWAITING_HUMAN run (via seed_e2e_admin.py).
  2. Plant the session cookie in the browser.
  3. Hit /backoffice/agent-runs/  → assert the seeded run appears.
  4. Hit /backoffice/agent-runs/{id} → assert verdict + Confirm button.
  5. Click "Assign to me" → assert "mine" badge appears.
  6. Click "Park for merchant" with on_timeout=escalate → assert
     "Awaiting merchant reply" section renders.
  7. Hit /backoffice/agent-runs/inbox → assert seeded run is in
     "Action required (yours)".

Run with the dev API already up on http://127.0.0.1:8000.
"""

from __future__ import annotations

import asyncio
import os
import subprocess
import sys
from pathlib import Path

os.environ["PLAYWRIGHT_BROWSERS_PATH"] = "/opt/pw-browsers"

from playwright.async_api import async_playwright  # noqa: E402

API_BASE = os.environ.get("E2E_API_BASE", "http://127.0.0.1:8000")
CHROMIUM = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome"


def _seed() -> dict[str, str]:
    """Run seed_e2e_admin.py and parse its KEY=VALUE output."""

    result = subprocess.run(
        [
            sys.executable,
            "-W",
            "ignore::DeprecationWarning",
            str(Path(__file__).parent / "seed_e2e_admin.py"),
        ],
        capture_output=True,
        text=True,
        env={
            **os.environ,
            "PYTHONPATH": ".",
            "PYDANTIC_AI_GATEWAY_BASE_URL": "http://localhost:9999/unused",
        },
        check=True,
    )
    values: dict[str, str] = {}
    for line in result.stdout.splitlines():
        if "=" in line and not line.startswith("/"):
            key, _, val = line.partition("=")
            if key.startswith(("COOKIE_", "ADMIN_", "ORG_", "RUN_")):
                values[key] = val.strip()
    if not all(
        k in values
        for k in (
            "COOKIE_NAME",
            "COOKIE_VALUE",
            "COOKIE_DOMAIN",
            "RUN_ID",
            "ORG_ID",
        )
    ):
        raise RuntimeError(
            f"Seed script did not emit expected values. Got: {values}\n"
            f"stdout:\n{result.stdout}\nstderr:\n{result.stderr}"
        )
    return values


async def _assert_text(page, text: str, *, where: str = "page") -> None:
    body = await page.content()
    if text not in body:
        raise AssertionError(
            f"Expected to find {text!r} in {where} ({page.url}); "
            f"body excerpt:\n{body[:400]}\n…\n{body[-400:]}"
        )
    print(f"  ✓ found {text!r} in {where}")


async def _assert_not_text(page, text: str, *, where: str = "page") -> None:
    body = await page.content()
    if text in body:
        raise AssertionError(
            f"Expected NOT to find {text!r} in {where} ({page.url})"
        )
    print(f"  ✓ no {text!r} in {where}")


async def main() -> int:
    print("Seeding…")
    seed = _seed()
    print(f"  run_id: {seed['RUN_ID']}")
    print(f"  org_id: {seed['ORG_ID']}")

    async with async_playwright() as p:
        browser = await p.chromium.launch(
            executable_path=CHROMIUM, args=["--no-sandbox"]
        )
        context = await browser.new_context()

        # Plant the session cookie. domain=127.0.0.1 + path=/ matches
        # the FastAPI cookie set by auth_service.
        await context.add_cookies(
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

        page = await context.new_page()

        # --- Recent agent runs index ---
        print("Step 1: /backoffice/agent-runs/")
        resp = await page.goto(f"{API_BASE}/backoffice/agent-runs/")
        assert resp and resp.status == 200, (
            f"Expected 200 at index; got {resp.status if resp else 'no resp'}"
        )
        await _assert_text(page, "Agent Runs", where="index")
        # The seeded run carries the e2e_seed trigger and the org slug.
        await _assert_text(page, "e2e_seed", where="index")
        await _assert_text(page, "e2e-merchant", where="index")
        await _assert_text(page, "deny", where="index")
        print("  ✓ index lists seeded run")

        # --- Detail page ---
        print("Step 2: /backoffice/agent-runs/{id}")
        detail_url = f"{API_BASE}/backoffice/agent-runs/{seed['RUN_ID']}"
        resp = await page.goto(detail_url)
        assert resp and resp.status == 200, (
            f"Expected 200 at detail; got {resp.status if resp else 'no resp'}"
        )
        await _assert_text(page, "e2e-merchant", where="detail")
        await _assert_text(page, "Final Report", where="detail")
        await _assert_text(page, "deny", where="detail")
        await _assert_text(
            page,
            "We weren't able to approve your account at this time.",
            where="detail (merchant_summary)",
        )
        # AWAITING_HUMAN run → commit form renders.
        await _assert_text(page, "Confirm deny", where="commit form")
        await _assert_text(page, "Override → APPROVE", where="commit form")
        await _assert_text(page, "Park for merchant", where="park form")
        # Owner controls visible.
        await _assert_text(page, "Assign to me", where="owner controls")
        print("  ✓ detail page renders with all action affordances")

        # --- Assign to me ---
        print("Step 3: Assign to me")
        await page.click('button:has-text("Assign to me")')
        await page.wait_for_load_state("networkidle")
        await _assert_text(page, "mine", where="post-assign badge")
        print("  ✓ run now owned by me")

        # --- Park for merchant ---
        print("Step 4: Park for merchant (escalate, 5d)")
        # Fill the park form. The "days" field is pre-filled to 7; pick
        # on_timeout=escalate (already default) and add a reason.
        await page.fill('input[name="days"]', "5")
        await page.fill(
            'input[name="reason"]',
            "e2e seed: testing the SLA contract end-to-end",
        )
        await page.click('button:has-text("Park")')
        await page.wait_for_load_state("networkidle")
        await _assert_text(
            page, "Awaiting merchant reply", where="post-park"
        )
        await _assert_text(page, "escalate", where="post-park")
        # Park form replaced with the read-only "due" line.
        await _assert_not_text(page, "Park for merchant", where="post-park")
        print("  ✓ SLA contract armed")

        # --- Inbox ---
        print("Step 5: /backoffice/agent-runs/inbox")
        resp = await page.goto(f"{API_BASE}/backoffice/agent-runs/inbox")
        assert resp and resp.status == 200, (
            f"Expected 200 at inbox; got {resp.status if resp else 'no resp'}"
        )
        await _assert_text(
            page, "Action required (yours)", where="inbox"
        )
        await _assert_text(page, "e2e-merchant", where="inbox")
        print("  ✓ inbox shows owned run")

        # --- Screenshot for proof ---
        screenshot_path = "/tmp/e2e_backoffice_inbox.png"
        await page.screenshot(path=screenshot_path, full_page=True)
        print(f"\nScreenshot saved: {screenshot_path}")

        await browser.close()

    print("\n✅ E2E PASSED")
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
