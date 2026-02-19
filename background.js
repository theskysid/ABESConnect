// Background service worker for ABESConnect

const PORTAL_URL = 'https://192.168.1.254:8090/httpclient.html'; // Explicit full path
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

async function checkPortal() {
    try {
        console.log('Checking portal availability...');
        // Try to fetch the portal page
        // Timeout is important so we don't hang if offline
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);

        const response = await fetch(PORTAL_URL, { signal: controller.signal });
        clearTimeout(timeoutId);

        if (response.ok) {
            const text = await response.text();

            // Check if we are already logged in
            // Heuristic: If page contains "Logout", we are good.
            if (text.includes('Logout') || text.includes('logout')) {
                console.log('Portal reachable, but already logged in.');
                return;
            }

            // If we are NOT logged in, and the login page is reachable...
            console.log('Portal reachable and login needed.');

            // Check if a tab is already open to avoid spamming
            const tabs = await chrome.tabs.query({ url: '*://192.168.1.254/*' });
            if (tabs.length === 0) {
                console.log('Opening portal tab...');
                chrome.tabs.create({ url: PORTAL_URL });
            } else {
                console.log('Portal tab already open.');
            }
        }
    } catch (error) {
        // Fetch failed (offline, or not on ABES network)
        // console.log('Portal unreachable:', error.message);
    }
}

// Also check on startup
chrome.runtime.onStartup.addListener(checkPortal);

// Listener for messages from popup or content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'log') {
        console.log('ABESConnect Log:', request.message);
    } else if (request.action === 'close_tab') {
        if (sender.tab && sender.tab.id) {
            console.log('Closing tab:', sender.tab.id);
            chrome.tabs.remove(sender.tab.id);
        }
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
