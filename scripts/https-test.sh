#!/bin/bash
set -eu
host=webhook-pruebas.tecnimastersecurity.com
certbot certonly --webroot -w /var/www/html -d "$host" --agree-tos --register-unsafely-without-email --non-interactive --keep-until-expiring
conf=/etc/nginx/conf.d/tec-wa-test.conf
cat > "$conf" <<EOF
server {
    listen 80;
    server_name $host;
    access_log off;
    location ^~ /.well-known/acme-challenge/ { root /var/www/html; }
    location / { return 404; }
}
server {
    listen 443 ssl;
    server_name $host;
    ssl_certificate /etc/letsencrypt/live/$host/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/$host/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    access_log off;
    location = /webhooks/whatsapp {
        client_max_body_size 2m;
        proxy_pass http://127.0.0.1:8788;
    }
    location / { return 404; }
}
EOF
nginx -t
systemctl reload nginx
install -d /etc/letsencrypt/renewal-hooks/deploy
printf '%s\n' '#!/bin/sh' 'nginx -t && systemctl reload nginx' >/etc/letsencrypt/renewal-hooks/deploy/tec-wa
chmod 755 /etc/letsencrypt/renewal-hooks/deploy/tec-wa
curl -sS -o /dev/null -w 'Webhook HTTPS: %{http_code}\n' "https://$host/webhooks/whatsapp"
