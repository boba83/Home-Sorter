import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const filePath = path.join(__dirname, '../src/pages/AcceptInvite.jsx');
let s = fs.readFileSync(filePath, 'utf8');

const wrongTag = ['m', 'o', 't', 'i', 'o', 'n', 'l', 'e', 's', 's'].join('');
const rightTag = ['d', 'i', 'v'].join('');
s = s.split(wrongTag).join(rightTag);

fs.writeFileSync(filePath, s);
console.log('Replaced tag', wrongTag, '->', rightTag);
