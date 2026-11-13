#![cfg_attr(
    not(test),
    expect(
        dead_code,
        reason = "used once ingest rolls events up into reducer buckets"
    )
)]

use std::cmp::Ordering;

use serde::Deserialize;
use serde_json::{Map, Value};

use crate::event::EventCreate;

const EVENT_SOURCE: &str = "user";

#[derive(Debug, Deserialize)]
pub struct Filter {
    conjunction: Conjunction,
    clauses: Vec<Clause>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "lowercase")]
enum Conjunction {
    And,
    Or,
}

#[derive(Debug, Deserialize)]
#[serde(untagged)]
enum Clause {
    Condition(Condition),
    Group(Filter),
}

#[derive(Debug, Deserialize)]
struct Condition {
    property: String,
    operator: Operator,
    value: ConditionValue,
}

#[derive(Clone, Copy, Debug, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
enum Operator {
    Eq,
    Ne,
    Gt,
    Gte,
    Lt,
    Lte,
    Like,
    NotLike,
}

#[derive(Debug, Deserialize)]
#[serde(untagged)]
enum ConditionValue {
    Bool(bool),
    Integer(i64),
    Text(String),
}

#[derive(Debug, Deserialize)]
#[serde(tag = "func", rename_all = "lowercase")]
pub enum Aggregation {
    Count,
    Sum { property: String },
    Max { property: String },
    Min { property: String },
    Avg { property: String },
    Unique,
}

fn strip_metadata_prefix(property: &str) -> &str {
    property.strip_prefix("metadata.").unwrap_or(property)
}

fn unix_seconds(event: &EventCreate) -> i64 {
    let seconds = event.timestamp.timestamp();
    if seconds < 0 && event.timestamp.timestamp_subsec_nanos() > 0 {
        seconds + 1
    } else {
        seconds
    }
}

fn nested_metadata_value<'a>(metadata: &'a Map<String, Value>, path: &str) -> Option<&'a Value> {
    if path.is_empty() {
        return None;
    }
    let mut parts = path.split('.');
    let mut value = metadata.get(parts.next()?)?;
    for part in parts {
        value = value.as_object()?.get(part)?;
    }
    Some(value).filter(|value| !value.is_null())
}

impl Filter {
    pub fn matches(&self, event: &EventCreate) -> bool {
        let mut clauses = self.clauses.iter().map(|clause| match clause {
            Clause::Condition(condition) => condition.matches(event),
            Clause::Group(filter) => filter.matches(event),
        });
        match self.conjunction {
            Conjunction::And => clauses.all(|matched| matched),
            Conjunction::Or => self.clauses.is_empty() || clauses.any(|matched| matched),
        }
    }
}

impl Condition {
    fn matches(&self, event: &EventCreate) -> bool {
        match (strip_metadata_prefix(&self.property), &self.value) {
            ("name", ConditionValue::Text(expected)) => self.compare_text(&event.name, expected),
            ("source", ConditionValue::Text(expected)) => self.compare_text(EVENT_SOURCE, expected),
            ("timestamp", ConditionValue::Integer(expected)) => {
                self.compare_ordering(Some(unix_seconds(event).cmp(expected)))
            }
            ("name" | "source" | "timestamp", _) => false,
            (property, expected) => nested_metadata_value(&event.metadata, property)
                .is_some_and(|actual| self.compare(actual, expected)),
        }
    }

    fn compare(&self, actual: &Value, expected: &ConditionValue) -> bool {
        match (actual, expected) {
            (Value::Bool(actual), ConditionValue::Bool(expected)) => {
                self.compare_ordering(Some(actual.cmp(expected)))
            }
            (Value::Bool(_), _) | (_, ConditionValue::Bool(_)) => self.operator == Operator::Ne,
            (Value::String(actual), ConditionValue::Text(expected)) => {
                self.compare_text(actual, expected)
            }
            (Value::Number(actual), ConditionValue::Integer(expected)) => {
                let ordering = match actual.as_i64() {
                    Some(actual) => Some(actual.cmp(expected)),
                    None => actual
                        .as_f64()
                        .and_then(|actual| actual.partial_cmp(&(*expected as f64))),
                };
                self.compare_ordering(ordering)
            }
            _ => self.operator == Operator::Ne,
        }
    }

    fn compare_text(&self, actual: &str, expected: &str) -> bool {
        match self.operator {
            Operator::Like => actual.contains(expected),
            Operator::NotLike => !actual.contains(expected),
            _ => self.compare_ordering(Some(actual.cmp(expected))),
        }
    }

    fn compare_ordering(&self, ordering: Option<Ordering>) -> bool {
        let Some(ordering) = ordering else {
            return self.operator == Operator::Ne;
        };
        match self.operator {
            Operator::Eq => ordering.is_eq(),
            Operator::Ne => ordering.is_ne(),
            Operator::Gt => ordering.is_gt(),
            Operator::Gte => ordering.is_ge(),
            Operator::Lt => ordering.is_lt(),
            Operator::Lte => ordering.is_le(),
            Operator::Like | Operator::NotLike => false,
        }
    }
}

impl Aggregation {
    pub fn value(&self, event: &EventCreate) -> Option<f64> {
        let property = match self {
            Self::Count => return Some(1.0),
            Self::Unique => return None,
            Self::Sum { property }
            | Self::Max { property }
            | Self::Min { property }
            | Self::Avg { property } => strip_metadata_prefix(property),
        };
        match property {
            "timestamp" => Some(unix_seconds(event) as f64),
            "name" | "source" => None,
            property => nested_metadata_value(&event.metadata, property)?.as_f64(),
        }
    }
}

#[cfg(test)]
mod tests {
    use chrono::Utc;

    use super::*;
    use crate::event::CustomerReference;

    fn fixture() -> (Value, EventCreate) {
        let cases: Value =
            serde_json::from_str(include_str!("../tests/fixtures/reducer_cases.json")).unwrap();
        let event = &cases["event"];
        let event = EventCreate {
            timestamp: event["timestamp"].as_str().unwrap().parse().unwrap(),
            name: event["name"].as_str().unwrap().to_owned(),
            organization_id: None,
            external_id: None,
            parent_id: None,
            metadata: event["metadata"].as_object().unwrap().clone(),
            customer: CustomerReference::External {
                external_customer_id: "customer".to_owned(),
                external_member_id: None,
            },
        };
        (cases, event)
    }

    #[test]
    fn filters_match_like_python() {
        let (cases, event) = fixture();
        let failures: Vec<String> = cases["filters"]
            .as_array()
            .unwrap()
            .iter()
            .filter_map(|case| {
                let filter: Filter = serde_json::from_value(case["filter"].clone()).unwrap();
                let matches = filter.matches(&event);
                (Value::Bool(matches) != case["matches"])
                    .then(|| format!("{} matched {matches}", case["filter"]))
            })
            .collect();

        assert!(failures.is_empty(), "{}", failures.join("\n"));
    }

    #[test]
    fn aggregations_extract_values_like_python() {
        let (cases, event) = fixture();
        let failures: Vec<String> = cases["aggregations"]
            .as_array()
            .unwrap()
            .iter()
            .filter_map(|case| {
                let aggregation: Aggregation =
                    serde_json::from_value(case["aggregation"].clone()).unwrap();
                let value = aggregation.value(&event);
                let expected = match &aggregation {
                    Aggregation::Count => Some(1.0),
                    _ => case["value"].as_f64(),
                };
                (value != expected).then(|| format!("{} gave {value:?}", case["aggregation"]))
            })
            .collect();

        assert!(failures.is_empty(), "{}", failures.join("\n"));
    }

    #[test]
    fn truncates_negative_timestamps_towards_zero() {
        let (_, mut event) = fixture();
        event.timestamp = "1969-12-31T23:59:59.500Z".parse().unwrap();

        assert_eq!(unix_seconds(&event), 0);
        assert!(event.timestamp < Utc::now());
    }
}
