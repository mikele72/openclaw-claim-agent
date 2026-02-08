import { execSync } from 'child_process'
import 'dotenv/config'
import { createPublicClient, createWalletClient, http, parseAbi, isAddress, zeroAddress } from 'viem'
import { baseSepolia } from 'viem/chains'
import { privateKeyToAccount } from 'viem/accounts'
import fs from 'fs'

const rpc = process.env.BASE_SEPOLIA_RPC
const pk = process.env.PRIVATE_KEY

// Farcaster (Neynar)
const neynarKey = process.env.NEYNAR_API_KEY
const signerUuid = process.env.NEYNAR_SIGNER_UUID

if (!rpc || !pk) {
  console.error('Missing BASE_SEPOLIA_RPC or PRIVATE_KEY in .env')
  process.exit(1)
}

const account = privateKeyToAccount(pk)

const publicClient = createPublicClient({
  chain: baseSepolia,
  transport: http(rpc),
})

const walletClient = createWalletClient({
  account,
  chain: baseSepolia,
  transport: http(rpc),
})

const usersFile = './state/users.json'
const users = JSON.parse(fs.readFileSync(usersFile, 'utf8'))

const statusFile = './state/status.json'
const airdropsFile = './airdrops/base-sepolia.json'
const airdropsRegistry = JSON.parse(fs.readFileSync(airdropsFile, 'utf8'))

function readStatus() {
  try {
    const s = JSON.parse(fs.readFileSync(statusFile, 'utf8'))
    return s?.lastStatus || 'unknown'
  } catch {
    return 'unknown'
  }
}

function writeStatus(lastStatus) {
  fs.writeFileSync(statusFile, JSON.stringify({ lastStatus }, null, 2))
}

function postToFarcaster(msg) {
  if (!neynarKey || !signerUuid) {
    console.log('Skipping Farcaster post (missing NEYNAR_API_KEY or NEYNAR_SIGNER_UUID)')
    return
  }
  try {
    execSync(`node scripts/farcaster_cast_stdin.mjs`, {
      input: msg,
      stdio: ['pipe', 'inherit', 'inherit'],
    })
  } catch (e) {
    console.error('Farcaster post failed:', e?.message || e)
  }
}

const abiSimple = parseAbi([
  'function claimable(address) view returns (uint256)',
  'function claimReward()',
])

const abiMerkle = parseAbi([
  'function isClaimed(uint256) view returns (bool)',
  'function claim(uint256,address,uint256,bytes32[])',
])

function loadMerkleProofs(path) {
  try {
    return JSON.parse(fs.readFileSync(path, 'utf8'))
  } catch (e) {
    console.error(`Failed to read proofs file: ${path}`, e?.message || e)
    return null
  }
}

function normalizeAddr(a) {
  return (a || '').toLowerCase()
}

async function run() {
  const ts = new Date().toISOString()
  const prevStatus = readStatus()

  let actions = 0
  const lines = []

  for (const target of Object.keys(users.users)) {
    const targetLc = normalizeAddr(target)

    for (const drop of airdropsRegistry.airdrops || []) {
      if (!drop?.contract || !isAddress(drop.contract)) {
        console.log(`[${drop?.id || 'unknown'}] Skipping: invalid contract address`)
        continue
      }

      // ---------- SIMPLE ----------
      if (drop.type === 'simple') {
        const amount = await publicClient.readContract({
          address: drop.contract,
          abi: abiSimple,
          functionName: 'claimable',
          args: [target],
        })

        if (amount > 0n) {
          console.log(`[${drop.id}] Claiming for ${target} amount ${amount}`)

          const txHash = await walletClient.writeContract({
            address: drop.contract,
            abi: abiSimple,
            functionName: 'claimReward',
          })

          console.log(`[${drop.id}] Tx: ${txHash}`)

          actions += 1
          lines.push(
            `• Airdrop: ${drop.name} (${drop.tokenSymbol})\n  Type: simple\n  Target: ${target}\n  Amount: ${amount.toString()}\n  Tx: ${txHash}`
          )
        } else {
          console.log(`[${drop.id}] No claim for ${target}`)
        }
      }

      // ---------- MERKLE ----------
      if (drop.type === 'merkle') {
        const proofsPath = drop.proofs
        const proofs = loadMerkleProofs(proofsPath)
        if (!proofs?.claims) {
          console.log(`[${drop.id}] No proofs/claims found`)
          continue
        }

        const entry = proofs.claims[target] || proofs.claims[targetLc]
        if (!entry) {
          console.log(`[${drop.id}] No merkle entry for ${target}`)
          continue
        }

        const index = BigInt(entry.index)
        const amount = BigInt(entry.amount)
        const proof = entry.proof

        // FAIL-SAFE: if contract is 0x0 we do not send tx
        if (drop.contract === zeroAddress) {
          console.log(
            `[${drop.id}] Found merkle claim for ${target} amount ${amount} (DRY: contract is 0x0)`
          )
          // count as "claimable" signal (so we can test status/logic) but no tx
          actions += 1
          lines.push(
            `• Airdrop: ${drop.name} (${drop.tokenSymbol})\n  Type: merkle (dry)\n  Target: ${target}\n  Amount: ${amount.toString()}\n  Note: contract=0x0, not broadcasting`
          )
          continue
        }

        // If real merkle contract: check if already claimed
        const alreadyClaimed = await publicClient.readContract({
          address: drop.contract,
          abi: abiMerkle,
          functionName: 'isClaimed',
          args: [index],
        })

        if (alreadyClaimed) {
          console.log(`[${drop.id}] Already claimed index ${index} for ${target}`)
          continue
        }

        console.log(`[${drop.id}] Claiming merkle for ${target} amount ${amount}`)

        const txHash = await walletClient.writeContract({
          address: drop.contract,
          abi: abiMerkle,
          functionName: 'claim',
          args: [index, target, amount, proof],
        })

        console.log(`[${drop.id}] Tx: ${txHash}`)

        actions += 1
        lines.push(
          `• Airdrop: ${drop.name} (${drop.tokenSymbol})\n  Type: merkle\n  Target: ${target}\n  Amount: ${amount.toString()}\n  Tx: ${txHash}`
        )
      }
    }
  }

  const currentStatus = actions > 0 ? 'claimable' : 'no_claim'
  writeStatus(currentStatus)

  if (actions > 0) {
    const msg = `🟦 ClawClaimAgent scan ✅
Run: ${ts}
Agent: ${account.address}
Network: Base Sepolia

Findings (${actions}):
${lines.join('\n')}`

    postToFarcaster(msg)
  } else {
    // Heartbeat only when status changes from claimable -> no_claim
    if (prevStatus === 'claimable') {
      const msg = `🟦 ClawClaimAgent heartbeat ✅
Run: ${ts}
Agent: ${account.address}
Network: Base Sepolia
Status: nothing claimable`

      postToFarcaster(msg)
    } else {
      console.log(`No heartbeat posted (status unchanged: ${prevStatus} -> ${currentStatus})`)
    }
  }
}

run().catch((e) => {
  console.error('Run failed:', e)
  process.exit(1)
})
