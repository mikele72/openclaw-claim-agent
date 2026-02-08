#!/bin/bash
cd "$HOME/openclaw-claim-agent" || exit 1
mkdir -p logs
/usr/local/bin/node scripts/scan_and_claim.mjs >> logs/loop.log 2>&1
