// popup.js - Single Button Logic with Visual Feedback

const PORTAL_URLs = [
    'https://192.168.1.254:8090/httpclient.html',
    'http://192.168.1.254:8090/'
];

function updateStatus(message, state = 'default') {
    const statusText = document.getElementById('status');
    const body = document.body;

    statusText.textContent = message;

    // Reset classes
    body.classList.remove('connecting', 'connected');

    if (state === 'connecting') {
        body.classList.add('connecting');
    } else if (state === 'connected') {
        body.classList.add('connected');
    }
}

document.getElementById('connectBtn').addEventListener('click', async () => {
    const btn = document.getElementById('connectBtn');
    const originalText = btn.innerHTML;

    // UI Loading State
    btn.innerHTML = '<span>Connecting...</span>';
    btn.style.opacity = '0.8';
    updateStatus('Searching for network...', 'connecting');

    try {
        // Check if portal tab is already open
        const tabs = await chrome.tabs.query({ url: '*://192.168.1.254/*' });

        if (tabs.length > 0) {
            // Tab exists: Highlight it and trigger login
            const tab = tabs[0];
            updateStatus('Portal found. Logging in...', 'connecting');

            await chrome.tabs.update(tab.id, { active: true });
            await chrome.windows.update(tab.windowId, { focused: true });

            // Send manual trigger
            chrome.tabs.sendMessage(tab.id, { action: 'manual_login' }, () => {
                if (chrome.runtime.lastError) {
                    // If script not ready, reload to trigger auto-run
                    chrome.tabs.reload(tab.id);
                }
            });

        } else {
            // Tab not found: Open new one
            updateStatus('Opening portal...', 'connecting');
            await chrome.tabs.create({ url: PORTAL_URLs[0] });
        }

        // Success State interaction
        setTimeout(() => {
            updateStatus('Action initiated', 'connected');
            setTimeout(() => window.close(), 800);
        }, 500);

    } catch (error) {
        updateStatus('Error: ' + error.message);
        btn.innerHTML = originalText;
        btn.style.opacity = '1';
    }
});
