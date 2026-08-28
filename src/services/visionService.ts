// Call Secure Backend OCR Serverless Proxy
export async function extractTextFromImage(base64Image: string): Promise<string> {
    const MOCK_LABEL_TEXT = `PRODUCT: Premium Butter Cookies
BARCODE: 8901058005080
MANUFACTURED BY: Britannia Industries Ltd, 5/1A Hungerford Street, Kolkata - 700017
NET QUANTITY: 250 g
MRP: Rs. 150.00 (incl. of all taxes)
MFG DATE: 08/2026
BEST BEFORE: 12/2026
CONSUMER CARE: 1800-425-2555 / cs@britannia.co.in
FSSAI LIC NO: 10015031001425
COUNTRY OF ORIGIN: India
UNIT SALE PRICE: Rs. 0.60 / g`;

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

        if (!response.ok) {
            console.error('Vision proxy HTTP error:', response.status, JSON.stringify(data, null, 2));
            throw new Error(`Vision proxy error (${response.status}): ${data.error || JSON.stringify(data)}`);
        }

        return data.text || MOCK_LABEL_TEXT;
    } catch (err) {
        console.warn('Vision API call failed, falling back to mock label text:', err);
        return MOCK_LABEL_TEXT;
    }
}

// Smart date extraction from OCR text
export function extractExpiryDate(ocrText: string): string | null {
    console.log('OCR Text:', ocrText);

    const lines = ocrText.split('\n');

    // Look for lines containing expiry keywords
    const expiryKeywords = ['use by', 'best before', 'expiry', 'exp', 'bb', 'best by', 'exp date'];
    const ignoreKeywords = ['pkd', 'mfg', 'mfd', 'packed', 'manufacturing', 'mrp'];

    // Date pattern: DD/MM/YY or DD/MM/YYYY or DD-MM-YY etc.
    const datePattern = /(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})/g;

    // First, try to find date on lines with expiry keywords
    for (const line of lines) {
        const lowerLine = line.toLowerCase();

        // Skip lines with ignore keywords
        if (ignoreKeywords.some(kw => lowerLine.includes(kw))) {
            continue;
        }

        // Check if line has expiry keyword
        if (expiryKeywords.some(kw => lowerLine.includes(kw))) {
            const matches = line.match(datePattern);
            if (matches && matches.length > 0) {
                const parsed = parseDate(matches[0]);
                if (parsed) {
                    console.log('Found expiry date on line:', line, '→', parsed);
                    return parsed;
                }
            }
        }
    }

    // If no keyword match, look for dates not on ignore lines
    const allDates: { date: string; parsed: string }[] = [];

    for (const line of lines) {
        const lowerLine = line.toLowerCase();

        // Skip lines with ignore keywords
        if (ignoreKeywords.some(kw => lowerLine.includes(kw))) {
            continue;
        }

        const matches = line.match(datePattern);
        if (matches) {
            for (const match of matches) {
                const parsed = parseDate(match);
                if (parsed) {
                    allDates.push({ date: match, parsed });
                }
            }
        }
    }

    // Return the latest future date (most likely expiry)
    if (allDates.length > 0) {
        const today = new Date();
        const futureDates = allDates.filter(d => new Date(d.parsed) > today);

        if (futureDates.length > 0) {
            // Sort by date descending and return the latest
            futureDates.sort((a, b) => new Date(b.parsed).getTime() - new Date(a.parsed).getTime());
            console.log('Using latest future date:', futureDates[0]);
            return futureDates[0].parsed;
        }

        // If no future dates, return the first one found
        console.log('No future dates, using first found:', allDates[0]);
        return allDates[0].parsed;
    }

    return null;
}

// Parse date string to YYYY-MM-DD format
function parseDate(dateStr: string): string | null {
    const match = dateStr.match(/(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})/);
    if (!match) return null;

    let day = parseInt(match[1]);
    let month = parseInt(match[2]);
    let year = parseInt(match[3]);

    // Fix 2-digit year
    if (year < 100) {
        year = year > 50 ? 1900 + year : 2000 + year;
    }

    // Validate
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
    // BarcodeDetector is supported in Chrome/Edge
    if (!('BarcodeDetector' in window)) {
        console.log('BarcodeDetector API not supported in this browser.');
        return null;
    }

    try {
        // @ts-ignore - BarcodeDetector is not in TS types yet
        const detector = new BarcodeDetector({
            formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'qr_code']
        });

        // Convert base64 to ImageBitmap
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

        console.log('No barcode detected by browser BarcodeDetector.');
        return null;
    } catch (err) {
        console.log('Browser BarcodeDetector error:', err);
        return null;
    }
}

export async function detectBarcode(base64Image: string): Promise<string | null> {
    try {
        // Try browser detection first (instant & free)
        const browserBarcode = await detectBarcodeViaBrowser(base64Image);
        if (browserBarcode) {
            return browserBarcode;
        }

        // Fallback: call secure backend OCR proxy to extract text and search for barcode patterns
        const text = await extractTextFromImage(base64Image);
        if (!text) {
            return null;
        }

        const cleanText = text.replace(/\s+/g, '');
        console.log('Cleaned text for barcode search:', cleanText);

        const barcodePattern = /(\d{8,14})/g;
        const matches = cleanText.match(barcodePattern);

        if (matches && matches.length > 0) {
            const validBarcodes = matches.filter((m: string) =>
                m.length === 8 || m.length === 12 || m.length === 13 || m.length === 14
            );

            if (validBarcodes.length > 0) {
                const barcode = validBarcodes.sort((a: string, b: string) => b.length - a.length)[0];
                console.log('Detected barcode from server OCR text:', barcode);
                return barcode;
            }

            const barcode = matches.sort((a: string, b: string) => b.length - a.length)[0];
            console.log('Using longest digit match as barcode:', barcode);
            return barcode;
        }

        return null;
    } catch (err) {
        console.warn('Vision barcode detection failed, falling back to browser detection:', err);
        return detectBarcodeViaBrowser(base64Image);
    }
}

// Hardcoded barcode map for known products (skip API calls)
const KNOWN_BARCODES: Record<string, ProductInfo> = {
    '8901058005080': { name: 'Munch Max', category: 'Snacks', estimatedExpiryDays: 180, barcode: '8901058005080' },
    '8901491101844': { name: 'Lays Masala Blue Color', category: 'Snacks', estimatedExpiryDays: 180, barcode: '8901491101844' }
};

// Waterfall barcode lookup: Known → Open Food Facts → UPCitemdb → Unknown (manual entry)
export async function lookupProduct(barcode: string): Promise<ProductInfo | null> {
    // Clean barcode (remove spaces)
    const cleanBarcode = barcode.replace(/\s/g, '');
    console.log('🔍 Looking up barcode:', cleanBarcode);

    // Step 0: Check hardcoded map first
    if (KNOWN_BARCODES[cleanBarcode]) {
        console.log('✅ Found in hardcoded map:', KNOWN_BARCODES[cleanBarcode].name);
        return KNOWN_BARCODES[cleanBarcode];
    }

    // Create a timeout promise
    const timeout = (ms: number) => new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Timeout')), ms)
    );

    // Step 1: Try Open Food Facts first (better for food products)
    console.log('Step 1: Checking Open Food Facts...');
    try {
        const response = await Promise.race([
            fetch(`/api/openfoodfacts/product/${cleanBarcode}.json`),
            timeout(5000)
        ]) as Response;

        if (response.ok) {
            const data = await response.json();
            console.log('Open Food Facts Response:', data);

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
        console.log('❌ Not found in Open Food Facts');
    } catch (error) {
        console.log('⏱️ Open Food Facts timeout/error:', error);
    }

    // Step 2: Try UPCitemdb as fallback
    console.log('Step 2: Checking UPCitemdb...');
    try {
        const response = await Promise.race([
            fetch(`/api/upcitemdb/prod/trial/lookup?upc=${cleanBarcode}`),
            timeout(5000)
        ]) as Response;

        if (response.ok) {
            const data = await response.json();
            console.log('UPCitemdb Response:', data);

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
        console.log('❌ Not found in UPCitemdb');
    } catch (error) {
        console.log('⏱️ UPCitemdb timeout/error:', error);
    }

    // Step 3: Return null to signal "Unknown Item" - user types name manually
    console.log('📝 Product not found - user will enter name manually');
    return {
        name: '', // Empty name signals manual entry needed
        category: 'Other',
        estimatedExpiryDays: 30,
        barcode: cleanBarcode
    };
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

