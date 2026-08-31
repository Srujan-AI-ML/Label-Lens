// Image preprocessing and AI vision service using Google Gemini API

export interface StructuredProduct {
    productName?: string | null;
    brand?: string | null;
    netQuantity?: string | null;
    quantityUnit?: string | null;
    mrp?: string | null;
    manufacturingDate?: string | null;
    expiryDate?: string | null;
    manufacturerName?: string | null;
    manufacturerAddress?: string | null;
    consumerCare?: string | null;
    fssaiLicense?: string | null;
    countryOfOrigin?: string | null;
    unitSalePrice?: string | null;
    barcode?: string | null;
}

export interface GeminiScanDeclarationSpatial {
    field: string;
    boundingBox?: { ymin: number; xmin: number; ymax: number; xmax: number } | null;
    onPackage?: boolean;
    onPDP?: boolean;
    estimatedHeightPx?: number;
}

export interface GeminiScanSpatial {
    packagingBox?: { ymin: number; xmin: number; ymax: number; xmax: number } | null;
    pdpBox?: { ymin: number; xmin: number; ymax: number; xmax: number } | null;
    declarations?: GeminiScanDeclarationSpatial[];
}

export interface GeminiScanVisualQuality {
    contrastRatio?: 'high' | 'medium' | 'low';
    clarity?: 'clear' | 'blurry' | 'partially_occluded';
    lighting?: 'adequate' | 'glare' | 'dark';
    readabilityNotes?: string;
}

export interface GeminiScanResult {
    text: string;
    product: StructuredProduct;
    spatial?: GeminiScanSpatial | null;
    visualQuality?: GeminiScanVisualQuality | null;
}

export const saveUserGeminiApiKey = (key: string): void => {
    if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem('gemini_api_key', key.trim());
    }
};

export const getUserGeminiApiKey = (): string => {
    if (typeof window !== 'undefined' && window.localStorage) {
        const stored = window.localStorage.getItem('gemini_api_key') ||
                       window.localStorage.getItem('GEMINI_API_KEY') ||
                       window.localStorage.getItem('labellens_gemini_key');
        if (stored && stored.trim()) return stored.trim();
    }
    try {
        return (import.meta.env.VITE_GEMINI_API_KEY as string) ||
               (import.meta.env.GEMINI_API_KEY as string) || '';
    } catch {
        return '';
    }
};

const getClientEnvKey = (): string => {
    return getUserGeminiApiKey();
};

async function callGeminiDirectlyFromClient(imagePayload: string, apiKey: string): Promise<GeminiScanResult> {
    console.log('--- [PIPELINE] DIRECT CLIENT GEMINI API FALLBACK START ---');
    
    let mimeType = 'image/jpeg';
    let cleanBase64 = imagePayload;

    if (imagePayload.startsWith('data:')) {
        const matches = imagePayload.match(/^data:([^;]+);base64,(.*)$/s);
        if (matches) {
            mimeType = matches[1] || 'image/jpeg';
            cleanBase64 = matches[2] || '';
        } else {
            const parts = imagePayload.split(';base64,');
            cleanBase64 = parts[1] || imagePayload;
        }
    }

    cleanBase64 = cleanBase64.replace(/\s/g, '');

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
Also perform spatial packaging layout and visual readability analysis.

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
  },
  "spatial": {
    "packagingBox": { "ymin": 0, "xmin": 0, "ymax": 1000, "xmax": 1000 },
    "pdpBox": { "ymin": 0, "xmin": 0, "ymax": 1000, "xmax": 1000 },
    "declarations": [
      {
        "field": "genericName",
        "boundingBox": { "ymin": 50, "xmin": 50, "ymax": 150, "xmax": 950 },
        "onPackage": true,
        "onPDP": true,
        "estimatedHeightPx": 28
      },
      {
        "field": "netQuantity",
        "boundingBox": { "ymin": 400, "xmin": 60, "ymax": 470, "xmax": 350 },
        "onPackage": true,
        "onPDP": true,
        "estimatedHeightPx": 18
      },
      {
        "field": "mrp",
        "boundingBox": { "ymin": 480, "xmin": 60, "ymax": 550, "xmax": 400 },
        "onPackage": true,
        "onPDP": true,
        "estimatedHeightPx": 16
      },
      {
        "field": "manufactureDate",
        "boundingBox": { "ymin": 560, "xmin": 60, "ymax": 620, "xmax": 450 },
        "onPackage": true,
        "onPDP": true,
        "estimatedHeightPx": 14
      },
      {
        "field": "bestBefore",
        "boundingBox": { "ymin": 630, "xmin": 60, "ymax": 690, "xmax": 450 },
        "onPackage": true,
        "onPDP": true,
        "estimatedHeightPx": 14
      },
      {
        "field": "manufacturer",
        "boundingBox": { "ymin": 700, "xmin": 60, "ymax": 850, "xmax": 950 },
        "onPackage": true,
        "onPDP": false,
        "estimatedHeightPx": 12
      },
      {
        "field": "consumerCare",
        "boundingBox": { "ymin": 860, "xmin": 60, "ymax": 940, "xmax": 950 },
        "onPackage": true,
        "onPDP": false,
        "estimatedHeightPx": 11
      }
    ]
  },
  "visualQuality": {
    "contrastRatio": "high",
    "clarity": "clear",
    "lighting": "adequate",
    "readabilityNotes": "High contrast dark typography on clean bright label background with sharp edge clarity."
  }
}

Use normalized coordinates (0 to 1000 for ymin, xmin, ymax, xmax).
Respond ONLY with the JSON object. Do not include markdown code block syntax or additional explanatory text.`;

    let lastError = null;

    for (const modelName of candidateModels) {
        try {
            console.log(`[Client Gemini] Requesting model: ${modelName}`);
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
                    const cleanJsonStr = responseText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
                    const parsed = JSON.parse(cleanJsonStr);
                    console.log(`[Client Gemini] ✅ Success with model [${modelName}]`);
                    return {
                        text: parsed.rawText || '',
                        product: parsed.product || {},
                        spatial: parsed.spatial || null,
                        visualQuality: parsed.visualQuality || null
                    };
                }
            } else {
                lastError = data.error?.message || `HTTP ${response.status}`;
            }
        } catch (err: any) {
            lastError = err.message;
        }
    }

    throw new Error(`Direct Gemini API failed. ${lastError}`);
}

// Call Serverless Endpoint for Google Gemini API Vision Scanning with structured extraction and tracing
export async function scanProductImageWithGemini(imagePayload: string): Promise<GeminiScanResult> {
    console.log('--- [PIPELINE] SCAN START ---');
    
    if (!imagePayload || !imagePayload.trim()) {
        console.error('--- [PIPELINE] ERROR: Image payload is empty ---');
        throw new Error('Image data is missing or empty.');
    }

    console.log('--- [PIPELINE] IMAGE RECEIVED ---');
    
    let mimeType = 'image/jpeg';
    let cleanBase64 = imagePayload;

    if (imagePayload.startsWith('data:')) {
        const mimeMatch = imagePayload.match(/^data:([^;]+);base64,/);
        if (mimeMatch) {
            mimeType = mimeMatch[1];
        }
        cleanBase64 = imagePayload.split(',')[1] || imagePayload;
    }

    const byteLength = Math.round((cleanBase64.length * 3) / 4);
    console.log(`--- [PIPELINE] IMAGE SIZE: ${byteLength} bytes (${(byteLength / 1024).toFixed(1)} KB) ---`);
    console.log(`--- [PIPELINE] IMAGE MIME TYPE: ${mimeType} ---`);

    console.log('--- [PIPELINE] IMAGE CONVERSION START ---');
    const formattedPayload = imagePayload.startsWith('data:') 
        ? imagePayload 
        : `data:${mimeType};base64,${cleanBase64.replace(/\s/g, '')}`;
    console.log('--- [PIPELINE] IMAGE CONVERSION COMPLETE ---');

    const clientApiKey = getClientEnvKey();

    console.log('--- [PIPELINE] API REQUEST START ---');
    const token = localStorage.getItem('labellens-token');
    
    const startTime = Date.now();
    let response: Response | null = null;
    let serverErrorMsg: string | null = null;

    try {
        console.log('--- [PIPELINE] API REQUEST SENT to /api/vision/ocr ---');
        response = await fetch('/api/vision/ocr', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(token ? { 'Authorization': `Bearer ${token}` } : {})
            },
            body: JSON.stringify({ 
                image: formattedPayload,
                ...(clientApiKey ? { apiKey: clientApiKey } : {})
            })
        });

        const duration = Date.now() - startTime;
        console.log(`--- [PIPELINE] AI/OCR RESPONSE RECEIVED (Status: ${response.status} in ${duration}ms) ---`);

        if (response.ok) {
            const data = await response.json();
            if (data.success && !data.error) {
                console.log('--- [PIPELINE] RESPONSE PARSED ---', data);
                console.log('--- [PIPELINE] PRODUCT OBJECT CREATED ---', data.product);
                console.log('--- [PIPELINE] RAW TEXT EXTRACTED LENGTH ---', (data.text || '').length);
                return {
                    text: data.text || '',
                    product: data.product || {},
                    spatial: data.spatial || null,
                    visualQuality: data.visualQuality || null
                };
            } else {
                serverErrorMsg = data.error || data.details || `HTTP ${response.status}`;
            }
        } else {
            try {
                const errData = await response.json();
                serverErrorMsg = errData.error || errData.details || `HTTP ${response.status}`;
            } catch {
                serverErrorMsg = `HTTP ${response.status}`;
            }
        }
    } catch (networkErr: any) {
        console.warn('--- [PIPELINE] API SERVERLESS ROUTE NETWORK FAILURE ---', networkErr.message);
        serverErrorMsg = networkErr.message;
    }

    // If serverless route fails but client API key exists, fallback to direct client Gemini call
    if (clientApiKey) {
        console.warn('--- [PIPELINE] SERVERLESS OCR FAILED/UNCONFIGURED, ATTEMPTING DIRECT CLIENT GEMINI API FALLBACK ---', serverErrorMsg);
        try {
            return await callGeminiDirectlyFromClient(formattedPayload, clientApiKey);
        } catch (clientErr: any) {
            console.error('--- [PIPELINE] DIRECT CLIENT GEMINI FALLBACK FAILED ---', clientErr.message);
            throw new Error(`Gemini Vision scan failed: ${clientErr.message}`);
        }
    }

    throw new Error(serverErrorMsg || 'Gemini Vision processing failed. Please ensure GEMINI_API_KEY is configured.');
}

// Backward-compatible text-only wrapper
export async function extractTextFromImage(base64Image: string): Promise<string> {
    const result = await scanProductImageWithGemini(base64Image);
    return result.text;
}

// Smart date extraction from OCR text
export function extractExpiryDate(ocrText: string): string | null {
    if (!ocrText) return null;
    const lines = ocrText.split('\n');

    const expiryKeywords = ['use by', 'best before', 'expiry', 'exp', 'bb', 'best by', 'exp date'];
    const ignoreKeywords = ['pkd', 'mfg', 'mfd', 'packed', 'manufacturing', 'mrp'];

    const datePattern = /(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})/g;

    for (const line of lines) {
        const lowerLine = line.toLowerCase();
        if (ignoreKeywords.some(kw => lowerLine.includes(kw))) continue;

        if (expiryKeywords.some(kw => lowerLine.includes(kw))) {
            const matches = line.match(datePattern);
            if (matches && matches.length > 0) {
                const parsed = parseDate(matches[0]);
                if (parsed) return parsed;
            }
        }
    }

    const allDates: { date: string; parsed: string }[] = [];

    for (const line of lines) {
        const lowerLine = line.toLowerCase();
        if (ignoreKeywords.some(kw => lowerLine.includes(kw))) continue;

        const matches = line.match(datePattern);
        if (matches) {
            for (const match of matches) {
                const parsed = parseDate(match);
                if (parsed) allDates.push({ date: match, parsed });
            }
        }
    }

    if (allDates.length > 0) {
        const today = new Date();
        const futureDates = allDates.filter(d => new Date(d.parsed) > today);
        if (futureDates.length > 0) {
            futureDates.sort((a, b) => new Date(b.parsed).getTime() - new Date(a.parsed).getTime());
            return futureDates[0].parsed;
        }
        return allDates[0].parsed;
    }

    return null;
}

// Parse date string to YYYY-MM-DD format
function parseDate(dateStr: string): string | null {
    const match = dateStr.match(/(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})/);
    if (!match) return null;

    const day = parseInt(match[1]);
    const month = parseInt(match[2]);
    let year = parseInt(match[3]);

    if (year < 100) {
        year = year > 50 ? 1900 + year : 2000 + year;
    }

    if (month < 1 || month > 12 || day < 1 || day > 31) {
        return null;
    }

    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

// ============ BARCODE DETECTION ============

export interface ProductInfo {
    name: string;
    category: 'Dairy' | 'Grain' | 'Vegetable' | 'Meat' | 'Snacks' | 'Other';
    estimatedExpiryDays: number;
    barcode: string;
}

// Detect barcode using browser BarcodeDetector API
async function detectBarcodeViaBrowser(base64Image: string): Promise<string | null> {
    if (typeof window === 'undefined' || !('BarcodeDetector' in window)) {
        return null;
    }

    try {
        // @ts-ignore - BarcodeDetector
        const detector = new (window as any).BarcodeDetector({
            formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'qr_code']
        });

        const formatted = base64Image.startsWith('data:') ? base64Image : `data:image/jpeg;base64,${base64Image}`;
        const response = await fetch(formatted);
        const blob = await response.blob();
        const bitmap = await createImageBitmap(blob);

        const barcodes = await detector.detect(bitmap);
        bitmap.close();

        if (barcodes && barcodes.length > 0) {
            const barcode = barcodes[0].rawValue;
            console.log('✅ Browser BarcodeDetector found:', barcode);
            return barcode;
        }
        return null;
    } catch (err) {
        return null;
    }
}

export async function detectBarcode(base64Image: string, preExtractedText?: string): Promise<string | null> {
    try {
        const browserBarcode = await detectBarcodeViaBrowser(base64Image);
        if (browserBarcode) {
            return browserBarcode;
        }

        const text = preExtractedText !== undefined ? preExtractedText : await extractTextFromImage(base64Image);
        if (!text) {
            return null;
        }

        const explicitPattern = /(?:barcode|ean(?:-?13|-?8)?|upc(?:-?a)?|gtin(?:-?14|-?12|-?13|-?8)?)\s*[:\-]?\s*(\d{8,14})\b/i;
        const expMatch = text.match(explicitPattern);
        if (expMatch && expMatch[1]) {
            console.log('Detected explicit barcode from text:', expMatch[1]);
            return expMatch[1].trim();
        }

        const lines = text.split(/[\r\n]+/).map(l => l.trim());
        for (const line of lines) {
            const cleanDigits = line.replace(/\s+/g, '');
            if (/^(?:\d{8}|\d{12}|\d{13}|\d{14})$/.test(cleanDigits)) {
                if (/^(?:1800|100|200)/.test(cleanDigits)) continue;
                console.log('Detected standalone numeric barcode from line:', cleanDigits);
                return cleanDigits;
            }
        }

        return null;
    } catch (err) {
        console.warn('Barcode detection notice:', err);
        return null;
    }
}

// Waterfall barcode lookup: Open Food Facts → UPCitemdb → Manual entry
export async function lookupProduct(barcode: string): Promise<ProductInfo | null> {
    const cleanBarcode = barcode.replace(/\s/g, '');
    if (!cleanBarcode || cleanBarcode.length < 8) return null;
    console.log('🔍 Looking up barcode in registries:', cleanBarcode);

    const timeout = (ms: number) => new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Timeout')), ms)
    );

    // Step 1: Try Open Food Facts
    try {
        const response = await Promise.race([
            fetch(`/api/openfoodfacts/product/${cleanBarcode}.json`),
            timeout(4000)
        ]) as Response;

        if (response.ok) {
            const data = await response.json();
            if (data.status === 1 && data.product) {
                const product = data.product;
                const productName = product.product_name || product.generic_name;

                if (productName) {
                    const categories = (product.categories_tags || []).join(' ').toLowerCase();
                    const category = mapToCategory(categories, productName);
                    const expiryDays = getEstimatedExpiryDays(category, categories);

                    console.log('✅ Found in Open Food Facts:', productName);
                    return {
                        name: productName,
                        category: category,
                        estimatedExpiryDays: expiryDays,
                        barcode: cleanBarcode
                    };
                }
            }
        }
    } catch { }

    // Step 2: Try UPCitemdb
    try {
        const response = await Promise.race([
            fetch(`/api/upcitemdb/prod/trial/lookup?upc=${cleanBarcode}`),
            timeout(4000)
        ]) as Response;

        if (response.ok) {
            const data = await response.json();
            if (data.items && data.items.length > 0) {
                const item = data.items[0];
                const productName = item.title || item.brand;

                if (productName) {
                    const category = mapToCategory(item.category || '', productName);
                    const expiryDays = getEstimatedExpiryDays(category, item.category || '');

                    console.log('✅ Found in UPCitemdb:', productName);
                    return {
                        name: productName,
                        category: category,
                        estimatedExpiryDays: expiryDays,
                        barcode: cleanBarcode
                    };
                }
            }
        }
    } catch { }

    return null;
}

// Category mapping helper
function mapToCategory(categoryStr: string, name: string): 'Dairy' | 'Grain' | 'Vegetable' | 'Meat' | 'Snacks' | 'Other' {
    const text = `${categoryStr} ${name}`.toLowerCase();

    if (text.includes('milk') || text.includes('cheese') || text.includes('yogurt') ||
        text.includes('butter') || text.includes('cream') || text.includes('dairy') ||
        text.includes('paneer') || text.includes('curd') || text.includes('ghee')) {
        return 'Dairy';
    }
    if (text.includes('bread') || text.includes('rice') || text.includes('flour') ||
        text.includes('pasta') || text.includes('cereal') || text.includes('oats') ||
        text.includes('wheat') || text.includes('grain') || text.includes('noodle')) {
        return 'Grain';
    }
    if (text.includes('vegetable') || text.includes('fruit') || text.includes('apple') ||
        text.includes('banana') || text.includes('tomato') || text.includes('potato') ||
        text.includes('onion') || text.includes('spinach') || text.includes('salad')) {
        return 'Vegetable';
    }
    if (text.includes('chicken') || text.includes('meat') || text.includes('beef') ||
        text.includes('pork') || text.includes('fish') || text.includes('egg') ||
        text.includes('mutton') || text.includes('seafood')) {
        return 'Meat';
    }
    if (text.includes('snack') || text.includes('chip') || text.includes('biscuit') ||
        text.includes('cookie') || text.includes('chocolate') || text.includes('candy') ||
        text.includes('cracker') || text.includes('namkeen') || text.includes('bhujia')) {
        return 'Snacks';
    }

    return 'Other';
}

// Estimated shelf-life in days
function getEstimatedExpiryDays(category: string, rawCategory: string): number {
    const text = rawCategory.toLowerCase();

    if (text.includes('fresh milk') || text.includes('raw milk')) return 5;
    if (text.includes('pasteurized milk')) return 7;
    if (text.includes('yogurt') || text.includes('curd')) return 10;
    if (text.includes('cheese')) return 21;
    if (text.includes('butter') || text.includes('ghee')) return 90;
    if (text.includes('bread')) return 5;
    if (text.includes('fresh meat') || text.includes('raw chicken') || text.includes('fish')) return 3;
    if (text.includes('egg')) return 21;
    if (text.includes('leafy') || text.includes('spinach') || text.includes('lettuce')) return 4;
    if (text.includes('apple') || text.includes('orange') || text.includes('citrus')) return 14;
    if (text.includes('banana')) return 5;
    if (text.includes('potato') || text.includes('onion')) return 30;
    if (text.includes('canned') || text.includes('preserve')) return 365;

    switch (category) {
        case 'Dairy': return 7;
        case 'Vegetable': return 7;
        case 'Meat': return 3;
        case 'Grain': return 180;
        case 'Snacks': return 120;
        default: return 14;
    }
}
