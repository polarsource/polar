from collections.abc import Callable

from mypy.plugin import AnalyzeTypeContext, Plugin
from mypy.types import NoneType, Type


def _githubkit_unset_hook(ctx: AnalyzeTypeContext) -> Type:
    return NoneType()


class GitHubKitUnsetPlugin(Plugin):
    """
    Simple mypy plugin to handle the `githubkit.utils.Unset` type.

    It allows us to please mypy when doing things like `if value` when `value`
    is of type `githubkit.utils.Unset`.

    We simply map the type of this enum to `NoneType`.
    """

    def get_type_analyze_hook(
        self, fullname: str
    ) -> Callable[[AnalyzeTypeContext], Type] | None:
        if fullname == "githubkit.utils.Unset._UNSET":
            return _githubkit_unset_hook
        return None


def plugin(version: str) -> type[Plugin]:
    return GitHubKitUnsetPlugin
