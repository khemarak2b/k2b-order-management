#!/usr/bin/env bash
# T0.1: run every backend unit test in this repo and exit non-zero if any fails.
# buildspec.yml runs this before build.sh, so a failing test stops the pipeline before anything deploys.
# The same file is copied into each service repo; keep the copies identical.
#
# Finds every *.test.js under amplify/backend/function (ignoring node_modules), installs each
# owning package's dependencies (layers first, because handler tests load the layer in place of
# /opt/nodejs), then runs node --test on that package's files. Also runs the repo-root npm test
# if package.json defines one.
set -euo pipefail

cd "$(dirname "$0")/.."
REPO_ROOT="$(pwd)"
FUNCTIONS="amplify/backend/function"

install_deps() {
  local dir="$1"
  if [ -f "$dir/package-lock.json" ]; then
    (cd "$dir" && npm ci --no-audit --no-fund --loglevel=error)
  else
    (cd "$dir" && npm install --no-audit --no-fund --loglevel=error)
  fi
}

# Nearest directory at or above the test file that has a package.json, without leaving the repo.
package_of() {
  local dir
  dir="$(dirname "$1")"
  while [ "$dir" != "." ] && [ "$dir" != "/" ] && [ ! -f "$dir/package.json" ]; do
    dir="$(dirname "$dir")"
  done
  echo "$dir"
}

if [ -d "$FUNCTIONS" ]; then
  mapfile -t test_files < <(find "$FUNCTIONS" -name node_modules -prune -o -type f -name '*.test.js' -print | sort)
else
  test_files=()
fi

declare -A package_files=()
for file in "${test_files[@]}"; do
  pkg="$(package_of "$file")"
  if [ "$pkg" = "." ] || [ "$pkg" = "/" ]; then
    echo "No package.json above $file" >&2
    exit 1
  fi
  package_files["$pkg"]+="${file#"$pkg"/} "
done

# Layers first: handler tests resolve /opt/nodejs/... to the layer's lib/nodejs folder.
if [ -d "$FUNCTIONS" ]; then
  while IFS= read -r layer_pkg; do
    layer_dir="$(dirname "$layer_pkg")"
    echo "==> npm install $layer_dir"
    install_deps "$layer_dir"
  done < <(find "$FUNCTIONS" -mindepth 4 -maxdepth 4 -path '*/lib/nodejs/package.json' | sort)
fi

failed=()
for pkg in $(printf '%s\n' "${!package_files[@]}" | sort); do
  case "$pkg" in */lib/nodejs) ;; *)
    echo "==> npm install $pkg"
    install_deps "$pkg"
  esac
  # shellcheck disable=SC2086 # the file list is intentionally word-split
  echo "==> node --test in $pkg: ${package_files[$pkg]}"
  if ! (cd "$pkg" && node --test ${package_files[$pkg]}); then
    failed+=("$pkg")
  fi
done

if [ -f "$REPO_ROOT/package.json" ] && node -e 'process.exit(require("./package.json").scripts?.test ? 0 : 1)'; then
  echo "==> npm test (repo root)"
  install_deps "$REPO_ROOT"
  if ! npm test; then
    failed+=("repo root")
  fi
fi

echo "Ran ${#test_files[@]} test file(s) in ${#package_files[@]} package(s)."
if [ "${#failed[@]}" -gt 0 ]; then
  echo "Tests FAILED in: ${failed[*]}" >&2
  exit 1
fi
echo "All tests passed."
