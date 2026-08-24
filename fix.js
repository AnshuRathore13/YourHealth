const fs = require('fs');

try {
  let login = fs.readFileSync('frontend/auth/login.html', 'utf8');
  // Fix logo
  login = login.replace(/YourHealth<span[^>]*>\.<\/span>AI/g, 'YourHealth');
  login = login.replace(/YourHealth\s*\.\s*AI/g, 'YourHealth');
  // Fix role tabs
  login = login.replace(/<span class="role-tab active" data-role="patient">.*?Patient<\/span>/g, '<span class="role-tab active" data-role="patient">👤 Patient</span>');
  login = login.replace(/<span class="role-tab" data-role="doctor">.*?Doctor<\/span>/g, '<span class="role-tab" data-role="doctor">👨‍⚕️ Doctor</span>');
  login = login.replace(/<span class="role-tab" data-role="admin">.*?Admin<\/span>/g, '<span class="role-tab" data-role="admin">🛡️ Admin</span>');
  // Fix feature icons
  login = login.replace(/<div class="auth-feature-icon">.*?<\/div>\s*<div class="auth-feature-text">\s*<strong>AI Pre-Visit Summaries<\/strong>/g, '<div class="auth-feature-icon">🧠</div>\n          <div class="auth-feature-text">\n            <strong>AI Pre-Visit Summaries</strong>');
  login = login.replace(/<div class="auth-feature-icon">.*?<\/div>\s*<div class="auth-feature-text">\s*<strong>Google Calendar Sync<\/strong>/g, '<div class="auth-feature-icon">📅</div>\n          <div class="auth-feature-text">\n            <strong>Google Calendar Sync</strong>');
  login = login.replace(/<div class="auth-feature-icon">.*?<\/div>\s*<div class="auth-feature-text">\s*<strong>Medication Reminders<\/strong>/g, '<div class="auth-feature-icon">💊</div>\n          <div class="auth-feature-text">\n            <strong>Medication Reminders</strong>');
  // Fix dashes and quotes
  login = login.replace(/â€”/g, '—');
  login = login.replace(/â€œ/g, '“');
  login = login.replace(/â€/g, '”');
  login = login.replace(/â†’/g, '→');
  // Fix replacement artifacts
  login = login.replace(/â€™/g, "'");

  fs.writeFileSync('frontend/auth/login.html', login, 'utf8');
  console.log("login.html fixed");
} catch(e) { console.error(e) }

try {
  let index = fs.readFileSync('frontend/index.html', 'utf8');
  // Fix portal icons
  index = index.replace(/<span class="portal-icon">.*?<\/span>\s*<div class="portal-title"[^>]*>Patient Portal<\/div>/g, '<span class="portal-icon">👤</span>\n        <div class="portal-title" style="color:var(--text);">Patient Portal</div>');
  index = index.replace(/<span class="portal-icon">.*?<\/span>\s*<div class="portal-title"[^>]*>Doctor Portal<\/div>/g, '<span class="portal-icon">👨‍⚕️</span>\n        <div class="portal-title" style="color:var(--text);">Doctor Portal</div>');
  index = index.replace(/<span class="portal-icon">.*?<\/span>\s*<div class="portal-title"[^>]*>Admin Portal<\/div>/g, '<span class="portal-icon">🛡️</span>\n        <div class="portal-title" style="color:var(--text);">Admin Portal</div>');
  // Fix feature icons
  index = index.replace(/<div class="feature-icon"[^>]*>.*?<\/div>\s*<div class="feature-title">AI Pre-Visit Summaries<\/div>/g, '<div class="feature-icon" style="background:var(--accent-dim); color:var(--accent);">🧠</div>\n        <div class="feature-title">AI Pre-Visit Summaries</div>');
  index = index.replace(/<div class="feature-icon"[^>]*>.*?<\/div>\s*<div class="feature-title">Post-Visit AI Summaries<\/div>/g, '<div class="feature-icon" style="background:var(--accent-dim); color:var(--accent);">📋</div>\n        <div class="feature-title">Post-Visit AI Summaries</div>');
  index = index.replace(/<div class="feature-icon"[^>]*>.*?<\/div>\s*<div class="feature-title">Double-Booking Prevention<\/div>/g, '<div class="feature-icon" style="background:var(--accent-dim); color:var(--accent);">🔒</div>\n        <div class="feature-title">Double-Booking Prevention</div>');
  index = index.replace(/<div class="feature-icon"[^>]*>.*?<\/div>\s*<div class="feature-title">Google Calendar Sync<\/div>/g, '<div class="feature-icon" style="background:var(--accent-dim); color:var(--accent);">📅</div>\n        <div class="feature-title">Google Calendar Sync</div>');
  index = index.replace(/<div class="feature-icon"[^>]*>.*?<\/div>\s*<div class="feature-title">Smart Medication Reminders<\/div>/g, '<div class="feature-icon" style="background:var(--accent-dim); color:var(--accent);">💊</div>\n        <div class="feature-title">Smart Medication Reminders</div>');
  index = index.replace(/<div class="feature-icon"[^>]*>.*?<\/div>\s*<div class="feature-title">Doctor Leave Management<\/div>/g, '<div class="feature-icon" style="background:var(--accent-dim); color:var(--accent);">🏥</div>\n        <div class="feature-title">Doctor Leave Management</div>');

  index = index.replace(/â€”/g, '—');
  index = index.replace(/â†’/g, '→');
  index = index.replace(/â€™/g, "'");

  fs.writeFileSync('frontend/index.html', index, 'utf8');
  console.log("index.html fixed");
} catch(e) { console.error(e) }
