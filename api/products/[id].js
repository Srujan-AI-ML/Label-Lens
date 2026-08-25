// Single Product API - GET single product detail, DELETE scan record
import { ObjectId } from 'mongodb';
import { connectToDatabase } from '../lib/mongodb.js';
import { authenticateRequest } from '../lib/auth.js';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,DELETE,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');

    if (req.method === 'OPTIONS') return res.status(200).end();

    const user = await authenticateRequest(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });

    const { id } = req.query;
    if (!id || !ObjectId.isValid(id)) {
        return res.status(400).json({ error: 'Invalid product ID' });
    }

    try {
        const { db } = await connectToDatabase();
        const col = db.collection('products');

        // Verify product belongs to user
        const existingProduct = await col.findOne({
            _id: new ObjectId(id),
            userId: user.userId
        });

        if (!existingProduct) {
            return res.status(404).json({ error: 'Product scan not found' });
        }

        // GET - Fetch single product
        if (req.method === 'GET') {
            return res.status(200).json({
                id: existingProduct._id.toString(),
                productName: existingProduct.productName,
                barcode: existingProduct.barcode || null,
                scannedAt: existingProduct.scannedAt,
                complianceScore: existingProduct.complianceScore,
                complianceStatus: existingProduct.complianceStatus,
                declarations: existingProduct.declarations,
                violations: existingProduct.violations || [],
                rawExtractedText: existingProduct.rawExtractedText || '',
                imageData: existingProduct.imageData || null,
                category: existingProduct.category || null,
                notes: existingProduct.notes || null
            });
        }

        // PUT - Update notes or metadata on scan record
        if (req.method === 'PUT') {
            const { notes, productName } = req.body || {};
            const updates = {};
            if (notes !== undefined) updates.notes = notes;
            if (productName !== undefined) updates.productName = productName;

            await col.updateOne(
                { _id: new ObjectId(id) },
                { $set: updates }
            );

            const updatedProduct = await col.findOne({ _id: new ObjectId(id) });
            return res.status(200).json({
                id: updatedProduct._id.toString(),
                productName: updatedProduct.productName,
                barcode: updatedProduct.barcode || null,
                scannedAt: updatedProduct.scannedAt,
                complianceScore: updatedProduct.complianceScore,
                complianceStatus: updatedProduct.complianceStatus,
                declarations: updatedProduct.declarations,
                violations: updatedProduct.violations || [],
                rawExtractedText: updatedProduct.rawExtractedText || '',
                imageData: updatedProduct.imageData || null,
                category: updatedProduct.category || null,
                notes: updatedProduct.notes || null
            });
        }

        // DELETE - Delete scan record
        if (req.method === 'DELETE') {
            await col.deleteOne({ _id: new ObjectId(id) });
            return res.status(200).json({ message: 'Product scan deleted successfully' });
        }

        return res.status(405).json({ error: 'Method not allowed' });
    } catch (error) {
        console.error('Single Product API error:', error);
        return res.status(500).json({ error: 'Internal server error', details: error.message });
    }
}
