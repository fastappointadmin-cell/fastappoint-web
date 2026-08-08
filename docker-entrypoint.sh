#!/bin/sh
set -e

# Substitute only ${BACKEND_URL} — leave nginx's own $variables untouched
envsubst '${BACKEND_URL}' < /etc/nginx/conf.d/nginx.conf.template > /etc/nginx/conf.d/default.conf

exec nginx -g 'daemon off;'
