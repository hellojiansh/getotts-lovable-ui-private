const fs = require('fs');
const filepath = 'c:/Users/agarw/OneDrive/Desktop/sitebuildup/frontend/index.html';
let content = fs.readFileSync(filepath, 'utf8');

const htmlStart = content.indexOf('<!-- Product Edit Modal -->');
const htmlEnd = content.indexOf('<!-- Dynamic Notification Toast -->');
console.log('HTML indices:', htmlStart, htmlEnd);

if(htmlStart !== -1 && htmlEnd !== -1) {
    content = content.substring(0, htmlStart) + content.substring(htmlEnd);
}

const jsStart = content.indexOf('// ---- Edit Mode ----');
const jsEnd = content.indexOf('// ---- Maintenance Mode (Global via Backend) ----');
console.log('JS indices:', jsStart, jsEnd);

if(jsStart !== -1 && jsEnd !== -1) {
    content = content.substring(0, jsStart) + content.substring(jsEnd);
}

fs.writeFileSync(filepath, content);
console.log('Stripped again.');
