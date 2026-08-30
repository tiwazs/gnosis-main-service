import express from 'express';
import crypto from 'crypto';
import logger from '../lib/logger';
import { UserService } from '../services/userService';
import { AuthenticationService } from '../services/authenticationService';

const router = express.Router();

function gatewaySecretOk(req: express.Request): boolean {
    const want = process.env.GATEWAY_INTERNAL_SECRET;
    const got = req.header('X-Gateway-Secret') || '';
    if (!want) {
        return false;
    }
    const a = Buffer.from(got);
    const b = Buffer.from(want);
    if (a.length !== b.length) {
        return false;
    }
    return crypto.timingSafeEqual(a, b);
}

router.get('/apikey', async (req, res) => {
    if (!gatewaySecretOk(req)) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    const key = typeof req.query.key === 'string' ? req.query.key : '';
    if (!key) {
        return res.status(400).json({ error: 'key is required' });
    }
    try {
        const user = await UserService.getByApiKey(key);
        if (!user) {
            return res.status(404).json({ error: 'Not found' });
        }
        return res.status(200).json({ id: user.id, email: user.email ?? '' });
    } catch (error: any) {
        logger.error(error.message);
        return res.status(500).json({ error: error.message });
    }
});

router.post('/token', async (req, res) => {
    if (!gatewaySecretOk(req)) {
        return res.status(401).json({ error: 'Unauthorized' });
    }
    const userId = req.body?.userId;
    if (!userId || typeof userId !== 'string') {
        return res.status(400).json({ error: 'userId is required' });
    }
    try {
        const issued = await AuthenticationService.issueTokenForUser(userId);
        return res.status(200).json(issued);
    } catch (error: any) {
        logger.error(error.message);
        if (error.message === 'User not found') {
            return res.status(404).json({ error: error.message });
        }
        return res.status(500).json({ error: error.message });
    }
});

module.exports = router;
