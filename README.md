# ABESConnect Chrome Extension

Automatically logs you into the ABES Engineering College captive Wi-Fi portal.

## Features

- **Auto-Login:** Detects the login form and signs you in automatically.
- **Configurable:** Save credentials securely from the extension popup.
- **Manual Trigger:** Use the popup button to force a login attempt if auto-detection fails.
- **Robust:** Handles slow page loads and dynamic content.

## Installation

1.  **Clone or Download** this repository.
2.  **Set Credentials:**
    - Click the extension icon after loading it.
    - Enter your username and password in the popup.
    - Click **Connect Highspeed** once to save credentials and trigger login.
3.  **Load in Chrome:**
    - Open Chrome and go to `chrome://extensions`.
    - Enable **Developer mode** (top right).
    - Click **Load unpacked**.
    - Select the `ABESConnect` folder.

## Usage

- Connect to the ABES Wi-Fi network.
- The captive portal page (`http://192.168.1.254:8090/`) should open.
- The extension will automatically fill in your credentials and click login.
- If it doesn't work automatically, click the extension icon and press **Connect Highspeed**.
- After first save, credentials stay stored. Use **Edit Credentials** only when you want to change them.

## Troubleshooting

- **Login loop:** If the extension keeps trying to log in even when you are connected, check if the "Logout" button is visible on the page. The extension relies on detecting the login form vs. logout button.
- **Not working:** Ensure you entered the correct credentials in the popup.
- **Reload:** If you change code or config, go to `chrome://extensions` and click the refresh icon on the ABESConnect card.
