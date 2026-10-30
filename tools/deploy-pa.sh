#!/usr/bin/env bash
set -euo pipefail
# PA_SSH_TARGET=username@host PA_WEB_ROOT=/home/username/public_html bash tools/deploy-pa.sh
# Review the dry-run, then repeat with --apply. No deletion of server-side uploads/config.
: "${PA_SSH_TARGET:?Set PA_SSH_TARGET=username@host}"
: "${PA_WEB_ROOT:?Set absolute PA_WEB_ROOT}"
[[ "$PA_WEB_ROOT" == /* && "$PA_WEB_ROOT" != / && "$PA_SSH_TARGET" != -* ]] || { echo 'Unsafe deployment target' >&2; exit 1; }
cd "$(dirname "$0")/.."
[[ -d dist ]] || { echo 'Run npm run build and npm run check first' >&2; exit 1; }
args=(-az --itemize-changes --exclude=avecjo-config.php)
if [[ "${1:-}" != --apply ]]; then args+=(--dry-run); fi
rsync "${args[@]}" -- dist/ "${PA_SSH_TARGET}:${PA_WEB_ROOT%/}/"
