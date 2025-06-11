export async function preprocessCodeWithGemini(code) {
    const prompt = `
You are a code simplifier. Your job is to clean up C++ code for execution in an online judge like Judge0. 
Please:
- Remove all unnecessary templates/macros/typedefs.
- Replace fast I/O with cin/cout.
- Ensure the code is self-contained and runnable.
    
Here is the code to clean:
\`\`\`cpp
${code}
\`\`\`
`;

    const response = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=YOUR_GEMINI_API_KEY", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            contents: [{
                parts: [{ text: prompt }],
                role: "user"
            }]
        })
    });

    const result = await response.json();

    // Extract and return cleaned code
    const outputText = result.candidates?.[0]?.content?.parts?.[0]?.text ?? "// Gemini error";
    return outputText;
}
