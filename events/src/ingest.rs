use std::collections::{BTreeSet, HashMap, HashSet};

use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
};
use chrono::Utc;
use serde::Serialize;
use serde_json::json;
use sqlx::{PgConnection, types::Json};
use uuid::Uuid;

use crate::{
    app::error_response,
    event::{CustomerReference, EventCreate, LocItem, ValidationError},
    telemetry,
};

#[derive(Serialize)]
pub struct IngestResponse {
    pub inserted: usize,
    pub duplicates: usize,
}

pub struct StagedEvents<'a> {
    pub inserted: Vec<&'a EventCreate>,
    pub duplicates: usize,
}

pub enum IngestError {
    StagedIngestDisabled,
    InvalidPayload(Vec<ValidationError>),
    InvalidReferences(Vec<ValidationError>),
    EventTypeUnavailable,
    Database(sqlx::Error),
    Interrupted(tokio::task::JoinError),
    TimedOut,
}

impl From<sqlx::Error> for IngestError {
    fn from(error: sqlx::Error) -> Self {
        Self::Database(error)
    }
}

impl IntoResponse for IngestError {
    fn into_response(self) -> Response {
        match self {
            Self::InvalidPayload(errors) => error_response(
                StatusCode::UNPROCESSABLE_ENTITY,
                "RequestValidationError",
                errors,
            ),
            Self::InvalidReferences(errors) => error_response(
                StatusCode::UNPROCESSABLE_ENTITY,
                "PolarRequestValidationError",
                errors,
            ),
            Self::StagedIngestDisabled => error_response(
                StatusCode::NOT_IMPLEMENTED,
                "StagedEventsIngestDisabled",
                "This service only ingests events for organizations with staged ingestion enabled.",
            ),
            Self::EventTypeUnavailable => {
                tracing::error!("event type could not be created");
                StatusCode::INTERNAL_SERVER_ERROR.into_response()
            }
            Self::TimedOut => error_response(
                StatusCode::GATEWAY_TIMEOUT,
                "IngestTimedOut",
                "Storing the events took too long. None of them were stored.",
            ),
            Self::Interrupted(error) => {
                tracing::error!(%error, "event ingestion task failed");
                StatusCode::INTERNAL_SERVER_ERROR.into_response()
            }
            Self::Database(error) => {
                telemetry::log_database_error(&error, "event ingestion");
                StatusCode::INTERNAL_SERVER_ERROR.into_response()
            }
        }
    }
}

pub async fn validate_references(
    connection: &mut PgConnection,
    organization_id: Uuid,
    events: &[EventCreate],
) -> Result<(), IngestError> {
    let mut customer_ids = HashSet::new();
    let mut member_ids = HashSet::new();
    for event in events {
        if let CustomerReference::Polar {
            customer_id,
            member_id,
        } = &event.customer
        {
            customer_ids.insert(*customer_id);
            member_ids.extend(*member_id);
        }
    }

    let customers = existing_ids(
        connection,
        "SELECT id FROM customers \
         WHERE deleted_at IS NULL AND id = ANY($1) AND organization_id = $2",
        customer_ids,
        organization_id,
    )
    .await?;
    let members = existing_ids(
        connection,
        "SELECT id FROM members \
         WHERE deleted_at IS NULL AND id = ANY($1) AND organization_id = $2",
        member_ids,
        organization_id,
    )
    .await?;

    let errors = reference_errors(events, &customers, &members);
    if errors.is_empty() {
        Ok(())
    } else {
        Err(IngestError::InvalidReferences(errors))
    }
}

pub async fn resolve_event_types(
    connection: &mut PgConnection,
    organization_id: Uuid,
    events: &[EventCreate],
) -> Result<HashMap<String, Uuid>, IngestError> {
    let names: BTreeSet<&str> = events.iter().map(|event| event.name.as_str()).collect();
    let mut event_types = select_event_types(connection, organization_id, &names).await?;

    let missing: Vec<&str> = names
        .iter()
        .copied()
        .filter(|name| !event_types.contains_key(*name))
        .collect();
    if missing.is_empty() {
        return Ok(event_types);
    }

    let created: Vec<(String, Uuid)> = sqlx::query_as(
        "INSERT INTO event_types (id, created_at, name, label, organization_id) \
         SELECT new.id, now(), new.name, new.name, $1 \
         FROM UNNEST($2::uuid[], $3::text[]) AS new (id, name) \
         ON CONFLICT ON CONSTRAINT event_types_name_organization_id_key DO NOTHING \
         RETURNING name, id",
    )
    .bind(organization_id)
    .bind(Vec::from_iter(missing.iter().map(|_| Uuid::new_v4())))
    .bind(&missing)
    .fetch_all(&mut *connection)
    .await?;
    if created.len() == missing.len() {
        event_types.extend(created);
        return Ok(event_types);
    }

    let event_types = select_event_types(connection, organization_id, &names).await?;
    if names.iter().any(|name| !event_types.contains_key(*name)) {
        return Err(IngestError::EventTypeUnavailable);
    }
    Ok(event_types)
}

pub async fn insert_staged_events<'a>(
    connection: &mut PgConnection,
    organization_id: Uuid,
    events: &'a [EventCreate],
    event_types: &HashMap<String, Uuid>,
) -> Result<StagedEvents<'a>, IngestError> {
    if events.is_empty() {
        return Ok(StagedEvents {
            inserted: Vec::new(),
            duplicates: 0,
        });
    }

    let ids = Vec::from_iter(events.iter().map(|_| Uuid::new_v4()));
    let mut event_type_ids = Vec::with_capacity(events.len());
    let mut customer_ids = Vec::with_capacity(events.len());
    let mut external_customer_ids = Vec::with_capacity(events.len());
    let mut member_ids = Vec::with_capacity(events.len());
    let mut external_member_ids = Vec::with_capacity(events.len());
    for event in events {
        let event_type_id = event_types
            .get(&event.name)
            .ok_or(IngestError::EventTypeUnavailable)?;
        event_type_ids.push(*event_type_id);
        let (customer_id, external_customer_id, member_id, external_member_id) =
            match &event.customer {
                CustomerReference::Polar {
                    customer_id,
                    member_id,
                } => (Some(*customer_id), None, *member_id, None),
                CustomerReference::External {
                    external_customer_id,
                    external_member_id,
                } => (
                    None,
                    Some(external_customer_id.as_str()),
                    None,
                    external_member_id.as_deref(),
                ),
            };
        customer_ids.push(customer_id);
        external_customer_ids.push(external_customer_id);
        member_ids.push(member_id);
        external_member_ids.push(external_member_id);
    }

    let staged: Vec<(Uuid, Option<String>)> = sqlx::query_as(
        "INSERT INTO staged_events (\
             id, ingested_at, timestamp, name, source, organization_id, customer_id, \
             external_customer_id, member_id, external_member_id, external_id, \
             pending_parent_external_id, event_type_id, user_metadata\
         ) \
         SELECT new.id, new.ingested_at, new.timestamp, new.name, 'user', $1, new.customer_id, \
             new.external_customer_id, new.member_id, new.external_member_id, new.external_id, \
             new.pending_parent_external_id, new.event_type_id, new.user_metadata \
         FROM UNNEST(\
             $2::uuid[], $3::timestamptz[], $4::text[], $5::uuid[], $6::text[], $7::uuid[], \
             $8::text[], $9::text[], $10::text[], $11::uuid[], $12::jsonb[], \
             $13::timestamptz[]\
         ) AS new (\
             id, timestamp, name, customer_id, external_customer_id, member_id, \
             external_member_id, external_id, pending_parent_external_id, event_type_id, \
             user_metadata, ingested_at\
         ) \
         ON CONFLICT (organization_id, external_id) WHERE external_id IS NOT NULL DO NOTHING \
         RETURNING id, external_id",
    )
    .bind(organization_id)
    .bind(&ids)
    .bind(Vec::from_iter(events.iter().map(|event| event.timestamp)))
    .bind(Vec::from_iter(
        events.iter().map(|event| event.name.as_str()),
    ))
    .bind(customer_ids)
    .bind(external_customer_ids)
    .bind(member_ids)
    .bind(external_member_ids)
    .bind(Vec::from_iter(
        events.iter().map(|event| event.external_id.as_deref()),
    ))
    .bind(Vec::from_iter(
        events.iter().map(|event| event.parent_id.as_deref()),
    ))
    .bind(event_type_ids)
    .bind(Vec::from_iter(
        events.iter().map(|event| Json(&event.metadata)),
    ))
    .bind(Vec::from_iter(events.iter().map(|_| Utc::now())))
    .fetch_all(&mut *connection)
    .await?;

    let mut inserted_ids: HashSet<Uuid> = staged.iter().map(|(id, _)| *id).collect();
    let external_ids = Vec::from_iter(
        staged
            .into_iter()
            .filter_map(|(_, external_id)| external_id),
    );
    if !external_ids.is_empty() {
        let already_moved: Vec<Uuid> = sqlx::query_scalar(
            "DELETE FROM staged_events \
             WHERE organization_id = $1 AND external_id IN (\
                 SELECT external_id FROM events \
                 WHERE organization_id = $1 AND external_id = ANY($2)\
             ) \
             RETURNING id",
        )
        .bind(organization_id)
        .bind(external_ids)
        .fetch_all(&mut *connection)
        .await?;
        for id in already_moved {
            inserted_ids.remove(&id);
        }
    }

    let inserted = Vec::from_iter(
        ids.iter()
            .zip(events)
            .filter(|(id, _)| inserted_ids.contains(*id))
            .map(|(_, event)| event),
    );
    Ok(StagedEvents {
        duplicates: events.len() - inserted.len(),
        inserted,
    })
}

async fn select_event_types(
    connection: &mut PgConnection,
    organization_id: Uuid,
    names: &BTreeSet<&str>,
) -> Result<HashMap<String, Uuid>, sqlx::Error> {
    sqlx::query_as(
        "SELECT name, id FROM event_types \
         WHERE organization_id = $1 AND name = ANY($2) AND deleted_at IS NULL",
    )
    .bind(organization_id)
    .bind(Vec::from_iter(names.iter().copied()))
    .fetch_all(connection)
    .await
    .map(HashMap::from_iter)
}

async fn existing_ids(
    connection: &mut PgConnection,
    query: &'static str,
    ids: HashSet<Uuid>,
    organization_id: Uuid,
) -> Result<HashSet<Uuid>, sqlx::Error> {
    if ids.is_empty() {
        return Ok(HashSet::new());
    }
    sqlx::query_scalar(query)
        .bind(Vec::from_iter(ids))
        .bind(organization_id)
        .fetch_all(connection)
        .await
        .map(HashSet::from_iter)
}

fn reference_errors(
    events: &[EventCreate],
    customers: &HashSet<Uuid>,
    members: &HashSet<Uuid>,
) -> Vec<ValidationError> {
    events
        .iter()
        .enumerate()
        .filter_map(|(index, event)| {
            let (kind, field, msg, input) = if let Some(organization_id) = event.organization_id {
                (
                    "organization_token",
                    "organization_id",
                    "Setting organization_id is disallowed when using an organization token.",
                    organization_id,
                )
            } else {
                let CustomerReference::Polar {
                    customer_id,
                    member_id,
                } = &event.customer
                else {
                    return None;
                };
                if !customers.contains(customer_id) {
                    (
                        "customer_id",
                        "customer_id",
                        "Customer not found.",
                        *customer_id,
                    )
                } else {
                    let member_id = member_id.filter(|member_id| !members.contains(member_id))?;
                    ("member_id", "member_id", "Member not found.", member_id)
                }
            };
            Some(ValidationError {
                kind,
                loc: vec![
                    LocItem::Field("body"),
                    LocItem::Field("events"),
                    LocItem::Index(index),
                    LocItem::Field(field),
                ],
                msg: msg.to_owned(),
                input: json!(input),
            })
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use serde_json::{Map, Value};
    use sqlx::Connection;

    use super::*;

    const CUSTOMER: Uuid = Uuid::from_u128(1);
    const MEMBER: Uuid = Uuid::from_u128(2);
    const UNKNOWN: Uuid = Uuid::from_u128(3);

    fn event(organization_id: Option<Uuid>, customer: CustomerReference) -> EventCreate {
        EventCreate {
            timestamp: Utc::now(),
            name: "name".to_owned(),
            organization_id,
            external_id: None,
            parent_id: None,
            metadata: Map::new(),
            customer,
        }
    }

    fn polar(customer_id: Uuid, member_id: Option<Uuid>) -> CustomerReference {
        CustomerReference::Polar {
            customer_id,
            member_id,
        }
    }

    fn errors(events: &[EventCreate]) -> Vec<(usize, &'static str)> {
        reference_errors(events, &HashSet::from([CUSTOMER]), &HashSet::from([MEMBER]))
            .into_iter()
            .map(|error| {
                let LocItem::Index(index) = error.loc[2] else {
                    panic!("expected an event index");
                };
                (index, error.kind)
            })
            .collect()
    }

    async fn local_database() -> (sqlx::PgConnection, Uuid) {
        let config = crate::config::Config::from_env().unwrap();
        let mut connection = sqlx::PgConnection::connect_with(&config.postgres)
            .await
            .unwrap();
        let organization_id = sqlx::query_scalar("SELECT id FROM organizations LIMIT 1")
            .fetch_one(&mut connection)
            .await
            .unwrap();
        (connection, organization_id)
    }

    #[tokio::test]
    #[ignore = "needs the local development database"]
    async fn creates_missing_event_types_once() {
        let (mut connection, organization_id) = local_database().await;
        let mut transaction = connection.begin().await.unwrap();
        let name = format!("events-test-{}", Uuid::new_v4());
        let mut first = event(None, polar(CUSTOMER, None));
        first.name = name.clone();
        let mut second = event(None, polar(CUSTOMER, None));
        second.name = name.clone();
        let events = [first, second];

        let created = resolve_event_types(&mut transaction, organization_id, &events)
            .await
            .ok()
            .unwrap();
        let reused = resolve_event_types(&mut transaction, organization_id, &events)
            .await
            .ok()
            .unwrap();
        let (label, count): (String, i64) = sqlx::query_as(
            "SELECT MIN(label), COUNT(*) FROM event_types WHERE organization_id = $1 AND name = $2",
        )
        .bind(organization_id)
        .bind(&name)
        .fetch_one(&mut *transaction)
        .await
        .unwrap();

        assert_eq!(created.len(), 1);
        assert_eq!(created, reused);
        assert_eq!((label, count), (name, 1));
        transaction.rollback().await.unwrap();
    }

    #[tokio::test]
    #[ignore = "needs the local development database"]
    async fn stages_events_and_skips_duplicates() {
        let (mut connection, organization_id) = local_database().await;
        let mut transaction = connection.begin().await.unwrap();
        let external_id = format!("events-test-{}", Uuid::new_v4());
        let moved_external_id = format!("events-test-moved-{}", Uuid::new_v4());
        let name = format!("events-test-{}", Uuid::new_v4());
        let external = |external_id: Option<&str>, parent_id: Option<&str>| {
            let mut event = event(
                None,
                CustomerReference::External {
                    external_customer_id: "customer".to_owned(),
                    external_member_id: Some("member".to_owned()),
                },
            );
            event.name = name.clone();
            event.external_id = external_id.map(str::to_owned);
            event.parent_id = parent_id.map(str::to_owned);
            event.metadata.insert("tokens".to_owned(), json!(12.5));
            event
        };
        let events = [
            external(Some(&external_id), Some("parent")),
            external(Some(&external_id), None),
            external(None, None),
            external(Some(&moved_external_id), None),
        ];
        let event_types = resolve_event_types(&mut transaction, organization_id, &events)
            .await
            .ok()
            .unwrap();
        sqlx::query(
            "INSERT INTO events (id, ingested_at, timestamp, name, source, organization_id, \
                 external_id, user_metadata) \
             VALUES ($1, now(), now(), 'name', 'user', $2, $3, '{}')",
        )
        .bind(Uuid::new_v4())
        .bind(organization_id)
        .bind(&moved_external_id)
        .execute(&mut *transaction)
        .await
        .unwrap();

        let staged = insert_staged_events(&mut transaction, organization_id, &events, &event_types)
            .await
            .ok()
            .unwrap();
        let again = insert_staged_events(
            &mut transaction,
            organization_id,
            &events[..1],
            &event_types,
        )
        .await
        .ok()
        .unwrap();
        let row: (String, Option<String>, Option<String>, Uuid, Value, String) = sqlx::query_as(
            "SELECT source, pending_parent_external_id, external_member_id, event_type_id, \
                 user_metadata, external_customer_id \
             FROM staged_events WHERE organization_id = $1 AND external_id = $2",
        )
        .bind(organization_id)
        .bind(&external_id)
        .fetch_one(&mut *transaction)
        .await
        .unwrap();

        assert_eq!((staged.inserted.len(), staged.duplicates), (2, 2));
        assert_eq!((again.inserted.len(), again.duplicates), (0, 1));
        assert_eq!(
            row,
            (
                "user".to_owned(),
                Some("parent".to_owned()),
                Some("member".to_owned()),
                event_types[&name],
                json!({ "tokens": 12.5 }),
                "customer".to_owned(),
            )
        );
        transaction.rollback().await.unwrap();
    }

    #[tokio::test]
    #[ignore = "needs the local development database"]
    async fn rejects_references_outside_the_organization() {
        let (mut connection, organization_id) = local_database().await;
        let events = [event(None, polar(UNKNOWN, Some(UNKNOWN)))];

        let result = validate_references(&mut connection, organization_id, &events).await;

        assert!(
            matches!(result, Err(IngestError::InvalidReferences(errors)) if errors[0].kind == "customer_id")
        );
    }

    #[test]
    fn accepts_known_references_and_external_customers() {
        let events = [
            event(None, polar(CUSTOMER, None)),
            event(None, polar(CUSTOMER, Some(MEMBER))),
            event(
                None,
                CustomerReference::External {
                    external_customer_id: "external".to_owned(),
                    external_member_id: None,
                },
            ),
        ];

        assert!(errors(&events).is_empty());
    }

    #[test]
    fn reports_one_error_per_invalid_event() {
        let events = [
            event(Some(UNKNOWN), polar(UNKNOWN, Some(UNKNOWN))),
            event(None, polar(UNKNOWN, Some(UNKNOWN))),
            event(None, polar(CUSTOMER, None)),
            event(None, polar(CUSTOMER, Some(UNKNOWN))),
        ];

        assert_eq!(
            errors(&events),
            [
                (0, "organization_token"),
                (1, "customer_id"),
                (3, "member_id")
            ]
        );
    }
}
