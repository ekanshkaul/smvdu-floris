(() => {
    'use strict';

    const THEME_STORAGE_KEY = 'smvdu_floris_theme';
    const VALID_THEMES = new Set(['dark', 'light']);

    function getStoredTheme() {
        try {
            const storedTheme = localStorage.getItem(THEME_STORAGE_KEY);
            return VALID_THEMES.has(storedTheme) ? storedTheme : null;
        } catch (error) {
            return null;
        }
    }

    function getSystemTheme() {
        return window.matchMedia?.('(prefers-color-scheme: dark)').matches
            ? 'dark'
            : 'light';
    }

    function getInitialTheme() {
        return getStoredTheme() || getSystemTheme();
    }

    function setThemeIconState(theme) {
        const button = document.getElementById('themeToggleBtn');

        if (!button) {
            return;
        }

        const icon = button.querySelector('i');

        if (!icon) {
            return;
        }

        icon.classList.toggle('fa-sun', theme === 'dark');
        icon.classList.toggle('fa-moon', theme !== 'dark');

        button.setAttribute(
            'aria-label',
            theme === 'dark'
                ? 'Switch to light mode'
                : 'Switch to dark mode'
        );

        button.setAttribute(
            'title',
            theme === 'dark'
                ? 'Switch to light mode'
                : 'Switch to dark mode'
        );
    }

    function applyTheme(theme, persist = false) {
        const nextTheme = VALID_THEMES.has(theme)
            ? theme
            : getSystemTheme();

        document.documentElement.setAttribute('data-theme', nextTheme);
        setThemeIconState(nextTheme);

        if (persist) {
            try {
                localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
            } catch (error) {
                // Ignore storage errors.
            }
        }

        return nextTheme;
    }

    // Apply the theme as soon as this shared script loads.
    applyTheme(getInitialTheme());

    // Shared HTML escaping helper.
    window.escapeHtml = function escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    };

    document.addEventListener('DOMContentLoaded', () => {
        /*
         * Highlight the current navigation item.
         */
        const currentPage = window.location.pathname
            .split('/')
            .pop()
            .toLowerCase();

        document.querySelectorAll('nav a[href]').forEach((link) => {
            const linkPage = link.getAttribute('href')
                ?.split('/')
                .pop()
                .split('?')[0]
                .toLowerCase();

            if (
                linkPage &&
                (
                    linkPage === currentPage ||
                    (currentPage === '' && linkPage === 'index.html')
                )
            ) {
                link.classList.add('active');
            }
        });

        /*
         * Retractable Navigation Drawer Handler (Home Page)
         */
        const menuBtn = document.getElementById('btn-toggle-menu');
        const navDrawer = document.getElementById('retractable-nav-drawer');
        const menuIcon = document.getElementById('menu-icon');

        if (menuBtn && navDrawer) {
            menuBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const isOpen = navDrawer.classList.toggle('open');
                navDrawer.setAttribute('aria-hidden', !isOpen);
                if (menuIcon) {
                    menuIcon.className = isOpen ? 'fa-solid fa-xmark' : 'fa-solid fa-bars';
                }
            });

            // Close when clicking anywhere outside
            document.addEventListener('click', (e) => {
                if (!navDrawer.contains(e.target) && !menuBtn.contains(e.target)) {
                    navDrawer.classList.remove('open');
                    navDrawer.setAttribute('aria-hidden', 'true');
                    if (menuIcon) {
                        menuIcon.className = 'fa-solid fa-bars';
                    }
                }
            });
        }

        /*
         * Theme toggle.
         */
        const themeToggleBtn = document.getElementById('themeToggleBtn');

        themeToggleBtn?.addEventListener('click', () => {
            const currentTheme =
                document.documentElement.getAttribute('data-theme') ||
                getSystemTheme();

            const nextTheme =
                currentTheme === 'dark'
                    ? 'light'
                    : 'dark';

            // An explicit click creates a persistent user preference.
            applyTheme(nextTheme, true);
        });

        /*
         * Synchronize theme changes between open tabs/windows.
         */
        window.addEventListener('storage', (event) => {
            if (event.key !== THEME_STORAGE_KEY) {
                return;
            }

            if (VALID_THEMES.has(event.newValue)) {
                applyTheme(event.newValue);
            } else {
                // If the explicit preference is removed,
                // return to the system preference.
                applyTheme(getSystemTheme());
            }
        });

        /*
         * Follow the operating-system theme only while
         * the user has not explicitly selected a theme.
         */
        const mediaQuery = window.matchMedia?.(
            '(prefers-color-scheme: dark)'
        );

        mediaQuery?.addEventListener?.('change', () => {
            if (!getStoredTheme()) {
                applyTheme(getSystemTheme());
            }
        });

        /*
         * Register the service worker if supported.
         */
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('sw.js').catch(() => {
                // Service worker registration failure should not
                // prevent the rest of the application from working.
            });
        }
    });
})();

/* =========================================================
   PAGE & WINDOW TRANSITIONS
   ========================================================= */

(() => {
    const reduceMotion = window.matchMedia(
        '(prefers-reduced-motion: reduce)'
    ).matches;

    // Window/page opening
    if (!reduceMotion) {
        document.body.classList.add('page-enter');

        window.addEventListener('pageshow', () => {
            document.body.classList.remove('page-exit');
            document.body.classList.add('page-enter');
        });
    }

    // Page switching
    document.addEventListener('click', (event) => {
        const link = event.target.closest('a[href]');

        if (!link || reduceMotion) return;

        const href = link.getAttribute('href');

        // Ignore links that should not trigger a page transition
        if (
            !href ||
            href.startsWith('#') ||
            href.startsWith('mailto:') ||
            href.startsWith('tel:') ||
            link.target === '_blank' ||
            link.hasAttribute('download')
        ) {
            return;
        }

        // Ignore external URLs
        const destination = new URL(href, window.location.href);

        if (destination.origin !== window.location.origin) {
            return;
        }

        // Ignore same-page links
        if (
            destination.pathname === window.location.pathname &&
            destination.search === window.location.search &&
            destination.hash
        ) {
            return;
        }

        event.preventDefault();

        document.body.classList.remove('page-enter');
        document.body.classList.add('page-exit');

        setTimeout(() => {
            window.location.href = destination.href;
        }, 180);
    });

    // Browser back/forward cache
    window.addEventListener('pageshow', (event) => {
        if (event.persisted) {
            document.body.classList.remove('page-exit');
        }
    });
})();