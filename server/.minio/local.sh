#!/bin/bash

export CMD_MC=$(which mc)

# Configure our host
until ($CMD_MC config host add polar http://$MINIO_HOST:9000 $MINIO_ROOT_USER $MINIO_ROOT_PASSWORD)
do
  echo '...waiting...' &&
  sleep 1;
done;

bash $1
