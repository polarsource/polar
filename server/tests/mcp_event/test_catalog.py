import json
from enum import StrEnum
from typing import Annotated, Literal

from pydantic import BaseModel, Field, TypeAdapter

from polar.mcp_event.catalog import MCPEventDefinition


class Color(StrEnum):
    red = "red"
    blue = "blue"


class Cat(BaseModel):
    kind: Literal["cat"]
    lives: int


class Dog(BaseModel):
    kind: Literal["dog"]
    breed: str


class Owner(BaseModel):
    name: str


class Pet(BaseModel):
    color: Color = Field(description="The pet's color.")
    owner: Owner
    animal: Annotated[Cat | Dog, Field(discriminator="kind")]


def test_payload_schema() -> None:
    schema = MCPEventDefinition("A pet event.", TypeAdapter(Pet)).payload_schema()

    assert "$ref" not in json.dumps(schema)
    assert "$defs" not in schema
    properties = schema["properties"]
    assert properties["color"] == {
        "enum": ["red", "blue"],
        "title": "Color",
        "type": "string",
        "description": "The pet's color.",
    }
    assert properties["owner"] == {"type": "object", "title": "Owner"}
    assert properties["animal"] == {
        "discriminator": {"propertyName": "kind"},
        "oneOf": [
            {"type": "object", "title": "Cat"},
            {"type": "object", "title": "Dog"},
        ],
        "title": "Animal",
    }
