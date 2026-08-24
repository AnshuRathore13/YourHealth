const fs = require('fs');
const path = require('path');

function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        file = path.join(dir, file);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory() && !file.includes('node_modules') && !file.includes('.git')) {
            results = results.concat(walk(file));
        } else {
            if (file.match(/\.(html|js|ts|md|css|sql)$/)) {
                results.push(file);
            }
        }
    });
    return results;
}

const files = walk('C:\\yourhealth.AI');
let updatedCount = 0;
files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    let original = content;
    
    // Fix logos with spans or spaces
    content = content.replace(/YourHealth<span[^>]*>\.<\/span>AI/g, 'YourHealth');
    content = content.replace(/YourHealth\s*\.\s*AI/g, 'YourHealth');
    
    // Fix normal text YourHealth
    content = content.replace(/YourHealth\.AI/g, 'YourHealth');
    
    if (content !== original) {
        fs.writeFileSync(file, content, 'utf8');
        console.log("Updated: " + file);
        updatedCount++;
    }
});
console.log("Total files updated: " + updatedCount);
