// Health check endpoint
export default function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', 'application/json');

    const hasMongoUri = !!process.env.MONGODB_URI;
    const hasJwtSecret = !!process.env.JWT_SECRET;
    const mongoUriPrefix = process.env.MONGODB_URI ? process.env.MONGODB_URI.substring(0, 25) + '...' : 'NOT SET';

    return res.status(200).json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        nodeVersion: process.version,
        env: {
            MONGODB_URI: hasMongoUri ? 'SET (' + mongoUriPrefix + ')' : 'NOT SET',
            JWT_SECRET: hasJwtSecret ? 'SET' : 'NOT SET',
            GOOGLE_CLOUD_CLIENT_EMAIL: !!process.env.GOOGLE_CLOUD_CLIENT_EMAIL,
            VITE_GOOGLE_CLOUD_CLIENT_EMAIL: !!process.env.VITE_GOOGLE_CLOUD_CLIENT_EMAIL,
            GOOGLE_CLOUD_PRIVATE_KEY: !!process.env.GOOGLE_CLOUD_PRIVATE_KEY,
            VITE_GOOGLE_CLOUD_PRIVATE_KEY: !!process.env.VITE_GOOGLE_CLOUD_PRIVATE_KEY,
        }
    });
}
