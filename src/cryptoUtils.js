// Simple encryption using Web Crypto API
// In a real scenario, the key should come from a user password or a secure vault.
// For this extension, we'll generate a local key on first run to obfuscate storage.

const ALGO = { name: 'AES-GCM', length: 256 };

export async function getOrCreateKey() {
    // Try to retrieve key from local storage
    const result = await chrome.storage.local.get('encryptionKey');
    if (result.encryptionKey) {
        // Import the key back from JSON/JWK
        return crypto.subtle.importKey(
            'jwk',
            result.encryptionKey,
            ALGO,
            true,
            ['encrypt', 'decrypt']
        );
    }

    // Generate new key
    const key = await crypto.subtle.generateKey(ALGO, true, ['encrypt', 'decrypt']);

    // Export and save
    const exported = await crypto.subtle.exportKey('jwk', key);
    await chrome.storage.local.set({ encryptionKey: exported });
    return key;
}

export async function encryptData(data) {
    const key = await getOrCreateKey();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encoded = new TextEncoder().encode(JSON.stringify(data));

    const encrypted = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv: iv },
        key,
        encoded
    );

    // Return as string: IV + Encrypted Data (Base64)
    const ivStr = btoa(String.fromCharCode(...iv));
    const dataStr = btoa(String.fromCharCode(...new Uint8Array(encrypted)));
    return `${ivStr}:${dataStr}`;
}

export async function decryptData(cipherText) {
    if (!cipherText || !cipherText.includes(':')) {
        throw new Error('Invalid cipher text format');
    }

    const key = await getOrCreateKey();
    const [ivStr, dataStr] = cipherText.split(':');

    const iv = new Uint8Array(atob(ivStr).split('').map(c => c.charCodeAt(0)));
    const data = new Uint8Array(atob(dataStr).split('').map(c => c.charCodeAt(0)));

    // This will throw a DOMException if the key is wrong or data is corrupt
    const decrypted = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: iv },
        key,
        data
    );

    return JSON.parse(new TextDecoder().decode(decrypted));
}
