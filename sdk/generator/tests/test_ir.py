"""Tests for the IR generation from OpenAPI specs."""

import typing

import openapi_pydantic as op
import pytest

from generator.ir import generate_ir

_STRING = {"kind": "primitive", "type": "string"}


@pytest.mark.parametrize(
    ("specs", "expected"),
    [
        pytest.param(
            [
                {
                    "openapi": "3.1.0",
                    "info": {"title": "Test API", "version": "1.0.0"},
                    "paths": {
                        "/products": {
                            "get": {
                                "operationId": "products:list",
                                "description": "List products",
                                "responses": {
                                    "200": {
                                        "description": "Success",
                                        "content": {
                                            "application/json": {
                                                "schema": {
                                                    "$ref": "#/components/schemas/Product"
                                                }
                                            }
                                        },
                                    }
                                },
                            }
                        },
                        "/users": {
                            "get": {
                                "operationId": "users:list",
                                "description": "List users",
                                "responses": {
                                    "200": {
                                        "description": "Success",
                                        "content": {
                                            "application/json": {
                                                "schema": {
                                                    "$ref": "#/components/schemas/User"
                                                }
                                            }
                                        },
                                    }
                                },
                            }
                        },
                    },
                    "components": {
                        "schemas": {
                            "User": {
                                "type": "object",
                                "properties": {
                                    "name": {"type": "string"},
                                    "email": {"type": "string"},
                                },
                                "title": "User",
                                "required": ["name", "email"],
                            },
                            "Product": {
                                "type": "object",
                                "properties": {
                                    "id": {"type": "string"},
                                    "name": {"type": "string"},
                                },
                                "title": "Product",
                                "required": ["id", "name"],
                            },
                        }
                    },
                }
            ],
            {
                "versions": [
                    {
                        "version": "1.0.0",
                        "servers": [],
                        "services": [
                            {
                                "name": "Products",
                                "services": [],
                                "methods": [
                                    {
                                        "name": "list",
                                        "description": "List products",
                                        "http_method": "GET",
                                        "path": "/products",
                                        "path_params": [],
                                        "query_params": [],
                                        "response": {
                                            "kind": "model",
                                            "name": "Product",
                                        },
                                        "response_type": "json",
                                        "errors": [],
                                    }
                                ],
                            },
                            {
                                "name": "Users",
                                "services": [],
                                "methods": [
                                    {
                                        "name": "list",
                                        "description": "List users",
                                        "http_method": "GET",
                                        "path": "/users",
                                        "path_params": [],
                                        "query_params": [],
                                        "response": {"kind": "model", "name": "User"},
                                        "response_type": "json",
                                        "errors": [],
                                    }
                                ],
                            },
                        ],
                        "input_models": [],
                        "output_models": [
                            {
                                "name": "Product",
                                "fields": [
                                    {"name": "id", "type": _STRING, "required": True},
                                    {"name": "name", "type": _STRING, "required": True},
                                ],
                            },
                            {
                                "name": "User",
                                "fields": [
                                    {"name": "name", "type": _STRING, "required": True},
                                    {
                                        "name": "email",
                                        "type": _STRING,
                                        "required": True,
                                    },
                                ],
                            },
                        ],
                        "webhooks": [],
                        "enums": [],
                        "input_unions": [],
                        "output_unions": [],
                    }
                ]
            },
            id="Schemas referenced in components.schemas should appear in models; response TypeRef uses ModelRef.",
        ),
        pytest.param(
            [
                {
                    "openapi": "3.1.0",
                    "info": {"title": "Test API", "version": "1.0.0"},
                    "paths": {},
                    "webhooks": {
                        "customer.updated": {
                            "post": {
                                "description": "Sent when a customer is updated.",
                                "requestBody": {
                                    "required": True,
                                    "content": {
                                        "application/json": {
                                            "schema": {
                                                "$ref": "#/components/schemas/WebhookCustomerUpdatedPayload"
                                            }
                                        }
                                    },
                                },
                                "responses": {
                                    "200": {"description": "Successful Response"}
                                },
                            }
                        },
                        "customer.created": {
                            "post": {
                                "description": "Sent when a customer is created.",
                                "requestBody": {
                                    "required": True,
                                    "content": {
                                        "application/json": {
                                            "schema": {
                                                "$ref": "#/components/schemas/WebhookCustomerCreatedPayload"
                                            }
                                        }
                                    },
                                },
                                "responses": {
                                    "200": {"description": "Successful Response"}
                                },
                            }
                        },
                    },
                    "components": {
                        "schemas": {
                            "WebhookCustomerUpdatedPayload": {
                                "type": "object",
                                "title": "WebhookCustomerUpdatedPayload",
                                "description": "Sent when a customer is updated.",
                                "properties": {
                                    "type": {
                                        "type": "string",
                                        "const": "customer.updated",
                                    },
                                    "data": {"$ref": "#/components/schemas/Customer"},
                                },
                                "required": ["type", "data"],
                            },
                            "WebhookCustomerCreatedPayload": {
                                "type": "object",
                                "title": "WebhookCustomerCreatedPayload",
                                "description": "Sent when a customer is created.",
                                "properties": {
                                    "type": {
                                        "type": "string",
                                        "const": "customer.created",
                                    },
                                    "data": {"$ref": "#/components/schemas/Customer"},
                                },
                                "required": ["type", "data"],
                            },
                            "Customer": {
                                "type": "object",
                                "title": "Customer",
                                "properties": {
                                    "id": {"type": "string"},
                                    "status": {
                                        "$ref": "#/components/schemas/CustomerStatus"
                                    },
                                    "subject": {
                                        "$ref": "#/components/schemas/CustomerSubject"
                                    },
                                },
                                "required": ["id", "status", "subject"],
                            },
                            "CustomerStatus": {
                                "type": "string",
                                "title": "CustomerStatus",
                                "enum": ["active", "deleted"],
                            },
                            "CustomerSubject": {
                                "title": "CustomerSubject",
                                "oneOf": [
                                    {"$ref": "#/components/schemas/Individual"},
                                    {"$ref": "#/components/schemas/Business"},
                                ],
                            },
                            "Individual": {
                                "type": "object",
                                "title": "Individual",
                                "properties": {"name": {"type": "string"}},
                                "required": ["name"],
                            },
                            "Business": {
                                "type": "object",
                                "title": "Business",
                                "properties": {"company_name": {"type": "string"}},
                                "required": ["company_name"],
                            },
                        }
                    },
                }
            ],
            {
                "versions": [
                    {
                        "version": "1.0.0",
                        "servers": [],
                        "services": [],
                        "input_models": [],
                        "output_models": [
                            {
                                "name": "Business",
                                "fields": [
                                    {
                                        "name": "company_name",
                                        "type": _STRING,
                                        "required": True,
                                    }
                                ],
                            },
                            {
                                "name": "Customer",
                                "fields": [
                                    {"name": "id", "type": _STRING, "required": True},
                                    {
                                        "name": "status",
                                        "type": {
                                            "kind": "enum",
                                            "name": "CustomerStatus",
                                        },
                                        "required": True,
                                    },
                                    {
                                        "name": "subject",
                                        "type": {
                                            "kind": "union_ref",
                                            "name": "CustomerSubject",
                                        },
                                        "required": True,
                                    },
                                ],
                            },
                            {
                                "name": "Individual",
                                "fields": [
                                    {
                                        "name": "name",
                                        "type": _STRING,
                                        "required": True,
                                    }
                                ],
                            },
                        ],
                        "webhooks": [
                            {
                                "name": "WebhookCustomerCreatedPayload",
                                "description": "Sent when a customer is created.",
                                "fields": [
                                    {
                                        "name": "type",
                                        "type": {
                                            "kind": "literal",
                                            "value": "customer.created",
                                        },
                                        "required": True,
                                    },
                                    {
                                        "name": "data",
                                        "type": {
                                            "kind": "model",
                                            "name": "Customer",
                                        },
                                        "required": True,
                                    },
                                ],
                            },
                            {
                                "name": "WebhookCustomerUpdatedPayload",
                                "description": "Sent when a customer is updated.",
                                "fields": [
                                    {
                                        "name": "type",
                                        "type": {
                                            "kind": "literal",
                                            "value": "customer.updated",
                                        },
                                        "required": True,
                                    },
                                    {
                                        "name": "data",
                                        "type": {
                                            "kind": "model",
                                            "name": "Customer",
                                        },
                                        "required": True,
                                    },
                                ],
                            },
                        ],
                        "enums": [
                            {
                                "name": "CustomerStatus",
                                "type": "string",
                                "values": [
                                    {"name": "ACTIVE", "value": "active"},
                                    {"name": "DELETED", "value": "deleted"},
                                ],
                            }
                        ],
                        "input_unions": [],
                        "output_unions": [
                            {
                                "name": "CustomerSubject",
                                "variants": [
                                    {"kind": "model", "name": "Individual"},
                                    {"kind": "model", "name": "Business"},
                                ],
                                "composition_kind": "oneOf",
                            }
                        ],
                    }
                ]
            },
            id="Webhook schemas are emitted separately with transitive output dependencies.",
        ),
        pytest.param(
            [
                {
                    "openapi": "3.1.0",
                    "info": {"title": "Test API", "version": "1.0.0"},
                    "paths": {
                        "/users": {
                            "post": {
                                "operationId": "users:create",
                                "description": "Create a user",
                                "requestBody": {
                                    "required": True,
                                    "content": {
                                        "application/json": {
                                            "schema": {
                                                "type": "object",
                                                "properties": {
                                                    "name": {"type": "string"},
                                                    "email": {"type": "string"},
                                                },
                                                "title": "UserCreate",
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
                                                    "type": "object",
                                                    "properties": {
                                                        "id": {"type": "string"},
                                                        "name": {"type": "string"},
                                                        "type": {
                                                            "$ref": "#/components/schemas/UserType"
                                                        },
                                                    },
                                                    "title": "UserResponse",
                                                }
                                            }
                                        },
                                    }
                                },
                                "tags": ["users"],
                            }
                        }
                    },
                    "components": {
                        "schemas": {
                            "UserType": {
                                "type": "string",
                                "enum": ["admin", "regular"],
                                "title": "UserType",
                            }
                        }
                    },
                }
            ],
            {
                "versions": [
                    {
                        "version": "1.0.0",
                        "servers": [],
                        "services": [
                            {
                                "name": "Users",
                                "services": [],
                                "methods": [
                                    {
                                        "name": "create",
                                        "description": "Create a user",
                                        "http_method": "POST",
                                        "path": "/users",
                                        "path_params": [],
                                        "query_params": [],
                                        "body": {"kind": "model", "name": "UserCreate"},
                                        "response": {
                                            "kind": "model",
                                            "name": "UserResponse",
                                        },
                                        "response_type": "json",
                                        "errors": [],
                                    }
                                ],
                            }
                        ],
                        "input_models": [
                            {
                                "name": "UserCreate",
                                "fields": [
                                    {
                                        "name": "name",
                                        "type": _STRING,
                                        "required": False,
                                    },
                                    {
                                        "name": "email",
                                        "type": _STRING,
                                        "required": False,
                                    },
                                ],
                            },
                        ],
                        "output_models": [
                            {
                                "name": "UserResponse",
                                "fields": [
                                    {"name": "id", "type": _STRING, "required": False},
                                    {
                                        "name": "name",
                                        "type": _STRING,
                                        "required": False,
                                    },
                                    {
                                        "name": "type",
                                        "type": {"kind": "enum", "name": "UserType"},
                                        "required": False,
                                    },
                                ],
                            },
                        ],
                        "webhooks": [],
                        "enums": [
                            {
                                "name": "UserType",
                                "type": "string",
                                "values": [
                                    {"name": "ADMIN", "value": "admin"},
                                    {"name": "REGULAR", "value": "regular"},
                                ],
                            }
                        ],
                        "input_unions": [],
                        "output_unions": [],
                    }
                ]
            },
            id="Inline titled schemas become named models/enums; untitled properties use EnumRef to named enums.",
        ),
        pytest.param(
            [
                {
                    "openapi": "3.1.0",
                    "info": {"title": "Test API", "version": "1.0.0"},
                    "paths": {},
                    "components": {
                        "schemas": {
                            "UnusedSchema": {
                                "type": "object",
                                "properties": {"foo": {"type": "string"}},
                                "title": "UnusedSchema",
                            }
                        }
                    },
                }
            ],
            {
                "versions": [
                    {
                        "version": "1.0.0",
                        "servers": [],
                        "services": [],
                        "input_models": [],
                        "output_models": [],
                        "webhooks": [],
                        "enums": [],
                        "input_unions": [],
                        "output_unions": [],
                    }
                ]
            },
            id="Schemas defined in components.schemas but not referenced anywhere should not appear in the IR.",
        ),
        pytest.param(
            [
                {
                    "openapi": "3.1.0",
                    "info": {"title": "Test API", "version": "1.0.0"},
                    "paths": {
                        "/products": {
                            "get": {
                                "operationId": "products:list",
                                "description": "List products",
                                "parameters": [
                                    {
                                        "name": "category",
                                        "in": "query",
                                        "schema": {"type": "string"},
                                        "description": "Filter products by category",
                                    }
                                ],
                                "responses": {
                                    "200": {
                                        "description": "Success",
                                        "content": {
                                            "application/json": {
                                                "schema": {
                                                    "$ref": "#/components/schemas/Product"
                                                }
                                            }
                                        },
                                    }
                                },
                            }
                        },
                        "/products/{id}": {
                            "get": {
                                "operationId": "products:get",
                                "description": "Get a product by ID",
                                "parameters": [
                                    {
                                        "name": "id",
                                        "in": "path",
                                        "schema": {"type": "string"},
                                        "required": True,
                                        "description": "The ID of the product",
                                    }
                                ],
                                "responses": {
                                    "200": {
                                        "description": "Success",
                                        "content": {
                                            "application/json": {
                                                "schema": {
                                                    "$ref": "#/components/schemas/Product"
                                                }
                                            }
                                        },
                                    }
                                },
                            }
                        },
                    },
                    "components": {
                        "schemas": {
                            "Product": {
                                "type": "object",
                                "properties": {
                                    "id": {"type": "string"},
                                    "name": {"type": "string"},
                                },
                                "title": "Product",
                                "required": ["id", "name"],
                            },
                        }
                    },
                }
            ],
            {
                "versions": [
                    {
                        "version": "1.0.0",
                        "servers": [],
                        "services": [
                            {
                                "name": "Products",
                                "services": [],
                                "methods": [
                                    {
                                        "name": "list",
                                        "description": "List products",
                                        "http_method": "GET",
                                        "path": "/products",
                                        "path_params": [],
                                        "query_params": [
                                            {
                                                "name": "category",
                                                "parameter_name": "category",
                                                "type": _STRING,
                                                "required": False,
                                                "description": "Filter products by category",
                                            }
                                        ],
                                        "response": {
                                            "kind": "model",
                                            "name": "Product",
                                        },
                                        "response_type": "json",
                                        "errors": [],
                                    },
                                    {
                                        "name": "get",
                                        "description": "Get a product by ID",
                                        "http_method": "GET",
                                        "path": "/products/{id}",
                                        "path_params": [
                                            {
                                                "name": "id",
                                                "parameter_name": "id",
                                                "type": _STRING,
                                                "required": True,
                                                "description": "The ID of the product",
                                            }
                                        ],
                                        "query_params": [],
                                        "response": {
                                            "kind": "model",
                                            "name": "Product",
                                        },
                                        "response_type": "json",
                                        "errors": [],
                                    },
                                ],
                            }
                        ],
                        "input_models": [],
                        "output_models": [
                            {
                                "name": "Product",
                                "fields": [
                                    {"name": "id", "type": _STRING, "required": True},
                                    {"name": "name", "type": _STRING, "required": True},
                                ],
                            },
                        ],
                        "webhooks": [],
                        "enums": [],
                        "input_unions": [],
                        "output_unions": [],
                    }
                ]
            },
            id="Path and query parameters use PrimitiveType; parameter required flag is correctly set.",
        ),
        pytest.param(
            [
                {
                    "openapi": "3.1.0",
                    "info": {"title": "Test API", "version": "1.0.0"},
                    "paths": {
                        "/orders": {
                            "get": {
                                "operationId": "orders:list",
                                "description": "List orders",
                                "parameters": [
                                    {
                                        "name": "status",
                                        "in": "query",
                                        "schema": {
                                            "type": "string",
                                            "enum": [
                                                "pending",
                                                "shipped",
                                                "delivered",
                                            ],
                                        },
                                        "description": "Filter by order status",
                                    }
                                ],
                                "responses": {
                                    "200": {
                                        "description": "Success",
                                        "content": {
                                            "application/json": {
                                                "schema": {
                                                    "$ref": "#/components/schemas/Order"
                                                }
                                            }
                                        },
                                    }
                                },
                            }
                        }
                    },
                    "components": {
                        "schemas": {
                            "Order": {
                                "type": "object",
                                "properties": {
                                    "id": {"type": "string"},
                                    "status": {
                                        "$ref": "#/components/schemas/OrderStatus"
                                    },
                                },
                                "required": ["id", "status"],
                                "title": "Order",
                            },
                            "OrderStatus": {
                                "type": "string",
                                "enum": ["pending", "shipped", "delivered"],
                                "title": "OrderStatus",
                            },
                        }
                    },
                }
            ],
            {
                "versions": [
                    {
                        "version": "1.0.0",
                        "servers": [],
                        "services": [
                            {
                                "name": "Orders",
                                "services": [],
                                "methods": [
                                    {
                                        "name": "list",
                                        "description": "List orders",
                                        "http_method": "GET",
                                        "path": "/orders",
                                        "path_params": [],
                                        "query_params": [
                                            {
                                                "name": "status",
                                                "parameter_name": "status",
                                                "type": {
                                                    "kind": "union",
                                                    "variants": [
                                                        {
                                                            "kind": "literal",
                                                            "value": "pending",
                                                        },
                                                        {
                                                            "kind": "literal",
                                                            "value": "shipped",
                                                        },
                                                        {
                                                            "kind": "literal",
                                                            "value": "delivered",
                                                        },
                                                    ],
                                                },
                                                "required": False,
                                                "description": "Filter by order status",
                                            }
                                        ],
                                        "response": {"kind": "model", "name": "Order"},
                                        "response_type": "json",
                                        "errors": [],
                                    }
                                ],
                            }
                        ],
                        "input_models": [],
                        "output_models": [
                            {
                                "name": "Order",
                                "fields": [
                                    {"name": "id", "type": _STRING, "required": True},
                                    {
                                        "name": "status",
                                        "type": {"kind": "enum", "name": "OrderStatus"},
                                        "required": True,
                                    },
                                ],
                            }
                        ],
                        "webhooks": [],
                        "enums": [
                            {
                                "name": "OrderStatus",
                                "type": "string",
                                "values": [
                                    {"name": "PENDING", "value": "pending"},
                                    {"name": "SHIPPED", "value": "shipped"},
                                    {"name": "DELIVERED", "value": "delivered"},
                                ],
                            }
                        ],
                        "input_unions": [],
                        "output_unions": [],
                    }
                ]
            },
            id="Named enum schemas become Enum entries with EnumRef; anonymous inline enums become a union of literals.",
        ),
        pytest.param(
            [
                {
                    "openapi": "3.1.0",
                    "info": {"title": "Test API", "version": "1.0.0"},
                    "paths": {
                        "/products": {
                            "get": {
                                "operationId": "products:list",
                                "description": "List products",
                                "responses": {"200": {"description": "Success"}},
                            }
                        },
                        "/products/{product_id}/variants": {
                            "get": {
                                "operationId": "products:variants:list",
                                "description": "List variants of a product",
                                "parameters": [
                                    {
                                        "name": "product_id",
                                        "in": "path",
                                        "schema": {"type": "string"},
                                        "required": True,
                                        "description": "The product ID",
                                    }
                                ],
                                "responses": {"200": {"description": "Success"}},
                            }
                        },
                        "/products/{product_id}/variants/{variant_id}": {
                            "get": {
                                "operationId": "products:variants:get",
                                "description": "Get a variant of a product",
                                "parameters": [
                                    {
                                        "name": "product_id",
                                        "in": "path",
                                        "schema": {"type": "string"},
                                        "required": True,
                                        "description": "The product ID",
                                    },
                                    {
                                        "name": "variant_id",
                                        "in": "path",
                                        "schema": {"type": "string"},
                                        "required": True,
                                        "description": "The variant ID",
                                    },
                                ],
                                "responses": {"200": {"description": "Success"}},
                            }
                        },
                    },
                }
            ],
            {
                "versions": [
                    {
                        "version": "1.0.0",
                        "servers": [],
                        "services": [
                            {
                                "name": "Products",
                                "services": [
                                    {
                                        "name": "Variants",
                                        "services": [],
                                        "methods": [
                                            {
                                                "name": "list",
                                                "description": "List variants of a product",
                                                "http_method": "GET",
                                                "path": "/products/{product_id}/variants",
                                                "path_params": [
                                                    {
                                                        "name": "product_id",
                                                        "parameter_name": "product_id",
                                                        "type": _STRING,
                                                        "required": True,
                                                        "description": "The product ID",
                                                    }
                                                ],
                                                "query_params": [],
                                                "response_type": "none",
                                                "errors": [],
                                            },
                                            {
                                                "name": "get",
                                                "description": "Get a variant of a product",
                                                "http_method": "GET",
                                                "path": "/products/{product_id}/variants/{variant_id}",
                                                "path_params": [
                                                    {
                                                        "name": "product_id",
                                                        "parameter_name": "product_id",
                                                        "type": _STRING,
                                                        "required": True,
                                                        "description": "The product ID",
                                                    },
                                                    {
                                                        "name": "variant_id",
                                                        "parameter_name": "variant_id",
                                                        "type": _STRING,
                                                        "required": True,
                                                        "description": "The variant ID",
                                                    },
                                                ],
                                                "query_params": [],
                                                "response_type": "none",
                                                "errors": [],
                                            },
                                        ],
                                    }
                                ],
                                "methods": [
                                    {
                                        "name": "list",
                                        "description": "List products",
                                        "http_method": "GET",
                                        "path": "/products",
                                        "path_params": [],
                                        "query_params": [],
                                        "response_type": "none",
                                        "errors": [],
                                    }
                                ],
                            }
                        ],
                        "input_models": [],
                        "output_models": [],
                        "webhooks": [],
                        "enums": [],
                        "input_unions": [],
                        "output_unions": [],
                    }
                ]
            },
            id="Operations with multi-part operationIds should be grouped into nested services.",
        ),
        pytest.param(
            [
                {
                    "openapi": "3.1.0",
                    "info": {"title": "Test API", "version": "1.0.0"},
                    "paths": {
                        "/accounts": {
                            "get": {
                                "operationId": "accounts:list",
                                "description": "List accounts",
                                "responses": {
                                    "200": {
                                        "description": "Success",
                                        "content": {
                                            "application/json": {
                                                "schema": {
                                                    "$ref": "#/components/schemas/Account"
                                                }
                                            }
                                        },
                                    }
                                },
                            }
                        }
                    },
                    "components": {
                        "schemas": {
                            "Account": {
                                "type": "object",
                                "properties": {
                                    "id": {"type": "string"},
                                    "modified_at": {
                                        "anyOf": [
                                            {"type": "string", "format": "date-time"},
                                            {"type": "null"},
                                        ]
                                    },
                                },
                                "required": ["id"],
                                "title": "Account",
                            }
                        }
                    },
                }
            ],
            {
                "versions": [
                    {
                        "version": "1.0.0",
                        "servers": [],
                        "services": [
                            {
                                "name": "Accounts",
                                "services": [],
                                "methods": [
                                    {
                                        "name": "list",
                                        "description": "List accounts",
                                        "http_method": "GET",
                                        "path": "/accounts",
                                        "path_params": [],
                                        "query_params": [],
                                        "response": {
                                            "kind": "model",
                                            "name": "Account",
                                        },
                                        "response_type": "json",
                                        "errors": [],
                                    }
                                ],
                            }
                        ],
                        "input_models": [],
                        "output_models": [
                            {
                                "name": "Account",
                                "fields": [
                                    {"name": "id", "type": _STRING, "required": True},
                                    {
                                        "name": "modified_at",
                                        "type": {
                                            "kind": "nullable",
                                            "inner": {
                                                "kind": "primitive",
                                                "type": "string",
                                                "format": "date-time",
                                            },
                                        },
                                        "required": False,
                                    },
                                ],
                            }
                        ],
                        "webhooks": [],
                        "enums": [],
                        "input_unions": [],
                        "output_unions": [],
                    }
                ]
            },
            id="anyOf with a null branch becomes NullableType; string format is preserved on PrimitiveType.",
        ),
        pytest.param(
            [
                {
                    "openapi": "3.1.0",
                    "info": {"title": "Test API", "version": "1.0.0"},
                    "paths": {
                        "/events": {
                            "get": {
                                "operationId": "events:list",
                                "description": "List events",
                                "responses": {
                                    "200": {
                                        "description": "Success",
                                        "content": {
                                            "application/json": {
                                                "schema": {
                                                    "$ref": "#/components/schemas/Event"
                                                }
                                            }
                                        },
                                    }
                                },
                            }
                        }
                    },
                    "components": {
                        "schemas": {
                            "Event": {
                                "oneOf": [
                                    {"$ref": "#/components/schemas/SystemEvent"},
                                    {"$ref": "#/components/schemas/UserEvent"},
                                ],
                                "discriminator": {
                                    "propertyName": "source",
                                    "mapping": {
                                        "system": "#/components/schemas/SystemEvent",
                                        "user": "#/components/schemas/UserEvent",
                                    },
                                },
                                "title": "Event",
                            },
                            "SystemEvent": {
                                "type": "object",
                                "properties": {"source": {"type": "string"}},
                                "required": ["source"],
                                "title": "SystemEvent",
                            },
                            "UserEvent": {
                                "type": "object",
                                "properties": {"source": {"type": "string"}},
                                "required": ["source"],
                                "title": "UserEvent",
                            },
                        }
                    },
                }
            ],
            {
                "versions": [
                    {
                        "version": "1.0.0",
                        "servers": [],
                        "services": [
                            {
                                "name": "Events",
                                "services": [],
                                "methods": [
                                    {
                                        "name": "list",
                                        "description": "List events",
                                        "http_method": "GET",
                                        "path": "/events",
                                        "path_params": [],
                                        "query_params": [],
                                        "response": {
                                            "kind": "union_ref",
                                            "name": "Event",
                                        },
                                        "response_type": "json",
                                        "errors": [],
                                    }
                                ],
                            }
                        ],
                        "input_models": [],
                        "output_models": [
                            {
                                "name": "SystemEvent",
                                "fields": [
                                    {
                                        "name": "source",
                                        "type": _STRING,
                                        "required": True,
                                    }
                                ],
                            },
                            {
                                "name": "UserEvent",
                                "fields": [
                                    {
                                        "name": "source",
                                        "type": _STRING,
                                        "required": True,
                                    }
                                ],
                            },
                        ],
                        "webhooks": [],
                        "enums": [],
                        "input_unions": [],
                        "output_unions": [
                            {
                                "name": "Event",
                                "variants": [
                                    {"kind": "model", "name": "SystemEvent"},
                                    {"kind": "model", "name": "UserEvent"},
                                ],
                                "discriminator": {
                                    "property_name": "source",
                                    "mapping": {
                                        "system": "SystemEvent",
                                        "user": "UserEvent",
                                    },
                                },
                                "composition_kind": "oneOf",
                            }
                        ],
                    }
                ]
            },
            id="oneOf discriminated union becomes a NamedUnion with UnionRef at the call site; variants are added to models.",
        ),
        pytest.param(
            [
                {
                    "openapi": "3.1.0",
                    "info": {"title": "Test API", "version": "1.0.0"},
                    "paths": {
                        "/payments": {
                            "get": {
                                "operationId": "payments:list",
                                "description": "List payments",
                                "responses": {
                                    "200": {
                                        "description": "Success",
                                        "content": {
                                            "application/json": {
                                                "schema": {
                                                    "$ref": "#/components/schemas/Payment"
                                                }
                                            }
                                        },
                                    }
                                },
                            }
                        }
                    },
                    "components": {
                        "schemas": {
                            "Payment": {
                                "anyOf": [
                                    {"$ref": "#/components/schemas/CardPayment"},
                                    {"$ref": "#/components/schemas/BankPayment"},
                                ],
                                "title": "Payment",
                            },
                            "CardPayment": {
                                "type": "object",
                                "properties": {"last4": {"type": "string"}},
                                "required": ["last4"],
                                "title": "CardPayment",
                            },
                            "BankPayment": {
                                "type": "object",
                                "properties": {"iban": {"type": "string"}},
                                "required": ["iban"],
                                "title": "BankPayment",
                            },
                        }
                    },
                }
            ],
            {
                "versions": [
                    {
                        "version": "1.0.0",
                        "servers": [],
                        "services": [
                            {
                                "name": "Payments",
                                "services": [],
                                "methods": [
                                    {
                                        "name": "list",
                                        "description": "List payments",
                                        "http_method": "GET",
                                        "path": "/payments",
                                        "path_params": [],
                                        "query_params": [],
                                        "response": {
                                            "kind": "union_ref",
                                            "name": "Payment",
                                        },
                                        "response_type": "json",
                                        "errors": [],
                                    }
                                ],
                            }
                        ],
                        "input_models": [],
                        "output_models": [
                            {
                                "name": "BankPayment",
                                "fields": [
                                    {"name": "iban", "type": _STRING, "required": True}
                                ],
                            },
                            {
                                "name": "CardPayment",
                                "fields": [
                                    {"name": "last4", "type": _STRING, "required": True}
                                ],
                            },
                        ],
                        "webhooks": [],
                        "enums": [],
                        "input_unions": [],
                        "output_unions": [
                            {
                                "name": "Payment",
                                "variants": [
                                    {"kind": "model", "name": "CardPayment"},
                                    {"kind": "model", "name": "BankPayment"},
                                ],
                                "composition_kind": "anyOf",
                            }
                        ],
                    }
                ]
            },
            id="anyOf union without discriminator also becomes a NamedUnion; no discriminator field emitted.",
        ),
        pytest.param(
            [
                {
                    "openapi": "3.1.0",
                    "info": {"title": "Test API", "version": "1.0.0"},
                    "paths": {
                        "/metadata": {
                            "get": {
                                "operationId": "metadata:get",
                                "description": "Get metadata",
                                "responses": {
                                    "200": {
                                        "description": "Success",
                                        "content": {
                                            "application/json": {
                                                "schema": {
                                                    "$ref": "#/components/schemas/Metadata"
                                                }
                                            }
                                        },
                                    }
                                },
                            }
                        }
                    },
                    "components": {
                        "schemas": {
                            "Metadata": {
                                "type": "object",
                                "additionalProperties": {
                                    "anyOf": [
                                        {"type": "string"},
                                        {"type": "integer"},
                                        {"type": "boolean"},
                                    ]
                                },
                                "title": "Metadata",
                            }
                        }
                    },
                }
            ],
            {
                "versions": [
                    {
                        "version": "1.0.0",
                        "servers": [],
                        "services": [
                            {
                                "name": "Metadata",
                                "services": [],
                                "methods": [
                                    {
                                        "name": "get",
                                        "description": "Get metadata",
                                        "http_method": "GET",
                                        "path": "/metadata",
                                        "path_params": [],
                                        "query_params": [],
                                        "response": {
                                            "kind": "model",
                                            "name": "Metadata",
                                        },
                                        "response_type": "json",
                                        "errors": [],
                                    }
                                ],
                            }
                        ],
                        "input_models": [],
                        "output_models": [
                            {
                                "name": "Metadata",
                                "fields": [],
                            }
                        ],
                        "webhooks": [],
                        "enums": [],
                        "input_unions": [],
                        "output_unions": [],
                    }
                ]
            },
            id="additionalProperties-only objects become MapType; Metadata model fields are empty (no explicit properties).",
        ),
        pytest.param(
            [
                {
                    "openapi": "3.1.0",
                    "info": {"title": "Test API", "version": "1.0.0"},
                    "paths": {
                        "/products/{id}": {
                            "get": {
                                "operationId": "products:get",
                                "description": "Get a product",
                                "parameters": [
                                    {
                                        "name": "id",
                                        "in": "path",
                                        "schema": {"type": "string"},
                                        "required": True,
                                    }
                                ],
                                "responses": {
                                    "200": {
                                        "description": "Success",
                                        "content": {
                                            "application/json": {
                                                "schema": {
                                                    "$ref": "#/components/schemas/Product"
                                                }
                                            }
                                        },
                                    },
                                    "404": {
                                        "description": "Not found",
                                        "content": {
                                            "application/json": {
                                                "schema": {
                                                    "$ref": "#/components/schemas/NotFound"
                                                }
                                            }
                                        },
                                    },
                                    "422": {
                                        "description": "Validation error",
                                        "content": {
                                            "application/json": {
                                                "schema": {
                                                    "$ref": "#/components/schemas/ValidationError"
                                                }
                                            }
                                        },
                                    },
                                    "503": {
                                        "description": "Service unavailable — no body",
                                    },
                                },
                            }
                        }
                    },
                    "components": {
                        "schemas": {
                            "Product": {
                                "type": "object",
                                "properties": {"id": {"type": "string"}},
                                "required": ["id"],
                                "title": "Product",
                            },
                            "NotFound": {
                                "type": "object",
                                "properties": {"detail": {"type": "string"}},
                                "title": "NotFound",
                            },
                            "ValidationError": {
                                "type": "object",
                                "properties": {"detail": {"type": "string"}},
                                "title": "ValidationError",
                            },
                        }
                    },
                }
            ],
            {
                "versions": [
                    {
                        "version": "1.0.0",
                        "servers": [],
                        "services": [
                            {
                                "name": "Products",
                                "services": [],
                                "methods": [
                                    {
                                        "name": "get",
                                        "description": "Get a product",
                                        "http_method": "GET",
                                        "path": "/products/{id}",
                                        "path_params": [
                                            {
                                                "name": "id",
                                                "parameter_name": "id",
                                                "type": _STRING,
                                                "required": True,
                                            }
                                        ],
                                        "query_params": [],
                                        "response": {
                                            "kind": "model",
                                            "name": "Product",
                                        },
                                        "response_type": "json",
                                        "errors": [
                                            {
                                                "name": "NotFound",
                                                "status_code": 404,
                                                "response_type": "json",
                                                "type": {
                                                    "kind": "model",
                                                    "name": "NotFound",
                                                },
                                                "description": "Not found",
                                            },
                                            {
                                                "name": "ValidationError",
                                                "status_code": 422,
                                                "response_type": "json",
                                                "type": {
                                                    "kind": "model",
                                                    "name": "ValidationError",
                                                },
                                                "description": "Validation error",
                                            },
                                            {
                                                "name": "Get503Error",
                                                "status_code": 503,
                                                "response_type": "none",
                                                "description": "Service unavailable — no body",
                                            },
                                        ],
                                    }
                                ],
                            }
                        ],
                        "input_models": [],
                        "output_models": [
                            {
                                "name": "NotFound",
                                "fields": [
                                    {
                                        "name": "detail",
                                        "type": _STRING,
                                        "required": False,
                                    },
                                ],
                            },
                            {
                                "name": "Product",
                                "fields": [
                                    {"name": "id", "type": _STRING, "required": True},
                                ],
                            },
                            {
                                "name": "ValidationError",
                                "fields": [
                                    {
                                        "name": "detail",
                                        "type": _STRING,
                                        "required": False,
                                    },
                                ],
                            },
                        ],
                        "webhooks": [],
                        "enums": [],
                        "input_unions": [],
                        "output_unions": [],
                    }
                ]
            },
            id="Non-2xx responses become ErrorResponse entries sorted by status code; body-less errors omit type.",
        ),
        pytest.param(
            [
                {
                    "openapi": "3.1.0",
                    "info": {"title": "Test API", "version": "1.0.0"},
                    "paths": {
                        "/items": {
                            "get": {
                                "operationId": "items:list",
                                "description": "List items",
                                "responses": {
                                    "200": {
                                        "description": "Success",
                                        "content": {
                                            "application/json": {
                                                "schema": {
                                                    "$ref": "#/components/schemas/Item"
                                                }
                                            }
                                        },
                                    }
                                },
                            },
                            "post": {
                                "operationId": "items:create",
                                "description": "Create an item",
                                "requestBody": {
                                    "required": True,
                                    "content": {
                                        "application/json": {
                                            "schema": {
                                                "$ref": "#/components/schemas/ItemCreate"
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
                                                    "$ref": "#/components/schemas/Item"
                                                }
                                            }
                                        },
                                    }
                                },
                            },
                        },
                        "/items/{id}": {
                            "put": {
                                "operationId": "items:update",
                                "description": "Update an item",
                                "requestBody": {
                                    "required": True,
                                    "content": {
                                        "application/json": {
                                            "schema": {
                                                "$ref": "#/components/schemas/Item"
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
                                                    "$ref": "#/components/schemas/Item"
                                                }
                                            }
                                        },
                                    }
                                },
                            }
                        },
                    },
                    "components": {
                        "schemas": {
                            "ItemCreate": {
                                "type": "object",
                                "properties": {"name": {"type": "string"}},
                                "title": "ItemCreate",
                            },
                            "Item": {
                                "type": "object",
                                "properties": {
                                    "id": {"type": "string"},
                                    "name": {"type": "string"},
                                },
                                "required": ["id", "name"],
                                "title": "Item",
                            },
                        }
                    },
                }
            ],
            {
                "versions": [
                    {
                        "version": "1.0.0",
                        "servers": [],
                        "services": [
                            {
                                "name": "Items",
                                "services": [],
                                "methods": [
                                    {
                                        "name": "list",
                                        "description": "List items",
                                        "http_method": "GET",
                                        "path": "/items",
                                        "path_params": [],
                                        "query_params": [],
                                        "response": {"kind": "model", "name": "Item"},
                                        "response_type": "json",
                                        "errors": [],
                                    },
                                    {
                                        "name": "create",
                                        "description": "Create an item",
                                        "http_method": "POST",
                                        "path": "/items",
                                        "path_params": [],
                                        "query_params": [],
                                        "body": {"kind": "model", "name": "ItemCreate"},
                                        "response": {"kind": "model", "name": "Item"},
                                        "response_type": "json",
                                        "errors": [],
                                    },
                                    {
                                        "name": "update",
                                        "description": "Update an item",
                                        "http_method": "PUT",
                                        "path": "/items/{id}",
                                        "path_params": [],
                                        "query_params": [],
                                        "body": {"kind": "model", "name": "Item"},
                                        "response": {"kind": "model", "name": "Item"},
                                        "response_type": "json",
                                        "errors": [],
                                    },
                                ],
                            }
                        ],
                        "input_models": [
                            {
                                "name": "Item",
                                "fields": [
                                    {"name": "id", "type": _STRING, "required": True},
                                    {"name": "name", "type": _STRING, "required": True},
                                ],
                            },
                            {
                                "name": "ItemCreate",
                                "fields": [
                                    {
                                        "name": "name",
                                        "type": _STRING,
                                        "required": False,
                                    },
                                ],
                            },
                        ],
                        "output_models": [
                            {
                                "name": "Item",
                                "fields": [
                                    {"name": "id", "type": _STRING, "required": True},
                                    {"name": "name", "type": _STRING, "required": True},
                                ],
                            },
                        ],
                        "webhooks": [],
                        "enums": [],
                        "input_unions": [],
                        "output_unions": [],
                    }
                ]
            },
            id="Models used in request body appear in input_models; models used in responses appear in output_models; models used in both appear in both lists.",
        ),
        pytest.param(
            [
                {
                    "openapi": "3.1.0",
                    "info": {"title": "Test API", "version": "1.0.0"},
                    "paths": {
                        "/items": {
                            "post": {
                                "operationId": "items:create",
                                "description": "Create an item",
                                "requestBody": {
                                    "required": True,
                                    "content": {
                                        "application/json": {
                                            "schema": {
                                                "$ref": "#/components/schemas/Item-Create"
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
                                                    "$ref": "#/components/schemas/Item-Response"
                                                }
                                            }
                                        },
                                    }
                                },
                            }
                        },
                    },
                    "components": {
                        "schemas": {
                            "Item-Create": {
                                "type": "object",
                                "properties": {"name": {"type": "string"}},
                                "title": "Item-Create",
                            },
                            "Item-Response": {
                                "type": "object",
                                "properties": {
                                    "id": {"type": "string"},
                                    "name": {"type": "string"},
                                },
                                "required": ["id", "name"],
                                "title": "Item-Response",
                            },
                        }
                    },
                }
            ],
            {
                "versions": [
                    {
                        "version": "1.0.0",
                        "servers": [],
                        "services": [
                            {
                                "name": "Items",
                                "services": [],
                                "methods": [
                                    {
                                        "name": "create",
                                        "description": "Create an item",
                                        "http_method": "POST",
                                        "path": "/items",
                                        "path_params": [],
                                        "query_params": [],
                                        "body": {"kind": "model", "name": "ItemCreate"},
                                        "response": {
                                            "kind": "model",
                                            "name": "ItemResponse",
                                        },
                                        "response_type": "json",
                                        "errors": [],
                                    }
                                ],
                            }
                        ],
                        "input_models": [
                            {
                                "name": "ItemCreate",
                                "fields": [
                                    {
                                        "name": "name",
                                        "type": _STRING,
                                        "required": False,
                                    },
                                ],
                            },
                        ],
                        "output_models": [
                            {
                                "name": "ItemResponse",
                                "fields": [
                                    {"name": "id", "type": _STRING, "required": True},
                                    {"name": "name", "type": _STRING, "required": True},
                                ],
                            },
                        ],
                        "webhooks": [],
                        "enums": [],
                        "input_unions": [],
                        "output_unions": [],
                    }
                ]
            },
            id="Models with non-normalized names (dashes) in components.schemas are correctly resolved",
        ),
        pytest.param(
            [
                {
                    "openapi": "3.1.0",
                    "info": {"title": "Test API", "version": "1.0.0"},
                    "paths": {
                        "/checkout": {
                            "post": {
                                "operationId": "checkout:create",
                                "description": "Create checkout",
                                "requestBody": {
                                    "required": True,
                                    "content": {
                                        "application/json": {
                                            "schema": {
                                                "$ref": "#/components/schemas/CheckoutCreate"
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
                                                    "$ref": "#/components/schemas/CheckoutCreate"
                                                }
                                            }
                                        },
                                    }
                                },
                            }
                        },
                    },
                    "components": {
                        "schemas": {
                            "CheckoutCreate": {
                                "$ref": "#/components/schemas/CheckoutProductsCreate"
                            },
                            "CheckoutProductsCreate": {
                                "type": "object",
                                "properties": {
                                    "product_id": {"type": "string"},
                                    "quantity": {"type": "integer"},
                                },
                                "required": ["product_id", "quantity"],
                                "title": "CheckoutProductsCreate",
                            },
                        }
                    },
                }
            ],
            {
                "versions": [
                    {
                        "version": "1.0.0",
                        "servers": [],
                        "services": [
                            {
                                "name": "Checkout",
                                "services": [],
                                "methods": [
                                    {
                                        "name": "create",
                                        "description": "Create checkout",
                                        "http_method": "POST",
                                        "path": "/checkout",
                                        "path_params": [],
                                        "query_params": [],
                                        "body": {
                                            "kind": "model",
                                            "name": "CheckoutCreate",
                                        },
                                        "response": {
                                            "kind": "model",
                                            "name": "CheckoutCreate",
                                        },
                                        "response_type": "json",
                                        "errors": [],
                                    }
                                ],
                            }
                        ],
                        "input_models": [
                            {
                                "name": "CheckoutCreate",
                                "fields": [
                                    {
                                        "name": "product_id",
                                        "type": _STRING,
                                        "required": True,
                                    },
                                    {
                                        "name": "quantity",
                                        "type": {
                                            "kind": "primitive",
                                            "type": "integer",
                                        },
                                        "required": True,
                                    },
                                ],
                            },
                        ],
                        "output_models": [
                            {
                                "name": "CheckoutCreate",
                                "fields": [
                                    {
                                        "name": "product_id",
                                        "type": _STRING,
                                        "required": True,
                                    },
                                    {
                                        "name": "quantity",
                                        "type": {
                                            "kind": "primitive",
                                            "type": "integer",
                                        },
                                        "required": True,
                                    },
                                ],
                            },
                        ],
                        "webhooks": [],
                        "enums": [],
                        "input_unions": [],
                        "output_unions": [],
                    }
                ]
            },
            id="Schema in components that is a reference to another schema is resolved",
        ),
        pytest.param(
            [
                {
                    "openapi": "3.1.0",
                    "info": {"title": "Test API", "version": "1.0.0"},
                    "paths": {
                        "/payment": {
                            "get": {
                                "operationId": "payment:get",
                                "description": "Get payment method",
                                "responses": {
                                    "200": {
                                        "description": "Success",
                                        "content": {
                                            "application/json": {
                                                "schema": {
                                                    "$ref": "#/components/schemas/APaymentMethod"
                                                }
                                            }
                                        },
                                    }
                                },
                            }
                        }
                    },
                    "components": {
                        "schemas": {
                            "VisaCard": {
                                "type": "object",
                                "properties": {"card_type": {"type": "string"}},
                                "required": ["card_type"],
                                "title": "VisaCard",
                            },
                            "Mastercard": {
                                "type": "object",
                                "properties": {"card_type": {"type": "string"}},
                                "required": ["card_type"],
                                "title": "Mastercard",
                            },
                            "BankPayment": {
                                "type": "object",
                                "properties": {"iban": {"type": "string"}},
                                "required": ["iban"],
                                "title": "BankPayment",
                            },
                            "ZCardPayment": {
                                "anyOf": [
                                    {"$ref": "#/components/schemas/VisaCard"},
                                    {"$ref": "#/components/schemas/Mastercard"},
                                ],
                                "title": "ZCardPayment",
                            },
                            "APaymentMethod": {
                                "anyOf": [
                                    {"$ref": "#/components/schemas/ZCardPayment"},
                                    {"$ref": "#/components/schemas/BankPayment"},
                                ],
                                "title": "APaymentMethod",
                            },
                        }
                    },
                }
            ],
            {
                "versions": [
                    {
                        "version": "1.0.0",
                        "servers": [],
                        "services": [
                            {
                                "name": "Payment",
                                "services": [],
                                "methods": [
                                    {
                                        "name": "get",
                                        "description": "Get payment method",
                                        "http_method": "GET",
                                        "path": "/payment",
                                        "path_params": [],
                                        "query_params": [],
                                        "response": {
                                            "kind": "union_ref",
                                            "name": "APaymentMethod",
                                        },
                                        "response_type": "json",
                                        "errors": [],
                                    }
                                ],
                            }
                        ],
                        "input_models": [],
                        "output_models": [
                            {
                                "name": "BankPayment",
                                "fields": [
                                    {"name": "iban", "type": _STRING, "required": True}
                                ],
                            },
                            {
                                "name": "Mastercard",
                                "fields": [
                                    {
                                        "name": "card_type",
                                        "type": _STRING,
                                        "required": True,
                                    }
                                ],
                            },
                            {
                                "name": "VisaCard",
                                "fields": [
                                    {
                                        "name": "card_type",
                                        "type": _STRING,
                                        "required": True,
                                    }
                                ],
                            },
                        ],
                        "webhooks": [],
                        "enums": [],
                        "input_unions": [],
                        "output_unions": [
                            {
                                "name": "ZCardPayment",
                                "variants": [
                                    {"kind": "model", "name": "VisaCard"},
                                    {"kind": "model", "name": "Mastercard"},
                                ],
                                "composition_kind": "anyOf",
                            },
                            {
                                "name": "APaymentMethod",
                                "variants": [
                                    {"kind": "union_ref", "name": "ZCardPayment"},
                                    {"kind": "model", "name": "BankPayment"},
                                ],
                                "composition_kind": "anyOf",
                            },
                        ],
                    }
                ]
            },
            id="Nested unions are ordered with child unions before parent unions",
        ),
        pytest.param(
            [
                {
                    "openapi": "3.1.0",
                    "info": {"title": "Test API", "version": "1.0.0"},
                    "paths": {
                        "/files/{id}": {
                            "post": {
                                "operationId": "files:upload",
                                "description": "Upload a file",
                                "parameters": [
                                    {
                                        "name": "id",
                                        "in": "path",
                                        "schema": {"type": "string"},
                                        "required": True,
                                    },
                                    {
                                        "name": "file_name",
                                        "in": "query",
                                        "schema": {"type": "string"},
                                        "required": False,
                                    },
                                ],
                                "requestBody": {
                                    "required": True,
                                    "content": {
                                        "application/json": {
                                            "schema": {
                                                "$ref": "#/components/schemas/FileUpload"
                                            }
                                        }
                                    },
                                },
                            }
                        }
                    },
                    "components": {
                        "schemas": {
                            "FileUpload": {
                                "type": "object",
                                "properties": {
                                    "id": {"type": "string"},
                                    "file_name": {"type": "string"},
                                    "file_size": {"type": "integer"},
                                },
                                "required": ["file_name", "file_size"],
                                "title": "FileUpload",
                            }
                        }
                    },
                }
            ],
            {
                "versions": [
                    {
                        "version": "1.0.0",
                        "servers": [],
                        "services": [
                            {
                                "name": "Files",
                                "services": [],
                                "methods": [
                                    {
                                        "name": "upload",
                                        "description": "Upload a file",
                                        "http_method": "POST",
                                        "path": "/files/{id}",
                                        "path_params": [
                                            {
                                                "name": "id",
                                                "parameter_name": "id_path",
                                                "type": _STRING,
                                                "required": True,
                                            }
                                        ],
                                        "query_params": [
                                            {
                                                "name": "file_name",
                                                "parameter_name": "file_name_query",
                                                "type": _STRING,
                                                "required": False,
                                            }
                                        ],
                                        "body": {"kind": "model", "name": "FileUpload"},
                                        "response_type": "none",
                                        "errors": [],
                                    }
                                ],
                            }
                        ],
                        "input_models": [
                            {
                                "name": "FileUpload",
                                "fields": [
                                    {"name": "id", "type": _STRING, "required": False},
                                    {
                                        "name": "file_name",
                                        "type": _STRING,
                                        "required": True,
                                    },
                                    {
                                        "name": "file_size",
                                        "type": {
                                            "kind": "primitive",
                                            "type": "integer",
                                        },
                                        "required": True,
                                    },
                                ],
                            }
                        ],
                        "output_models": [],
                        "webhooks": [],
                        "enums": [],
                        "input_unions": [],
                        "output_unions": [],
                    }
                ]
            },
            id="Path/Query parameters conflicting with body parameters are correctly resolved",
        ),
        pytest.param(
            [
                {
                    "openapi": "3.1.0",
                    "info": {"title": "Test API", "version": "1.0.0"},
                    "paths": {
                        "/export": {
                            "get": {
                                "operationId": "export:data",
                                "description": "Export data as CSV",
                                "responses": {
                                    "200": {
                                        "description": "CSV export",
                                        "content": {
                                            "text/csv": {"schema": {"type": "string"}}
                                        },
                                    }
                                },
                            }
                        },
                        "/export-json": {
                            "get": {
                                "operationId": "export:json",
                                "description": "Export data as JSON",
                                "responses": {
                                    "200": {
                                        "description": "JSON export",
                                        "content": {
                                            "application/json": {
                                                "schema": {"type": "object"}
                                            }
                                        },
                                    }
                                },
                            }
                        },
                        "/export-mixed": {
                            "get": {
                                "operationId": "export:mixed",
                                "description": "Export with both CSV and JSON",
                                "responses": {
                                    "200": {
                                        "description": "Mixed export",
                                        "content": {
                                            "application/json": {
                                                "schema": {"type": "object"}
                                            },
                                            "text/csv": {"schema": {"type": "string"}},
                                        },
                                    }
                                },
                            }
                        },
                        "/export-none": {
                            "get": {
                                "operationId": "export:none",
                                "description": "Export with no content type",
                                "responses": {
                                    "200": {"description": "No content type specified"}
                                },
                            }
                        },
                    },
                }
            ],
            {
                "versions": [
                    {
                        "version": "1.0.0",
                        "servers": [],
                        "services": [
                            {
                                "name": "Export",
                                "services": [],
                                "methods": [
                                    {
                                        "name": "data",
                                        "description": "Export data as CSV",
                                        "http_method": "GET",
                                        "path": "/export",
                                        "path_params": [],
                                        "query_params": [],
                                        "response_type": "text",
                                        "response": {
                                            "kind": "primitive",
                                            "type": "string",
                                        },
                                        "errors": [],
                                    },
                                    {
                                        "name": "json",
                                        "description": "Export data as JSON",
                                        "http_method": "GET",
                                        "path": "/export-json",
                                        "path_params": [],
                                        "query_params": [],
                                        "response_type": "json",
                                        "response": {
                                            "kind": "primitive",
                                            "type": "unknown",
                                        },
                                        "errors": [],
                                    },
                                    {
                                        "name": "mixed",
                                        "description": "Export with both CSV and JSON",
                                        "http_method": "GET",
                                        "path": "/export-mixed",
                                        "path_params": [],
                                        "query_params": [],
                                        "response_type": "json",
                                        "response": {
                                            "kind": "primitive",
                                            "type": "unknown",
                                        },
                                        "errors": [],
                                    },
                                    {
                                        "name": "none",
                                        "description": "Export with no content type",
                                        "http_method": "GET",
                                        "path": "/export-none",
                                        "path_params": [],
                                        "query_params": [],
                                        "response_type": "none",
                                        "errors": [],
                                    },
                                ],
                            },
                        ],
                        "input_models": [],
                        "output_models": [],
                        "webhooks": [],
                        "enums": [],
                        "input_unions": [],
                        "output_unions": [],
                    }
                ]
            },
            id="Response type is determined from content types (JSON vs text vs none)",
        ),
        pytest.param(
            [
                {
                    "openapi": "3.1.0",
                    "info": {"title": "Test API", "version": "1.0.0"},
                    "servers": [
                        {
                            "url": "https://api.example.com",
                            "description": "Production environment",
                            "x-polar-environment": "production",
                        },
                        {
                            "url": "https://sandbox-api.example.com",
                            "description": "Sandbox environment",
                            "x-polar-environment": "sandbox",
                        },
                    ],
                    "paths": {},
                }
            ],
            {
                "versions": [
                    {
                        "version": "1.0.0",
                        "servers": [
                            {
                                "environment": "production",
                                "url": "https://api.example.com",
                                "description": "Production environment",
                            },
                            {
                                "environment": "sandbox",
                                "url": "https://sandbox-api.example.com",
                                "description": "Sandbox environment",
                            },
                        ],
                        "services": [],
                        "input_models": [],
                        "output_models": [],
                        "webhooks": [],
                        "enums": [],
                        "input_unions": [],
                        "output_unions": [],
                    }
                ]
            },
            id="Servers use the Polar environment extension",
        ),
        pytest.param(
            [
                {
                    "openapi": "3.1.0",
                    "info": {"title": "Test API", "version": "1.0.0"},
                    "paths": {},
                },
                {
                    "openapi": "3.1.0",
                    "info": {"title": "Test API", "version": "2.0.0"},
                    "paths": {},
                },
            ],
            {
                "versions": [
                    {
                        "version": "1.0.0",
                        "servers": [],
                        "services": [],
                        "input_models": [],
                        "output_models": [],
                        "webhooks": [],
                        "enums": [],
                        "input_unions": [],
                        "output_unions": [],
                    },
                    {
                        "version": "2.0.0",
                        "servers": [],
                        "services": [],
                        "input_models": [],
                        "output_models": [],
                        "webhooks": [],
                        "enums": [],
                        "input_unions": [],
                        "output_unions": [],
                    },
                ]
            },
            id="Multiple versions",
        ),
    ],
)
def test_ir_generation(
    specs: list[dict[typing.Any, typing.Any]], expected: dict[typing.Any, typing.Any]
) -> None:
    """Test that the IR is generated correctly from the OpenAPI spec."""
    ir = generate_ir(*(op.OpenAPI.model_validate(spec) for spec in specs))

    assert ir.model_dump(mode="json", exclude_none=True) == expected
