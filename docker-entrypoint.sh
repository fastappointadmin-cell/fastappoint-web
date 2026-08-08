#!/bin/sh
set -e

# Railway injects PORT; default to 8080 if it is not set locally.
: "${PORT:=8080}"

# Substitute only the variables we own — leave nginx's own $variables untouched.
envsubst '${BACKEND_URL} ${PORT}' < /etc/nginx/conf.d/nginx.conf.template > /etc/nginx/conf.d/default.conf

exec nginx -g 'daemon off;'
