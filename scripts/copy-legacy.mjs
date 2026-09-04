// The 2017 build ships alongside the new one, at /fof/legacy/.
import { cpSync } from 'node:fs';

cpSync('legacy', 'dist/legacy', { recursive: true });
console.log('legacy/ -> dist/legacy/');
