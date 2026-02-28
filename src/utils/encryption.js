const CryptoJS = require('crypto-js');

class Encryption {
  constructor(key) {
    if (!key || key.length < 32) {
      throw new Error('Encryption key must be at least 32 characters');
    }
    this.key = key;
  }

  encrypt(data) {
    if (typeof data !== 'string') {
      data = JSON.stringify(data);
    }
    return CryptoJS.AES.encrypt(data, this.key).toString();
  }

  decrypt(encryptedData) {
    const bytes = CryptoJS.AES.decrypt(encryptedData, this.key);
    return bytes.toString(CryptoJS.enc.Utf8);
  }

  decryptJSON(encryptedData) {
    const decrypted = this.decrypt(encryptedData);
    try {
      return JSON.parse(decrypted);
    } catch (e) {
      return decrypted;
    }
  }
}

module.exports = Encryption;
