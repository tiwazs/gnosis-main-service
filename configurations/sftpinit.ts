import Client from 'ssh2-sftp-client';
import logger from '../lib/logger';

let sftp = new Client(); // Changed from const to let
setupSFTPListeners();
let isConnected = false;

async function connectSFTP() {
    try {
        if (!isConnected) {
            await sftp.connect({
                host: process.env.SFTP_HOST,
                port: Number(process.env.SFTP_PORT),
                username: process.env.SFTP_USER,
                password: process.env.SFTP_PASSWORD,
            });
            isConnected = true;
            logger.info('SFTP connection established');
        }
    } catch (error) {
        isConnected = false;
        logger.error('Failed to connect to SFTP:', error);
        throw error;
    }
}

function setupSFTPListeners() {
    sftp.on('end', async () => {
        logger.warn('SFTP connection ended. Attempting to reconnect...');
        isConnected = false;
        try {
            await reconnectSFTP();
        } catch (error) {
            logger.error('Reconnection attempt failed:', error);
        }
    });

    sftp.on('close', async () => {
        logger.warn('SFTP connection closed. Attempting to reconnect...');
        isConnected = false;
        try {
            await reconnectSFTP();
        } catch (error) {
            logger.error('Reconnection attempt failed:', error);
        }
    });

    sftp.on('error', async (error: Error) => {
        logger.error(`SFTP error occurred: ${error.message}`);
        isConnected = false;
        try {
            await reconnectSFTP();
        } catch (reconnectError) {
            logger.error('Failed to recover from SFTP error:', reconnectError);
        }
    });
}

async function reconnectSFTP(retries = 5, delay = 1000) {
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            logger.info(`Reconnection attempt ${attempt}...`);

            // Destroy the current SFTP client and create a new one
            try {
                await sftp.end(); 
            } catch (endError) {
                if (endError instanceof Error) {
                    logger.warn(`Failed to properly close SFTP connection: ${endError.message}`);
                } else {
                    logger.warn(`Failed to properly close SFTP connection: ${String(endError)}`);
                }
            }

            // Recreate the SFTP client instance
            sftp = new Client(); 
            setupSFTPListeners();

            // Attempt to reconnect
            await connectSFTP();
            logger.info('Reconnection successful');
            return;
        } catch (error) {
            if (error instanceof Error) {
                logger.warn(`Reconnection attempt ${attempt} failed: ${error.message}`);
            } else {
                logger.warn(`Reconnection attempt ${attempt} failed: ${String(error)}`);
            }

            if (attempt < retries) {
                await new Promise(resolve => setTimeout(resolve, delay));
                delay *= 2;
            } else {
                logger.error('All reconnection attempts failed');
                throw error;
            }
        }
    }
}

async function checkSFTPHealth() {
    try {
        if (isConnected) {
            // Perform a simple operation to verify the connection
            await sftp.list('/');
            logger.info('SFTP connection is healthy');
        }
    } catch (error) {
        logger.warn('SFTP connection is unhealthy. Attempting to reconnect...');
        isConnected = false;
        try {
            await reconnectSFTP();
        } catch (reconnectError) {
            logger.error('Failed to recover from unhealthy SFTP connection:', reconnectError);
        }
    }
}

// Initial connection
(async () => {
    try {
        await connectSFTP();
        // Start the health check to monitor the connection every 30 seconds
        setInterval(checkSFTPHealth, 30000);
    } catch (error) {
        logger.error('Failed to establish initial SFTP connection:', error);
    }
})();

export default sftp;