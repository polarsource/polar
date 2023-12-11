FROM docker.io/python:3.12.0-bullseye

LABEL org.opencontainers.image.source=https://github.com/polarsource/polar
LABEL org.opencontainers.image.description="Polar"
LABEL org.opencontainers.image.licenses=Apache-2.0

RUN pip install "poetry==1.4.2"

WORKDIR /app/server

ADD poetry.lock .
ADD pyproject.toml .

RUN poetry config virtualenvs.in-project true && \
    poetry install --without test,docs --no-root

ADD polar polar
ADD scripts scripts
ADD run_worker.py .

ADD migrations migrations
ADD alembic.ini .

CMD ["poetry", "run", "uvicorn", "polar.app:app", "--host", "0.0.0.0", "--port", "10000"]
