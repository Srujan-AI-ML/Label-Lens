// Auth utility functions with RBAC
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'labellens-secret-key-change-in-production';

export const USER_ROLES = {
    ADMIN: 'ADMIN',
    ENFORCEMENT_OFFICER: 'ENFORCEMENT_OFFICER',
    INSPECTOR: 'INSPECTOR',
    MERCHANT: 'MERCHANT'
};

export function generateToken(userId, username, role = 'INSPECTOR') {
    return jwt.sign(
        { userId, username, role: role || 'INSPECTOR' },
        JWT_SECRET,
        { expiresIn: '7d' }
    );
}

export function verifyToken(token) {
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        if (decoded && !decoded.role) {
            decoded.role = 'INSPECTOR'; // Safe default migration for legacy tokens
        }
        return decoded;
    } catch (error) {
        return null;
    }
}

export function getTokenFromHeader(req) {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        return authHeader.substring(7);
    }
    return null;
}

export async function authenticateRequest(req) {
    const token = getTokenFromHeader(req);
    if (!token) {
        return null;
    }
    return verifyToken(token);
}

export function hasRole(user, allowedRoles = []) {
    if (!user) return false;
    const userRole = user.role || 'INSPECTOR';
    if (userRole === 'ADMIN') return true; // Admin has full access to all resources
    return allowedRoles.includes(userRole);
}

