// Image preprocessing for improved AI vision accuracy
async function preprocessImageForOCR(base64Image: string): Promise<string> {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
        return `data:image/jpeg;base64,${base64Image}`;
    }

    return new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
            try {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                // Scale image to optimal OCR dimensions (min dimension ~1200px)
                const minDim = Math.min(width, height);
                if (minDim > 0 && minDim < 900) {
                    const scale = 1200 / minDim;
                    width = Math.round(width * scale);
                    height = Math.round(height * scale);
                } else if (Math.max(width, height) > 2600) {
                    const scale = 2600 / Math.max(width, height);
                    width = Math.round(width * scale);
                    height = Math.round(height * scale);
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                if (!ctx) {
                    resolve(`data:image/jpeg;base64,${base64Image}`);
                    return;
                }

                ctx.drawImage(img, 0, 0, width, height);

                const imgData = ctx.getImageData(0, 0, width, height);
                const d = imgData.data;

                // Grayscale & contrast enhancement
                const contrast = 1.25; // 25% contrast boost
                const factor = (259 * (contrast * 255 + 255)) / (255 * (259 - contrast * 255));

                for (let i = 0; i < d.length; i += 4) {
                    const gray = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
                    const enhanced = Math.min(255, Math.max(0, factor * (gray - 128) + 128));
                    d[i] = enhanced;
                    d[i + 1] = enhanced;
                    d[i + 2] = enhanced;
                }

                ctx.putImageData(imgData, 0, 0);
                resolve(canvas.toDataURL('image/jpeg', 0.92));
            } catch (err) {
                console.warn('Preprocessing canvas error, using raw image:', err);
                resolve(`data:image/jpeg;base64,${base64Image}`);
            }
        };
        img.onerror = () => {
            resolve(`data:image/jpeg;base64,${base64Image}`);
        };
        img.src = base64Image.startsWith('data:') ? base64Image : `data:image/jpeg;base64,${base64Image}`;
    });
}



// Call Serverless Endpoint for Google Gemini API Vision Scanning
export async function extractTextFromImage(base64Image: string): Promise<string> {
    try {
        const token = localStorage.getItem('labellens-token');
        const response = await fetch('/api/vision/ocr', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(token ? { 'Authorization': `Bearer ${token}` } : {})
            },
            body: JSON.stringify({ image: base64Image })
        });

        const data = await response.json();

        if (!response.ok || data.error) {
            console.error('Gemini Vision API error:', response.status, JSON.stringify(data, null, 2));
            throw new Error(data.error || data.details || `Gemini Vision processing failed (${response.status})`);
        }

        console.log('✅ Google Gemini API Vision Output:\n', data.text);
        return data.text || '';
    } catch (err: any) {
        console.error('Google Gemini Vision extraction failed:', err);
        throw new Error(err.message || 'Google Gemini API failed to analyze product image.');
    }
}

// Smart date extraction from OCR text
export function extractExpiryDate(ocrText: string): string | null {
    console.log('OCR Text for Date Extraction:\n', ocrText);

    const lines = ocrText.split('\n');

    // Look for lines containing expiry keywords
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

// Detect barcode using browser BarcodeDetector API (free, no credentials needed)
async function detectBarcodeViaBrowser(base64Image: string): Promise<string | null> {
    if (!('BarcodeDetector' in window)) {
        return null;
    }

    try {
        // @ts-ignore - BarcodeDetector is not in TS types yet
        const detector = new BarcodeDetector({
            formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'qr_code']
        });

        const response = await fetch(`data:image/jpeg;base64,${base64Image}`);
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

        // Check for explicitly labeled barcode
        const explicitPattern = /(?:barcode|ean(?:-?13|-?8)?|upc(?:-?a)?|gtin(?:-?14|-?12|-?13|-?8)?)\s*[:\-]?\s*(\d{8,14})\b/i;
        const expMatch = text.match(explicitPattern);
        if (expMatch && expMatch[1]) {
            console.log('Detected explicit barcode from OCR text:', expMatch[1]);
            return expMatch[1].trim();
        }

        // Check standalone lines with only 8, 12, 13, or 14 digits
        const lines = text.split(/[\r\n]+/).map(l => l.trim());
        for (const line of lines) {
            const cleanDigits = line.replace(/\s+/g, '');
            if (/^(?:\d{8}|\d{12}|\d{13}|\d{14})$/.test(cleanDigits)) {
                if (/^(?:1800|100|200)/.test(cleanDigits)) continue;
                console.log('Detected standalone numeric barcode from OCR line:', cleanDigits);
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
                    const categoryStr = (item.category || '').toLowerCase();
                    const category = mapToCategory(categoryStr, productName);
                    const expiryDays = getEstimatedExpiryDays(category, categoryStr);

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

// Map Open Food Facts categories to our categories
function mapToCategory(categories: string, productName: string): ProductInfo['category'] {
    const lowerName = productName.toLowerCase();
    const lowerCats = categories.toLowerCase();

    // Dairy
    if (lowerCats.includes('dairy') || lowerCats.includes('milk') || lowerCats.includes('cheese') ||
        lowerCats.includes('yogurt') || lowerCats.includes('butter') || lowerCats.includes('cream') ||
        lowerCats.includes('lassi') || lowerCats.includes('paneer') ||
        lowerName.includes('milk') || lowerName.includes('cheese') || lowerName.includes('yogurt') ||
        lowerName.includes('butter') || lowerName.includes('paneer') || lowerName.includes('curd') ||
        lowerName.includes('dahi') || lowerName.includes('ghee') || lowerName.includes('lassi')) {
        return 'Dairy';
    }

    // Meat
    if (lowerCats.includes('meat') || lowerCats.includes('poultry') || lowerCats.includes('fish') ||
        lowerCats.includes('seafood') || lowerCats.includes('chicken') || lowerCats.includes('beef') ||
        lowerName.includes('chicken') || lowerName.includes('mutton') || lowerName.includes('fish') ||
        lowerName.includes('egg') || lowerName.includes('meat') || lowerName.includes('prawn') ||
        lowerName.includes('kebab') || lowerName.includes('sausage')) {
        return 'Meat';
    }

    // Vegetable/Fruits
    if (lowerCats.includes('vegetable') || lowerCats.includes('fruit') || lowerCats.includes('produce') ||
        lowerCats.includes('fresh') || lowerCats.includes('salad') ||
        lowerName.includes('vegetable') || lowerName.includes('fruit') || lowerName.includes('sabzi')) {
        return 'Vegetable';
    }

    // Snacks - chips, biscuits, namkeen, etc.
    if (lowerCats.includes('snack') || lowerCats.includes('chips') || lowerCats.includes('biscuit') ||
        lowerCats.includes('cookie') || lowerCats.includes('cracker') || lowerCats.includes('wafer') ||
        lowerCats.includes('namkeen') || lowerCats.includes('rusk') ||
        lowerName.includes('chips') || lowerName.includes('lays') || lowerName.includes('kurkure') ||
        lowerName.includes('biscuit') || lowerName.includes('cookie') || lowerName.includes('namkeen') ||
        lowerName.includes('bhujia') || lowerName.includes('mixture') || lowerName.includes('haldiram') ||
        lowerName.includes('rusk') || lowerName.includes('cracker') || lowerName.includes('wafer') ||
        lowerName.includes('oreo') || lowerName.includes('parle') || lowerName.includes('britannia') ||
        lowerName.includes('munch') || lowerName.includes('snack')) {
        return 'Snacks';
    }

    // Grain - bread, rice, flour, noodles
    if (lowerCats.includes('grain') || lowerCats.includes('bread') || lowerCats.includes('cereal') ||
        lowerCats.includes('flour') || lowerCats.includes('rice') || lowerCats.includes('pasta') ||
        lowerCats.includes('noodle') ||
        lowerName.includes('bread') || lowerName.includes('rice') || lowerName.includes('flour') ||
        lowerName.includes('noodle') || lowerName.includes('maggi') || lowerName.includes('toast')) {
        return 'Grain';
    }

    return 'Other';
}

// Estimate shelf life based on category
function getEstimatedExpiryDays(category: ProductInfo['category'], categories: string): number {
    // Check for specific subcategories
    if (categories.includes('fresh') || categories.includes('refrigerated')) {
        return 7; // Fresh items: ~1 week
    }

    if (categories.includes('frozen')) {
        return 90; // Frozen items: ~3 months
    }

    switch (category) {
        case 'Dairy':
            return 14; // Dairy: ~2 weeks
        case 'Meat':
            return 5; // Fresh meat: ~5 days
        case 'Vegetable':
            return 7; // Fresh produce: ~1 week  
        case 'Grain':
            return 180; // Dry goods: ~6 months
        case 'Snacks':
            return 120; // Packaged snacks: ~4 months
        default:
            return 30; // Default: ~1 month
    }
}

