from pathlib import Path

import anyio
import httpx
import pytest
from fastapi import FastAPI
from logfire.testing import CaptureLogfire

from polar.logfire import instrument_fastapi
from polar.observability import cpu_starvation


@pytest.mark.anyio
async def test_records_cpu_wait_on_request_span(
    capfire: CaptureLogfire, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    schedstat = tmp_path / "schedstat"
    cpu_stat = tmp_path / "cpu.stat"
    schedstat.write_text("1000000 1000000 5\n")
    cpu_stat.write_text("usage_usec 10\nnr_throttled 0\nthrottled_usec 2000\n")
    monkeypatch.setattr(cpu_starvation, "SCHEDSTAT_PATH", str(schedstat))
    monkeypatch.setattr(cpu_starvation, "CGROUP_CPU_STAT_PATH", str(cpu_stat))

    app = FastAPI()

    @app.get("/ping")
    async def ping() -> dict[str, bool]:
        await anyio.sleep(0.05)
        schedstat.write_text("3000000 4000000 5\n")
        cpu_stat.write_text("usage_usec 10\nnr_throttled 1\nthrottled_usec 7000\n")
        return {"ok": True}

    app.add_middleware(cpu_starvation.CPUStarvationMiddleware)
    instrument_fastapi(app)

    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.get("/ping")

    assert response.status_code == 200
    request_span = next(
        span
        for span in capfire.exporter.exported_spans
        if span.attributes
        and span.attributes.get("http.route") == "/ping"
        and span.attributes.get("logfire.span_type") == "span"
    )
    assert request_span.attributes is not None
    assert request_span.attributes["cpu.on_cpu_ms"] == 2.0
    assert request_span.attributes["cpu.run_delay_ms"] == 3.0
    idle_ms = request_span.attributes["cpu.idle_ms"]
    assert isinstance(idle_ms, float)
    assert idle_ms >= 45.0
    assert request_span.attributes["cpu.throttled_ms"] == 5.0
