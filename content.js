// Content script for ABESConnect
// Runs on http://192.168.1.254:8090/* and https://192.168.1.254:8090/*

(function () {
    'use strict';

    console.log('ABESConnect: Content script loaded (v3.0 - CSP Bypass via Background).');

    const { AUTO_SUBMIT_DELAY_MS, MAX_RETRIES, RETRY_INTERVAL_MS } = CONFIG;

    let isSubmitting = false;
    let credentials = null;
    let warnedMissingCredentials = false;

    function isValidCredentials(creds) {
        return !!(creds && creds.username && creds.password);
    }

    function getStoredCredentials() {
        return new Promise((resolve) => {
            chrome.storage.local.get(['abesCredentials'], (result) => {
                resolve(result.abesCredentials || null);
            });
        });
    }

    async function loadCredentials(forceReload = false) {
        if (!forceReload && isValidCredentials(credentials)) {
            return credentials;
        }

        credentials = await getStoredCredentials();
        return credentials;
    }

    // Function to check for success and close tab
    function checkSuccessAndClose() {
        const bodyText = document.body.innerText.toLowerCase();
        // Check for common indicators of being logged in
        if (bodyText.includes('logout') || bodyText.includes('sign out') || bodyText.includes('logged in')) {
            console.log('ABESConnect: Login successful. Closing tab...');
            chrome.runtime.sendMessage({ action: 'close_tab' });
            return true;
        }
        return false;
    }

    function attemptLogin() {
        if (isSubmitting) return;

        if (!isValidCredentials(credentials)) {
            if (!warnedMissingCredentials) {
                console.warn('ABESConnect: Missing credentials. Set username/password in the popup.');
                warnedMissingCredentials = true;
            }
            return;
        }

        // If we are already logged in, close immediately
        if (checkSuccessAndClose()) return;

        // 1. Find Username Field
        const usernameSelectors = [
            'input[name="username"]', 'input[id="username"]',
            'input[placeholder*="sername"]', 'input[placeholder*="dmission"]'
        ];

        // 2. Find Password Field
        const passwordSelectors = [
            'input[name="password"]', 'input[id="password"]',
            'input[type="password"]', 'input[placeholder*="assword"]'
        ];

        const findElement = (selectors) => {
            for (const selector of selectors) {
                try {
                    const el = document.querySelector(selector);
                    if (el && el.offsetParent !== null) return el;
                } catch (e) { }
            }
            return null;
        };

        const usernameField = findElement(usernameSelectors);
        const passwordField = findElement(passwordSelectors);

        if (usernameField && passwordField) {
            console.log('ABESConnect: Fields found.');

            // Fill credentials
            const simulateInput = (element, value) => {
                element.focus();
                element.value = value;
                element.dispatchEvent(new Event('input', { bubbles: true }));
                element.dispatchEvent(new Event('change', { bubbles: true }));
                element.blur();
            };

            simulateInput(usernameField, credentials.username);
            simulateInput(passwordField, credentials.password);

            // Submit logic
            isSubmitting = true;
            console.log(`ABESConnect: Submitting in ${AUTO_SUBMIT_DELAY_MS}ms...`);

            setTimeout(() => {
                console.log('ABESConnect: Triggering submit...');

                console.log('ABESConnect: Triggering submit...');

                // Method 1: Ask Background script to execute submitRequest() in MAIN world
                // This bypasses CSP specific to content scripts
                console.log('ABESConnect: Sending execution request to background...');
                chrome.runtime.sendMessage({ action: 'execute_login_fn' });

                // Method 2: Click the element with the href (Backup 1)
                // (Still likely to fail CSP if it's a javascript: link, but worth keeping as finding element check)
                const ssoLink = document.querySelector('a[href*="submitRequest"]');
                if (ssoLink) {
                    // console.log('ABESConnect: Clicking SSO Link...');
                    // ssoLink.click(); 
                }

                // Method 3: Click the inner div directly (Backup 2)
                const loginDiv = document.querySelector('#loginbutton');
                if (loginDiv) {
                    console.log('ABESConnect: Clicking login div...');
                    loginDiv.click();
                }

                // Start checking for success to close tab
                let closeCheckCount = 0;
                const closeCheckInterval = setInterval(() => {
                    if (checkSuccessAndClose() || closeCheckCount > 20) { // Check for 10 seconds
                        clearInterval(closeCheckInterval);
                    }
                    closeCheckCount++;
                }, 500);

            }, AUTO_SUBMIT_DELAY_MS);

        } else {
            // console.log('ABESConnect: Fields not found.');
        }
    }

    // Message listener
    chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
        if (request.action === 'manual_login') {
            console.log('ABESConnect: Manual login triggered.');
            if (isValidCredentials(request.credentials)) {
                credentials = request.credentials;
                warnedMissingCredentials = false;
                chrome.storage.local.set({ abesCredentials: credentials });
            }
            isSubmitting = false;
            attemptLogin();
            sendResponse({ status: 'Login started' });
        }
    });

    async function initialize() {
        await loadCredentials(true);

        const observer = new MutationObserver(() => {
            if (!isSubmitting) attemptLogin();
        });

        if (document.body) {
            observer.observe(document.body, { childList: true, subtree: true });
        } else {
            document.addEventListener('DOMContentLoaded', () => {
                if (document.body) {
                    observer.observe(document.body, { childList: true, subtree: true });
                }
            });
        }

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', attemptLogin);
        } else {
            attemptLogin();
        }

        let retries = 0;
        const retryInterval = setInterval(() => {
            if (isSubmitting || retries >= MAX_RETRIES) {
                clearInterval(retryInterval);
                return;
            }
            attemptLogin();
            retries++;
        }, RETRY_INTERVAL_MS);
    }

    initialize();

})();
