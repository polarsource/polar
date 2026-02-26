terraform {
  required_version = ">= 1.2"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 5.0"
    }
  }
}

locals {
  full_name_prefix = "polar-${var.environment}"
}

# =============================================================================
# Athena Query Results Bucket
# =============================================================================

resource "aws_s3_bucket" "athena_results" {
  bucket = "${local.full_name_prefix}-athena-results"
}

resource "aws_s3_bucket_lifecycle_configuration" "athena_results" {
  bucket = aws_s3_bucket.athena_results.id

  rule {
    id     = "expire-results-after-7-days"
    status = "Enabled"
    filter {}
    expiration {
      days = 7
    }
  }
}

# =============================================================================
# Glue Catalog
# =============================================================================

resource "aws_glue_catalog_database" "spans" {
  name = "${local.full_name_prefix}-spans"
}

resource "aws_glue_catalog_table" "spans" {
  name          = "spans"
  database_name = aws_glue_catalog_database.spans.name

  table_type = "EXTERNAL_TABLE"

  parameters = {
    "classification"               = "json"
    "compressionType"              = "gzip"
    "projection.enabled"           = "true"
    "projection.service_name.type" = "injected"
    "projection.dt.type"           = "date"
    "projection.dt.range"          = "2025-01-01,NOW"
    "projection.dt.format"         = "yyyy-MM-dd"
    "storage.location.template"    = "s3://${var.logs_bucket_name}/spans/$${service_name}/dt=$${dt}"
  }

  partition_keys {
    name = "service_name"
    type = "string"
  }

  partition_keys {
    name = "dt"
    type = "string"
  }

  storage_descriptor {
    location      = "s3://${var.logs_bucket_name}/spans/"
    input_format  = "org.apache.hadoop.mapred.TextInputFormat"
    output_format = "org.apache.hadoop.hive.ql.io.HiveIgnoreKeyTextOutputFormat"

    ser_de_info {
      serialization_library = "org.openx.data.jsonserde.JsonSerDe"
      parameters = {
        "ignore.malformed.json" = "TRUE"
        "dots.in.keys"          = "TRUE"
      }
    }

    columns {
      name = "name"
      type = "string"
    }

    columns {
      name = "context"
      type = "struct<trace_id:string,span_id:string,trace_state:string>"
    }

    columns {
      name = "kind"
      type = "string"
    }

    columns {
      name = "parent_id"
      type = "string"
    }

    columns {
      name = "start_time"
      type = "string"
    }

    columns {
      name = "end_time"
      type = "string"
    }

    columns {
      name = "status"
      type = "struct<status_code:string,description:string>"
    }

    columns {
      name = "attributes"
      type = "map<string,string>"
    }

    columns {
      name = "events"
      type = "array<struct<name:string,timestamp:string,attributes:map<string,string>>>"
    }

    columns {
      name = "links"
      type = "array<struct<context:struct<trace_id:string,span_id:string>,attributes:map<string,string>>>"
    }

    columns {
      name = "resource"
      type = "struct<attributes:map<string,string>,schema_url:string>"
    }
  }
}

# =============================================================================
# Athena Workgroup
# =============================================================================

resource "aws_athena_workgroup" "spans" {
  name = "${local.full_name_prefix}-spans"

  configuration {
    result_configuration {
      output_location = "s3://${aws_s3_bucket.athena_results.id}/results/"
    }

    enforce_workgroup_configuration = true

    engine_version {
      selected_engine_version = "Athena engine version 3"
    }
  }
}
