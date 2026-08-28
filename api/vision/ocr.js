// Secure Server-Side Google Cloud Vision OCR Proxy Function
import jwt from 'jsonwebtoken';
import { authenticateRequest } from '../lib/auth.js';

function parsePrivateKey(raw) {
    if (!raw) return '';
    // Remove surrounding quotes if present
    let key = raw.replace(/^["']|["']$/g, '');
    // Replace all forms of escaped newlines with actual newlines
    key = key.replace(/\\\\n/g, '\n').replace(/\\n/g, '\n');
    return key;
}

const SERVICE_ACCOUNT = {
    client_email: process.env.GOOGLE_CLOUD_CLIENT_EMAIL || process.env.VITE_GOOGLE_CLOUD_CLIENT_EMAIL || '',
    private_key: parsePrivateKey(process.env.GOOGLE_CLOUD_PRIVATE_KEY || process.env.VITE_GOOGLE_CLOUD_PRIVATE_KEY || ''),
    token_uri: "https://oauth2.googleapis.com/token"
};

let cachedToken = null;

async function getAccessToken() {
    if (!SERVICE_ACCOUNT.client_email || !SERVICE_ACCOUNT.private_key) {
        throw new Error('Google Cloud Vision credentials are not configured on the server side.');
    }

    if (cachedToken && Date.now() < cachedToken.expiry - 60000) {
        return cachedToken.token;
    }

    const now = Math.floor(Date.now() / 1000);
    const payload = {
        iss: SERVICE_ACCOUNT.client_email,
        sub: SERVICE_ACCOUNT.client_email,
        aud: SERVICE_ACCOUNT.token_uri,
        iat: now,
        exp: now + 3600,
        scope: "https://www.googleapis.com/auth/cloud-vision"
    };

    // Sign the JWT with RS256 algorithm using jsonwebtoken library on the server side
    const signedJwt = jwt.sign(payload, SERVICE_ACCOUNT.private_key, { algorithm: 'RS256' });

    const tokenResponse = await fetch(SERVICE_ACCOUNT.token_uri, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
            assertion: signedJwt
        })
    });

    const tokenData = await tokenResponse.json();

    if (tokenData.error) {
        throw new Error(`Token exchange error: ${tokenData.error_description || tokenData.error}`);
    }

    cachedToken = {
        token: tokenData.access_token,
        expiry: Date.now() + (tokenData.expires_in * 1000)
    };

    return cachedToken.token;
}

export default async function handler(req, res) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        // Authenticate requests to prevent unauthorized users from consuming Google Vision API billing quota
        const decoded = await authenticateRequest(req);
        if (!decoded || !decoded.userId) {
            return res.status(401).json({ error: 'Unauthorized. Must be signed in to perform scans.' });
        }

        const { image } = req.body || {};
        if (!image) {
            return res.status(400).json({ error: 'Image base64 content is required' });
        }

        const isPlaceholder = !SERVICE_ACCOUNT.client_email || 
            SERVICE_ACCOUNT.client_email.includes('your-service-account') || 
            !SERVICE_ACCOUNT.private_key || 
            SERVICE_ACCOUNT.private_key.includes('YOUR_PRIVATE_KEY_HERE');

        if (isPlaceholder) {
            console.log('Google Cloud Vision credentials are not set in production backend.');
            return res.status(200).json({ text: '', isMock: true, error: 'Google Cloud Vision API credentials are not configured on the server side.' });
        }

        const accessToken = await getAccessToken();

        const googleResponse = await fetch('https://vision.googleapis.com/v1/images:annotate', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                requests: [{
                    image: { content: image },
                    features: [
                        { type: 'DOCUMENT_TEXT_DETECTION' },
                        { type: 'TEXT_DETECTION' }
                    ]
                }]
            })
        });

        const data = await googleResponse.json();

        if (data.error) {
            console.error('Google Vision API Error:', data.error);
            return res.status(500).json({ error: 'Google Vision API failed', details: data.error });
        }

        const responses = data.responses?.[0];
        const extractedText = responses?.fullTextAnnotation?.text || responses?.textAnnotations?.[0]?.description || '';

        return res.status(200).json({ text: extractedText });

    } catch (error) {
        console.error('Vision proxy handler error:', error);
        return res.status(500).json({ error: 'Vision processing failed', details: error.message });
    }
}
