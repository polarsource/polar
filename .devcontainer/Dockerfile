ARG PYTHON_VERSION=3.12-bullseye
FROM mcr.microsoft.com/vscode/devcontainers/python:${PYTHON_VERSION}

ENV PYTHONUNBUFFERED 1
ENV FORWARDED_ALLOW_IPS *

# [Optional] If your requirements rarely change, uncomment this section to add them to the image.
# COPY requirements.txt /tmp/pip-tmp/
# RUN pip3 --disable-pip-version-check --no-cache-dir install -r /tmp/pip-tmp/requirements.txt \
#    && rm -rf /tmp/pip-tmp

# [Optional] Uncomment this section to install additional OS packages.
# RUN apt-get update && export DEBIAN_FRONTEND=noninteractive \
#     && apt-get -y install --no-install-recommends <your-package-list-here>
