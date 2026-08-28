// Serverless Endpoint for Google Gemini API Multimodal Product Scanning
import { authenticateRequest } from '../lib/auth.js';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || 
                       process.env.GOOGLE_GEMINI_API_KEY || 
                       process.env.VITE_GEMINI_API_KEY || 
                       process.env.VITE_GOOGLE_GEMINI_API_KEY || '';

function getCleanBase64(base64Str) {
    if (base64Str.startsWith('data:')) {
        const parts = base64Str.split(';base64,');
        return parts[1] || base64Str;
    }
    return base64Str;
}

async function extractTextUsingGemini(base64Image, apiKey) {
    const cleanBase64 = getCleanBase64(base64Image);
    const candidateModels = [
        'gemini-3.5-flash',
        'gemini-3.6-flash',
        'gemini-2.5-flash',
        'gemini-flash-latest'
    ];

    let lastError = null;

    for (const modelName of candidateModels) {
        try {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{
                        parts: [
                            {
                                text: "You are an expert product label analyzer. Extract all text and declarations visible on this product packaging label accurately without hallucinating or making up missing information. Focus on capturing: Product Name/Title, Brand Name, Net Quantity/Weight, Price/MRP (specifically keeping any Indian Rupee ₹ symbols intact), Dates (MFG Date, Packing Date, EXP Date, Best Before), FSSAI License Number, Barcode digits, Manufacturer Name and Complete Address, Consumer Care contact info, and Country of Origin. Print the text clearly line-by-line as it appears on the label."
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
            if (response.ok && !data.error) {
                const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
                if (text && text.trim()) {
                    console.log(`✅ Success with Gemini model [${modelName}]`);
                    return text;
                }
            } else {
                console.warn(`Model [${modelName}] failed:`, data.error?.message || response.status);
                lastError = data.error?.message || `HTTP ${response.status}`;
            }
        } catch (err) {
            console.warn(`Model [${modelName}] request exception:`, err.message);
            lastError = err.message;
        }
    }

    throw new Error(`All Gemini Vision models failed. Last error: ${lastError}`);
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
        // Authenticate requests
        const decoded = await authenticateRequest(req);
        if (!decoded || !decoded.userId) {
            return res.status(401).json({ error: 'Unauthorized. Must be signed in to perform scans.' });
        }

        const { image } = req.body || {};
        if (!image) {
            return res.status(400).json({ error: 'Image base64 content is required' });
        }

        if (!GEMINI_API_KEY) {
            return res.status(400).json({ 
                error: 'Google Gemini API key (GEMINI_API_KEY or GOOGLE_GEMINI_API_KEY) is not configured in Vercel environment variables.' 
            });
        }

        console.log('Running Google Gemini API Multimodal Vision Scanner...');
        const extractedText = await extractTextUsingGemini(image, GEMINI_API_KEY);
        console.log('✅ Google Gemini API scan successful');

        return res.status(200).json({ text: extractedText });

    } catch (error) {
        console.error('Gemini Vision processing handler error:', error);
        return res.status(500).json({ error: 'Gemini Vision processing failed', details: error.message });
    }
}
