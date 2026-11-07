// Usage: npm run pin -- 1234   → prints a hash for PLAYER_PINS
import { randomBytes, scryptSync } from 'node:crypto';

const pin = process.argv[2];
if (!pin || !/^\d{4,8}$/.test(pin)) {
  console.error('PIN mit 4–8 Ziffern angeben: npm run pin -- 1234');
  process.exit(1);
}
const salt = randomBytes(16);
console.log(`scrypt$${salt.toString('hex')}$${scryptSync(pin, salt, 32).toString('hex')}`);
