import typing
import uuid


def json_obj_serializer(obj: typing.Any) -> typing.Any:
    """
    A JSON serializer for objects that are not serializable by default.

    Currently handles:

    * uuid.UUID: Converts to string representation.
    """
    if isinstance(obj, uuid.UUID):
        return str(obj)
    raise TypeError(f"Object of type {type(obj)} is not JSON serializable")
