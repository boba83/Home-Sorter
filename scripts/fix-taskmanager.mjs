import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const filePath = path.join(path.dirname(fileURLToPath(import.meta.url)), '../src/pages/TaskManager.jsx');
let s = fs.readFileSync(filePath, 'utf8');

const badTag = 'm' + 'o' + 't' + 'i' + 'o' + 'n' + 'l' + 'e' + 's' + 's';
s = s.split('</' + badTag + '>').join('</div>');
s = s.split('<' + badTag + ' ').join('<' + 'div' + ' ');
s = s.split('<' + badTag + '>').join('<' + 'd' + 'i' + 'v' + '>');

const marker = '            {addingColumn ? (';
const markerEnd = '              ) : null}';
if (s.includes('addColumnUi') && s.includes(marker)) {
  const start = s.indexOf(marker);
  const end = s.indexOf(markerEnd, start) + markerEnd.length;
  s = s.slice(0, start) + '              {addColumnUi}' + s.slice(end);
}

fs.writeFileSync(filePath, s);
console.log('TaskManager.jsx fixed');
