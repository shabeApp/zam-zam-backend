import { createClient } from 'redis';
import { CONFIG } from '../config/constants';

export const redisClient = createClient({
    username: CONFIG.REDIS_USERNAME,
    password: CONFIG.REDIS_PASSWORD,
    socket: {
        host: CONFIG.REDIS_HOST,
        port: parseInt(CONFIG.REDIS_PORT)
    }
});

redisClient.on('error', err => console.log('Redis Client Error', err));

// export const connectRedis = async () => {
//     if (!redisClient.isOpen) {
//         await redisClient.connect();
//     }
// };

(async () => {
    if (!redisClient.isOpen) {
        await redisClient.connect();
        console.log('Connected to Redis');
    }
})();