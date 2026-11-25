import pathlib
import re

import pytest

from generator import emitter
from generator.ir import APIIR
from python.emitter import PythonEmitter
from typescript.emitter import TypeScriptEmitter


def test_loads_redis_scripts_by_group() -> None:
    assert {
        group: set(scripts) for group, scripts in emitter.load_redis_scripts().items()
    } == {
        "common": {"backoff", "confirm", "extend_lock", "release_lock"},
        "outbox": {"outbox_backlog"},
        "outpost": {
            "apply_snapshot",
            "commit_pull",
            "prepare_snapshot",
            "push_telemetry",
            "read_states",
            "write_bucket",
        },
    }


@pytest.mark.parametrize("breaker", ["`", "${", '"""', "\\"])
def test_rejects_a_script_that_breaks_its_literal(
    tmp_path: pathlib.Path, monkeypatch: pytest.MonkeyPatch, breaker: str
) -> None:
    (tmp_path / "script.lua").write_text(f"return '{breaker}'\n")
    monkeypatch.setattr(emitter, "REDIS_DIRECTORY", tmp_path)
    with pytest.raises(ValueError, match="script.lua"):
        emitter.load_redis_scripts()


def test_every_sdk_references_every_redis_constant() -> None:
    ir = APIIR(versions=[])
    templates = (
        (
            TypeScriptEmitter(ir, "1.0.0"),
            "redis_constants",
            (
                "src/redis.ts",
                "src/metering/outbox/redis.ts",
                "src/outpost/client.ts",
                "src/outpost/reducer.ts",
            ),
        ),
        (
            PythonEmitter(ir, "1.0.0"),
            "redis_constants",
            (
                "polar/_redis.py",
                "polar/outpost/client.py",
                "polar/outpost/reducer.py",
                "polar/metering/outbox/redis.py",
            ),
        ),
    )
    for sdk, key, paths in templates:
        source = "".join((sdk.templates_dir / path).read_text() for path in paths)
        assert set(re.findall(rf"{key}\.(\w+)", source)) == set(sdk.get_context()[key])
