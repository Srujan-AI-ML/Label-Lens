// User Registration API
import bcrypt from 'bcryptjs';
import { connectToDatabase } from '../lib/mongodb.js';
import { generateToken } from '../lib/auth.js';

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
        const { username, password, role: requestedRole } = req.body || {};

        // Validation
        if (!username || !password) {
            return res.status(400).json({ error: 'Username and password are required' });
        }

        if (username.length < 3) {
            return res.status(400).json({ error: 'Username must be at least 3 characters' });
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

        let db;
        try {
            const connection = await connectToDatabase();
            db = connection.db;
        } catch (dbError) {
            console.error('Database connection error:', dbError);
            return res.status(500).json({ 
                error: 'Database connection failed',
                details: dbError.message 
            });
        }

        const usersCollection = db.collection('users');

        // Check if username already exists
        const existingUser = await usersCollection.findOne({ username: username.toLowerCase() });
        if (existingUser) {
            return res.status(400).json({ error: 'Username already taken' });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Determine user role
        const validRoles = ['ADMIN', 'ENFORCEMENT_OFFICER', 'INSPECTOR', 'MERCHANT'];
        let role = 'INSPECTOR';
        if (requestedRole && validRoles.includes(requestedRole.toUpperCase())) {
            role = requestedRole.toUpperCase();
        } else if (username.toLowerCase() === 'admin') {
            role = 'ADMIN';
        }

        // Create user
        const result = await usersCollection.insertOne({
            username: username.toLowerCase(),
            password: hashedPassword,
            role: role,
            createdAt: new Date()
        });

        // Generate token with role
        const token = generateToken(result.insertedId.toString(), username.toLowerCase(), role);

        return res.status(201).json({
            message: 'User created successfully',
            token,
            user: {
                id: result.insertedId.toString(),
                username: username.toLowerCase(),
                role: role
            }
        });

    } catch (error) {
        console.error('Registration error:', error);
        return res.status(500).json({ 
            error: 'Internal server error',
            details: error.message 
        });
    }
}

