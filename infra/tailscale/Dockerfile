FROM debian:latest
WORKDIR /render

ARG TAILSCALE_VERSION
ENV TAILSCALE_VERSION=$TAILSCALE_VERSION

RUN apt-get -qq update \
  && apt-get -qq install --upgrade -y --no-install-recommends \
    apt-transport-https \
    ca-certificates \
    dnsmasq \
    libcap2-bin \
    wget \
    dnsutils \
  > /dev/null \
  && apt-get -qq clean \
  && rm -rf \
    /var/lib/apt/lists/* \
    /tmp/* \
    /var/tmp/*

RUN groupadd --system tailscale \
  && useradd --system --gid tailscale --home-dir /render --shell /usr/sbin/nologin tailscale

RUN echo "+search +short" > /render/.digrc
COPY --chmod=755 run-tailscale.sh /render/

COPY --chmod=755 install-tailscale.sh /tmp/
RUN /tmp/install-tailscale.sh && rm -r /tmp/*

RUN setcap 'cap_net_bind_service=+ep' /usr/sbin/dnsmasq \
  && chown -R tailscale:tailscale /render /var/run/tailscale /var/cache/tailscale /var/lib/tailscale

USER tailscale

CMD ./run-tailscale.sh
