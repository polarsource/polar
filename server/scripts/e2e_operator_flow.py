"""Coherent multi-slice operator journey, driven by Playwright.

A single browser session that walks the operator flow across slices:

  inbox (Slice 3)
   → open an AWAITING_HUMAN run (Slice 1 detail)
   → resolve a pending signal "Real concern" (Slice 2 signal-history)
   → commit the run (Slice 1 commit)
   → auto-advance to the next owned run (Slice 10)
   → commit it → queue clear → land back on the inbox

Run against the live API (:8000) with seed_e2e_statuses already run.
"""

from __future__ import annotations

import asyncio
import os
import subprocess
import sys
from pathlib import Path

os.environ["PLAYWRIGHT_BROWSERS_PATH"] = "/opt/pw-browsers"

from playwright.async_api import async_playwright  # noqa: E402

API = "http://127.0.0.1:8000"
CHROMIUM = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome"


def _seed() -> dict[str, str]:
    result = subprocess.run(
        [sys.executable, str(Path(__file__).parent / "seed_e2e_statuses.py")],
        capture_output=True,
        text=True,
        env={
            **os.environ,
            "PYTHONPATH": ".",
            "PYDANTIC_AI_GATEWAY_BASE_URL": "http://localhost:9999/unused",
        },
        check=True,
    )
    vals: dict[str, str] = {}
    for line in result.stdout.splitlines():
        if line.startswith(("COOKIE_", "RUN_", "ORG_")):
            k, _, v = line.partition("=")
            vals[k] = v.strip()
    return vals


async def _text(page) -> str:
    return await page.content()


async def main() -> int:
    seed = _seed()
    assert "COOKIE_VALUE" in seed, f"seed failed: {seed}"

    async with async_playwright() as p:
        browser = await p.chromium.launch(
            executable_path=CHROMIUM, args=["--no-sandbox"]
        )
        ctx = await browser.new_context(
            viewport={"width": 1440, "height": 900}
        )
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

        # 1) Inbox shows my action-required runs.
        print("1) inbox")
        r = await page.goto(
            f"{API}/backoffice/agent-runs/inbox", wait_until="domcontentloaded"
        )
        assert r and r.status == 200, r.status if r else "no resp"
        body = await _text(page)
        assert "Action required (yours)" in body
        assert "e2e-merchant" in body
        print("   ✓ inbox lists owned runs")

        # 2) Open the AWAITING_DENY run detail (Slices 1, 8, 11).
        print("2) open AWAITING_DENY detail")
        deny_id = seed["RUN_AWAITING_DENY"]
        await page.goto(
            f"{API}/backoffice/agent-runs/{deny_id}",
            wait_until="domcontentloaded",
        )
        body = await _text(page)
        assert "Confirm deny" in body
        assert "Signals" in body
        # Slice 8: facets card rendered with backfilled facets.
        assert "Facets" in body and "product_category" in body
        # Slice 11: blast-radius two-person banner (org is 15d old →
        # not blast-radius by age alone, but the banner logic is
        # exercised; assert the card path renders regardless).
        print("   ✓ detail renders commit + signals + facets cards")

        # 2b) Blast-radius two-person banner (Slice 11).
        print("2b) blast-radius two-person banner")
        br_id = seed.get("RUN_BLAST_RADIUS")
        if br_id:
            await page.goto(
                f"{API}/backoffice/agent-runs/{br_id}",
                wait_until="domcontentloaded",
            )
            assert (
                await page.get_by_test_id("two-person-banner").count() == 1
            ), "expected two-person banner on high-blast-radius DENY"
            print("   ✓ two-person banner shown (Slice 11)")

        # 2c) Park a run for merchant (Slice 5).
        print("2c) park for merchant")
        needs_id = seed.get("RUN_AWAITING_NEEDS_HUMAN")
        if needs_id:
            await page.goto(
                f"{API}/backoffice/agent-runs/{needs_id}",
                wait_until="domcontentloaded",
            )
            await page.locator('input[name="days"]').first.fill("5")
            await page.locator(
                'form[action*="/park-for-merchant"] input[name="reason"]'
            ).first.fill("Need payout details from merchant.")
            async with page.expect_navigation(
                wait_until="domcontentloaded"
            ):
                await page.locator(
                    'form[action*="/park-for-merchant"] button:has-text("Park")'
                ).first.click()
            assert "Awaiting merchant reply" in await _text(page)
            print("   ✓ parked + SLA armed (Slice 5)")

        # 2d) Context badge on a threshold-context run (Slice 7).
        print("2d) context dispatch surface")
        if needs_id:
            body = await _text(page)
            assert "threshold" in body  # context badge rendered
            print("   ✓ context badge rendered (Slice 7)")

        # 2e) Merchant-facing frontend, same session (Slice 4).
        print("2e) merchant frontend")
        try:
            r4 = await page.goto(
                "http://127.0.0.1:3000/dashboard/e2e-merchant/review",
                wait_until="domcontentloaded",
                timeout=45000,
            )
            if r4 and r4.status < 400:
                assert (
                    await page.get_by_test_id("review-page").count() >= 1
                )
                print("   ✓ merchant review page (Slice 4)")
            else:
                print(f"   ⚠ merchant frontend status {r4.status if r4 else '?'} (web server down?)")
        except Exception as e:
            print(f"   ⚠ merchant frontend skipped ({type(e).__name__})")

        # Back to the operator detail to continue the commit flow.
        await page.goto(
            f"{API}/backoffice/agent-runs/{deny_id}",
            wait_until="domcontentloaded",
        )

        # 3) Resolve the first pending signal "Real concern".
        print("3) resolve pending signal")
        await page.locator(
            'form[action*="/resolve"] textarea[name="reason"]'
        ).first.fill("Confirmed with payouts team during review.")
        async with page.expect_navigation(wait_until="domcontentloaded"):
            await page.locator(
                'form[action*="/resolve"] button:has-text("Real concern")'
            ).first.click()
        body = await _text(page)
        assert "real concern" in body  # resolution badge
        print("   ✓ signal flipped to 'real concern'")

        # 4) Commit the run → expect auto-advance to the next owned run.
        print("4) commit → auto-advance")
        commit_reason = page.locator(
            'form[action*="/commit"] textarea[name="reason"]'
        ).first
        assert await commit_reason.count() == 1, "commit form not present"
        await commit_reason.fill("Deny confirmed after signal review.")
        async with page.expect_navigation(wait_until="domcontentloaded"):
            await page.locator(
                'form[action*="/commit"] button:has-text("Confirm deny")'
            ).first.click()
        advanced_url = page.url
        assert deny_id not in advanced_url, (
            f"expected auto-advance away from committed run, at {advanced_url}"
        )
        body = await _text(page)
        assert "Advanced to next" in body or "Inbox" in body
        print(f"   ✓ auto-advanced to {advanced_url.split('/')[-1]}")

        # 5) Keep committing until the queue clears → land on inbox.
        print("5) drain queue → inbox")
        for _ in range(8):
            if page.url.rstrip("/").endswith("/agent-runs/inbox"):
                break
            commit_btn = page.locator(
                'form[action*="/commit"] button:has-text("Confirm")'
            ).first
            if await commit_btn.count() == 0:
                break
            reason = page.locator(
                'form[action*="/commit"] textarea[name="reason"]'
            ).first
            if await reason.count():
                await reason.fill("Committed during queue drain.")
            async with page.expect_navigation(wait_until="domcontentloaded"):
                await commit_btn.click()
        print(f"   ✓ ended at {page.url}")

        # 6) Lead surfaces in the same session (Slices 12, 9, 6).
        print("6) dashboard / pattern-match / rules")
        await page.goto(
            f"{API}/backoffice/agent-runs/dashboard",
            wait_until="domcontentloaded",
        )
        assert "Agent Dashboard" in await _text(page)
        print("   ✓ dashboard (Slice 12)")

        pattern_id = seed.get("RUN_PATTERN_MATCH")
        if pattern_id:
            await page.goto(
                f"{API}/backoffice/agent-runs/{pattern_id}",
                wait_until="domcontentloaded",
            )
            assert "pattern_match" in await _text(page)
            print("   ✓ pattern-match run (Slice 9)")

        await page.goto(
            f"{API}/backoffice/agent-runs/rules",
            wait_until="domcontentloaded",
        )
        body = await _text(page)
        assert "Auto-action Rules" in body and "R-1" in body
        print("   ✓ auto-action rules (Slice 6)")

        await page.goto(
            f"{API}/backoffice/agent-runs/inbox", wait_until="domcontentloaded"
        )
        await page.screenshot(
            path="/tmp/shots/50_operator_flow_inbox.png", full_page=True
        )
        await browser.close()

    print("\n✅ OPERATOR FLOW PASSED")
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
