use std::collections::{BTreeSet, HashMap, HashSet};

use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
};
use serde_json::json;
use sqlx::PgConnection;
use uuid::Uuid;

use crate::{
    app::error_response,
    event::{CustomerReference, EventCreate, LocItem, ValidationError},
};

pub enum IngestError {
    InvalidPayload(Vec<ValidationError>),
    InvalidReferences(Vec<ValidationError>),
    EventTypeUnavailable(String),
    Database(sqlx::Error),
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
            Self::EventTypeUnavailable(name) => {
                tracing::error!(name, "event type could not be created");
                StatusCode::INTERNAL_SERVER_ERROR.into_response()
            }
            Self::Database(error) => {
                tracing::error!(%error, "event ingestion failed");
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
    let raced = created.len() < missing.len();
    event_types.extend(created);

    if raced {
        event_types = select_event_types(connection, organization_id, &names).await?;
        if let Some(name) = names.iter().find(|name| !event_types.contains_key(**name)) {
            return Err(IngestError::EventTypeUnavailable((*name).to_owned()));
        }
    }
    Ok(event_types)
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
    use chrono::Utc;
    use serde_json::Map;
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
