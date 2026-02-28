// src/authManager.js
export async function getAwsCredentials(credsList) {
    // Current mapping: return an array of creds.
    // For single, it was creds.aws.
    // Ensure array format for Phase 4 multi-account
    return Array.isArray(credsList) ? credsList : (credsList ? [credsList] : []);
}

export async function getAzureToken(creds) {
    // Wrap the Azure logic from azureService here later, or just return the credentials.
    // In Phase 7: All credential handling must pass through this layer.
    return Array.isArray(creds) ? creds : (creds ? [creds] : []);
}

export async function getGcpAccessToken(creds) {
    return Array.isArray(creds) ? creds : (creds ? [creds] : []);
}
