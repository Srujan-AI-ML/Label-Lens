// Products API - GET all scanned products, POST new scan with RBAC & Enforcement
import { connectToDatabase } from '../lib/mongodb.js';
import { authenticateRequest, hasRole } from '../lib/auth.js';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST,DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');

    if (req.method === 'OPTIONS') return res.status(200).end();

    const user = await authenticateRequest(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized. Valid authentication token required.' });

    try {
        const { db } = await connectToDatabase();
        const col = db.collection('products');

        // GET - fetch products based on RBAC role
        if (req.method === 'GET') {
            // ADMIN and ENFORCEMENT_OFFICER can view all records; INSPECTOR & MERCHANT view own records
            const isPrivileged = hasRole(user, ['ADMIN', 'ENFORCEMENT_OFFICER']);
            const query = isPrivileged ? {} : { userId: user.userId };

            const products = await col
                .find(query)
                .sort({ scannedAt: -1 })
                .toArray();

            const result = products.map(p => ({
                id: p._id.toString(),
                productName: p.productName,
                barcode: p.barcode || null,
                mrp: p.mrp || p.declarations?.mrp?.value || null,
                scannedAt: p.scannedAt,
                complianceScore: p.complianceScore !== undefined ? p.complianceScore : 100,
                complianceStatus: p.complianceStatus || 'Compliant',
                declarations: p.declarations,
                violations: p.violations || [],
                rawExtractedText: p.rawExtractedText || '',
                imageData: p.imageData || null,
                category: p.category || null,
                regulatoryLicense: p.regulatoryLicense || p.declarations?.regulatoryLicense?.value || p.declarations?.fssaiLicense?.value || null,
                notes: p.notes || null,
                
                // Spatial & Visual Quality Evidence
                spatialAnalysis: p.spatialAnalysis || null,
                visualQuality: p.visualQuality || null,
                photoEvidenceNotes: p.photoEvidenceNotes || null,

                // Enforcement Workflow Lifecycle
                enforcementStatus: p.enforcementStatus || 'AUDITED',
                enforcementHistory: p.enforcementHistory || [{
                    id: 'enf-initial',
                    action: p.enforcementStatus || 'AUDITED',
                    timestamp: p.scannedAt || new Date().toISOString(),
                    officerName: 'Automated Inspector AI',
                    notes: 'Initial inspection scan recorded.'
                }],
                assignedOfficer: p.assignedOfficer || null,
                noticeReferenceNumber: p.noticeReferenceNumber || null,
                penaltyAmount: p.penaltyAmount || null,
                userId: p.userId || null
            }));
            return res.status(200).json(result);
        }

        // POST - save a new scan result
        if (req.method === 'POST') {
            const {
                productName, barcode, scannedAt, rawExtractedText,
                complianceScore, complianceStatus, declarations,
                violations, imageData, category, regulatoryLicense, notes, mrp,
                spatialAnalysis, visualQuality, photoEvidenceNotes,
                enforcementStatus, enforcementHistory, assignedOfficer,
                noticeReferenceNumber, penaltyAmount
            } = req.body || {};

            if (!productName || complianceScore === undefined || !declarations) {
                return res.status(400).json({ error: 'Missing required inspection fields' });
            }

            const initialHistory = enforcementHistory && Array.isArray(enforcementHistory) && enforcementHistory.length > 0
                ? enforcementHistory
                : [{
                    id: 'enf-' + Date.now(),
                    action: enforcementStatus || 'AUDITED',
                    timestamp: new Date().toISOString(),
                    officerId: user.userId,
                    officerName: user.username || 'System Inspector',
                    notes: 'Initial inspection scan and Legal Metrology compliance evaluation conducted.'
                }];

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
                regulatoryLicense: regulatoryLicense || declarations?.regulatoryLicense?.value || declarations?.fssaiLicense?.value || null,
                notes: notes || null,
                
                // Spatial & Visual Quality Evidence
                spatialAnalysis: spatialAnalysis || null,
                visualQuality: visualQuality || null,
                photoEvidenceNotes: photoEvidenceNotes || null,

                // Enforcement Workflow Lifecycle
                enforcementStatus: enforcementStatus || 'AUDITED',
                enforcementHistory: initialHistory,
                assignedOfficer: assignedOfficer || user.username,
                noticeReferenceNumber: noticeReferenceNumber || null,
                penaltyAmount: penaltyAmount !== undefined ? penaltyAmount : null,
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

