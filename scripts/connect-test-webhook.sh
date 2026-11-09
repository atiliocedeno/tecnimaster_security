#!/usr/bin/env bash
set -euo pipefail
umask 077
cd /opt/tec-cobranzas-pruebas
unit=tec-wa.service
receiver=/opt/tec-wa/webhook.mjs
envfile=/root/tec-wa.env
dropin=/etc/systemd/system/tec-wa.service.d/forward-test-status.conf
[[ $EUID == 0 && -f $receiver && -s $envfile && -s .env.local && -d .data/cobranza ]]
systemctl is-active --quiet "$unit"
node --env-file="$envfile" -e 'for(const k of ["META_APP_SECRET","WHATSAPP_VERIFY_TOKEN","WHATSAPP_TEST_ACCESS_TOKEN"])if(!process.env[k])throw Error("Falta "+k)'
health() { curl --fail --silent --max-time 2 http://127.0.0.1:8787/cobranza/ >/dev/null; }
listener=$(ss -H -ltnp 'sport = :8787')
if [[ -n $listener ]]; then
  pid=$(sed -n 's/.*pid=\([0-9]*\).*/\1/p' <<< "$listener")
  [[ -n $pid && $(readlink -f "/proc/$pid/cwd") == "$PWD" ]] && grep -zFxq 'scripts/dev.mjs' "/proc/$pid/cmdline" || { echo 'Puerto ocupado por un proceso inesperado'; exit 1; }
  kill -INT "$pid"
  for _ in {1..20}; do kill -0 "$pid" 2>/dev/null || break; sleep 1; done
  if kill -0 "$pid" 2>/dev/null; then echo 'El módulo sigue cerrando'; exit 1; fi
fi
export WHATSAPP_TEST_ENABLED=true WHATSAPP_TEST_RECIPIENT=56946309218 COBRANZA_TEST_IMPORTS=true
nohup node --env-file="$envfile" --env-file=.env.local scripts/dev.mjs </dev/null >/root/tec-cobranzas-pruebas.log 2>&1 &
for _ in {1..20}; do health && break; sleep 1; done
health || { echo 'Revisa /root/tec-cobranzas-pruebas.log'; exit 1; }
probe() {
  node --env-file="$envfile" --input-type=module - "$1" "$2" <<'JS'
import {createHmac} from 'node:crypto';
const body=JSON.stringify({object:'whatsapp_business_account',entry:[]});
const signature='sha256='+createHmac('sha256',process.env.META_APP_SECRET).update(body).digest('hex');
const response=await fetch(process.argv[2],{method:'POST',headers:{'x-hub-signature-256':signature},body,signal:AbortSignal.timeout(10000)});
if(response.status!==Number(process.argv[3]))throw Error('HTTP '+response.status);
JS
}
probe http://127.0.0.1:8787/internal/whatsapp-status 204
backup=$(mktemp -d /root/tec-wa-backup.XXXXXX)
cp -p "$receiver" "$backup/webhook.mjs"
if [[ -f $dropin ]]; then cp -p "$dropin" "$backup/forward.conf"; fi
rollback() {
  cp -p "$backup/webhook.mjs" "$receiver"
  if [[ -f $backup/forward.conf ]]; then cp -p "$backup/forward.conf" "$dropin"; else rm -f "$dropin"; fi
  systemctl daemon-reload
  systemctl restart "$unit"
}
trap rollback ERR
install -m 644 server/whatsapp-test-webhook.mjs "$receiver"
mkdir -p "$(dirname "$dropin")"
printf '%s\n' '[Service]' 'Environment=WHATSAPP_FORWARD_TO_TEST_APP=true' > "$dropin"
systemctl daemon-reload
systemctl restart "$unit"
for _ in {1..10}; do if ss -H -ltn 'sport = :8788' | grep -q .; then break; fi; sleep 1; done
probe http://127.0.0.1:8788/webhooks/whatsapp 200
trap - ERR
echo 'Receptor de pruebas conectado a Cobranzas. Comprobación HTTP firmada correcta.'
