use std::cmp::Ordering;

use chrono::{DateTime, Datelike, NaiveDate, NaiveTime, TimeDelta, Utc};
use serde::Serialize;
use serde_json::{Map, Value, json};
use uuid::{Uuid, Variant};

const MAX_NAME_LENGTH: usize = 128;
const MAX_METADATA_STRING_LENGTH: usize = 500;
const MAX_NUMERIC_VALUE: i64 = (1 << 53) - 1;
const MAX_COST_DIGITS: usize = 17;
const MAX_COST_DECIMAL_PLACES: usize = 12;
const MAX_COST_WHOLE_DIGITS: usize = MAX_COST_DIGITS - MAX_COST_DECIMAL_PLACES;
const UNIX_MILLISECONDS_THRESHOLD: f64 = 2e10;

#[derive(Debug)]
pub struct EventCreate {
    pub timestamp: DateTime<Utc>,
    pub name: String,
    pub organization_id: Option<Uuid>,
    pub external_id: Option<String>,
    pub parent_id: Option<String>,
    pub metadata: Map<String, Value>,
    pub customer: CustomerReference,
}

#[derive(Debug)]
pub enum CustomerReference {
    Polar {
        customer_id: Uuid,
        member_id: Option<Uuid>,
    },
    External {
        external_customer_id: String,
        external_member_id: Option<String>,
    },
}

#[derive(Clone, Debug, PartialEq, Serialize)]
#[serde(untagged)]
pub enum LocItem {
    Field(&'static str),
    Key(String),
    Index(usize),
}

#[derive(Clone, Debug, Serialize)]
pub struct ValidationError {
    #[serde(rename = "type")]
    pub kind: &'static str,
    pub loc: Vec<LocItem>,
    pub msg: String,
    pub input: Value,
}

struct FieldError {
    kind: &'static str,
    msg: String,
}

impl FieldError {
    fn new(kind: &'static str, msg: impl Into<String>) -> Self {
        Self {
            kind,
            msg: msg.into(),
        }
    }
}

type FieldResult<T> = Result<T, FieldError>;

fn model_attributes_type() -> FieldError {
    FieldError::new(
        "model_attributes_type",
        "Input should be a valid dictionary or object to extract fields from",
    )
}

fn invalid_characters() -> FieldError {
    FieldError::new(
        "value_error",
        "Value error, This value contains invalid characters",
    )
}

#[derive(Default)]
struct Errors(Vec<ValidationError>);

impl Errors {
    fn push(&mut self, loc: &[LocItem], input: &Value, error: FieldError) {
        self.0.push(ValidationError {
            kind: error.kind,
            loc: loc.to_vec(),
            msg: error.msg,
            input: input.clone(),
        });
    }

    fn required<T>(
        &mut self,
        object: &Map<String, Value>,
        field: &'static str,
        parse: impl FnOnce(&Value) -> FieldResult<T>,
    ) -> Option<T> {
        match object.get(field) {
            Some(value) => self.check(field, value, parse(value)),
            None => {
                self.push(
                    &[LocItem::Field(field)],
                    &Value::Object(object.clone()),
                    FieldError::new("missing", "Field required"),
                );
                None
            }
        }
    }

    fn optional<T>(
        &mut self,
        object: &Map<String, Value>,
        field: &'static str,
        parse: impl FnOnce(&Value) -> FieldResult<T>,
    ) -> Option<T> {
        match object.get(field) {
            Some(Value::Null) | None => None,
            Some(value) => self.check(field, value, parse(value)),
        }
    }

    fn check<T>(
        &mut self,
        field: &'static str,
        value: &Value,
        result: FieldResult<T>,
    ) -> Option<T> {
        result
            .map_err(|error| self.push(&[LocItem::Field(field)], value, error))
            .ok()
    }

    fn nested(&mut self, prefix: &[LocItem], errors: Errors) {
        self.0.extend(errors.0.into_iter().map(|mut error| {
            error.loc.splice(0..0, prefix.iter().cloned());
            error
        }));
    }

    fn is_empty(&self) -> bool {
        self.0.is_empty()
    }
}

pub fn parse_ingest(
    body: &[u8],
    is_json: bool,
    now: DateTime<Utc>,
) -> Result<Vec<EventCreate>, Vec<ValidationError>> {
    let body_loc = [LocItem::Field("body")];
    let mut errors = Errors::default();

    if body.is_empty() {
        errors.push(
            &body_loc,
            &Value::Null,
            FieldError::new("missing", "Field required"),
        );
        return Err(errors.0);
    }
    if !is_json {
        let input = Value::String(String::from_utf8_lossy(body).into_owned());
        errors.push(&body_loc, &input, model_attributes_type());
        return Err(errors.0);
    }

    let Ok(body) = serde_json::from_slice::<Value>(body) else {
        errors.push(
            &body_loc,
            &json!({}),
            FieldError::new("json_invalid", "JSON decode error"),
        );
        return Err(errors.0);
    };
    let Some(object) = body.as_object() else {
        errors.push(&body_loc, &body, model_attributes_type());
        return Err(errors.0);
    };
    let events_loc = [LocItem::Field("body"), LocItem::Field("events")];
    let Some(events) = object.get("events") else {
        errors.push(
            &events_loc,
            &body,
            FieldError::new("missing", "Field required"),
        );
        return Err(errors.0);
    };
    let Some(events) = events.as_array() else {
        errors.push(
            &events_loc,
            events,
            FieldError::new("list_type", "Input should be a valid array"),
        );
        return Err(errors.0);
    };

    let mut parsed = Vec::with_capacity(events.len());
    for (index, event) in events.iter().enumerate() {
        match parse_event(event, now) {
            Ok(event) => parsed.push(event),
            Err(event_errors) => errors.nested(
                &[
                    LocItem::Field("body"),
                    LocItem::Field("events"),
                    LocItem::Index(index),
                ],
                event_errors,
            ),
        }
    }
    if errors.is_empty() {
        Ok(parsed)
    } else {
        Err(errors.0)
    }
}

const POLAR_VARIANT: &str = "EventCreateCustomer";
const EXTERNAL_VARIANT: &str = "EventCreateExternalCustomer";

fn parse_event(value: &Value, now: DateTime<Utc>) -> Result<EventCreate, Errors> {
    let mut errors = Errors::default();
    let Some(object) = value.as_object() else {
        for variant in [POLAR_VARIANT, EXTERNAL_VARIANT] {
            errors.push(&[LocItem::Field(variant)], value, model_attributes_type());
        }
        return Err(errors);
    };

    let mut shared = Errors::default();
    let mut coerced = false;
    let timestamp = match object.get("timestamp") {
        Some(value) => {
            coerced = true;
            shared.check("timestamp", value, parse_timestamp(value, now))
        }
        None => Some(now),
    };
    let name = shared.required(object, "name", parse_name);
    let organization_id = shared.optional(object, "organization_id", parse_uuid4);
    coerced |= organization_id.is_some();
    let external_id = shared.optional(object, "external_id", parse_text);
    let parent_id = shared.optional(object, "parent_id", parse_text);
    let metadata = match object.get("metadata") {
        Some(value) => match parse_metadata(value, &mut coerced) {
            Ok(metadata) if contains_nul(&metadata) => {
                shared.push(&[LocItem::Field("metadata")], value, invalid_characters());
                None
            }
            Ok(metadata) => Some(metadata),
            Err(metadata_errors) => {
                shared.nested(&[LocItem::Field("metadata")], metadata_errors);
                None
            }
        },
        None => Some(Map::new()),
    };

    let mut polar_errors = Errors::default();
    let customer_id = polar_errors.required(object, "customer_id", parse_uuid4);
    let member_id = polar_errors.optional(object, "member_id", parse_uuid4);

    let mut external_errors = Errors::default();
    let external_customer_id = external_errors.required(object, "external_customer_id", parse_text);
    let external_member_id = external_errors.optional(object, "external_member_id", parse_text);

    let fields_set = |fields: [&str; 2]| {
        fields
            .iter()
            .filter(|field| object.contains_key(**field))
            .count()
    };
    let prefer_external = match fields_set(["external_customer_id", "external_member_id"])
        .cmp(&fields_set(["customer_id", "member_id"]))
    {
        Ordering::Greater => true,
        Ordering::Equal => !coerced,
        Ordering::Less => false,
    };

    let polar = customer_id
        .filter(|_| polar_errors.is_empty())
        .map(|customer_id| CustomerReference::Polar {
            customer_id,
            member_id,
        });
    let external = external_customer_id
        .filter(|_| external_errors.is_empty())
        .map(|external_customer_id| CustomerReference::External {
            external_customer_id,
            external_member_id,
        });
    let customer = match (polar, external) {
        (Some(_), Some(external)) if prefer_external => Some(external),
        (Some(polar), _) => Some(polar),
        (None, external) => external,
    };

    if let (true, Some(timestamp), Some(name), Some(metadata), Some(customer)) =
        (shared.is_empty(), timestamp, name, metadata, customer)
    {
        return Ok(EventCreate {
            timestamp,
            name,
            organization_id,
            external_id,
            parent_id,
            metadata,
            customer,
        });
    }

    for (variant, variant_errors) in [
        (POLAR_VARIANT, polar_errors),
        (EXTERNAL_VARIANT, external_errors),
    ] {
        let prefix = [LocItem::Field(variant)];
        errors.nested(&prefix, Errors(shared.0.clone()));
        errors.nested(&prefix, variant_errors);
    }
    Err(errors)
}

fn parse_string(value: &Value) -> FieldResult<String> {
    value
        .as_str()
        .map(str::to_owned)
        .ok_or_else(|| FieldError::new("string_type", "Input should be a valid string"))
}

fn parse_text(value: &Value) -> FieldResult<String> {
    let text = parse_string(value)?;
    if text.contains('\0') {
        return Err(invalid_characters());
    }
    Ok(text)
}

fn contains_nul(metadata: &Map<String, Value>) -> bool {
    metadata.iter().any(|(key, value)| {
        key.contains('\0')
            || match value {
                Value::String(text) => text.contains('\0'),
                Value::Object(nested) => contains_nul(nested),
                _ => false,
            }
    })
}

fn parse_name(value: &Value) -> FieldResult<String> {
    let name = parse_string(value)?;
    if name.chars().count() > MAX_NAME_LENGTH {
        return Err(FieldError::new(
            "string_too_long",
            format!("String should have at most {MAX_NAME_LENGTH} characters"),
        ));
    }
    if name.contains('\0') {
        return Err(invalid_characters());
    }
    Ok(name)
}

fn parse_uuid4(value: &Value) -> FieldResult<Uuid> {
    let value = value.as_str().ok_or_else(|| {
        FieldError::new(
            "uuid_type",
            "UUID input should be a string, bytes or UUID object",
        )
    })?;
    let uuid = Uuid::parse_str(value).map_err(|error| {
        FieldError::new(
            "uuid_parsing",
            format!("Input should be a valid UUID, {error}"),
        )
    })?;
    if uuid.get_version_num() != 4 || uuid.get_variant() != Variant::RFC4122 {
        return Err(FieldError::new("uuid_version", "UUID version 4 expected"));
    }
    Ok(uuid)
}

fn parse_timestamp(value: &Value, now: DateTime<Utc>) -> FieldResult<DateTime<Utc>> {
    let timestamp = match value {
        Value::Number(number) => from_unix_timestamp(number.as_f64().unwrap_or(f64::INFINITY)),
        Value::String(text) => match parse_unix_timestamp(text) {
            Some(unix) => from_unix_timestamp(unix),
            None => parse_datetime(text),
        },
        _ => Err(FieldError::new(
            "datetime_type",
            "Input should be a valid datetime",
        )),
    }?;
    if timestamp > now {
        return Err(FieldError::new(
            "value_error",
            "Value error, Timestamp must be in the past.",
        ));
    }
    Ok(timestamp)
}

fn datetime_out_of_range() -> FieldError {
    FieldError::new("datetime_parsing", "Input should be a valid datetime")
}

fn in_python_datetime_range(timestamp: DateTime<Utc>) -> FieldResult<DateTime<Utc>> {
    if (1..=9999).contains(&timestamp.year()) {
        Ok(timestamp)
    } else {
        Err(datetime_out_of_range())
    }
}

fn parse_unix_timestamp(text: &str) -> Option<f64> {
    let digits = text.strip_prefix(['-', '+']).unwrap_or(text);
    let (integer, fraction) = digits.split_once('.').unwrap_or((digits, ""));
    let all_digits = |part: &str| part.bytes().all(|byte| byte.is_ascii_digit());
    if integer.is_empty() || !all_digits(integer) || !all_digits(fraction) {
        return None;
    }
    text.parse().ok()
}

fn from_unix_timestamp(unix: f64) -> FieldResult<DateTime<Utc>> {
    let seconds = if unix.abs() > UNIX_MILLISECONDS_THRESHOLD {
        unix / 1000.0
    } else {
        unix
    };
    let micros = (seconds * 1e6).round();
    if !micros.is_finite() || micros.abs() >= i64::MAX as f64 {
        return Err(datetime_out_of_range());
    }
    DateTime::from_timestamp_micros(micros as i64)
        .ok_or_else(datetime_out_of_range)
        .and_then(in_python_datetime_range)
}

fn parse_datetime(text: &str) -> FieldResult<DateTime<Utc>> {
    let invalid = || {
        FieldError::new(
            "datetime_from_date_parsing",
            "Input should be a valid datetime or date",
        )
    };
    let number = |range: std::ops::Range<usize>| -> Option<u32> {
        let digits = text.as_bytes().get(range)?;
        digits.iter().all(u8::is_ascii_digit).then(|| {
            digits
                .iter()
                .fold(0, |number, digit| number * 10 + u32::from(digit - b'0'))
        })
    };
    let byte = |index: usize| text.as_bytes().get(index).copied();

    let (Some(year), Some(b'-'), Some(month), Some(b'-'), Some(day)) =
        (number(0..4), byte(4), number(5..7), byte(7), number(8..10))
    else {
        return Err(invalid());
    };
    let date = NaiveDate::from_ymd_opt(year as i32, month, day).ok_or_else(invalid)?;
    if text.len() == 10 {
        return Err(FieldError::new(
            "timezone_aware",
            "Input should have timezone info",
        ));
    }

    let (Some(b'T' | b't' | b' ' | b'_'), Some(hour), Some(b':'), Some(minute)) =
        (byte(10), number(11..13), byte(13), number(14..16))
    else {
        return Err(invalid());
    };
    let mut position = 16;
    let mut second = 0;
    let mut micros = 0;
    if byte(position) == Some(b':') {
        second = number(position + 1..position + 3).ok_or_else(invalid)?;
        position += 3;
        if matches!(byte(position), Some(b'.' | b',')) {
            let digits = text.as_bytes()[position + 1..]
                .iter()
                .take_while(|byte| byte.is_ascii_digit())
                .count();
            if digits == 0 {
                return Err(invalid());
            }
            let kept = digits.min(6);
            micros = number(position + 1..position + 1 + kept).ok_or_else(invalid)?
                * 10_u32.pow(6 - kept as u32);
            position += 1 + digits;
        }
    }
    let time = NaiveTime::from_hms_micro_opt(hour, minute, second, micros)
        .filter(|_| second < 60)
        .ok_or_else(invalid)?;

    let offset_seconds = match &text.as_bytes()[position..] {
        [] => {
            return Err(FieldError::new(
                "timezone_aware",
                "Input should have timezone info",
            ));
        }
        [b'Z' | b'z'] => 0,
        [sign @ (b'+' | b'-'), rest @ ..] => {
            let start = position + 1;
            let (hours, minutes) = match rest.len() {
                5 if rest[2] == b':' => (number(start..start + 2), number(start + 3..start + 5)),
                4 => (number(start..start + 2), number(start + 2..start + 4)),
                _ => (None, None),
            };
            let (Some(hours), Some(minutes)) = (hours, minutes) else {
                return Err(invalid());
            };
            if hours > 23 || minutes > 59 {
                return Err(invalid());
            }
            let seconds = i64::from(hours * 3600 + minutes * 60);
            if *sign == b'-' { -seconds } else { seconds }
        }
        _ => return Err(invalid()),
    };

    if year == 0 {
        return Err(datetime_out_of_range());
    }
    date.and_time(time)
        .and_utc()
        .checked_sub_signed(TimeDelta::seconds(offset_seconds))
        .ok_or_else(datetime_out_of_range)
        .and_then(in_python_datetime_range)
}

fn parse_metadata(value: &Value, coerced: &mut bool) -> Result<Map<String, Value>, Errors> {
    let object = parse_object(value)?;
    let mut errors = Errors::default();
    let mut metadata = Map::new();
    for (key, value) in object {
        let parsed = match key.as_str() {
            "_cost" => {
                *coerced = true;
                parse_cost(value)
            }
            "_llm" => parse_llm(value, coerced),
            _ => parse_metadata_value(value).map_err(|error| {
                let mut errors = Errors::default();
                errors.push(&[], value, error);
                errors
            }),
        };
        match parsed {
            Ok(value) => {
                metadata.insert(key.clone(), value);
            }
            Err(value_errors) => errors.nested(&[LocItem::Key(key.clone())], value_errors),
        }
    }
    if errors.is_empty() {
        Ok(metadata)
    } else {
        Err(errors)
    }
}

fn parse_metadata_value(value: &Value) -> FieldResult<Value> {
    match value {
        Value::Bool(_) => Ok(value.clone()),
        Value::String(text) => match text.chars().count() {
            0 => Err(FieldError::new(
                "string_too_short",
                "String should have at least 1 character",
            )),
            length if length > MAX_METADATA_STRING_LENGTH => Err(FieldError::new(
                "string_too_long",
                format!("String should have at most {MAX_METADATA_STRING_LENGTH} characters"),
            )),
            _ => Ok(value.clone()),
        },
        Value::Number(number) => {
            check_numeric_range(number.as_f64().unwrap_or(f64::INFINITY))?;
            Ok(value.clone())
        }
        _ => Err(FieldError::new(
            "metadata_value_type",
            "Input should be a valid string, number or boolean",
        )),
    }
}

fn check_numeric_range(value: f64) -> FieldResult<()> {
    if value > MAX_NUMERIC_VALUE as f64 {
        return Err(FieldError::new(
            "less_than_equal",
            format!("Input should be less than or equal to {MAX_NUMERIC_VALUE}"),
        ));
    }
    if value < -(MAX_NUMERIC_VALUE as f64) {
        return Err(FieldError::new(
            "greater_than_equal",
            format!("Input should be greater than or equal to -{MAX_NUMERIC_VALUE}"),
        ));
    }
    Ok(())
}

fn parse_object(value: &Value) -> Result<&Map<String, Value>, Errors> {
    value.as_object().ok_or_else(|| {
        let mut errors = Errors::default();
        errors.push(
            &[],
            value,
            FieldError::new("dict_type", "Input should be an object"),
        );
        errors
    })
}

fn parse_cost(value: &Value) -> Result<Value, Errors> {
    let object = parse_object(value)?;
    let mut errors = Errors::default();
    let amount = errors.required(object, "amount", parse_cost_amount);
    let currency = errors.required(object, "currency", |value| {
        let currency = parse_string(value)?;
        if !currency.contains("usd") {
            return Err(FieldError::new(
                "string_pattern_mismatch",
                "String should match pattern 'usd'",
            ));
        }
        Ok(currency)
    });
    match (amount, currency) {
        (Some(amount), Some(currency)) if errors.is_empty() => {
            Ok(json!({ "amount": amount, "currency": currency }))
        }
        _ => Err(errors),
    }
}

fn parse_cost_amount(value: &Value) -> FieldResult<f64> {
    let invalid = || FieldError::new("decimal_parsing", "Input should be a valid decimal");
    let text = match value {
        Value::Number(number) => number.to_string(),
        Value::String(text) => strip_digit_separators(text.trim()).ok_or_else(invalid)?,
        _ => {
            return Err(FieldError::new(
                "decimal_type",
                "Decimal input should be an integer, float, string or Decimal object",
            ));
        }
    };
    let unsigned = text.strip_prefix(['-', '+']).unwrap_or(&text);
    if ["nan", "inf", "infinity"].contains(&unsigned.to_ascii_lowercase().as_str()) {
        return Err(FieldError::new(
            "finite_number",
            "Input should be a finite number",
        ));
    }

    let (digits, decimal_places) = decimal_shape(unsigned).ok_or_else(invalid)?;
    if digits > MAX_COST_DIGITS {
        return Err(FieldError::new(
            "decimal_max_digits",
            format!("Decimal input should have no more than {MAX_COST_DIGITS} digits in total"),
        ));
    }
    if decimal_places > MAX_COST_DECIMAL_PLACES {
        return Err(FieldError::new(
            "decimal_max_places",
            format!(
                "Decimal input should have no more than {MAX_COST_DECIMAL_PLACES} decimal places"
            ),
        ));
    }
    if digits - decimal_places > MAX_COST_WHOLE_DIGITS {
        return Err(FieldError::new(
            "decimal_whole_digits",
            format!(
                "Decimal input should have no more than {MAX_COST_WHOLE_DIGITS} digits before the decimal point"
            ),
        ));
    }
    text.parse::<f64>()
        .ok()
        .filter(|amount| amount.is_finite())
        .ok_or_else(invalid)
}

fn strip_digit_separators(text: &str) -> Option<String> {
    let misplaced = text.starts_with('_') || text.ends_with('_') || text.contains("__");
    (!misplaced).then(|| text.replace('_', ""))
}

fn decimal_shape(unsigned: &str) -> Option<(usize, usize)> {
    let (mantissa, exponent) = match unsigned.split_once(['e', 'E']) {
        Some((mantissa, exponent)) => (mantissa, exponent.parse::<i64>().ok()?),
        None => (unsigned, 0),
    };
    let (integer, fraction) = mantissa.split_once('.').unwrap_or((mantissa, ""));
    let all_digits = |part: &str| part.bytes().all(|byte| byte.is_ascii_digit());
    if integer.is_empty() && fraction.is_empty() || !all_digits(integer) || !all_digits(fraction) {
        return None;
    }

    let coefficient = format!("{integer}{fraction}");
    let significant = coefficient.trim_start_matches('0').trim_end_matches('0');
    if significant.is_empty() {
        return Some((0, 0));
    }
    let trailing_zeros = coefficient.len() - coefficient.trim_end_matches('0').len();
    let exponent = exponent
        .checked_sub(fraction.len() as i64)?
        .checked_add(trailing_zeros as i64)?;
    let length = significant.len() as i64;
    let (digits, decimal_places) = if exponent >= 0 {
        (length.checked_add(exponent)?, 0)
    } else {
        (length.max(exponent.checked_neg()?), exponent.checked_neg()?)
    };
    Some((digits as usize, decimal_places as usize))
}

fn parse_llm(value: &Value, coerced: &mut bool) -> Result<Value, Errors> {
    let object = parse_object(value)?;
    let mut errors = Errors::default();
    let vendor = errors.required(object, "vendor", parse_string);
    let model = errors.required(object, "model", parse_string);
    let prompt = errors.optional(object, "prompt", parse_string);
    let response = errors.optional(object, "response", parse_string);
    let mut parse_token_count = |value: &Value| {
        *coerced |= !(value.is_i64() || value.is_u64());
        parse_token_count(value)
    };
    let input_tokens = errors.required(object, "input_tokens", &mut parse_token_count);
    let cached_input_tokens = object
        .get("cached_input_tokens")
        .and_then(|value| errors.check("cached_input_tokens", value, parse_token_count(value)));
    let output_tokens = errors.required(object, "output_tokens", &mut parse_token_count);
    let total_tokens = errors.required(object, "total_tokens", &mut parse_token_count);
    if !errors.is_empty() {
        return Err(errors);
    }

    let mut llm = json!({
        "vendor": vendor,
        "model": model,
        "prompt": prompt,
        "response": response,
        "input_tokens": input_tokens,
        "output_tokens": output_tokens,
        "total_tokens": total_tokens,
    });
    if let Some(cached_input_tokens) = cached_input_tokens {
        llm["cached_input_tokens"] = json!(cached_input_tokens);
    }
    Ok(llm)
}

fn parse_token_count(value: &Value) -> FieldResult<i64> {
    let count = match value {
        Value::Bool(flag) => i128::from(*flag),
        Value::Number(number) => match (number.as_i64(), number.as_u64(), number.as_f64()) {
            (Some(count), _, _) => i128::from(count),
            (None, Some(count), _) => i128::from(count),
            (None, None, Some(float)) if float.fract() != 0.0 => {
                return Err(FieldError::new(
                    "int_from_float",
                    "Input should be a valid integer, got a number with a fractional part",
                ));
            }
            (None, None, Some(float)) if float.abs() < i64::MAX as f64 => float as i128,
            _ => {
                return Err(FieldError::new(
                    "int_parsing_size",
                    "Unable to parse input string as an integer, exceeded maximum size",
                ));
            }
        },
        Value::String(text) => parse_integer_string(text).ok_or_else(|| {
            FieldError::new(
                "int_parsing",
                "Input should be a valid integer, unable to parse string as an integer",
            )
        })?,
        _ => {
            return Err(FieldError::new(
                "int_type",
                "Input should be a valid integer",
            ));
        }
    };
    check_numeric_range(count as f64)?;
    Ok(count as i64)
}

fn parse_integer_string(text: &str) -> Option<i128> {
    let text = strip_digit_separators(text.trim())?;
    let (integer, fraction) = match text.split_once('.') {
        Some((integer, fraction)) => (integer, Some(fraction)),
        None => (text.as_str(), None),
    };
    if fraction
        .is_some_and(|fraction| fraction.is_empty() || fraction.bytes().any(|byte| byte != b'0'))
    {
        return None;
    }
    let digits = integer.strip_prefix(['-', '+']).unwrap_or(integer);
    if digits.is_empty() || !digits.bytes().all(|byte| byte.is_ascii_digit()) {
        return None;
    }
    Some(integer.parse().unwrap_or(if integer.starts_with('-') {
        i128::MIN
    } else {
        i128::MAX
    }))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn dump(event: &EventCreate) -> Value {
        let mut dumped = json!({
            "name": event.name,
            "organization_id": event.organization_id,
            "external_id": event.external_id,
            "parent_id": event.parent_id,
            "user_metadata": event.metadata,
        });
        match &event.customer {
            CustomerReference::Polar {
                customer_id,
                member_id,
            } => {
                dumped["variant"] = json!(POLAR_VARIANT);
                dumped["customer_id"] = json!(customer_id);
                dumped["member_id"] = json!(member_id);
            }
            CustomerReference::External {
                external_customer_id,
                external_member_id,
            } => {
                dumped["variant"] = json!(EXTERNAL_VARIANT);
                dumped["external_customer_id"] = json!(external_customer_id);
                dumped["external_member_id"] = json!(external_member_id);
            }
        }
        dumped
    }

    fn check_events(expected: &[Value], events: &[EventCreate]) -> Result<(), String> {
        if expected.len() != events.len() {
            return Err(format!(
                "expected {} events, got {}",
                expected.len(),
                events.len()
            ));
        }
        for (expected, event) in expected.iter().zip(events) {
            let mut expected = expected.clone();
            if let Some(timestamp) = expected.as_object_mut().unwrap().remove("timestamp") {
                let timestamp = DateTime::parse_from_rfc3339(timestamp.as_str().unwrap()).unwrap();
                if timestamp != event.timestamp {
                    return Err(format!(
                        "expected timestamp {timestamp}, got {}",
                        event.timestamp
                    ));
                }
            }
            let dumped = dump(event);
            if expected != dumped {
                return Err(format!("expected {expected}, got {dumped}"));
            }
        }
        Ok(())
    }

    fn check_errors(expected: &[Value], errors: &[ValidationError]) -> Result<(), String> {
        let mut expected_locs: Vec<String> = expected
            .iter()
            .map(|error| error["loc"].to_string())
            .collect();
        let mut locs: Vec<String> = errors
            .iter()
            .map(|error| json!(error.loc).to_string())
            .collect();
        expected_locs.sort();
        locs.sort();
        if expected_locs != locs {
            return Err(format!(
                "expected errors at {expected_locs:?}, got {locs:?}"
            ));
        }
        for expected in expected.iter().filter(|error| !error["type"].is_null()) {
            let kinds: Vec<&str> = errors
                .iter()
                .filter(|error| json!(error.loc) == expected["loc"])
                .map(|error| error.kind)
                .collect();
            if kinds != [expected["type"].as_str().unwrap()] {
                return Err(format!(
                    "expected {} at {}, got {kinds:?}",
                    expected["type"], expected["loc"]
                ));
            }
        }
        Ok(())
    }

    #[test]
    fn matches_the_python_schema() {
        let cases: Vec<Value> =
            serde_json::from_str(include_str!("../tests/fixtures/ingest_cases.json")).unwrap();
        let failures: Vec<String> = cases
            .iter()
            .filter_map(|case| {
                let body = serde_json::to_vec(&case["body"]).unwrap();
                let outcome = match (
                    parse_ingest(&body, true, Utc::now()),
                    case.get("events"),
                    case.get("errors"),
                ) {
                    (Ok(events), Some(expected), _) => {
                        check_events(expected.as_array().unwrap(), &events)
                    }
                    (Err(errors), _, Some(expected)) => {
                        check_errors(expected.as_array().unwrap(), &errors)
                    }
                    (Ok(_), _, _) => Err("expected a validation error".to_owned()),
                    (Err(errors), _, _) => Err(format!("unexpected errors: {}", json!(errors))),
                };
                outcome
                    .err()
                    .map(|failure| format!("{}: {failure}", case["name"]))
            })
            .collect();

        assert!(failures.is_empty(), "{}", failures.join("\n"));
    }

    #[test]
    fn rejects_malformed_json() {
        let errors = parse_ingest(b"{", true, Utc::now()).unwrap_err();

        assert_eq!(errors[0].kind, "json_invalid");
        assert_eq!(errors[0].loc, [LocItem::Field("body")]);
    }

    #[test]
    fn rejects_bodies_fastapi_would_not_decode() {
        let empty = parse_ingest(b"", true, Utc::now()).unwrap_err();
        let not_json = parse_ingest(br#"{"events":[]}"#, false, Utc::now()).unwrap_err();

        assert_eq!(empty[0].kind, "missing");
        assert_eq!(not_json[0].kind, "model_attributes_type");
        assert_eq!(not_json[0].loc, [LocItem::Field("body")]);
    }

    #[test]
    fn parses_floats_exactly() {
        let body = br#"{"events":[{"name":"n","external_customer_id":"c","metadata":{"k":9391.670189485865}}]}"#;

        let events = parse_ingest(body, true, Utc::now()).unwrap();

        assert_eq!(events[0].metadata["k"].as_f64(), Some(9391.670189485865));
    }
}
