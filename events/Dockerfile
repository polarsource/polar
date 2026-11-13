FROM rust:1.99.0-slim-trixie AS build

RUN sed -i -e 's|^mozilla/emSign_ECC_Root_CA_-_G3.crt|!&|' \
    -e 's|^mozilla/Comodo_AAA_Services_root.crt|!&|' /etc/ca-certificates.conf \
  && update-ca-certificates

WORKDIR /app
COPY rust-toolchain.toml Cargo.toml Cargo.lock ./
COPY src src/
COPY benches benches/
RUN --mount=type=cache,target=/usr/local/cargo/registry \
  --mount=type=cache,target=/app/target \
  cargo build --release --locked \
  && cp target/release/events /usr/local/bin/events

FROM debian:trixie-slim AS production

LABEL org.opencontainers.image.source=https://github.com/polarsource/polar \
  org.opencontainers.image.description="Polar Events" \
  org.opencontainers.image.licenses=Apache-2.0

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates \
  && sed -i -e 's|^mozilla/emSign_ECC_Root_CA_-_G3.crt|!&|' \
    -e 's|^mozilla/Comodo_AAA_Services_root.crt|!&|' /etc/ca-certificates.conf \
  && update-ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY --from=build /usr/local/bin/events /usr/local/bin/events

ARG RELEASE_VERSION
ENV RELEASE_VERSION=${RELEASE_VERSION} \
  POLAR_ENV=production

USER nobody
EXPOSE 10000
CMD ["events"]
