#!/bin/bash
set -euo pipefail
umask 077
envfile=/root/tec-wa.env
grep -Eq '^META_APP_SECRET=[0-9a-fA-F]{32}$' "$envfile"
if ! grep -q '^WHATSAPP_VERIFY_TOKEN=' "$envfile"; then
  printf 'WHATSAPP_VERIFY_TOKEN=%s\n' "$(openssl rand -hex 32)" >> "$envfile"
fi
install -d -m 755 /opt/tec-wa
tmp=$(mktemp)
trap 'rm -f "$tmp"' EXIT
curl -fsSL https://raw.githubusercontent.com/atiliocedeno/tecnimaster_security/71da3fbd0f8c7fc74dcca14db1fc386c1e1a44b4/server/whatsapp-test-webhook.mjs -o "$tmp"
install -m 644 "$tmp" /opt/tec-wa/webhook.mjs
cat >/etc/systemd/system/tec-wa.service <<'UNIT'
[Unit]
Description=TecniMaster WhatsApp test webhook
After=network.target
[Service]
DynamicUser=yes
EnvironmentFile=/root/tec-wa.env
ExecStart=/snap/node/current/bin/node /opt/tec-wa/webhook.mjs
Restart=on-failure
[Install]
WantedBy=multi-user.target
UNIT
systemctl daemon-reload
systemctl enable --now tec-wa
for i in {1..15}; do
  if [[ $(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:8788/webhooks/whatsapp || true) == 403 ]]; then
    echo 'Webhook listening on loopback'
    exit 0
  fi
  sleep 1
done
exit 1
