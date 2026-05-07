import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import type { Request, Response } from 'express';

export const userRateLimiter = rateLimit({
    windowMs: 1000, // 1 second window
    max: 10, // Limit each user/IP to 10 requests per windowMs
    message: {
        status: "error",
        message: "Rate limit exceeded. Maximum 10 requests per second allowed."
    },
    standardHeaders: true,
    legacyHeaders: false,

    keyGenerator: (req: Request, res: Response) => {
        const user = req.user as any;

        // 1. If logged in, limit by their secure Database ID
        if (user && (user.sub || user.id)) {
            return String(user.sub || user.id);
        }

        // 2. Pass the raw IP string to the helper function, NOT the req object!
        return ipKeyGenerator(req.ip || req.socket.remoteAddress || '');
    }
});