// Sistema de Internacionalización (i18n) - Funcional
let translations = {};
let currentLanguage = localStorage.getItem('language') || 'es';

// Cargar traducciones
async function loadTranslations() {
    try {
        const esResponse = await fetch('/js/es.json');
        const enResponse = await fetch('/js/en.json');
        
        translations.es = await esResponse.json();
        translations.en = await enResponse.json();
    } catch (error) {
        console.error('Error loading translations:', error);
    }
}

// Función de traducción
function t(key) {
    return translations[currentLanguage]?.[key] || key;
}

// Cambiar idioma
function setLanguage(lang) {
    currentLanguage = lang;
    localStorage.setItem('language', lang);
    updatePageLanguage();
    updateLanguageSelector();
}

// Actualizar idioma de la página
function updatePageLanguage() {
    document.documentElement.lang = currentLanguage;
    document.querySelectorAll('[data-i18n]').forEach(element => {
        const key = element.getAttribute('data-i18n');
        if (element.tagName === 'INPUT' && (element.type === 'text' || element.type === 'email' || element.type === 'password' || element.type === 'tel')) {
            element.placeholder = t(key);
        } else {
            element.textContent = t(key);
        }
    });
    
    // Actualizar título
    const titleKey = document.querySelector('title')?.getAttribute('data-i18n');
    if (titleKey) {
        document.title = t(titleKey);
    }
}

// Agregar selector de idioma
function addLanguageSelector() {
    if (document.querySelector('.language-selector')) return;
    
    const navbar = document.querySelector('.navbar ul, nav ul');
    if (!navbar) return;
    
    const selector = document.createElement('li');
    selector.className = 'language-selector';
    selector.innerHTML = `
        <select id="languageSelect">
            <option value="es">${t('language.spanish')}</option>
            <option value="en">${t('language.english')}</option>
        </select>
    `;
    
    navbar.appendChild(selector);
    
    const select = selector.querySelector('#languageSelect');
    select.value = currentLanguage;
    select.addEventListener('change', (e) => {
        setLanguage(e.target.value);
    });
}

// Actualizar selector de idioma
function updateLanguageSelector() {
    const select = document.querySelector('#languageSelect');
    if (select) {
        select.value = currentLanguage;
        const options = select.querySelectorAll('option');
        options[0].textContent = t('language.spanish');
        options[1].textContent = t('language.english');
    }
}

// Inicializar sistema i18n
async function initI18n() {
    await loadTranslations();
    updatePageLanguage();
    addLanguageSelector();
}

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', initI18n);