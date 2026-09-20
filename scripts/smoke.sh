#!/usr/bin/env bash
set -Eeuo pipefail

# Smoke test API Derajat Work. Secret tidak pernah dicetak.
FRONTEND_PORT="${FRONTEND_PORT:-3100}"
FRONTEND_URL="${FRONTEND_URL:-http://127.0.0.1:${FRONTEND_PORT}}"
BASE_URL="${BASE_URL:-${FRONTEND_URL}}"
HEALTH_PATH="${HEALTH_PATH:-/api/health}"
LOGIN_PATH="${LOGIN_PATH:-/api/v1/auth/login}"
PROTECTED_PATH="${PROTECTED_PATH:-/api/v1/auth/me}"
LOGOUT_PATH="${LOGOUT_PATH:-/api/v1/auth/logout}"
WORKSPACES_PATH="${WORKSPACES_PATH:-/api/v1/workspaces}"
MATERIALS_PATH="${MATERIALS_PATH:-/api/v1/materials}"
TEMPLATES_PATH="${TEMPLATES_PATH:-/api/v1/templates}"

: "${TEST_ADMIN_EMAIL:?TEST_ADMIN_EMAIL wajib diatur}"
: "${TEST_ADMIN_PASSWORD:?TEST_ADMIN_PASSWORD wajib diatur}"
command -v curl >/dev/null 2>&1 || { printf 'ERROR: curl tidak ditemukan.\n' >&2; exit 1; }
if ! command -v jq >/dev/null 2>&1 && ! command -v python3 >/dev/null 2>&1; then
  printf 'ERROR: perlu jq atau python3 untuk membaca/membuat JSON.\n' >&2
  exit 1
fi

TMP_DIR="$(mktemp -d)"
COOKIE_JAR="${TMP_DIR}/cookies.txt"
RESPONSE_FILE="${TMP_DIR}/response.json"
LOGGED_IN=0
CREATED_PATHS=()

cleanup() {
  local path idx
  if (( LOGGED_IN )); then
    for (( idx=${#CREATED_PATHS[@]}-1; idx>=0; idx-- )); do
      path="${CREATED_PATHS[$idx]}"
      curl --silent --show-error --output /dev/null \
        --cookie "${COOKIE_JAR}" --cookie-jar "${COOKIE_JAR}" \
        --request DELETE "${BASE_URL}${path}" || true
    done
  fi
  rm -rf "${TMP_DIR}"
}
trap cleanup EXIT INT TERM

json_id() {
  if command -v jq >/dev/null 2>&1; then
    jq -er '(.id // .data.id // .item.id // empty) | tostring' "$1"
  else
    python3 -c 'import json,sys; d=json.load(open(sys.argv[1])); d=d.get("data",d.get("item",d)) if isinstance(d,dict) else {}; v=d.get("id") if isinstance(d,dict) else None; print(v if v is not None else ""); raise SystemExit(0 if v is not None else 1)' "$1"
  fi
}

json_bisa_ai_workspace_id() {
  if command -v jq >/dev/null 2>&1; then
    jq -er 'if type == "array" then . elif (.items | type) == "array" then .items elif (.data | type) == "array" then .data else [] end | map(select(.slug == "bisa-ai"))[0].id | tostring' "$1"
  else
    python3 -c 'import json,sys; d=json.load(open(sys.argv[1])); rows=d if isinstance(d,list) else d.get("items",d.get("data",[])); ids=[x.get("id") for x in rows if isinstance(x,dict) and x.get("slug")=="bisa-ai"]; print(ids[0] if ids else ""); raise SystemExit(0 if ids else 1)' "$1"
  fi
}

assert_generation_placeholder() {
  if command -v jq >/dev/null 2>&1; then
    jq -e 'type == "object" and length == 2 and .status == "not_implemented" and .message == "AI skill will be added later"' "$1" >/dev/null
  else
    python3 -c 'import json,sys; d=json.load(open(sys.argv[1])); raise SystemExit(0 if d == {"status":"not_implemented","message":"AI skill will be added later"} else 1)' "$1"
  fi
}

login_json() {
  if command -v jq >/dev/null 2>&1; then
    jq -cn --arg email "${TEST_ADMIN_EMAIL}" --arg password "${TEST_ADMIN_PASSWORD}" \
      '{email: $email, password: $password}'
  else
    TEST_EMAIL_VALUE="${TEST_ADMIN_EMAIL}" TEST_PASSWORD_VALUE="${TEST_ADMIN_PASSWORD}" \
      python3 -c 'import json,os; print(json.dumps({"email":os.environ["TEST_EMAIL_VALUE"],"password":os.environ["TEST_PASSWORD_VALUE"]},separators=(",",":")))'
  fi
}

request() {
  local method="$1" path="$2" data="${3:-}" status
  local args=(--silent --show-error --output "${RESPONSE_FILE}" --write-out '%{http_code}'
    --cookie "${COOKIE_JAR}" --cookie-jar "${COOKIE_JAR}"
    --header 'Accept: application/json' --request "${method}")
  if [[ -n "${data}" ]]; then
    args+=(--header 'Content-Type: application/json' --data "${data}")
  fi
  status="$(curl "${args[@]}" "${BASE_URL}${path}")"
  if [[ ! "${status}" =~ ^2[0-9][0-9]$ ]]; then
    printf 'GAGAL: %s %s mengembalikan HTTP %s.\n' "${method}" "${path}" "${status}" >&2
    return 1
  fi
  printf 'OK: %s %s (HTTP %s)\n' "${method}" "${path}" "${status}"
}

check_frontend() {
  local status
  status="$(curl --silent --show-error --output /dev/null --write-out '%{http_code}' "${FRONTEND_URL}/")"
  if [[ ! "${status}" =~ ^[23][0-9][0-9]$ ]]; then
    printf 'GAGAL: frontend %s mengembalikan HTTP %s.\n' "${FRONTEND_URL}" "${status}" >&2
    return 1
  fi
  printf 'OK: frontend dapat dijangkau (HTTP %s)\n' "${status}"
}

crud_resource() {
  local label="$1" list_path="$2" create_path="$3" detail_base="$4" create_payload="$5" update_payload="$6"
  local id item_path

  request GET "${list_path}"
  request POST "${create_path}" "${create_payload}"
  id="$(json_id "${RESPONSE_FILE}")" || {
    printf 'GAGAL: respons pembuatan %s tidak memuat id.\n' "${label}" >&2
    return 1
  }
  item_path="${detail_base}/${id}"
  CREATED_PATHS+=("${item_path}")

  request GET "${item_path}"
  request PATCH "${item_path}" "${update_payload}"
  request DELETE "${item_path}"
  unset "CREATED_PATHS[$((${#CREATED_PATHS[@]} - 1))]"
  printf 'OK: CRUD %s lengkap.\n' "${label}"
}

now="$(date +%s)"
printf 'Menjalankan smoke test terhadap %s ...\n' "${BASE_URL}"
check_frontend
request GET "${HEALTH_PATH}"
request POST "${LOGIN_PATH}" "$(login_json)"
LOGGED_IN=1
request GET "${PROTECTED_PATH}"
request GET "${WORKSPACES_PATH}"
workspace_id="$(json_bisa_ai_workspace_id "${RESPONSE_FILE}")" || {
  printf 'GAGAL: workspace seed dengan slug bisa-ai tidak ditemukan.\n' >&2
  exit 1
}
if [[ ! "${workspace_id}" =~ ^[0-9]+$ ]]; then
  printf 'GAGAL: id workspace bisa-ai bukan bilangan bulat.\n' >&2
  exit 1
fi
printf 'OK: workspace bisa-ai ditemukan.\n'

for generation_kind in slides module quiz assignment lesson-plan; do
  request POST "/api/v1/generation/${generation_kind}" '{}'
  assert_generation_placeholder "${RESPONSE_FILE}" || {
    printf 'GAGAL: kontrak placeholder generation/%s tidak sesuai.\n' "${generation_kind}" >&2
    exit 1
  }
done
printf 'OK: seluruh endpoint AI tetap placeholder tanpa konten tiruan.\n'

sessions_path="/api/v1/workspaces/${workspace_id}/teaching/sessions"
sessions_detail="/api/v1/teaching/sessions"
session_create="${SMOKE_SESSION_CREATE_JSON:-{\"title\":\"Smoke session ${now}\",\"description\":\"Data sementara smoke test\",\"instructor\":\"Smoke test\",\"scheduled_at\":\"2026-09-10T09:00:00Z\",\"duration_minutes\":30,\"topic\":\"Verifikasi operasional\",\"audience\":\"Tim internal\",\"difficulty\":\"beginner\",\"session_type\":\"workshop\",\"status\":\"draft\"}}"
session_update="${SMOKE_SESSION_UPDATE_JSON:-{\"topic\":\"Verifikasi operasional diperbarui\",\"status\":\"draft\"}}"
material_create="${SMOKE_MATERIAL_CREATE_JSON:-{\"workspace_id\":${workspace_id},\"title\":\"Smoke material ${now}\",\"description\":\"Data sementara smoke test\",\"material_type\":\"document\",\"material_date\":\"2026-09-10\",\"content_url\":\"https://example.invalid/smoke\",\"tags\":[\"smoke\"],\"content\":\"Konten sementara smoke test\",\"status\":\"draft\"}}"
material_update="${SMOKE_MATERIAL_UPDATE_JSON:-{\"title\":\"Smoke material ${now} updated\"}}"
template_create="${SMOKE_TEMPLATE_CREATE_JSON:-{\"workspace_id\":${workspace_id},\"name\":\"Smoke template ${now}\",\"template_type\":\"teaching_session\",\"category\":\"training\",\"description\":\"Template sementara smoke test\",\"config_json\":{}}}"
template_update="${SMOKE_TEMPLATE_UPDATE_JSON:-{\"name\":\"Smoke template ${now} updated\"}}"

crud_resource session "${sessions_path}" "${sessions_path}" "${sessions_detail}" "${session_create}" "${session_update}"
crud_resource material "${MATERIALS_PATH}?workspace_id=${workspace_id}" "${MATERIALS_PATH}" "${MATERIALS_PATH}" "${material_create}" "${material_update}"
crud_resource template "${TEMPLATES_PATH}?workspace_id=${workspace_id}" "${TEMPLATES_PATH}" "${TEMPLATES_PATH}" "${template_create}" "${template_update}"
request POST "${LOGOUT_PATH}"
LOGGED_IN=0
printf 'LULUS: health, autentikasi, workspace, semua CRUD, dan logout terverifikasi.\n'
