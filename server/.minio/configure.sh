#!/bin/bash

$CMD_MC alias set polar http://$MINIO_HOST:9000 $MINIO_ROOT_USER $MINIO_ROOT_PASSWORD;

# Setup user & acccess policy
$CMD_MC admin user add polar $ACCESS_KEY $SECRET_ACCESS_KEY
$CMD_MC admin policy create polar polar-development $POLICY_FILE
$CMD_MC admin policy attach polar polar-development --user $ACCESS_KEY

# Create development & testing buckets
$CMD_MC mb polar/$BUCKET_NAME --with-versioning --ignore-existing
$CMD_MC mb polar/$BUCKET_TESTING_NAME --with-versioning --ignore-existing

