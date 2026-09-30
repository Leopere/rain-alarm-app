#!/usr/bin/env bash
set -euo pipefail
exec python3 "${HOME}/.local/share/jenkins-local/jenkins-delivery.py" release-rain
