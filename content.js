// Content script for ABESConnect
// Runs on http://192.168.1.254:8090/* and https://192.168.1.254:8090/*
// VibeCoded by Siddhant

(function () {
    'use strict';

    console.log('ABESConnect: Content script loaded (v3.0 - CSP Bypass via Background).');

    const { AUTO_SUBMIT_DELAY_MS, MAX_RETRIES, RETRY_INTERVAL_MS } = CONFIG;

    let isSubmitting = false;
    let credentials = null;
    let warnedMissingCredentials = false;
    let closeCheckInterval = null;

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
        if (!document.body) return false;

        const bodyText = document.body.innerText.toLowerCase();
        // Check for common indicators of being logged in
        if (bodyText.includes('logout') || bodyText.includes('sign out') || bodyText.includes('logged in')) {
            console.log('ABESConnect: Login successful. Closing tab...');
            chrome.runtime.sendMessage({ action: 'close_tab' });
            return true;
        }
        return false;
    }

    function requestMainWorldSubmit() {
        return new Promise((resolve) => {
            chrome.runtime.sendMessage({ action: 'execute_login_fn' }, (response) => {
                if (chrome.runtime.lastError) {
                    resolve({
                        ok: false,
                        error: chrome.runtime.lastError.message
                    });
                    return;
                }
                resolve(response || { ok: false, error: 'Empty response from background' });
            });
        });
    }

    function startCloseCheckLoop() {
        let closeCheckCount = 0;
        if (closeCheckInterval) clearInterval(closeCheckInterval);

        closeCheckInterval = setInterval(() => {
            if (checkSuccessAndClose()) {
                clearInterval(closeCheckInterval);
                closeCheckInterval = null;
                return;
            }

            if (closeCheckCount > 20) { // ~10 seconds at 500ms interval
                clearInterval(closeCheckInterval);
                closeCheckInterval = null;
                isSubmitting = false;
                console.log('ABESConnect: Submit attempt timed out; retrying...');
                return;
            }

            closeCheckCount++;
        }, 500);
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

            setTimeout(async () => {
                console.log('ABESConnect: Triggering submit...');

                // Method 1: Ask Background script to execute submitRequest() in MAIN world
                // This bypasses CSP specific to content scripts
                console.log('ABESConnect: Sending execution request to background...');
                const submitResult = await requestMainWorldSubmit();
                if (!submitResult.ok) {
                    console.warn('ABESConnect: MAIN world submit failed:', submitResult.error);
                    isSubmitting = false;
                    return;
                }
                console.log(`ABESConnect: Submit triggered via ${submitResult.method || 'MAIN world'}.`);
                startCloseCheckLoop();

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
