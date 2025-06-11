chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === "FETCH_SUBMISSION_CODE") {
        const url = `https://codeforces.com/contest/${request.contestId}/submission/${request.submissionId}`;

        chrome.tabs.create({ url, active: false }, (tab) => {
            const tabId = tab.id;

            const tabUpdateListener = (updatedTabId, changeInfo) => {
                if (updatedTabId === tabId && changeInfo.status === "complete") {
                    chrome.scripting.executeScript({
                        target: { tabId },
                        files: ["content_script_fetch_code.js"]
                    }, () => {
                        // Listen for response from content_script_fetch_code.js
                        const responseHandler = (message) => {
                            if (message.type === "SUBMISSION_CODE_RESPONSE") {
                                chrome.runtime.onMessage.removeListener(responseHandler);
                                sendResponse({ code: message.code });
                                chrome.tabs.remove(tabId); // cleanup
                            }
                        };

                        chrome.runtime.onMessage.addListener(responseHandler);
                        chrome.tabs.sendMessage(tabId, { type: "EXTRACT_CODE" });
                    });

                    chrome.tabs.onUpdated.removeListener(tabUpdateListener);
                }
            };

            chrome.tabs.onUpdated.addListener(tabUpdateListener);
        });

        return true; // async response
    }
});
