const fs = require('fs');
const files = [
  'frontend/doctor/dashboard.html',
  'frontend/doctor/schedule.html',
  'frontend/doctor/prescriptions.html'
];

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(
    /<a href="#" class="sidebar-item" onclick="Toast\.info\('Coming Soon', 'This module will be available in V2\.'\)">/g,
    '<a href="patients.html" class="sidebar-item">'
  );
  fs.writeFileSync(file, content, 'utf8');
});
console.log("Sidebar updated.");
