#!/usr/bin/env zsh

poetry export --without-hashes --format=requirements.txt > requirements.txt
