import express from "express";
import fetch from "node-fetch";
import bodyParser from "body-parser";
import cors from "cors";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());
app.use(cors());

// Base64 encoding/decoding
const toBase64 = (str) => Buffer.from(str, 'utf-8').toString('base64');
const fromBase64 = (str) => Buffer.from(str, 'base64').toString('utf-8');

// Get Judge0 language ID
function getJudge0LanguageId(language) {
    const map = {
        cpp: 54,
        python: 71,
        java: 62,
        javascript: 63
    };
    return map[language.toLowerCase()] || 54;
}

// Route: Clean and process code with Gemini
app.post("/process", async (req, res) => {
    const { sourceCode, language } = req.body;
    const apiKey = process.env.GEMINI_API_KEY;

    const prompt = `
Remove all comments from this code.  
You are a specialized code converter focused on making code run correctly on Judge0's online compiler. Your task is to convert code to be 100% compatible with Judge0's environment while preserving exact functionality.

LANGUAGE DETECTION
I want you to remove all the part from code which has never used in the code.

CRITICAL JUDGE0 COMPATIBILITY ISSUES TO FIX

Error: Judge0 error 400: {"error":"some attributes for this submission cannot be converted to UTF-8, use base64_encoded=true query parameter"}
This issue must not be there for code provided you take care of that

FOR C++:
- Replace non-standard headers:
  #include <bits/stdc++.h> → individual standard headers
  Include only what's needed: <iostream>, <vector>, <map>, etc.

- Fix template syntax for older C++ compilers:
  vector<vector<int>> → vector<vector<int> >

- Replace auto keywords:
  auto it = upper_bound(...) → vector<int>::iterator it = upper_bound(...)
  Replace ALL auto variables with explicit types

- Expand ALL macros:
  #define endl "\\n" → replace all endl with "\\n"

- Replace typedefs:
  typedef long long int ll; → use long long directly everywhere

- Fix endl usage:
  Replace all endl with "\\n"

- Fix int32_t main to just int main

- Remove debug code:
  Remove all debugging code like #ifndef ONLINE_JUDGE, etc.

- Replace #define int long long with actual long long usage

- Reduce any large array sizes (N > 1e5) if possible

FOR PYTHON:
- Ensure Python 3 compatibility
- Replace raw_input() with input()
- Remove numpy/pandas dependencies

FOR JAVA:
- Class name must be Main
- No package declarations
- Import only needed classes
- Close Scanner objects

FOR JAVASCRIPT:
- No fs or Node.js-specific modules
- Implement processData(input) style logic

Also make sure error like this does not come : "Error: Judge0 error 400: {"error":"some attributes for this submission cannot be converted to UTF-8, use base64_encoded=true query parameter"}"
As I will be sending the final code to Judge0 so it should be judge0 friendly.
Also you can go for converting it to simpler code keeping the logic exact same.

Now convert the following code to be 100% Judge0 compatible:

${sourceCode}
    `;

    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                    temperature: 0.2,
                    topK: 40,
                    topP: 0.95,
                    maxOutputTokens: 8192
                }
            })
        });

        const data = await response.json();
        let output = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";

        if (output.startsWith("```")) {
            output = output.replace(/^```[\w]*\n/, "").replace(/```$/, "");
        }

        res.json({ cleanCode: output });
    } catch (err) {
        console.error("Gemini error:", err);
        res.status(500).json({ error: "Gemini failed", details: err.message });
    }
});

// Route: Run code via Judge0
app.post("/run", async (req, res) => {
    const { code, input, language } = req.body;
    const languageId = getJudge0LanguageId(language);

    const submissionBody = {
        source_code: toBase64(code),
        stdin: toBase64(input),
        language_id: languageId
    };

    try {
        const response = await fetch("https://judge0-ce.p.rapidapi.com/submissions?base64_encoded=true&wait=true", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-RapidAPI-Host": "judge0-ce.p.rapidapi.com",
                "X-RapidAPI-Key": process.env.RAPIDAPI_KEY
            },
            body: JSON.stringify(submissionBody)
        });

        const result = await response.json();
        const output = result.stdout || result.stderr || result.compile_output || "";
        res.json({ output: fromBase64(output) });
    } catch (err) {
        console.error("Judge0 error:", err);
        res.status(500).json({ error: "Judge0 failed", details: err.message });
    }
});

app.listen(PORT, () => {
    console.log(`✅ Server running at http://localhost:${PORT}`);
});
