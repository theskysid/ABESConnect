# ABESConnect Chrome Extension

Automatically logs you into the ABES Engineering College captive Wi-Fi portal.

## Features

- **Auto-Login:** Detects the login form and signs you in automatically.
- **Configurable:** Store credentials securely in a local config file.
- **Manual Trigger:** Use the popup button to force a login attempt if auto-detection fails.
- **Robust:** Handles slow page loads and dynamic content.

## Installation

1.  **Clone or Download** this repository.
2.  **Configure Credentials:**
    - Open `config.js` in a text editor.
    - Replace `USERNAME_PLACEHOLDER` with your username (e.g., Admission Number).
    - Replace `PASSWORD_PLACEHOLDER` with your wifi password.
    - Save the file.
3.  **Load in Chrome:**
    - Open Chrome and go to `chrome://extensions`.
    - Enable **Developer mode** (top right).
    - Click **Load unpacked**.
    - Select the `ABESConnect` folder.

## Usage

- Connect to the ABES Wi-Fi network.
- The captive portal page (`http://192.168.1.254:8090/`) should open.
- The extension will automatically fill in your credentials and click login.
- If it doesn't work automatically, click the extension icon and press **Login Now**.

## Troubleshooting

- **Login loop:** If the extension keeps trying to log in even when you are connected, check if the "Logout" button is visible on the page. The extension relies on detecting the login form vs. logout button.
- **Not working:** Ensure you have updated `config.js` with correct credentials.
- **Reload:** If you change code or config, go to `chrome://extensions` and click the refresh icon on the ABESConnect card.
