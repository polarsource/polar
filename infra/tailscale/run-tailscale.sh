#!/usr/bin/env bash

# Health check responder for Render
(while true; do printf "HTTP/1.1 200 OK\r\nContent-Length: 2\r\n\r\nOK" | nc -l 10000 2>/dev/null; done) &

/render/tailscaled --tun=userspace-networking --socks5-server=localhost:1055 &
PID=$!

ADVERTISE_ROUTES=${ADVERTISE_ROUTES:-10.0.0.0/8}
until /render/tailscale up --authkey="${TAILSCALE_AUTHKEY}" --hostname="${RENDER_SERVICE_NAME}" --advertise-routes="$ADVERTISE_ROUTES"; do
  sleep 0.1
done
export ALL_PROXY=socks5://localhost:1055/
tailscale_ip=$(/render/tailscale ip)
echo "Tailscale is up at IP ${tailscale_ip}"

wait ${PID}
