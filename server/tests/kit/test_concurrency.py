import anyio.lowlevel
import pytest

from polar.kit.concurrency import create_task_group


async def _value[T](value: T) -> T:
    await anyio.lowlevel.checkpoint()
    return value


async def _fail(message: str) -> None:
    await anyio.lowlevel.checkpoint()
    try:
        raise KeyError("cause")
    except KeyError as e:
        raise ValueError(message) from e


@pytest.mark.anyio
class TestCreateTaskGroup:
    async def test_returns_task_results(self) -> None:
        async with create_task_group() as tg:
            number = tg.create_task(_value(1))
            label = tg.create_task(_value("a"))

        assert (number.return_value, label.return_value) == (1, "a")

    async def test_unwraps_single_task_failure_keeping_cause(self) -> None:
        with pytest.raises(ValueError, match="boom") as exc_info:
            async with create_task_group() as tg:
                tg.create_task(_value(1))
                tg.create_task(_fail("boom"))

        assert isinstance(exc_info.value.__cause__, KeyError)

    async def test_unwraps_body_exception(self) -> None:
        with pytest.raises(ValueError, match="body"):
            async with create_task_group() as tg:
                tg.create_task(_value(1))
                raise ValueError("body")

    async def test_keeps_group_for_multiple_failures(self) -> None:
        with pytest.raises(ExceptionGroup) as exc_info:
            async with create_task_group() as tg:
                tg.create_task(_fail("a"))
                tg.create_task(_fail("b"))

        assert len(exc_info.value.exceptions) == 2
