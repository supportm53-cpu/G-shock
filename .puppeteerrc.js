const { join } = require('path');

/**
 * @type {import("puppeteer").Configuration}
 */
module.exports = {
  // Set cache directory for Render/Railway
  cacheDirectory: join(__dirname, '.cache', 'puppeteer'),
  
  // Download Chrome on install
  chrome: {
    skipDownload: false,
  },
};
