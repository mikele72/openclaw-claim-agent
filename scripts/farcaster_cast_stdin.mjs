import 'dotenv/config'
import fs from 'fs'

const text = fs.readFileSync(0, 'utf8').trim()
if (!text) {
  console.error("Missing cast text on stdin")
  process.exit(1)
}

const apiKey = process.env.NEYNAR_API_KEY
const signerUuid = process.env.NEYNAR_SIGNER_UUID

if (!apiKey || !signerUuid) {
  console.error("Missing NEYNAR_API_KEY or NEYNAR_SIGNER_UUID")
  process.exit(1)
}

const res = await fetch("https://api.neynar.com/v2/farcaster/cast", {
  method: "POST",
  headers: {
    "content-type": "application/json",
    "api_key": apiKey
  },
  body: JSON.stringify({
    signer_uuid: signerUuid,
    text
  })
})

const json = await res.json()
if (!res.ok) {
  console.error("Cast failed:", res.status, json)
  process.exit(1)
}

console.log("✅ Cast posted:", json?.cast?.hash || json)
