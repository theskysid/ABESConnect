// Runtime behavior configuration for ABESConnect
// Credentials are now stored via popup -> chrome.storage.local

const CONFIG = {
  AUTO_SUBMIT_DELAY_MS: 1000, // Delay before clicking submit (in milliseconds)
  MAX_RETRIES: 10,            // Number of times to check for the form
  RETRY_INTERVAL_MS: 500      // Time between checks (in milliseconds)
};
