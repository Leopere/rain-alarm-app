#!/usr/bin/env bash
set -euo pipefail
repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
branch="$(git -C "$repo_root" symbolic-ref --quiet --short HEAD)"
[[ "$branch" == main ]] || { echo 'Run this command from the existing main branch.' >&2; exit 1; }
revision="$(git -C "$repo_root" rev-parse HEAD)"
remote_revision="$(python3 -c 'import subprocess,sys; out=subprocess.check_output(["git","-C",sys.argv[1],"ls-remote","--exit-code","origin",sys.argv[2]],text=True,timeout=30).split(); assert len(out)==2 and out[1]==sys.argv[2]; print(out[0])' "$repo_root" "refs/heads/$branch")"
[[ "$revision" =~ ^[0-9a-f]{40}$ && "$remote_revision" == "$revision" ]] || {
  echo 'Push this exact main revision before submitting to Jenkins.' >&2; exit 1;
}
DEPLOY_IT_COMMIT="$revision" DEPLOY_IT_BRANCH="$branch" \
DEPLOY_IT_ENVIRONMENT=production DEPLOY_IT_REPO_ROOT="$repo_root" \
  exec python3 "${HOME}/.local/share/jenkins-local/jenkins-delivery.py" release-rain
