import { rmSync } from 'node:fs';
export default () => rmSync('.data/e2e', { recursive: true, force: true });
