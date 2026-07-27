import openapi_pydantic as op
import pytest


@pytest.fixture
def code_samples_spec() -> op.OpenAPI:
    return op.OpenAPI.model_validate(
        {
            "openapi": "3.1.0",
            "info": {"title": "Samples", "version": "2026-04"},
            "servers": [
                {
                    "url": "https://api.example.com",
                    "x-polar-environment": "production",
                }
            ],
            "paths": {
                "/health": {
                    "get": {
                        "operationId": "health:get",
                        "responses": {"204": {"description": "Healthy"}},
                    }
                },
                "/accounts/{account_id}/payment-methods": {
                    "get": {
                        "operationId": "accounts:payment_methods:list",
                        "parameters": [
                            {
                                "name": "account_id",
                                "in": "path",
                                "required": True,
                                "schema": {"type": "string", "format": "uuid"},
                            },
                            {
                                "name": "page",
                                "in": "query",
                                "schema": {"type": "integer", "default": 1},
                            },
                            {
                                "name": "label",
                                "in": "query",
                                "schema": {
                                    "anyOf": [
                                        {"type": "string"},
                                        {"type": "null"},
                                    ],
                                    "examples": ["primary"],
                                },
                            },
                        ],
                        "responses": {
                            "200": {
                                "description": "Success",
                                "content": {
                                    "application/json": {
                                        "schema": {
                                            "$ref": "#/components/schemas/PaymentMethodList"
                                        }
                                    }
                                },
                            }
                        },
                        "x-polar-pagination": {
                            "type": "page_limit",
                            "item_schema": {
                                "$ref": "#/components/schemas/PaymentMethod"
                            },
                        },
                    }
                },
                "/widgets": {
                    "post": {
                        "operationId": "widgets:create",
                        "requestBody": {
                            "required": True,
                            "content": {
                                "application/json": {
                                    "schema": {
                                        "$ref": "#/components/schemas/WidgetCreate"
                                    }
                                }
                            },
                        },
                        "responses": {
                            "200": {
                                "description": "Success",
                                "content": {
                                    "application/json": {
                                        "schema": {
                                            "$ref": "#/components/schemas/Widget"
                                        }
                                    }
                                },
                            }
                        },
                    }
                },
                "/private": {
                    "get": {
                        "operationId": "private:get",
                        "tags": ["private"],
                        "responses": {"204": {"description": "Private"}},
                    }
                },
            },
            "webhooks": {
                "widget.created": {
                    "post": {
                        "operationId": "webhooks:widget_created",
                        "requestBody": {
                            "required": True,
                            "content": {
                                "application/json": {
                                    "schema": {"$ref": "#/components/schemas/Widget"}
                                }
                            },
                        },
                        "responses": {"204": {"description": "Accepted"}},
                    }
                }
            },
            "components": {
                "schemas": {
                    "PaymentMethod": {
                        "type": "object",
                        "title": "PaymentMethod",
                        "properties": {"id": {"type": "string"}},
                        "required": ["id"],
                    },
                    "PaymentMethodList": {
                        "type": "object",
                        "title": "PaymentMethodList",
                        "properties": {
                            "items": {
                                "type": "array",
                                "items": {"$ref": "#/components/schemas/PaymentMethod"},
                            }
                        },
                        "required": ["items"],
                    },
                    "WidgetKind": {
                        "type": "string",
                        "title": "WidgetKind",
                        "enum": ["physical", "digital"],
                    },
                    "PhysicalWidget": {
                        "type": "object",
                        "title": "PhysicalWidget",
                        "properties": {
                            "type": {"type": "string", "const": "physical"},
                            "weight": {"type": "number"},
                        },
                        "required": ["type", "weight"],
                    },
                    "DigitalWidget": {
                        "type": "object",
                        "title": "DigitalWidget",
                        "properties": {
                            "type": {"type": "string", "const": "digital"},
                            "url": {"type": "string", "format": "uri"},
                        },
                        "required": ["type", "url"],
                    },
                    "WidgetDetails": {
                        "title": "WidgetDetails",
                        "oneOf": [
                            {"$ref": "#/components/schemas/PhysicalWidget"},
                            {"$ref": "#/components/schemas/DigitalWidget"},
                        ],
                        "discriminator": {
                            "propertyName": "type",
                            "mapping": {
                                "physical": "#/components/schemas/PhysicalWidget",
                                "digital": "#/components/schemas/DigitalWidget",
                            },
                        },
                    },
                    "WidgetCreate": {
                        "type": "object",
                        "title": "WidgetCreate",
                        "properties": {
                            "name": {"type": "string", "examples": ["Desk clock"]},
                            "kind": {"$ref": "#/components/schemas/WidgetKind"},
                            "details": {"$ref": "#/components/schemas/WidgetDetails"},
                            "note": {
                                "anyOf": [
                                    {"type": "string"},
                                    {"type": "null"},
                                ],
                                "examples": ["Limited edition"],
                            },
                            "code": {
                                "type": "string",
                                "pattern": "^A[A-Z0-9]+$",
                                "minLength": 2,
                                "maxLength": 8,
                            },
                            "score": {
                                "type": "number",
                                "exclusiveMinimum": 0,
                                "maximum": 0.5,
                            },
                            "tags": {
                                "type": "array",
                                "items": {"type": "string"},
                                "minItems": 2,
                            },
                            "archived_at": {
                                "anyOf": [
                                    {"type": "string", "format": "date-time"},
                                    {"type": "null"},
                                ],
                                "default": None,
                            },
                        },
                        "required": [
                            "name",
                            "kind",
                            "details",
                            "code",
                            "score",
                            "tags",
                        ],
                    },
                    "Widget": {
                        "type": "object",
                        "title": "Widget",
                        "properties": {"id": {"type": "string"}},
                        "required": ["id"],
                    },
                }
            },
        }
    )
