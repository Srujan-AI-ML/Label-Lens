// Single Product API - GET single product detail, PUT updates, DELETE scan record with RBAC
import { ObjectId } from 'mongodb';
import { connectToDatabase } from '../lib/mongodb.js';
import { authenticateRequest, hasRole } from '../lib/auth.js';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,DELETE,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');

    if (req.method === 'OPTIONS') return res.status(200).end();

    const user = await authenticateRequest(req);
    if (!user) return res.status(401).json({ error: 'Unauthorized. Token required.' });

    const { id } = req.query;
    if (!id || !ObjectId.isValid(id)) {
        return res.status(400).json({ error: 'Invalid product ID' });
    }

    try {
        const { db } = await connectToDatabase();
        const col = db.collection('products');

        // Locate product
        const existingProduct = await col.findOne({ _id: new ObjectId(id) });
        if (!existingProduct) {
            return res.status(404).json({ error: 'Product scan not found' });
        }

        // RBAC access check
        const isPrivileged = hasRole(user, ['ADMIN', 'ENFORCEMENT_OFFICER']);
        const isOwner = existingProduct.userId === user.userId;

        if (!isPrivileged && !isOwner) {
            return res.status(403).json({ error: 'Forbidden: You do not have permission to access this product record.' });
        }

        // GET - Fetch single product
        if (req.method === 'GET') {
            return res.status(200).json({
                id: existingProduct._id.toString(),
                productName: existingProduct.productName,
                barcode: existingProduct.barcode || null,
                mrp: existingProduct.mrp || existingProduct.declarations?.mrp?.value || null,
                scannedAt: existingProduct.scannedAt,
                complianceScore: existingProduct.complianceScore !== undefined ? existingProduct.complianceScore : 100,
                complianceStatus: existingProduct.complianceStatus || 'Compliant',
                declarations: existingProduct.declarations,
                violations: existingProduct.violations || [],
                rawExtractedText: existingProduct.rawExtractedText || '',
                imageData: existingProduct.imageData || null,
                category: existingProduct.category || null,
                regulatoryLicense: existingProduct.regulatoryLicense || existingProduct.declarations?.regulatoryLicense?.value || existingProduct.declarations?.fssaiLicense?.value || null,
                notes: existingProduct.notes || null,

                // Spatial & Visual Quality Evidence
                spatialAnalysis: existingProduct.spatialAnalysis || null,
                visualQuality: existingProduct.visualQuality || null,
                photoEvidenceNotes: existingProduct.photoEvidenceNotes || null,

                // Enforcement Workflow Lifecycle
                enforcementStatus: existingProduct.enforcementStatus || 'AUDITED',
                enforcementHistory: existingProduct.enforcementHistory || [{
                    id: 'enf-initial',
                    action: existingProduct.enforcementStatus || 'AUDITED',
                    timestamp: existingProduct.scannedAt || new Date().toISOString(),
                    officerName: 'Automated Inspector AI',
                    notes: 'Initial inspection scan recorded.'
                }],
                assignedOfficer: existingProduct.assignedOfficer || null,
                noticeReferenceNumber: existingProduct.noticeReferenceNumber || null,
                penaltyAmount: existingProduct.penaltyAmount || null,
                userId: existingProduct.userId || null
            });
        }

        // PUT - Update scan record, declarations, or enforcement status
        if (req.method === 'PUT') {
            const {
                productName,
                barcode,
                mrp,
                category,
                regulatoryLicense,
                notes,
                declarations,
                violations,
                complianceScore,
                complianceStatus,
                rawExtractedText,
                imageData,
                spatialAnalysis,
                visualQuality,
                photoEvidenceNotes,
                enforcementStatus,
                enforcementAction,
                noticeReferenceNumber,
                penaltyAmount,
                assignedOfficer
            } = req.body || {};

            const updates = {};
            if (productName !== undefined) updates.productName = productName;
            if (barcode !== undefined) updates.barcode = barcode || null;
            if (mrp !== undefined) {
                updates.mrp = mrp || null;
            } else if (declarations?.mrp !== undefined) {
                updates.mrp = declarations.mrp.value || null;
            }
            if (category !== undefined) updates.category = category || null;
            if (regulatoryLicense !== undefined) {
                updates.regulatoryLicense = regulatoryLicense || null;
            } else if (declarations?.regulatoryLicense !== undefined) {
                updates.regulatoryLicense = declarations.regulatoryLicense.value || null;
            } else if (declarations?.fssaiLicense !== undefined) {
                updates.regulatoryLicense = declarations.fssaiLicense.value || null;
            }
            if (notes !== undefined) updates.notes = notes || null;
            if (declarations !== undefined) updates.declarations = declarations;
            if (violations !== undefined) updates.violations = violations;
            if (complianceScore !== undefined) updates.complianceScore = complianceScore;
            if (complianceStatus !== undefined) updates.complianceStatus = complianceStatus;
            if (rawExtractedText !== undefined) updates.rawExtractedText = rawExtractedText;
            if (imageData !== undefined) updates.imageData = imageData;
            if (spatialAnalysis !== undefined) updates.spatialAnalysis = spatialAnalysis;
            if (visualQuality !== undefined) updates.visualQuality = visualQuality;
            if (photoEvidenceNotes !== undefined) updates.photoEvidenceNotes = photoEvidenceNotes;

            // Enforcement Workflow updates (Role-Protected: only Enforcement Officers and Admins)
            if (enforcementStatus !== undefined || enforcementAction !== undefined || noticeReferenceNumber !== undefined || penaltyAmount !== undefined) {
                if (!isPrivileged) {
                    return res.status(403).json({
                        error: 'Forbidden: Only Enforcement Officers and Administrators can modify enforcement workflow records.'
                    });
                }

                if (enforcementStatus !== undefined) updates.enforcementStatus = enforcementStatus;
                if (noticeReferenceNumber !== undefined) updates.noticeReferenceNumber = noticeReferenceNumber || null;
                if (penaltyAmount !== undefined) updates.penaltyAmount = penaltyAmount !== null ? Number(penaltyAmount) : null;
                if (assignedOfficer !== undefined) updates.assignedOfficer = assignedOfficer || null;

                // Append new action to audit history
                if (enforcementAction) {
                    const currentHistory = Array.isArray(existingProduct.enforcementHistory) ? existingProduct.enforcementHistory : [];
                    const newActionRecord = {
                        id: 'enf-' + Date.now(),
                        action: enforcementAction.action || enforcementStatus || 'NOTICE_ISSUED',
                        timestamp: enforcementAction.timestamp || new Date().toISOString(),
                        officerId: user.userId,
                        officerName: enforcementAction.officerName || user.username || 'Enforcement Officer',
                        noticeNumber: enforcementAction.noticeNumber || noticeReferenceNumber || null,
                        courtCaseNumber: enforcementAction.courtCaseNumber || null,
                        penaltyAmount: enforcementAction.penaltyAmount !== undefined ? enforcementAction.penaltyAmount : (penaltyAmount || null),
                        notes: enforcementAction.notes || 'Enforcement action status updated.'
                    };
                    updates.enforcementHistory = [...currentHistory, newActionRecord];
                }
            }

            updates.updatedAt = new Date();

            await col.updateOne(
                { _id: new ObjectId(id) },
                { $set: updates }
            );

            const updatedProduct = await col.findOne({ _id: new ObjectId(id) });
            return res.status(200).json({
                id: updatedProduct._id.toString(),
                productName: updatedProduct.productName,
                barcode: updatedProduct.barcode || null,
                mrp: updatedProduct.mrp || updatedProduct.declarations?.mrp?.value || null,
                scannedAt: updatedProduct.scannedAt,
                complianceScore: updatedProduct.complianceScore,
                complianceStatus: updatedProduct.complianceStatus,
                declarations: updatedProduct.declarations,
                violations: updatedProduct.violations || [],
                rawExtractedText: updatedProduct.rawExtractedText || '',
                imageData: updatedProduct.imageData || null,
                category: updatedProduct.category || null,
                regulatoryLicense: updatedProduct.regulatoryLicense || updatedProduct.declarations?.regulatoryLicense?.value || updatedProduct.declarations?.fssaiLicense?.value || null,
                notes: updatedProduct.notes || null,
                spatialAnalysis: updatedProduct.spatialAnalysis || null,
                visualQuality: updatedProduct.visualQuality || null,
                photoEvidenceNotes: updatedProduct.photoEvidenceNotes || null,
                enforcementStatus: updatedProduct.enforcementStatus || 'AUDITED',
                enforcementHistory: updatedProduct.enforcementHistory || [],
                assignedOfficer: updatedProduct.assignedOfficer || null,
                noticeReferenceNumber: updatedProduct.noticeReferenceNumber || null,
                penaltyAmount: updatedProduct.penaltyAmount || null
            });
        }

        // DELETE - Delete scan record (Role-Protected: Admins or product owner)
        if (req.method === 'DELETE') {
            const isAdmin = hasRole(user, ['ADMIN']);
            if (!isAdmin && !isOwner) {
                return res.status(403).json({ error: 'Forbidden: Only Administrators or the scan creator can delete records.' });
            }

            await col.deleteOne({ _id: new ObjectId(id) });
            return res.status(200).json({ message: 'Product scan deleted successfully' });
        }

        return res.status(405).json({ error: 'Method not allowed' });
    } catch (error) {
        console.error('Single Product API error:', error);
        return res.status(500).json({ error: 'Internal server error', details: error.message });
    }
}

