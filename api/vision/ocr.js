// Secure Server-Side Google Cloud Vision and Gemini API OCR Proxy Function
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

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || '';

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

function getCleanBase64(base64Str) {
    if (base64Str.startsWith('data:')) {
        const parts = base64Str.split(';base64,');
        return parts[1] || base64Str;
    }
    return base64Str;
}

async function extractTextUsingGemini(base64Image, apiKey) {
    const cleanBase64 = getCleanBase64(base64Image);
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            contents: [{
                parts: [
                    {
                        text: "You are an expert product label reader. Please extract all the text visible on this product packaging label. Focus on capturing details like: brand/product name, net quantity/weight, price/MRP (specifically keeping any Indian Rupee ₹ symbols intact), dates (MFG, EXP, Best Before), FSSAI license numbers, barcodes, manufacturer details, and consumer care info. Print the text line-by-line as it appears on the label."
                    },
                    {
                        inlineData: {
                            mimeType: "image/jpeg",
                            data: cleanBase64
                        }
                    }
                ]
            }]
        })
    });

    const data = await response.json();
    if (data.error) {
        throw new Error(data.error.message || JSON.stringify(data.error));
    }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    return text;
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

        // Try Google Cloud Vision first if configured
        const isVisionConfigured = SERVICE_ACCOUNT.client_email && 
            !SERVICE_ACCOUNT.client_email.includes('your-service-account') && 
            SERVICE_ACCOUNT.private_key && 
            !SERVICE_ACCOUNT.private_key.includes('YOUR_PRIVATE_KEY_HERE');

        if (isVisionConfigured) {
            try {
                console.log('Running Google Cloud Vision API on backend...');
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

                if (!data.error) {
                    const responses = data.responses?.[0];
                    const extractedText = responses?.fullTextAnnotation?.text || responses?.textAnnotations?.[0]?.description || '';
                    if (extractedText && extractedText.trim()) {
                        console.log('✅ Google Cloud Vision API scan success');
                        return res.status(200).json({ text: extractedText });
                    }
                } else {
                    console.warn('Google Vision API reported error, trying Gemini fallback:', data.error);
                }
            } catch (visionErr) {
                console.warn('Google Vision API path failed, attempting Gemini API fallback:', visionErr.message);
            }
        }

        // Fallback to Google Gemini API
        if (GEMINI_API_KEY) {
            try {
                console.log('Running Google Gemini Vision API on backend...');
                const extractedText = await extractTextUsingGemini(image, GEMINI_API_KEY);
                console.log('✅ Google Gemini Vision API scan success');
                return res.status(200).json({ text: extractedText });
            } catch (geminiErr) {
                console.error('Google Gemini API failed:', geminiErr.message);
                return res.status(500).json({ error: 'OCR processing failed', details: geminiErr.message });
            }
        }

        return res.status(400).json({ 
            error: 'Google Cloud Vision and Gemini API credentials are not configured on the server side.' 
        });

    } catch (error) {
        console.error('Vision proxy handler error:', error);
        return res.status(500).json({ error: 'Vision processing failed', details: error.message });
    }
}
