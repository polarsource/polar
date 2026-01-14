# Backoffice Development Guide

Internal admin UI using HTMX + DaisyUI + tagflow for server-rendered HTML.

## Key Imports

```python
from tagflow import classes, document, tag, text
from fastapi import Request
from fastapi.responses import HTMLResponse

from polar.backoffice.responses import HXRedirectResponse
from polar.backoffice.toast import add_toast
from polar.backoffice.components import datatable, description_list, modal, accordion
```

## Endpoint Pattern

```python
from fastapi.responses import HTMLResponse

router = APIRouter(prefix="/backoffice/resources", tags=["backoffice"])

@router.get("/", response_class=HTMLResponse)
async def list_page(
    request: Request,
    session: AsyncReadSession = Depends(get_db_read_session),
) -> str:
    repository = ResourceRepository.from_session(session)
    resources = await repository.get_all(repository.get_base_statement())

    with document() as doc:
        with tag.div(classes="container mx-auto p-4"):
            with tag.h1(classes="text-2xl font-bold mb-4"):
                text("Resources")
            # ... render content

    return doc.render()
```

## tagflow HTML Builder

```python
from tagflow import classes, tag, text

# Basic elements
with tag.div(classes="flex gap-4"):
    with tag.span(classes="text-gray-500"):
        text("Label")

# Dynamic classes
with tag.div(classes="badge"):
    if status == "active":
        classes("badge-success")
    elif status == "pending":
        classes("badge-warning")
    else:
        classes("badge-secondary")
    text(status)

# Attributes
with tag.a(href=f"/backoffice/resources/{resource.id}", classes="link"):
    text(resource.name)

# HTMX attributes
with tag.button(
    classes="btn btn-primary",
    hx_post=f"/backoffice/resources/{resource.id}/action",
    hx_target="#result",
    hx_swap="innerHTML",
):
    text("Submit")
```

## DaisyUI Components

### Badges

```python
with tag.div(classes="badge badge-success"):
    text("Active")

with tag.div(classes="badge badge-warning"):
    text("Pending")

with tag.div(classes="badge badge-error"):
    text("Failed")
```

### Cards

```python
with tag.div(classes="card bg-base-100 shadow-xl"):
    with tag.div(classes="card-body"):
        with tag.h2(classes="card-title"):
            text("Title")
        with tag.p():
            text("Content")
        with tag.div(classes="card-actions justify-end"):
            with tag.button(classes="btn btn-primary"):
                text("Action")
```

### Modals

```python
from polar.backoffice.components.modal import modal_trigger, modal_content

# Trigger button
with modal_trigger("modal-id", classes="btn btn-sm"):
    text("Open Modal")

# Modal content
with modal_content("modal-id", title="Confirm Action"):
    with tag.p():
        text("Are you sure?")
    with tag.div(classes="modal-action"):
        with tag.button(classes="btn btn-error"):
            text("Confirm")
```

### Accordions

```python
from polar.backoffice.components.accordion import accordion, accordion_item

with accordion():
    with accordion_item("Details", open=True):
        text("Content here")
    with accordion_item("Advanced"):
        text("More content")
```

## Datatables

```python
from polar.backoffice.components import datatable

class ResourceDatatable(datatable.Datatable[Resource, ResourceSortProperty]):
    def columns(self) -> list[datatable.DatatableColumn]:
        return [
            datatable.DatatableAttrColumn("Name", "name"),
            ResourceStatusColumn(),
            datatable.DatatableDateColumn("Created", "created_at"),
        ]

class ResourceStatusColumn(datatable.DatatableColumn[Resource, ResourceSortProperty]):
    def render(self, request: Request, item: Resource) -> Generator[None] | None:
        with tag.div(classes="badge"):
            if item.status == "active":
                classes("badge-success")
            text(item.status)
        return None
```

## Description Lists

```python
from polar.backoffice.components.description_list import description_list, dl_item

with description_list():
    with dl_item("Name"):
        text(resource.name)
    with dl_item("Status"):
        with tag.div(classes="badge badge-success"):
            text(resource.status)
    with dl_item("Created"):
        text(resource.created_at.strftime("%Y-%m-%d"))
```

## Forms

```python
from pydantic import BaseModel
from polar.backoffice.components.input import text_input, select_input, textarea_input

class UpdateResourceForm(BaseModel):
    name: str
    status: str

@router.post("/{id}/update", response_class=HTMLResponse)
async def update_resource(
    request: Request,
    id: UUID,
    form: UpdateResourceForm,
    session: AsyncSession = Depends(get_db_session),
) -> Response:
    # Update logic...
    add_toast(request, "Resource updated", type="success")
    return HXRedirectResponse(f"/backoffice/resources/{id}")
```

## HTMX Patterns

### Redirects

```python
from polar.backoffice.responses import HXRedirectResponse

# After form submission
return HXRedirectResponse("/backoffice/resources")
```

### Toast Notifications

```python
from polar.backoffice.toast import add_toast

add_toast(request, "Success message", type="success")
add_toast(request, "Error message", type="error")
add_toast(request, "Warning message", type="warning")
```

### Partial Updates

```python
# In template - target specific element
with tag.button(
    hx_get="/backoffice/resources/partial",
    hx_target="#resource-list",
    hx_swap="innerHTML",
):
    text("Refresh")

# Endpoint returns only the partial HTML
@router.get("/partial", response_class=HTMLResponse)
async def get_partial(...) -> str:
    # Return only the content to be swapped
```

## Reference Files

- Organizations backoffice: `polar/backoffice/organizations/`
- Customers backoffice: `polar/backoffice/customers/`
- Components: `polar/backoffice/components/`
- Base templates: `polar/backoffice/templates/`
