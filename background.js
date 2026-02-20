// Background service worker for ABESConnect

const PORTAL_URLS = [
    'https://192.168.1.254:8090/httpclient.html',
    'http://192.168.1.254:8090/'
];
const PORTAL_URL = PORTAL_URLS[0]; // Default URL used for opening portal tab
const CHECK_ALARM_NAME = 'check_portal_connectivity';

chrome.runtime.onInstalled.addListener(() => {
    console.log('ABESConnect extension installed.');
    chrome.alarms.create(CHECK_ALARM_NAME, { periodInMinutes: 0.5 }); // Check every 30 seconds
});

chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === CHECK_ALARM_NAME) {
        checkPortal();
    }
});

// Trigger check immediately when computer comes online
self.addEventListener('online', () => {
    console.log('Network is online. Checking portal...');
    checkPortal();
});

// Also check on startup
chrome.runtime.onStartup.addListener(checkPortal);

function parsePortalState(text) {
    const bodyText = (text || '').toLowerCase();

    if (bodyText.includes('logout') || bodyText.includes('sign out') || bodyText.includes('logged in')) {
        return 'logged_in';
    }

    if (bodyText.includes('username') || bodyText.includes('password') || bodyText.includes('login')) {
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

async function checkPortal() {
    try {
        console.log('Checking portal availability...');
        const status = await getPortalStatus();

        if (!status.connected) {
            return;
        }

        if (status.state === 'logged_in') {
            console.log('Portal reachable, but already logged in.');
            return;
        }

        console.log('Portal reachable and login needed.');

        // Check if a tab is already open to avoid spamming
        const tabs = await chrome.tabs.query({ url: '*://192.168.1.254/*' });
        if (tabs.length === 0) {
            console.log('Opening portal tab...');
            chrome.tabs.create({ url: PORTAL_URL });
        } else {
            console.log('Portal tab already open.');
        }
    } catch (error) {
        // Fetch failed (offline, or not on ABES network)
        // console.log('Portal unreachable:', error.message);
    }
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
        if (sender.tab && sender.tab.id) {
            console.log('Executing login function in MAIN world for tab:', sender.tab.id);
            chrome.scripting.executeScript({
                target: { tabId: sender.tab.id },
                world: 'MAIN',
                func: () => {
                    console.log('ABESConnect (MAIN): Attempting to call submitRequest()...');
                    if (typeof window.submitRequest === 'function') {
                        window.submitRequest();
                    } else if (typeof submitRequest === 'function') {
                        submitRequest();
                    } else {
                        console.error('ABESConnect (MAIN): submitRequest function not found!');
                        // Fallback: try finding the form and submitting it
                        const forms = document.forms;
                        if (forms.length > 0) {
                            forms[0].submit();
                        }
                    }
                }
            });
        }
    }
});
