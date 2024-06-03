#!/bin/bash

# Configure our host
until (mc config host add polar http://$MINIO_HOST:9000 $MINIO_ROOT_USER $MINIO_ROOT_PASSWORD)
do
  echo '...waiting...' &&
  sleep 1;
done;
mc alias set polar http://$MINIO_HOST:9000 $MINIO_ROOT_USER $MINIO_ROOT_PASSWORD;

# Setup user & acccess policy
mc admin user add polar $ACCESS_KEY $SECRET_ACCESS_KEY
mc admin policy create polar polar-development /tmp/config/policy.json
mc admin policy attach polar polar-development --user $ACCESS_KEY

# Create development & testing buckets
mc mb polar/$BUCKET_NAME --with-versioning --ignore-existing
mc mb polar/$BUCKET_TESTING_NAME --with-versioning --ignore-existing

