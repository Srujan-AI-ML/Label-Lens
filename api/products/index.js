// Products API - GET all scanned products, POST new scan
import { connectToDatabase } from '../lib/mongodb.js';
import { authenticateRequest } from '../lib/auth.js';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST,DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');

    if (req.method === 'OPTIONS') return res.status(200).end();

    const user = await authenticateRequest(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    try {
        const { db } = await connectToDatabase();
        const col = db.collection('products');

        // GET - fetch all products for user
        if (req.method === 'GET') {
            const products = await col
                .find({ userId: user.userId })
                .sort({ scannedAt: -1 })
                .toArray();

            const result = products.map(p => ({
                id: p._id.toString(),
                productName: p.productName,
                barcode: p.barcode || null,
                mrp: p.mrp || p.declarations?.mrp?.value || null,
                scannedAt: p.scannedAt,
                complianceScore: p.complianceScore,
                complianceStatus: p.complianceStatus,
                declarations: p.declarations,
                violations: p.violations || [],
                rawExtractedText: p.rawExtractedText || '',
                imageData: p.imageData || null,
                category: p.category || null,
                notes: p.notes || null,
            }));
            return res.status(200).json(result);
        }

        // POST - save a new scan result
        if (req.method === 'POST') {
            const {
                productName, barcode, scannedAt, rawExtractedText,
                complianceScore, complianceStatus, declarations,
                violations, imageData, category, notes, mrp
            } = req.body || {};

            if (!productName || complianceScore === undefined || !declarations) {
                return res.status(400).json({ error: 'Missing required fields' });
            }

            const doc = {
                userId: user.userId,
                productName,
                barcode: barcode || null,
                mrp: mrp !== undefined ? mrp : (declarations?.mrp?.value || null),
                scannedAt: scannedAt || new Date().toISOString(),
                rawExtractedText: rawExtractedText || '',
                complianceScore,
                complianceStatus,
                declarations,
                violations: violations || [],
                imageData: imageData || null,
                category: category || null,
                notes: notes || null,
                createdAt: new Date(),
            };

            const result = await col.insertOne(doc);
            return res.status(201).json({ id: result.insertedId.toString(), ...doc });
        }

        return res.status(405).json({ error: 'Method not allowed' });
    } catch (error) {
        console.error('Products API error:', error);
        return res.status(500).json({ error: 'Internal server error', details: error.message });
    }
}
