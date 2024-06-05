#!/bin/bash

wget https://dl.min.io/client/mc/release/linux-amd64/mc
chmod +x mc

export CMD_MC=./mc
bash ./configure.sh
