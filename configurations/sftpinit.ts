import Client from 'ssh2-sftp-client';
import logger from '../lib/logger';

const sftp = new Client();

async function connectSFTP() {
    try {
        if (!sftp.sftp) {
            await sftp.connect({
                host: process.env.SFTP_HOST,
                port: Number(process.env.SFTP_PORT),
                username: process.env.SFTP_USER,
                password: process.env.SFTP_PASSWORD
            });
            logger.info('SFTP connection established');
        }
    } catch (error) {
        logger.error('Failed to connect to SFTP:', error);
        throw error;
    }
}

// Automatically reconnect on connection reset
sftp.on('end', async () => {
    logger.warn('SFTP connection ended. Attempting to reconnect...');
    try {
        await connectSFTP();
    } catch (error) {
        logger.error('Reconnection attempt failed:', error);
    }
});

sftp.on('close', async () => {
    logger.warn('SFTP connection closed. Attempting to reconnect...');
    try {
        await connectSFTP();
    } catch (error) {
        logger.error('Reconnection attempt failed:', error);
    }
});

// Initial connection
(async () => {
    await connectSFTP();
})();

export default sftp;