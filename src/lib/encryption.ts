import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 16
const AUTH_TAG_LENGTH = 16

function getKey(): Buffer {
    const keyHex = process.env.TOKEN_ENCRYPTION_KEY
    if (!keyHex) {
        throw new Error('TOKEN_ENCRYPTION_KEY missing from environment')
    }
    const key = Buffer.from(keyHex, 'hex')
    if (key.length !== 32) {
        throw new Error(
            `TOKEN_ENCRYPTION_KEY must be 32 bytes (64 hex chars). Got ${key.length} bytes.`
        )
    }
    return key
}

/**
 * Encrypts plaintext using AES-256-GCM.
 * Returns a base64-encoded string: iv (16 bytes) + authTag (16 bytes) + ciphertext
 */
export function encrypt(text: string): string {
    if (!text || typeof text !== 'string') {
        throw new Error('Encryption input must be a non-empty string')
    }
    const key = getKey()
    const iv = randomBytes(IV_LENGTH)
    const cipher = createCipheriv(ALGORITHM, key, iv)

    const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()])
    const authTag = cipher.getAuthTag()

    // Layout: [iv (16)] [authTag (16)] [ciphertext]
    return Buffer.concat([iv, authTag, encrypted]).toString('base64')
}

/**
 * Decrypts a base64-encoded AES-256-GCM ciphertext produced by `encrypt`.
 */
export function decrypt(cipher: string): string {
    if (!cipher || typeof cipher !== 'string') {
        throw new Error('Decryption input must be a non-empty string')
    }
    const key = getKey()
    const buf = Buffer.from(cipher, 'base64')

    if (buf.length < IV_LENGTH + AUTH_TAG_LENGTH) {
        throw new Error('Invalid ciphertext: buffer too short')
    }

    const iv = buf.subarray(0, IV_LENGTH)
    const authTag = buf.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH)
    const ciphertext = buf.subarray(IV_LENGTH + AUTH_TAG_LENGTH)

    const decipher = createDecipheriv(ALGORITHM, key, iv)
    decipher.setAuthTag(authTag)

    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8')
}
