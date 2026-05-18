import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const filePath = path.join(path.dirname(fileURLToPath(import.meta.url)), '../src/pages/UserManagment.jsx');
let s = fs.readFileSync(filePath, 'utf8');

s = s.replace(/<\/div>>/g, '</div>');
const bad = 'm' + 'o' + 't' + 'i' + 'o' + 'n' + 'l' + 'e' + 's' + 's';
s = s.split('</' + bad + '>').join('</' + 'd' + 'i' + 'v' + '>');

fs.writeFileSync(filePath, s);
console.log('fixed');
