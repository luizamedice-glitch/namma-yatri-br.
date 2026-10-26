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
  provision-passenger)
    ssh "${args[@]}" "$target" "$remote src/provision-driver-pilot.mjs --passenger" </dev/null
    ;;
  provision)
    base64 -d brasil/backend/ops/driver-vehicle.sealed > "$work/profile.enc"
    openssl pkeyutl -decrypt -inkey "$work/key" -pkeyopt rsa_padding_mode:oaep -pkeyopt rsa_oaep_md:sha256 -in "$work/profile.enc" -out "$work/profile.json"
    ssh "${args[@]}" "$target" "$remote src/provision-driver-pilot.mjs /dev/stdin" < "$work/profile.json"
    ;;
  export-public-key)
    openssl pkey -in "$work/key" -pubout -out "$RUNNER_TEMP/geocoding-server-public.pem" 2>/dev/null
    if [[ -n "${GH_TOKEN:-}" ]]; then echo 'GitHub secret writer configured: true'; else echo 'GitHub secret writer configured: false'; fi
    ;;
  configure-geoapify)
    base64 -d brasil/backend/ops/geoapify-key.sealed > "$work/geoapify.enc"
    openssl pkeyutl -decrypt -inkey "$work/key" -pkeyopt rsa_padding_mode:oaep -pkeyopt rsa_oaep_md:sha256 -in "$work/geoapify.enc" -out "$work/geoapify.key"
    python3 -c 'import pathlib,re,sys;sys.exit(0 if re.fullmatch("[a-fA-F0-9]{32}",pathlib.Path(sys.argv[1]).read_text().strip()) else 1)' "$work/geoapify.key"
    gh secret set GEOAPIFY_API_KEY --repo "$GITHUB_REPOSITORY" < "$work/geoapify.key"
    remote_dir=$(ssh "${args[@]}" "$target" 'mktemp -d /tmp/yatri-geo.XXXXXX')
    [[ "$remote_dir" =~ ^/tmp/yatri-geo\.[a-zA-Z0-9]+$ ]]
    scp "${args[@]}" brasil/backend/ops/configure-geoapify.py "$target:$remote_dir/configure.py"
    ssh "${args[@]}" "$target" "sudo -n python3 '$remote_dir/configure.py'" < "$work/geoapify.key"
    ssh "${args[@]}" "$target" "rm -rf -- '$remote_dir'"
    ;;
  geocoding-check)
    ssh "${args[@]}" "$target" "$remote --input-type=module" < brasil/backend/ops/check-geocoding.mjs
    ;;
  geoapify-check)
    ssh "${args[@]}" "$target" "$remote --input-type=module" < brasil/backend/ops/check-geoapify.mjs
    ;;
  activate)
    [[ "${YATRI_PILOT_ROLE:-driver}" =~ ^(driver|passenger)$ ]] || exit 1
    ssh "${args[@]}" "$target" "$remote src/issue-driver-pairing.mjs ${YATRI_PILOT_ROLE:-driver}" < "${YATRI_DRIVER_PUBLIC_FILE:-brasil/backend/ops/driver-delivery-public.pem}" > "$RUNNER_TEMP/driver-activation.enc"
    test -s "$RUNNER_TEMP/driver-activation.enc"
    echo 'Ativacao gerada e criptografada para entrega privada.'
    ;;
  *) echo 'Operacao invalida.' >&2;exit 1;;
esac
