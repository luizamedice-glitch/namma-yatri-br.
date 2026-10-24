#!/usr/bin/env bash
# Private operator transport. No plaintext profile, code or session goes to logs.
set -euo pipefail
set +x
umask 077
work=$(mktemp -d "$RUNNER_TEMP/yatri-driver-private.XXXXXX")
trap 'rm -rf -- "$work"' EXIT
printf '%s\n' "$AWS_SSH_KEY" > "$work/key"
unset AWS_SSH_KEY
touch "$work/known_hosts"
host_check=accept-new
if [[ -n "${AWS_SSH_KNOWN_HOSTS:-}" ]]; then
  printf '%s\n' "$AWS_SSH_KNOWN_HOSTS" > "$work/known_hosts"
  host_check=yes
fi
args=(-i "$work/key" -o IdentitiesOnly=yes -o BatchMode=yes -o ForwardAgent=no -o ConnectTimeout=15 -o "StrictHostKeyChecking=$host_check" -o "UserKnownHostsFile=$work/known_hosts")
target=ubuntu@52.67.246.31
remote='sudo -n docker compose -f /opt/yatri-brasil/compose.yaml -f /opt/yatri-brasil/compose.driver-pilot.json exec -T driver-pilot node'
case "$YATRI_DRIVER_OPERATION" in
  provision)
    base64 -d brasil/backend/ops/driver-vehicle.sealed > "$work/profile.enc"
    openssl pkeyutl -decrypt -inkey "$work/key" -pkeyopt rsa_padding_mode:oaep -pkeyopt rsa_oaep_md:sha256 -in "$work/profile.enc" -out "$work/profile.json"
    ssh "${args[@]}" "$target" "$remote src/provision-driver-pilot.mjs /dev/stdin" < "$work/profile.json"
    ;;
  activate)
    ssh "${args[@]}" "$target" "$remote src/issue-driver-pairing.mjs" < brasil/backend/ops/driver-delivery-public.pem > "$RUNNER_TEMP/driver-activation.enc"
    test -s "$RUNNER_TEMP/driver-activation.enc"
    echo 'Ativacao gerada e criptografada para entrega privada.'
    ;;
  *) echo 'Operacao invalida.' >&2;exit 1;;
esac
