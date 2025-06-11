// === 1. Inject UI when on a Codeforces problem page ===
function injectSolverUI() {
    if (!window.location.href.includes('/problem/')) return;
    if (document.querySelector('.cf-test-case-solver')) return;

    // Add styles
    const styleElement = document.createElement('style');
    styleElement.textContent =  `
        .cf-test-case-solver {
            margin: 20px 0;
            padding: 15px;
            background-color: #f8f9fa;
            border: 1px solid #ddd;
            border-radius: 5px;
        }
        .solver-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 10px;
        }
        .solver-header h3 {
            margin: 0;
            color: #4a76a8;
        }
        #toggleSolver {
            background-color: #4a76a8;
            color: white;
            border: none;
            padding: 5px 10px;
            border-radius: 3px;
            cursor: pointer;
        }
        #toggleSolver:hover {
            background-color: #3d6293;
        }
        .solver-body {
            margin-top: 10px;
        }
        #customInput {
            width: 100%;
            min-height: 100px;
            margin-bottom: 10px;
            padding: 8px;
            border: 1px solid #ddd;
            border-radius: 3px;
            font-family: monospace;
            resize: vertical;
        }
        #runCustomTest {
            background-color: #5cb85c;
            color: white;
            border: none;
            padding: 8px 15px;
            border-radius: 3px;
            cursor: pointer;
        }
        #runCustomTest:hover {
            background-color: #4cae4c;
        }
        .solver-result {
            margin-top: 15px;
            padding: 10px;
            background-color: #fff;
            border: 1px solid #ddd;
            border-radius: 3px;
            font-family: monospace;
            white-space: pre-wrap;
            max-height: 300px;
            overflow-y: auto;
            display: none;
        }`
    ;
    document.head.appendChild(styleElement);

    // Create the UI
    const container = document.createElement('div');
    container.className = 'cf-test-case-solver';
    container.innerHTML = 
        `<div class="solver-header">
            <h3>Custom Test Case Solver</h3>
            <button id="toggleSolver">Show/Hide</button>
        </div>
        <div class="solver-body" style="display: none;">
            <textarea id="customInput" placeholder="Enter your test case here"></textarea>
            <button id="runCustomTest">Run Test</button>
            <div id="solverResult" class="solver-result"></div>
        </div>`
    ;

    const insertPoint = document.querySelector('.problem-statement');
    if (insertPoint) {
        insertPoint.parentElement.insertBefore(container, insertPoint.nextSibling);
    }

    document.getElementById('toggleSolver').addEventListener('click', () => {
        const body = document.querySelector('.solver-body');
        body.style.display = body.style.display === 'none' ? 'block' : 'none';
    });

    document.getElementById('runCustomTest').addEventListener('click', handleRunTest);
}

// === 2. Handle Run Button Click ===
async function handleRunTest() {
    const input = document.getElementById('customInput').value;
    const resultDiv = document.getElementById('solverResult');
    resultDiv.style.display = 'block';
    resultDiv.textContent = 'Running...';

    try {
        const problemInfo = getProblemInfo();
        const solution = await fetchAcceptedSolution(problemInfo);

        const cleanCode = await callServerForCleaning(solution.code, solution.language);
        const output = await callServerForExecution(cleanCode, input, solution.language);

        resultDiv.textContent = output;
    } catch (err) {
        console.error(err);
        resultDiv.textContent = 'Error: ' + err.message;
    }
}

// === 2a. Call server for cleaning
async function callServerForCleaning(code, lang) {
    const res = await fetch("http://localhost:3000/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceCode: code, language: lang })
    });
    const data = await res.json(); 
    // console.log('Cleaned Code : ',data.cleanCode);
    return data.cleanCode;
}

// === 2b. Call server for execution
async function callServerForExecution(code, input, lang) {
    const res = await fetch("http://localhost:3000/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, input, language: lang })
    });
    const data = await res.json();
    return data.output;
}

// === 3. Extract Problem Info ===
function getProblemInfo() {
    const path = window.location.pathname.split('/');
    let contestId = null, problemIndex = null;

    if (path.includes('contest') && path.includes('problem')) {
        contestId = path[path.indexOf('contest') + 1];
        problemIndex = path[path.indexOf('problem') + 1];
    } else if (path.includes('problemset') && path.includes('problem')) {
        contestId = path[path.indexOf('problem') + 1];
        problemIndex = path[path.indexOf('problem') + 2];
    }

    if (!contestId || !problemIndex) {
        throw new Error("Couldn't extract contestId or problemIndex from URL.");
    }

    return { contestId, problemIndex };
}

// === 4. Fetch Accepted Codeforces Solution ===
async function fetchAcceptedSolution({ contestId, problemIndex }) {
    const url = `https://codeforces.com/api/contest.status?contestId=${contestId}&from=1&count=1000`;

    const preferredLanguages = [
        { name: "C++", lang: "cpp" },
        { name: "Python", lang: "python" },
        { name: "Java", lang: "java" },
        { name: "C", lang: "c" },
        { name: "Kotlin", lang: "kotlin" },
        { name: "Go", lang: "go" }
    ];

    const res = await fetch(url);
    const data = await res.json();
    if (data.status !== "OK") {
        throw new Error("Failed to fetch submissions from Codeforces API.");
    }

    let accepted = null, usedLang = null;
    for (const { name, lang } of preferredLanguages) {
        accepted = data.result.find(sub =>
            sub.verdict === "OK" &&
            sub.problem.index === problemIndex &&
            sub.programmingLanguage.toLowerCase().includes(name.toLowerCase())
        );
        if (accepted) {
            usedLang = lang;
            break;
        }
    }

    if (!accepted) {
        throw new Error(`No accepted submission found for problem ${problemIndex} in contest ${contestId}.`);
    }

    const submissionId = accepted.id;
    const code = await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({
            type: "FETCH_SUBMISSION_CODE",
            contestId,
            submissionId
        }, (response) => {
            if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
            if (response && response.code) return resolve(response.code);
            return reject(new Error("No code received from background script."));
        });
    });

    return { language: usedLang, code };
}

// === 7. Initialize Extension ===
injectSolverUI();
