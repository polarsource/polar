output "glue_database_name" {
  value = aws_glue_catalog_database.spans.name
}

output "glue_table_name" {
  value = aws_glue_catalog_table.spans.name
}

output "athena_workgroup_name" {
  value = aws_athena_workgroup.spans.name
}

output "athena_results_bucket_name" {
  value = aws_s3_bucket.athena_results.id
}
