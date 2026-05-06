// i18n Logic
const langSelect = document.getElementById('lang-select');

// Robust Language Detection
function getInitialLanguage() {
  const savedLang = localStorage.getItem('axon-lang');
  if (savedLang) return savedLang;

  const browserLangs = navigator.languages || [navigator.language];
  for (const lang of browserLangs) {
    if (lang.startsWith('zh')) return 'zh';
    if (lang.startsWith('en')) return 'en';
  }
  return 'en'; // Default fallback
}

let currentLang = getInitialLanguage();

// OS Detection
function detectOS() {
  const ua = navigator.userAgent.toLowerCase();
  if (ua.indexOf('win') !== -1) return 'windows';
  if (ua.indexOf('mac') !== -1) return 'macos';
  if (ua.indexOf('linux') !== -1) return 'linux';
  return 'macos'; // Default
}

const userOS = detectOS();

function setLanguage(lang) {
  currentLang = lang;
  localStorage.setItem('axon-lang', lang);
  langSelect.value = lang;

  // Update OS-specific download button key before translating
  const mainDownloadBtn = document.querySelector('.hero .btn-primary span');
  if (mainDownloadBtn) {
    mainDownloadBtn.setAttribute('data-i18n', `btn_download_${userOS}`);
  }

  const strings = window.translations[lang];
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (strings[key]) {
      el.innerHTML = strings[key];
    }
  });

  // Re-initialize icons
  lucide.createIcons();
}

langSelect.addEventListener('change', (e) => {
  setLanguage(e.target.value);
});

// Initialize
setLanguage(currentLang);

// Initialize Lucide icons
lucide.createIcons();

// Scroll reveals
const observerOptions = {
  threshold: 0.1
};

const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.style.opacity = '1';
      entry.target.style.transform = 'translateY(0)';
      observer.unobserve(entry.target);
    }
  });
}, observerOptions);

document.querySelectorAll('.reveal').forEach(el => {
  // Reset initial styles for JS-based reveal if not already set in CSS
  el.style.opacity = '0';
  el.style.transform = 'translateY(20px)';
  el.style.transition = 'opacity 0.8s ease, transform 0.8s ease';
  observer.observe(el);
});

// Smooth scrolling for anchor links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
  anchor.addEventListener('click', function (e) {
    e.preventDefault();
    const target = document.querySelector(this.getAttribute('href'));
    if (target) {
      target.scrollIntoView({
        behavior: 'smooth'
      });
    }
  });
});
