#!/usr/bin/env node
// Encrypts a self-contained HTML page for the password-gated /designsystemcheck route.
//
// Usage:
//   node scripts/encrypt-designsystemcheck.mjs <input.html> [password] [output.json]
//   DSC_PASSWORD=... node scripts/encrypt-designsystemcheck.mjs <input.html>
//
// The password comes from the 2nd argument or the DSC_PASSWORD env var (never hard-coded).
// Output (default public/designsystemcheck/payload.json) holds only ciphertext:
// AES-256-GCM, key derived with PBKDF2-SHA256 from the password, random salt and IV.
// public/designsystemcheck/index.html decrypts it in the browser.
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { webcrypto as crypto } from 'node:crypto'

const ITERATIONS = 600_000
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')

const [input, argPassword, argOut] = process.argv.slice(2)
const password = argPassword || process.env.DSC_PASSWORD
if (!input || !password) {
  console.error('Usage: node scripts/encrypt-designsystemcheck.mjs <input.html> [password] [output.json]')
  console.error('       (or pass the password via the DSC_PASSWORD env var)')
  process.exit(1)
}
const out = resolve(argOut || resolve(root, 'public/designsystemcheck/payload.json'))

const plain = await readFile(input)
const salt = crypto.getRandomValues(new Uint8Array(16))
const iv = crypto.getRandomValues(new Uint8Array(12))
const baseKey = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, [
  'deriveKey',
])
const key = await crypto.subtle.deriveKey(
  { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: ITERATIONS },
  baseKey,
  { name: 'AES-GCM', length: 256 },
  false,
  ['encrypt'],
)
const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, plain))

const b64 = (u8) => Buffer.from(u8).toString('base64')
const payload = { v: 1, kdf: 'PBKDF2-SHA256', iter: ITERATIONS, salt: b64(salt), iv: b64(iv), ct: b64(ct) }
await mkdir(dirname(out), { recursive: true })
await writeFile(out, JSON.stringify(payload))
console.log(`Encrypted ${plain.length} bytes -> ${out}`)
