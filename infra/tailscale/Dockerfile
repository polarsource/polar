FROM debian:latest
WORKDIR /render

ARG TAILSCALE_VERSION
ENV TAILSCALE_VERSION=$TAILSCALE_VERSION

RUN apt-get -qq update \
  && apt-get -qq install --upgrade -y --no-install-recommends \
    apt-transport-https \
    ca-certificates \
    wget \
    dnsutils \
  > /dev/null \
  && apt-get -qq clean \
  && rm -rf \
    /var/lib/apt/lists/* \
    /tmp/* \
    /var/tmp/*

RUN echo "+search +short" > /root/.digrc
COPY --chmod=755 run-tailscale.sh /render/

COPY --chmod=755 install-tailscale.sh /tmp/
RUN /tmp/install-tailscale.sh && rm -r /tmp/*

CMD ./run-tailscale.sh
