
let translations = {};
let currentLanguage = localStorage.getItem('language') || 'es';


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


function t(key) {
    return translations[currentLanguage]?.[key] || key;
}


function setLanguage(lang) {
    currentLanguage = lang;
    localStorage.setItem('language', lang);
    updatePageLanguage();
    updateLanguageSelector();
}


function updatePageLanguage() {
    document.documentElement.lang = currentLanguage;
    document.querySelectorAll('[data-i18n], [data-i18n-placeholder]').forEach(translateElement);


    const titleKey = document.querySelector('title')?.getAttribute('data-i18n');
    if (titleKey) {
        document.title = t(titleKey);
    }
}


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


function updateLanguageSelector() {
    const select = document.querySelector('#languageSelect');
    if (select) {
        select.value = currentLanguage;
        const options = select.querySelectorAll('option');
        options[0].textContent = t('language.spanish');
        options[1].textContent = t('language.english');
    }
}


function translateElement(element) {
    const key = element.getAttribute('data-i18n');
    const placeholderKey = element.getAttribute('data-i18n-placeholder');

    if (key) {
        const tagName = element.tagName.toLowerCase();
        const inputTypes = ['text', 'email', 'password', 'tel', 'search'];

        if (tagName === 'input' && inputTypes.includes(element.type)) {
            element.placeholder = t(key);
        } else if (tagName === 'textarea') {
            element.placeholder = t(key);
        } else if (element.hasAttribute('title')) {
            element.title = t(key);
        } else if (element.hasAttribute('alt')) {
            element.alt = t(key);
        } else if (element.hasAttribute('aria-label')) {
            element.setAttribute('aria-label', t(key));
        } else {
            element.textContent = t(key);
        }
    }

    if (placeholderKey) {
        element.placeholder = t(placeholderKey);
    }
}


function setupDOMObserver() {
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {

            if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        // Traducir el elemento si tiene data-i18n
                        if (node.hasAttribute('data-i18n')) {
                            translateElement(node);
                        }
                        // Traducir elementos hijos con data-i18n
                        node.querySelectorAll?.('[data-i18n]').forEach(translateElement);
                    }
                });
            }


            if (mutation.type === 'attributes' && (mutation.attributeName === 'data-i18n' || mutation.attributeName === 'data-i18n-placeholder')) {
                translateElement(mutation.target);
            }
        });
    });

    observer.observe(document.documentElement, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['data-i18n', 'data-i18n-placeholder']
    });
}


async function initI18n() {
    await loadTranslations();
    updatePageLanguage();
    addLanguageSelector();
    setupDOMObserver();
}


document.addEventListener('DOMContentLoaded', initI18n);