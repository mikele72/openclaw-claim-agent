import 'dotenv/config'

const apiKey = process.env.NEYNAR_API_KEY
const signerUuid = process.env.NEYNAR_SIGNER_UUID

if (!apiKey || !signerUuid) {
  console.error("Missing NEYNAR_API_KEY or NEYNAR_SIGNER_UUID in .env")
  process.exit(1)
}

const text = process.argv.slice(2).join(' ')
if (!text) {
  console.error("Usage: node scripts/farcaster_cast.mjs \"your text\"")
  process.exit(1)
}

const res = await fetch("https://api.neynar.com/v2/farcaster/cast", {
  method: "POST",
  headers: {
    "accept": "application/json",
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
