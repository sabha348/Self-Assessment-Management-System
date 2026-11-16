#!/usr/bin/env bash
# Downloads the eval corpus (not committed: licence and repo size).
# Think Python, 2nd edition, by Allen B. Downey, CC BY-NC 3.0, greenteapress.com
set -euo pipefail
cd "$(dirname "$0")"
URL="https://greenteapress.com/thinkpython2/thinkpython2.pdf"
SHA256="6033000bac3f9268ad75ee041bf8e5d9a3bc8a33bb156399cbd014918cb59f94"
if [ ! -f thinkpython2.pdf ]; then
  curl -sSfL -o thinkpython2.pdf "$URL"
fi
echo "$SHA256  thinkpython2.pdf" | sha256sum -c -
