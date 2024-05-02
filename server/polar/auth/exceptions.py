from polar.exceptions import NotPermitted

from .scope import Scope


class MissingScope(NotPermitted):
    def __init__(self, granted_scopes: set[Scope], required_scopes: set[Scope]) -> None:
        self.granted_scopes = granted_scopes
        self.required_scopes = required_scopes
        message = (
            "Missing required scope: "
            f"have={','.join(granted_scopes)} "
            f"requires={','.join(self.required_scopes)}"
        )
        super().__init__(message)
