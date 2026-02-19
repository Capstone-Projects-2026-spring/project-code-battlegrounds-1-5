#!/bin/bash

set -eou pipefail

yes | bun install || status=$?
status=${status:-0}

if [ $status -ne 0 ] && [ $status -ne 141 ]; then
  # 141: Done successfully (with warnings)
  exit $status
else
  echo "Updated"
  exit 0
fi