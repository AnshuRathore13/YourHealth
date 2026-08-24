/**
 * YourHealth — Frontend API Client v2
 * Covers all backend routes (UTH.AI + backend-extensions).
 * All methods: async, throw on HTTP error, include JWT automatically.
 * Falls back gracefully — callers catch errors and show mock data.
 */

const API_BASE = 'http://localhost:5000/api';

// ============================================================
// HTTP helper
// ============================================================
async function http(method, path, body, auth = true) {
  const headers = { 'Content-Type': 'application/json' };
  if (auth) {
    const token = localStorage.getItem('yh_token');
    if (token) headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.error || data.message || `HTTP ${res.status}: ${path}`);
  }

  // Normalize appointments to include a valid datetime string
  const normalizeApt = (a) => {
    if (a && a.appointmentDate && a.timeSlot) {
      // timeSlot might be '09:00 AM' or '14:30'
      const timeStr = a.timeSlot;
      let [time, modifier] = timeStr.split(' ');
      let [hours, minutes] = time.split(':');
      if (modifier) {
        if (hours === '12') hours = '00';
        if (modifier.toUpperCase() === 'PM') hours = parseInt(hours, 10) + 12;
      }
      const hh = String(hours).padStart(2, '0');
      const mm = String(minutes).padStart(2, '0');
      a.datetime = `${a.appointmentDate}T${hh}:${mm}:00`;
    }
  };

  if (data && data.data && Array.isArray(data.data)) {
    data.data.forEach(normalizeApt);
  } else if (Array.isArray(data)) {
    data.forEach(normalizeApt);
  } else if (data && data.appointmentDate && data.timeSlot) {
    normalizeApt(data);
  }
  
  return data;
}

const get    = (path, auth) => http('GET',    path, null, auth);
const post   = (path, body, auth) => http('POST',   path, body, auth);
const put    = (path, body, auth) => http('PUT',    path, body, auth);
const patch  = (path, body, auth) => http('PATCH',  path, body, auth);
const del    = (path, auth) => http('DELETE', path, null, auth);

// ============================================================
// API Namespaces
// ============================================================
const api = {

  // ——————————————————————————
  // AUTH  /api/auth
  // ——————————————————————————
  auth: {
    login:          (email, password, role) => post('/auth/login', { email, password, role }, false),
    register: (payload) => post('/auth/register', {
      email:    payload.email,
      password: payload.password,
      name:     `${payload.firstName} ${payload.lastName}`.trim(),
      role:     (payload.role || 'patient').toUpperCase(),
      // Extended fields stored in profile
      phone:      payload.phone,
      dob:        payload.dob,
      gender:     payload.gender,
      bloodGroup: payload.bloodGroup,
      allergies:  payload.allergies,
      conditions: payload.conditions,
    }, false),
    profile: () => get('/auth/profile'),
    forgotPassword: (email) => post('/auth/forgot-password', { email }, false),
    resetPassword: (token, password) => post('/auth/reset-password', { token, password }, false),
    logout:  () => { Auth.clear(); window.location.href = '../auth/login.html'; },
  },

  // ——————————————————————————
  // AI  /api/ai
  // ——————————————————————————
  ai: {
    preVisitSummary:  (appointmentId, symptoms) => post('/ai/pre-visit',  { appointmentId, symptoms }),
    postVisitSummary: (appointmentId, notes)    => post('/ai/post-visit', { appointmentId, notes }),
  },

  // ——————————————————————————
  // DOCTORS  /api/doctors
  // ——————————————————————————
  doctors: {
    list:         (params = {}) => get(`/doctors?${new URLSearchParams(params)}`, false),
    get:          (id)          => get(`/doctors/${id}`, false),
    availability: (id, date)    => get(`/doctors/${id}/availability?date=${date}`, false),
    setLeave:     (id, dates)   => post(`/doctors/${id}/leave`, { dates }),
    // Admin only
    create:       (payload)     => post('/admin/doctors', payload),
    update:       (id, payload) => put(`/admin/doctors/${id}`, payload),
    delete:       (id)          => del(`/admin/doctors/${id}`),
  },

  // ——————————————————————————
  // APPOINTMENTS  /api/appointments
  // ——————————————————————————
  appointments: {
    list:       (params = {}) => get(`/appointments?${new URLSearchParams(params)}`),
    get:        (id)          => get(`/appointments/${id}`),
    book:       (payload)     => post('/appointments', payload),
    cancel:     (id, reason)  => patch(`/appointments/${id}/cancel`, { reason }),
    complete:   (id, payload) => patch(`/appointments/${id}/complete`, payload),
    reschedule: (id, payload) => patch(`/appointments/${id}/reschedule`, payload),
    rate:       (id, rating)  => post(`/patient/appointments/${id}/rate`, { rating }),
  },

  // ——————————————————————————
  // PATIENT  /api/patient
  // ——————————————————————————
  patient: {
    appointments: (status) => get(`/patient/appointments${status ? `?status=${status}` : ''}`),
    prescriptions: ()      => get('/patient/prescriptions'),
    reminders:    ()       => get('/patient/reminders'),
    profile:      ()       => get('/patient/profile'),
  },

  // ——————————————————————————
  // DOCTOR  /api/doctor
  // ——————————————————————————
  doctor: {
    schedule:    (date)          => get(`/doctor/schedule${date ? `?date=${date}` : ''}`),
    patients:    ()              => get('/doctor/patients'),
    profile:     ()              => get('/doctor/profile'),
    updateProfile:(payload)      => patch('/doctor/profile', payload),
    submitNotes: (id, payload)   => post(`/doctor/appointments/${id}/notes`, payload),
    prescriptions:()             => get('/doctor/prescriptions'),
    // Legacy
    postVisit:   (payload)       => post('/doctor/post-visit', payload),
  },

  // ——————————————————————————
  // ADMIN  /api/admin
  // ——————————————————————————
  admin: {
    stats:            ()         => get('/admin/stats'),
    doctors:          ()         => get('/admin/doctors'),
    appointments:     (p = {})   => get(`/admin/appointments?${new URLSearchParams(p)}`),
    notificationLogs: ()         => get('/admin/notification-logs'),
    users:            ()         => get('/admin/users'),
    addLeave:         (payload)  => post('/admin/leave', payload),
  },
};

// ============================================================
// Auth State
// ============================================================
const Auth = {
  save(token, user) {
    localStorage.setItem('yh_token', token);
    localStorage.setItem('yh_user',  JSON.stringify(user));
  },
  clear() {
    localStorage.removeItem('yh_token');
    localStorage.removeItem('yh_user');
  },
  get token() { return localStorage.getItem('yh_token'); },
  get user()  {
    try { return JSON.parse(localStorage.getItem('yh_user') || 'null'); }
    catch { return null; }
  },
  get role()  { return (this.user?.role || '').toLowerCase(); },
  isLoggedIn() { return !!this.token && !!this.user; },
  requireRole(role) {
    if (!this.isLoggedIn()) {
      window.location.href = `../auth/login.html?role=${role}`;
      return false;
    }
    if (this.role !== role) {
      // Redirect to correct portal
      const portals = { patient: '../patient/dashboard.html', doctor: '../doctor/dashboard.html', admin: '../admin/dashboard.html' };
      window.location.href = portals[this.role] || '../index.html';
      return false;
    }
    return true;
  },
  logout() {
    this.clear();
    // Using relative path works for both portals (patient/doctor/admin -> ../auth)
    window.location.href = '../auth/login.html';
  }
};

// ============================================================
// Toast notification system
// ============================================================
const Toast = {
  show(type, title, message, duration = 4000) {
    const colors = {
      success: { border: 'var(--green)',  icon: '✓' },
      error:   { border: 'var(--red)',    icon: '✕' },
      warning: { border: 'var(--amber)',  icon: '⚠' },
      info:    { border: 'var(--accent)', icon: 'ℹ' },
    };
    const { border, icon } = colors[type] || colors.info;

    const el = document.createElement('div');
    el.className = 'toast';
    el.style.cssText = `border-left-color:${border};`;
    el.innerHTML = `
      <div style="display:flex;align-items:flex-start;gap:10px;">
        <div style="width:20px;height:20px;border-radius:50%;background:${border};display:flex;align-items:center;justify-content:center;font-size:0.7rem;font-weight:700;color:#fff;flex-shrink:0;">${icon}</div>
        <div>
          <div style="font-weight:700;font-size:0.88rem;margin-bottom:2px;">${title}</div>
          ${message ? `<div style="font-size:0.8rem;color:var(--text-2);">${message}</div>` : ''}
        </div>
        <div onclick="this.closest('.toast').remove()" style="margin-left:auto;cursor:pointer;opacity:0.5;font-size:0.9rem;flex-shrink:0;">✕</div>
      </div>`;

    const container = document.querySelector('.toast-container');
    if (container) container.appendChild(el);

    setTimeout(() => el.classList.add('toast-exit'), duration - 400);
    setTimeout(() => el.remove(), duration);
  },
  success: (title, msg) => Toast.show('success', title, msg),
  error:   (title, msg) => Toast.show('error',   title, msg),
  warning: (title, msg) => Toast.show('warning', title, msg),
  info:    (title, msg) => Toast.show('info',     title, msg),
};

// ============================================================
// Button Loader helper
// ============================================================
const Loader = {
  show(btn, text = 'Loading...') {
    btn._original = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="animation:spin 1s linear infinite;"><path d="M21 12a9 9 0 11-9-9"/></svg> ${text}`;
  },
  hide(btn) {
    btn.disabled = false;
    btn.innerHTML = btn._original || btn.innerHTML;
  }
};

// ============================================================
// Format Utilities
// ============================================================
const Format = {
  date(d) {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  },
  time(d) {
    if (!d) return '—';
    return new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
  },
  urgency(level = 'Low') {
    const map = {
      low:    { label: 'Low Urgency',    class: 'badge-green',  dot: 'urgency-low' },
      medium: { label: 'Medium Urgency', class: 'badge-amber',  dot: 'urgency-medium' },
      high:   { label: 'High Urgency',   class: 'badge-red',    dot: 'urgency-high' },
    };
    return map[(level || 'Low').toLowerCase()] || map.low;
  },
  status(s = 'confirmed') {
    const map = {
      confirmed: 'badge-blue',
      completed: 'badge-green',
      cancelled: 'badge-red',
      pending:   'badge-amber',
    };
    return map[(s || '').toLowerCase()] || 'badge-default';
  }
};

// ============================================================
// Sidebar toggle (shared across portal pages)
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  const toggle  = document.getElementById('sidebar-toggle');
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebar-overlay');

  if (toggle && sidebar) {
    toggle.addEventListener('click', () => {
      sidebar.classList.toggle('open');
      if (overlay) overlay.classList.toggle('active');
    });
  }
  if (overlay) {
    overlay.addEventListener('click', () => {
      sidebar?.classList.remove('open');
      overlay.classList.remove('active');
    });
  }
});
