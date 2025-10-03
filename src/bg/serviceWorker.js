/**
 * Background service worker
 * Handles extension lifecycle and message routing
 */

// Listen for extension installation
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('Job Autofill Extension installed');
  } else if (details.reason === 'update') {
    console.log('Job Autofill Extension updated');
  }
});

// Keep service worker alive
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Handle any background messages here if needed
  return false; // Not async
});
