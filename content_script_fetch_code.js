chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === "EXTRACT_CODE") {
        const interval = setInterval(() => {
            const codeElement = document.getElementById("program-source-text");

            if (codeElement) {
                clearInterval(interval);
                chrome.runtime.sendMessage({
                    type: "SUBMISSION_CODE_RESPONSE",
                    code: codeElement.innerText
                });
            }
        }, 100);

        setTimeout(() => {
            clearInterval(interval);
            chrome.runtime.sendMessage({
                type: "SUBMISSION_CODE_RESPONSE",
                code: "// Error: Timed out waiting for code block"
            });
        }, 1000000);

        return true;
    }
});
