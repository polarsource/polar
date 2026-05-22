import inspect
from typing import NotRequired, Required, TypedDict, Unpack

from polar.backoffice.tasks.forms import _get_function_arguments


class _AllOptional(TypedDict, total=False):
    first_name: str
    last_name: str


class _AllRequired(TypedDict):
    user_id: str
    email: str


class _Mixed(TypedDict):
    user_id: Required[str]
    first_name: NotRequired[str]
    last_name: NotRequired[str]


def test_typeddict_total_false_yields_none_default() -> None:
    def task(**kwargs: Unpack[_AllOptional]) -> None: ...

    args = dict(((k, default) for k, _, default in _get_function_arguments(task)))

    assert args == {"first_name": None, "last_name": None}


def test_typeddict_total_true_yields_empty_default() -> None:
    def task(**kwargs: Unpack[_AllRequired]) -> None: ...

    args = {k: default for k, _, default in _get_function_arguments(task)}

    assert args == {
        "user_id": inspect.Parameter.empty,
        "email": inspect.Parameter.empty,
    }


def test_typeddict_mixed_required_and_not_required() -> None:
    def task(**kwargs: Unpack[_Mixed]) -> None: ...

    args = {k: default for k, _, default in _get_function_arguments(task)}

    assert args == {
        "user_id": inspect.Parameter.empty,
        "first_name": None,
        "last_name": None,
    }
