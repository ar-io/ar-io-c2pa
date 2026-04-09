#!/usr/bin/env bash
# =============================================================================
# Seed test C2PA manifests into the sidecar via webhook
# =============================================================================
# Usage: ./scripts/seed-test-data.sh [BASE_URL]
#
# These are real Arweave transactions with C2PA Content Credentials.
# Run this after starting the sidecar to populate it with demo data.
# =============================================================================

set -euo pipefail

BASE_URL="${1:-http://localhost:3003}"
OWNER="4GMXT7vb-qlPN1V-FvtIdmBvGHkoE06aVhhPVLyyPuc"

echo "Seeding C2PA test data into ${BASE_URL}..."

# ── Image group 1: pHash e8f0fcc0f0f0f0f0 (soft binding: 6PD8wPDw8PA=) ──
# 14 manifests of the same test image signed with different manifest IDs

GROUP1_TXS=(
  "Dw77ya7CVKVT7ffqYl_td4UQUauAN1YitCXRYlp7lNA:urn:c2pa:fa008c04-cbee-43c2-846c-2a3d3c487219:sdk-integration-test/0.1.0"
  "LmtXUh9qG8vMhhGLKpkbxqfAMclQLBz97VgqW1jGVJU:urn:c2pa:60d8e7c2-61ca-4e99-b370-5fab3cc80b33:sdk-integration-test/0.1.0"
  "q5MPwsc1TyUl4XAp3ubDoJ69expRwbPSjVaxvt0fv1Q:urn:c2pa:a46222ce-ed5f-4fb2-b31f-b0a721823319:sdk-integration-test/0.1.0"
  "xbtzMfMigYRCyDt80sPYWxEkyCRPViWujFdAJhIb7zo:urn:c2pa:89b106be-7d92-4626-aa69-d900aa00f306:sdk-integration-test/0.1.0"
  "8slToT6kHtECrRsRV_D_yCrXUlx9LfLS8tdxQwryNGE:urn:c2pa:5a2960c9-46c1-4e83-8943-168e3b0c6323:sdk-integration-test/0.1.0"
  "caPlUn54PicZ5JGoOmFXcKhifEoZYYhbpGLEzD3M8RY:urn:c2pa:e63b7b49-5b5c-4dda-b30f-0060193f87de:sdk-integration-test/0.1.0"
  "hGjeJppEQWyWPDmDToQayYmVwYMc6f7u-ZN6AJgfQnU:urn:c2pa:26a8f013-15c1-4daf-9b44-44489be96769:sdk-integration-test/0.1.0"
  "W1088UErjPfQnhwjQSC57JZ6ZfKWNF6nvSG-LqxOwgE:urn:c2pa:c7aa5646-82a4-41b0-b9c1-bc2a1f518c86:sdk-integration-test/0.1.0"
  "Mx8ILGC9yc7m3yDAPGvkpFNnCwV_ocxXtYv-boNCGK4:urn:c2pa:71c5231d-e485-45fe-9a15-5dd20c812420:sdk-integration-test/0.1.0"
  "_UNzB7geNlmfhBwsut4utEuSGR1kJB0artdx_yUPMn8:urn:c2pa:e515030c-4a1d-4dea-9e59-7fd92912ef23:sdk-integration-test/0.1.0"
  "zMfxYtHdHhOR5L48dAZWzdAjnsOUqZOlWoEGmJ2su0E:urn:c2pa:8437cbea-7df2-40b1-bcd4-6b705ab117ad:sdk-integration-test/0.1.0"
  "TNbGN19gFdrXCm8gTpJscD0DEz4RD4uh8Z8Y9IyxaNg:urn:c2pa:af24fd06-0f99-47a2-a3ee-e8e93b4f2c67:sdk-integration-test/0.1.0"
  "hjCTpYm02KdXWBw59ehigqoWhz7abEPBVzrOqhTMmZU:urn:c2pa:1ee6aaf3-a630-44e0-9c96-6f1302ea6fd5:sdk-integration-test/0.1.0"
  "3rxLuY4csYzu9divPLbOdahysjE4lQnjV2ILb6AgcLM:urn:c2pa:6f2239b8-c91e-49f1-8db1-7ec09f7711cf:turbo-c2pa-demo/0.1.0"
)

# ── Image group 2: pHash 1f0e7b0900ff1f0e (soft binding: Hw57CQD/Hw4=) ──
# 4 manifests of a different test image

GROUP2_TXS=(
  "teRLQH6mA6TufEoydg-UX7AJO_ENzsk-swD5ZfpImg8:urn:c2pa:4f6066e2-6bb0-482b-a589-024a826d803a:turbo-c2pa-demo/0.1.0"
  "k5oUjqt-bpZ7ZraIAzEibupOZYjW1nyGxGikkX8STlE:urn:c2pa:b137ff8c-fe95-4d68-a309-9743bc0883f4:turbo-c2pa-demo/0.1.0"
  "RyVOjiEC7T8W46jxnAXrQEc2XswbObmfw3yVbOlNprs:urn:c2pa:1ea27116-103a-4452-8346-617b03a14c41:turbo-c2pa-demo/0.1.0"
  "YfI_N_DSN0KA2uA7l4tKFLlEtkWlebfm4LYCHuADwwo:urn:c2pa:0c1cee61-5d5b-4f99-95b0-a6885880d1f1:turbo-c2pa-demo/0.1.0"
)

# ── Image group 3: pHash 000000f800000000 (soft binding: AAAA+PgAAAA=) ──
# 6 manifests of a third test image

GROUP3_TXS=(
  "9jT-YVO3nGQDD-lNfOP8NG8-4mb2drWGKt7zZq6GE20:urn:c2pa:6af4d050-1059-4243-8de0-716e921656ef:turbo-c2pa-demo/0.1.0"
  "phTDBfHkAGaNV-4MqitQttjqLX92oSZgfUBNtyz1lmg:urn:c2pa:d412fd65-5e27-4cf1-8d7f-00cb9a708d81:turbo-c2pa-demo/0.1.0"
  "4xTa_ux-lrDvpG4CG0hJYIE39GSxpl6asNTxWZABrac:urn:c2pa:d7b7948c-a7e0-4613-a14a-0d0ffb31feb8:turbo-c2pa-demo/0.1.0"
  "T6hCvQwbeiR5ASY3701P4iFpm4zCC55PN9uh5kfaotM:urn:c2pa:aab66166-89cf-4302-9a1c-73894eb6cebc:turbo-c2pa-demo/0.1.0"
  "rDGn7hF2LCi9SoT33y6BPOGm0wOnO9G6djcfrpOjJMY:urn:c2pa:39de3304-d666-47c5-a6aa-e00f4418daa2:turbo-c2pa-demo/0.1.0"
  "w3Kqkz1ZtlySiCILzl-paj6AtmMumdlN9O5dqO4D3JQ:urn:c2pa:99d83ead-f54f-40c4-9798-df1d78292da1:turbo-c2pa-demo/0.1.0"
)

seed_group() {
  local binding_value="$1"
  shift
  local txs=("$@")
  local indexed=0

  for entry in "${txs[@]}"; do
    IFS=':' read -r txid_raw rest <<< "$entry"
    # txid is the first field, manifest_id is urn:c2pa:UUID, generator is last
    txid="${entry%%:*}"
    manifest_id="urn:c2pa:${entry#*:urn:c2pa:}"
    manifest_id="${manifest_id%:*}"
    generator="${entry##*:}"

    result=$(curl -sf -X POST "${BASE_URL}/webhook" \
      -H "Content-Type: application/json" \
      -d "{
      \"tx_id\": \"${txid}\",
      \"tags\": [
        {\"name\": \"Protocol\", \"value\": \"C2PA-Manifest-Proof\"},
        {\"name\": \"C2PA-Storage-Mode\", \"value\": \"full\"},
        {\"name\": \"C2PA-Manifest-ID\", \"value\": \"${manifest_id}\"},
        {\"name\": \"C2PA-Soft-Binding-Alg\", \"value\": \"org.ar-io.phash\"},
        {\"name\": \"C2PA-Soft-Binding-Value\", \"value\": \"${binding_value}\"},
        {\"name\": \"C2PA-Asset-Content-Type\", \"value\": \"image/jpeg\"},
        {\"name\": \"C2PA-Claim-Generator\", \"value\": \"${generator}\"}
      ],
      \"owner\": \"${OWNER}\",
      \"block_height\": 1500000,
      \"block_timestamp\": 1710000000
    }" 2>&1)

    action=$(echo "$result" | python3 -c "import sys,json; print(json.load(sys.stdin).get('data',{}).get('action','?'))" 2>/dev/null || echo "error")
    if [ "$action" = "indexed" ]; then
      ((indexed++))
    fi
    echo "  ${txid:0:16}... → ${action}"
  done

  echo "  (${indexed} new, $((${#txs[@]} - indexed)) skipped)"
}

echo ""
echo "Group 1: pHash e8f0fcc0f0f0f0f0 (14 manifests)"
seed_group "6PD8wPDw8PA=" "${GROUP1_TXS[@]}"

echo ""
echo "Group 2: pHash 1f0e7b0900ff1f0e (4 manifests)"
seed_group "Hw57CQD/Hw4=" "${GROUP2_TXS[@]}"

echo ""
echo "Group 3: pHash 000000f800000000 (6 manifests)"
seed_group "AAAA+PgAAAA=" "${GROUP3_TXS[@]}"

echo ""
echo "Done. Verifying..."
health=$(curl -sf "${BASE_URL}/health" 2>&1)
count=$(echo "$health" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['stats']['indexedManifests'])" 2>/dev/null)
echo "Total indexed manifests: ${count}"
echo ""
echo "Example searches to try:"
echo "  pHash: e8f0fcc0f0f0f0f0"
echo "  pHash: 1f0e7b0900ff1f0e"
echo "  Manifest: urn:c2pa:fa008c04-cbee-43c2-846c-2a3d3c487219"
echo "  Manifest: urn:c2pa:4f6066e2-6bb0-482b-a589-024a826d803a"
