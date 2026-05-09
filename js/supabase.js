const supabaseUrl = 'https://hthhhdxqlyrouoerxjbq.supabase.co/rest/v1/';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh0aGhoZHhxbHlyb3VvZXJ4amJxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgyOTMyOTAsImV4cCI6MjA5Mzg2OTI5MH0.zvzFUgri_amW4njCbUZHJnXt-jH55IgDYhgkVFm8gLU';

const hasSupabaseConfig = supabaseUrl.startsWith('https://') && !supabaseKey.includes('YOUR_SUPABASE');
const weddingSupabase = hasSupabaseConfig
  ? window.supabase.createClient(supabaseUrl, supabaseKey)
  : null;

const WEDDING_DATE = new Date('2027-03-28T12:00:00+08:00');
const REGISTRATION_DEADLINE = new Date('2027-02-28T23:59:59+08:00');

function setupNavigation() {
  const toggle = document.querySelector('[data-nav-toggle]');
  const links = document.querySelector('[data-nav-links]');

  if (!toggle || !links) return;

  toggle.addEventListener('click', () => {
    links.classList.toggle('open');
  });

  links.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', () => links.classList.remove('open'));
  });
}

function setupRevealAnimation() {
  const items = document.querySelectorAll('.reveal');
  if (!items.length) return;

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.14 });

  items.forEach((item) => observer.observe(item));
}

function setupFaq() {
  document.querySelectorAll('[data-faq-question]').forEach((button) => {
    button.addEventListener('click', () => {
      const item = button.closest('.faq-item');
      item.classList.toggle('open');
    });
  });
}

function setupCalendarButtons() {
  document.querySelectorAll('[data-calendar]').forEach((button) => {
    button.addEventListener('click', () => {
      const ics = [
        'BEGIN:VCALENDAR',
        'VERSION:2.0',
        'PRODID:-//Yu and 134 Wedding//Wedding Site//ZH',
        'BEGIN:VEVENT',
        'UID:yu-134-wedding-20270328@example.com',
        'DTSTAMP:20270101T000000Z',
        'DTSTART:20270328T040000Z',
        'DTEND:20270328T080000Z',
        'SUMMARY:Yu & 134 Wedding',
        'LOCATION:新竹芙莉嘉, 新竹市東區公道五路二段105號',
        'DESCRIPTION:余為哲與林淯阡的婚禮。中午 12:00 入席，12:30 開席。',
        'END:VEVENT',
        'END:VCALENDAR'
      ].join('\r\n');

      downloadFile('yu-134-wedding.ics', ics, 'text/calendar;charset=utf-8');
    });
  });
}

function showNotice(element, message, type = 'success') {
  if (!element) return;
  element.textContent = message;
  element.className = `notice ${type} show`;
}

function clearNotice(element) {
  if (!element) return;
  element.textContent = '';
  element.className = 'notice';
}

function setLoading(spinner, isLoading) {
  if (!spinner) return;
  spinner.classList.toggle('show', isLoading);
}

function sanitizePhone(phone) {
  return String(phone || '').replace(/\s|-/g, '').trim();
}

function isRegistrationClosed() {
  return Date.now() > REGISTRATION_DEADLINE.getTime();
}

function translateStatus(status) {
  const labels = {
    attending: '確認參加',
    declined: '不克參加',
    pending: '尚未確認'
  };

  return labels[status] || status || '尚未確認';
}

function downloadFile(filename, content, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

document.addEventListener('DOMContentLoaded', () => {
  setupNavigation();
  setupRevealAnimation();
  setupFaq();
  setupCalendarButtons();
});
