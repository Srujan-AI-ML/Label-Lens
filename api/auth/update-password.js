// API to update user password (available for Google users during setup and general profile settings)
import bcrypt from 'bcryptjs';
import { connectToDatabase } from '../lib/mongodb.js';
import { authenticateRequest } from '../lib/auth.js';
import { ObjectId } from 'mongodb';

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
        const decoded = await authenticateRequest(req);
        if (!decoded || !decoded.userId) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const { password } = req.body || {};
        if (!password) {
            return res.status(400).json({ error: 'Password is required' });
        }

        if (password.length < 8) {
            return res.status(400).json({ error: 'Password must be at least 8 characters long' });
        }
        if (!/[A-Z]/.test(password)) {
            return res.status(400).json({ error: 'Password must contain at least one uppercase letter (A–Z)' });
        }
        if (!/[0-9]/.test(password)) {
            return res.status(400).json({ error: 'Password must contain at least one digit (0–9)' });
        }

        const { db } = await connectToDatabase();
        const usersCollection = db.collection('users');

        const hashedPassword = await bcrypt.hash(password, 10);

        const result = await usersCollection.updateOne(
            { _id: new ObjectId(decoded.userId) },
            { 
                $set: { 
                    password: hashedPassword,
                    updatedAt: new Date()
                }
            }
        );

        if (result.matchedCount === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        return res.status(200).json({ success: true, message: 'Password updated successfully' });

    } catch (error) {
        console.error('Update password error:', error);
        return res.status(500).json({ error: 'Failed to update password', details: error.message });
    }
}
