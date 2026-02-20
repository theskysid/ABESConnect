// popup.js - Credential capture and manual connect trigger

const PORTAL_URLS = [
  'https://192.168.1.254:8090/httpclient.html',
  'http://192.168.1.254:8090/'
];

let storedCredentials = null;
let isEditMode = false;

function updateStatus(message, state = 'default') {
  const statusText = document.getElementById('status');
  const body = document.body;

  if (statusText) {
    statusText.textContent = message;
  }
  body.classList.remove('connecting', 'connected');

  if (state === 'connecting') {
    body.classList.add('connecting');
  } else if (state === 'connected') {
    body.classList.add('connected');
  }
}

function getStoredCredentials() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['abesCredentials'], (result) => {
      resolve(result.abesCredentials || null);
    });
  });
}

function saveCredentials(username, password) {
  return new Promise((resolve) => {
    chrome.storage.local.set({
      abesCredentials: {
        username,
        password
      }
    }, resolve);
  });
}

function isValidCredentials(creds) {
  return Boolean(
    creds &&
    typeof creds.username === 'string' &&
    creds.username.trim() &&
    typeof creds.password === 'string' &&
    creds.password
  );
}

function maskUsername(username) {
  if (!username) return '';
  if (username.length <= 4) return `${username[0]}***`;
  return `${username.slice(0, 2)}${'*'.repeat(username.length - 4)}${username.slice(-2)}`;
}

function setBusy(isBusy) {
  const connectBtn = document.getElementById('connectBtn');
  const editBtn = document.getElementById('editBtn');
  connectBtn.disabled = isBusy;
  connectBtn.style.opacity = isBusy ? '0.8' : '1';
  editBtn.disabled = isBusy;
  editBtn.style.opacity = isBusy ? '0.6' : '1';
}

function setConnectLabel(text) {
  document.getElementById('connectLabel').textContent = text;
}

function applyViewState() {
  const hasSavedCredentials = isValidCredentials(storedCredentials);
  const credentialsForm = document.getElementById('credentialsForm');
  const savedInfo = document.getElementById('savedInfo');
  const editBtn = document.getElementById('editBtn');

  if (!hasSavedCredentials) {
    isEditMode = true;
    credentialsForm.classList.remove('hidden');
    savedInfo.classList.add('hidden');
    editBtn.classList.add('hidden');
    setConnectLabel('Save & Connect');
    return;
  }

  if (isEditMode) {
    credentialsForm.classList.remove('hidden');
    savedInfo.classList.add('hidden');
    editBtn.classList.remove('hidden');
    editBtn.textContent = 'Cancel Edit';
    setConnectLabel('Save & Connect');
    return;
  }

  credentialsForm.classList.add('hidden');
  savedInfo.classList.remove('hidden');
  savedInfo.textContent = `Credentials saved for ${maskUsername(storedCredentials.username)}.`;
  editBtn.classList.remove('hidden');
  editBtn.textContent = 'Edit Credentials';
  setConnectLabel('Connect Highspeed');
}

async function triggerConnect(username, password) {
  // Check if portal tab is already open
  const tabs = await chrome.tabs.query({ url: '*://192.168.1.254/*' });

  if (tabs.length > 0) {
    // Tab exists: highlight it and trigger login
    const tab = tabs[0];
    updateStatus('Portal found. Logging in...', 'connecting');

    await chrome.tabs.update(tab.id, { active: true });
    await chrome.windows.update(tab.windowId, { focused: true });

    chrome.tabs.sendMessage(
      tab.id,
      { action: 'manual_login', credentials: { username, password } },
      () => {
        if (chrome.runtime.lastError) {
          chrome.tabs.reload(tab.id);
        }
      }
    );
    return;
  }

  // Tab not found: open new one
  updateStatus('Opening portal...', 'connecting');
  await chrome.tabs.create({ url: PORTAL_URLS[0] });
}

document.addEventListener('DOMContentLoaded', () => {
  const usernameInput = document.getElementById('username');
  const passwordInput = document.getElementById('password');
  const connectBtn = document.getElementById('connectBtn');
  const editBtn = document.getElementById('editBtn');

  getStoredCredentials().then((creds) => {
    if (isValidCredentials(creds)) {
      storedCredentials = creds;
      usernameInput.value = creds.username;
      passwordInput.value = creds.password;
      isEditMode = false;
    } else {
      storedCredentials = null;
      isEditMode = true;
    }

    applyViewState();
  });

  editBtn.addEventListener('click', () => {
    if (!isValidCredentials(storedCredentials)) return;

    isEditMode = !isEditMode;
    if (isEditMode) {
      usernameInput.value = storedCredentials.username;
      passwordInput.value = storedCredentials.password;
    }
    applyViewState();
  });

  connectBtn.addEventListener('click', async () => {
    setBusy(true);
    setConnectLabel('Connecting...');
    updateStatus('Searching for network...', 'connecting');

    try {
      if (!isValidCredentials(storedCredentials) || isEditMode) {
        const username = usernameInput.value.trim();
        const password = passwordInput.value;

        if (!username || !password) {
          updateStatus('Enter both username and password');
          setBusy(false);
          applyViewState();
          return;
        }

        updateStatus('Saving credentials...', 'connecting');
        await saveCredentials(username, password);
        storedCredentials = { username, password };
        isEditMode = false;
      }

      await triggerConnect(storedCredentials.username, storedCredentials.password);

      setTimeout(() => {
        updateStatus('Action initiated', 'connected');
        setTimeout(() => window.close(), 800);
      }, 500);
    } catch (error) {
      updateStatus('Error: ' + error.message);
      setBusy(false);
      applyViewState();
    }
  });
});
