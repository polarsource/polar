FROM docker.io/python:3.11.3-bullseye as installer
RUN pip install "poetry==1.4.2"

WORKDIR /app/server

ADD poetry.lock .
ADD pyproject.toml .

RUN poetry config virtualenvs.in-project true && \
    poetry install --without test,docs --no-root

ADD polar polar
ADD scripts scripts
ADD run_worker.py .

