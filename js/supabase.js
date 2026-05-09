const supabaseUrl = 'https://hthhhdxqlyrouoerxjbq.supabase.co/rest/v1/';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh0aGhoZHhxbHlyb3VvZXJ4amJxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgyOTMyOTAsImV4cCI6MjA5Mzg2OTI5MH0.zvzFUgri_amW4njCbUZHJnXt-jH55IgDYhgkVFm8gLU';

const weddingSupabase = window.supabase.createClient(supabaseUrl, supabaseKey);

const WEDDING_DATE = new Date('2026-11-21T12:00:00+08:00');

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

document.addEventListener('DOMContentLoaded', () => {
  setupNavigation();
  setupRevealAnimation();
});
