// Serverless Endpoint for Google Gemini API Multimodal Product Scanning
import { authenticateRequest } from '../lib/auth.js';

const getGeminiApiKey = () => {
    return process.env.GEMINI_API_KEY || 
           process.env.GOOGLE_GEMINI_API_KEY || 
           process.env.VITE_GEMINI_API_KEY || 
           process.env.VITE_GOOGLE_GEMINI_API_KEY || '';
};

function getCleanBase64AndMime(base64Str) {
    if (!base64Str) return { data: '', mimeType: 'image/jpeg' };
    
    let mimeType = 'image/jpeg';
    let data = base64Str;
    
    if (base64Str.startsWith('data:')) {
        const matches = base64Str.match(/^data:([^;]+);base64,(.*)$/s);
        if (matches) {
            mimeType = matches[1] || 'image/jpeg';
            data = matches[2] || '';
        } else {
            const parts = base64Str.split(';base64,');
            data = parts[1] || base64Str;
        }
    }
    
    // Remove any leftover whitespace or newlines
    data = data.replace(/\s/g, '');
    return { data, mimeType };
}

async function analyzePackagingWithGemini(base64Image, apiKey) {
    const { data: cleanBase64, mimeType } = getCleanBase64AndMime(base64Image);
    
    if (!cleanBase64) {
        throw new Error('Image base64 data is empty or invalid.');
    }

    const candidateModels = [
        'gemini-3.6-flash',
        'gemini-3.5-flash',
        'gemini-2.5-flash',
        'gemini-2.0-flash',
        'gemini-1.5-flash',
        'gemini-flash-latest'
    ];

    const promptText = `You are an expert Legal Metrology and packaged commodity inspector.
Carefully examine the provided packaging/product label image. Extract all declarations accurately without inventing, guessing, or hallucinating information.

Return a strictly valid JSON object with the following structure:
{
  "rawText": "Complete transcript of all visible text and declarations on the label, line by line.",
  "product": {
    "productName": "Exact main product title or common identity (e.g. Parle-G Biscuits, Aloo Bhujia, Coca-Cola). Null if not visible.",
    "brand": "Brand or trademark name (e.g. Haldiram's, Britannia, Nestle). Null if not visible.",
    "netQuantity": "Numeric quantity value only (e.g. 200, 500, 1). Null if not visible.",
    "quantityUnit": "Unit of measurement: g, kg, ml, L, pcs, or units. Null if not visible.",
    "mrp": "Maximum Retail Price number only without currency symbols (e.g. 249.00, 45, 10.00). Do not confuse rupee symbol ₹ with digit 3. Null if not visible.",
    "manufacturingDate": "Manufacturing / Packing date exactly as printed or in standard format (e.g. 2026-08-15, 15/08/2026, AUG 2026). Null if not visible.",
    "expiryDate": "Best before / Expiry date or duration (e.g. 2026-12-31, 12 Months from PKD). Null if not visible.",
    "manufacturerName": "Name of manufacturer, packer, or marketer. Null if not visible.",
    "manufacturerAddress": "Complete physical address of the manufacturer/packer if visible. Null if not visible.",
    "consumerCare": "Customer care phone number, helpline, email address, or contact info. Null if not visible.",
    "fssaiLicense": "14-digit FSSAI License Number if present. Null if not visible.",
    "countryOfOrigin": "Country of origin / manufacturing (e.g. India). Null if not visible.",
    "unitSalePrice": "Unit sale price (USP per g/ml) if indicated. Null if not visible.",
    "barcode": "Numeric barcode / EAN / UPC digits if visible on the label. Null if not visible."
  }
}

Respond ONLY with the JSON object. Do not include markdown code block syntax or additional explanatory text.`;

    let lastError = null;

    for (const modelName of candidateModels) {
        try {
            console.log(`[OCR Backend] Calling Gemini model: ${modelName}`);
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;
            
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    contents: [{
                        parts: [
                            { text: promptText },
                            {
                                inlineData: {
                                    mimeType: mimeType || 'image/jpeg',
                                    data: cleanBase64
                                }
                            }
                        ]
                    }],
                    generationConfig: {
                        temperature: 0.1,
                        responseMimeType: "application/json"
                    }
                })
            });

            const data = await response.json();
            
            if (response.ok && !data.error) {
                const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
                if (responseText && responseText.trim()) {
                    try {
                        // Strip markdown formatting if returned
                        const cleanJsonStr = responseText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
                        const parsed = JSON.parse(cleanJsonStr);
                        console.log(`[OCR Backend] ✅ Successfully parsed structured extraction from [${modelName}]`);
                        return {
                            rawText: parsed.rawText || '',
                            product: parsed.product || {}
                        };
                    } catch (parseErr) {
                        console.warn(`[OCR Backend] JSON parse error from model [${modelName}], falling back to text:`, parseErr.message);
                        return {
                            rawText: responseText,
                            product: {}
                        };
                    }
                }
            } else {
                const errDetail = data.error?.message || `HTTP ${response.status}`;
                console.warn(`[OCR Backend] Model [${modelName}] error:`, errDetail);
                lastError = errDetail;
            }
        } catch (err) {
            console.warn(`[OCR Backend] Exception with model [${modelName}]:`, err.message);
            lastError = err.message;
        }
    }

    throw new Error(`Google Gemini Vision request failed for all candidate models. Last error: ${lastError}`);
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
        // Optional user authentication check (allow unauthenticated / guest inspections)
        let userId = null;
        try {
            const decoded = await authenticateRequest(req);
            if (decoded && decoded.userId) {
                userId = decoded.userId;
            }
        } catch (e) {
            // Guest session
        }

        const { image, apiKey: clientApiKey } = req.body || {};
        if (!image) {
            return res.status(400).json({ error: 'Image content is required.' });
        }

        const apiKey = clientApiKey || req.headers['x-gemini-api-key'] || getGeminiApiKey();
        if (!apiKey) {
            return res.status(400).json({ 
                error: 'Google Gemini API key (GEMINI_API_KEY) is not configured in environment variables or request.' 
            });
        }

        console.log(`[OCR Backend] Processing image scan (User: ${userId || 'Guest'})...`);
        const { rawText, product } = await analyzePackagingWithGemini(image, apiKey);
        console.log(`[OCR Backend] ✅ Scan complete. Text length: ${rawText.length}, Product name: ${product?.productName || 'None'}`);

        return res.status(200).json({
            success: true,
            text: rawText,
            product: product || {}
        });

    } catch (error) {
        console.error('[OCR Backend] Handler error:', error);
        return res.status(500).json({ 
            error: 'Gemini Vision processing failed', 
            details: error.message 
        });
    }
}
