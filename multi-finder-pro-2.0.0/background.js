// Initial Context Menu
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: "mfp-add",
      title: "Add to Finder",
      contexts: ["selection"],
    });
  });
});

// Context Menu Action
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info && info.menuItemId === "mfp-add" && tab && tab.id) {
    chrome.tabs.sendMessage(
      tab.id,
      { action: "addWordFromContext", word: info.selectionText },
      (response) => {
        if (chrome.runtime.lastError) {
          chrome.scripting
            .executeScript({
              target: { tabId: tab.id },
              files: ["content.js"],
            })
            .then(() => {
              chrome.tabs.sendMessage(tab.id, {
                action: "addWordFromContext",
                word: info.selectionText,
              });
            })
            .catch((e) => {
              /* Injection failed: e */
            });
        }
      },
    );
  }
});

// Command Toggle
if (chrome.commands) {
  chrome.commands.onCommand.addListener((cmd) => {
    if (cmd === "toggle-finder") {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs && tabs[0] && tabs[0].id) {
          const tabId = tabs[0].id;
          const url = tabs[0].url || "";
          if (url.startsWith("http")) {
            chrome.tabs.sendMessage(
              tabId,
              { action: "toggleFloatingWindow" },
              (response) => {
                if (chrome.runtime.lastError) {
                  chrome.scripting
                    .executeScript({
                      target: { tabId: tabId },
                      files: ["content.js"],
                    })
                    .then(() => {
                      chrome.tabs.sendMessage(tabId, {
                        action: "toggleFloatingWindow",
                      });
                    })
                    .catch((e) => {
                      /* Manual trigger failed */
                    });
                }
              },
            );
          }
        }
      });
    }
  });
}

// Quiet re-highlight on load
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (
    changeInfo &&
    changeInfo.status === "complete" &&
    tab &&
    tab.url &&
    tab.url.startsWith("http")
  ) {
    chrome.tabs.sendMessage(tabId, { action: "highlightReset" }, () => {
      if (chrome.runtime.lastError) {
        /* ignore quiet errors */
      }
    });
  }
});
