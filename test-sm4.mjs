
import pkg from 'sm-crypto';
const { sm4 } = pkg;

try {
  console.log('Starting test...');
  const key = '0123456789abcdeffedcba9876543210';
  const data = 'hello world';
  const iv = '0123456789abcdeffedcba9876543210';
  
  // Try CBC
  const encrypted = sm4.encrypt(data, key, { mode: 'cbc', iv: iv });
  console.log('SM4 CBC result:', encrypted);
  
  // Try decrypting to be sure
  const decrypted = sm4.decrypt(encrypted, key, { mode: 'cbc', iv: iv });
  console.log('Decrypted:', decrypted);
} catch (e) {
  console.error('Error:', e);
}
