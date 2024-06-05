echo "I'm being called from GitHub Actions!"

wget https://dl.min.io/client/mc/release/linux-amd64/mc
chmod +x mc

./mc alias set polar http://$MINIO_HOST:9000 $MINIO_ROOT_USER $MINIO_ROOT_PASSWORD;

# Setup user & acccess policy
./mc admin user add polar $ACCESS_KEY $SECRET_ACCESS_KEY
./mc admin policy create polar polar-development $POLICY_FILE
./mc admin policy attach polar polar-development --user $ACCESS_KEY

# Create development & testing buckets
./mc mb polar/$BUCKET_NAME --with-versioning --ignore-existing
./mc mb polar/$BUCKET_TESTING_NAME --with-versioning --ignore-existing

