// Background service worker for ABESConnect

const PORTAL_URLS = [
    'http://192.168.1.254:8090/',
    'https://192.168.1.254:8090/httpclient.html'
];

chrome.runtime.onInstalled.addListener(() => {
    console.log('ABESConnect extension installed.');
});

function parsePortalState(text) {
    const bodyText = (text || '').toLowerCase();

    if (bodyText.includes('logout') || bodyText.includes('sign out') || bodyText.includes('logged in')) {
        return 'logged_in';
    }

    const hasCredentialsFieldsHint = bodyText.includes('username') && bodyText.includes('password');
    const hasPortalSubmitFn = bodyText.includes('submitrequest(');
    if (hasCredentialsFieldsHint || hasPortalSubmitFn) {
        return 'login_required';
    }

    return 'reachable';
}

async function fetchPortalStatusWithUrl(url) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);

    try {
        const response = await fetch(url, {
            signal: controller.signal,
            cache: 'no-store'
        });

        if (!response.ok) {
            return null;
        }

        const text = await response.text();
        const state = parsePortalState(text);

        if (state === 'logged_in') {
            return {
                connected: true,
                state,
                message: 'ABESEC connected (already logged in)',
                url
            };
        }

        if (state === 'login_required') {
            return {
                connected: true,
                state,
                message: 'ABESEC connected (login required)',
                url
            };
        }

        return {
            connected: true,
            state,
            message: 'ABESEC network reachable',
            url
        };
    } catch (error) {
        return null;
    } finally {
        clearTimeout(timeoutId);
    }
}

async function getPortalStatus() {
    for (const url of PORTAL_URLS) {
        const result = await fetchPortalStatusWithUrl(url);
        if (result) {
            return result;
        }
    }

    return {
        connected: false,
        state: 'unreachable',
        message: 'ABESEC network not detected'
    };
}

// Listener for messages from popup or content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'log') {
        console.log('ABESConnect Log:', request.message);
    } else if (request.action === 'close_tab') {
        if (sender.tab && sender.tab.id) {
            console.log('Closing tab:', sender.tab.id);
            chrome.tabs.remove(sender.tab.id);
        }
    } else if (request.action === 'check_portal_status') {
        getPortalStatus()
            .then((status) => sendResponse(status))
            .catch(() => sendResponse({
                connected: false,
                state: 'error',
                message: 'Unable to verify ABESEC network'
            }));
        return true;
    } else if (request.action === 'execute_login_fn') {
        if (!sender.tab || !sender.tab.id) {
            sendResponse({ ok: false, error: 'No sender tab available' });
            return;
        }

        console.log('Executing login function in MAIN world for tab:', sender.tab.id);
        chrome.scripting.executeScript({
            target: { tabId: sender.tab.id },
            world: 'MAIN',
            func: () => {
                try {
                    // Run in page context to avoid isolated-world CSP blocks on javascript: handlers.
                    if (typeof window.submitRequest === 'function') {
                        window.submitRequest();
                        return { ok: true, method: 'window.submitRequest()' };
                    }

                    if (typeof submitRequest === 'function') {
                        submitRequest();
                        return { ok: true, method: 'submitRequest()' };
                    }

                    const loginButton = document.querySelector('#loginbutton');
                    if (loginButton && typeof loginButton.click === 'function') {
                        loginButton.click();
                        return { ok: true, method: '#loginbutton.click()' };
                    }

                    const primaryForm = document.forms && document.forms[0];
                    if (primaryForm) {
                        if (typeof primaryForm.requestSubmit === 'function') {
                            primaryForm.requestSubmit();
                        } else {
                            primaryForm.submit();
                        }
                        return { ok: true, method: 'form.submit()' };
                    }

                    return { ok: false, error: 'No submit method found on page' };
                } catch (error) {
                    return {
                        ok: false,
                        error: error && error.message ? error.message : 'Unknown MAIN world error'
                    };
                }
            }
        })
            .then((results) => {
                const result = results && results[0] && results[0].result;
                sendResponse(result || { ok: false, error: 'No result from injected script' });
            })
            .catch((error) => {
                sendResponse({
                    ok: false,
                    error: error && error.message ? error.message : 'executeScript failed'
                });
            });
        return true;
    }
});
