export async function generateKey(): Promise<string> {
  const key = await window.crypto.subtle.generateKey(
    {
      name: "AES-GCM",
      length: 256,
    },
    true,
    ["encrypt", "decrypt"]
  )
  const exported = await window.crypto.subtle.exportKey("jwk", key)
  return btoa(JSON.stringify(exported))
}

export async function importKey(keyStr: string): Promise<CryptoKey> {
  const jwk = JSON.parse(atob(keyStr))
  return await window.crypto.subtle.importKey(
    "jwk",
    jwk,
    "AES-GCM",
    true,
    ["encrypt", "decrypt"]
  )
}

export async function encryptMessage(text: string, key: CryptoKey): Promise<string> {
  const encoded = new TextEncoder().encode(text)
  const iv = window.crypto.getRandomValues(new Uint8Array(12))
  
  const encrypted = await window.crypto.subtle.encrypt(
    {
      name: "AES-GCM",
      iv: iv,
    },
    key,
    encoded
  )

  const encryptedArray = new Uint8Array(encrypted)
  const buf = new Uint8Array(iv.length + encryptedArray.length)
  buf.set(iv)
  buf.set(encryptedArray, iv.length)
  
  return btoa(String.fromCharCode(...buf))
}

export async function decryptMessage(encryptedText: string, key: CryptoKey): Promise<string> {
  try {
    const str = atob(encryptedText)
    const buf = new Uint8Array(str.length)
    for (let i = 0; i < str.length; i++) {
      buf[i] = str.charCodeAt(i)
    }

    const iv = buf.slice(0, 12)
    const data = buf.slice(12)

    const decrypted = await window.crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: iv,
      },
      key,
      data
    )

    return new TextDecoder().decode(decrypted)
  } catch {
    return "🔒 Decryption failed"
  }
}
