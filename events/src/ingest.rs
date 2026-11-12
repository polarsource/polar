use std::collections::HashSet;

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
