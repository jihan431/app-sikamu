/**
 * Konfigurasi Bot SIKAMU
 * Bot Telegram untuk login dan mengambil data KRS dari SIKAMU UMB
 */

module.exports = {
    // Token Bot Telegram - Dapatkan dari @BotFather
    BOT_TOKEN: '8221754756:AAFzCXE6YC4sdjBl147rgzmu6l4sZ0tvXCw',
    
    // Owner/Admin Bot (Telegram User ID)
    OWNER_ID: 6726423168, // Ganti dengan Telegram User ID Anda
    
    // URL SIKAMU
    SIKAMU_URL: 'https://sikamu.umb.ac.id',
    LOGIN_URL: 'https://sikamu.umb.ac.id/login',
    
    // Session timeout (ms) - 30 menit
    SESSION_TIMEOUT: 30 * 60 * 1000,
};
