const { discoverApiFromWebsite } = require('./index.js');
require('dotenv').config();

(async () => {
  try {
    const res = await discoverApiFromWebsite('https://www.postquee.com');
    console.log(JSON.stringify(res, null, 2));
  } catch (e) {
    console.error('Error:', e);
  }
})();
