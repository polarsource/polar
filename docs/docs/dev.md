# Page title (h1)

Hello world

### Standard writing stuff (h3)

I can even do a link to [Polar.sh](https://polar.sh). Or why not a list?

- This
- Is
- So
- Awesome

Or **bold**. What about italic? _Yeah that's nice_.

### Code blocks

I like to code too.

```py
async def update_issue_reference_state(
    self,
    session: AsyncSession,
    issue: Issue,
) -> None:
    refs = await self.list_issue_references(session, issue)

    in_progress = False
    pull_request = False

    for r in refs:
        if r.pull_request and not r.pull_request.is_draft:
            pull_request = True
        else:
            in_progress = True

    stmt = (
        sql.update(Issue)
        .where(Issue.id == issue.id)
        .values(
            issue_has_in_progress_relationship=in_progress,
            issue_has_pull_request_relationship=pull_request,
        )
    )

    await session.execute(stmt)
    await session.commit()
```

The `#!python range()` function is used to generate a sequence of numbers.

### Tables

And Bobby likes tables.

| Column 1 | Column 2 |
| -------- | -------- |
| 123      | 455      |

### Annotations

Lorem ipsum dolor sit amet, (1) consectetur adipiscing elit.
{ .annotate }

1.  I'm an annotation! I can contain `code`, **formatted
    text**, images, ... basically anything that can be expressed in Markdown.

### Button

[Subscribe to our newsletter](#){ .md-button }
[Subscribe to our newsletter](#){ .md-button .md-button--primary }

### Admonition

!!! note

    Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nulla et euismod
    nulla. Curabitur feugiat, tortor non consequat finibus, justo purus auctor
    massa, nec semper lorem quam in massa.
