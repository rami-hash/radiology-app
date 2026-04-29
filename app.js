// =======================
// CASES — loaded from SharePoint at runtime
// =======================

const CASES_URL = "https://defaultc49fb86316014b5bb7fa930a71704c.39.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/2e49d8eaeb7743d196df2e6d5a03505d/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=6-8RZ3mHEYkyLDOYLPDCmCJ-WMvO97oOBvpUE66YPdE";

// ⬇️ Change this to your access code
const ACCESS_CODE = "RADIOLOGY2024";

let cases = [];  // populated by loadCasesFromSharePoint()

// Fetch cases and questions from SharePoint via Power Automate
function loadCasesFromSharePoint() {
  const loading = document.getElementById("loadingScreen");
  const welcome = document.getElementById("welcome");
  if (loading) loading.classList.add("active");
  if (welcome) welcome.classList.remove("active");

  fetch(CASES_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "getCases" })
  })
  .then(res => {
    if (!res.ok) throw new Error("HTTP " + res.status);
    return res.json();
  })
  .then(data => {
    console.log("Cases flow response:", JSON.stringify(data).slice(0, 500));
    const rawCases     = data.cases     || [];
    const rawQuestions = data.questions || [];

    // Sort by CaseOrder
    rawCases.sort((a, b) => (a.CaseOrder || 0) - (b.CaseOrder || 0));

    // Log first question to see field names
    if (rawQuestions.length > 0) {
      console.log("First question fields:", Object.keys(rawQuestions[0]));
      console.log("First question sample:", JSON.stringify(rawQuestions[0]).slice(0, 300));
    }

    // Build structured cases array
    cases = rawCases.map(c => {
      const caseId = c.ID || c.id;
      const qs = rawQuestions
        .filter(q => {
          // SharePoint returns generic field names — field_1 = CaseID
          const qCaseId = q.CaseID || q.field_1 || 0;
          return Number(qCaseId) === Number(caseId);
        })
        .sort((a, b) => {
          // field_2 = QuestionOrder
          const aOrder = a.QuestionOrder || a.field_2 || 0;
          const bOrder = b.QuestionOrder || b.field_2 || 0;
          return aOrder - bOrder;
        })
        .map(q => ({
          text:          q.Title        || "",
          content:       q.Content      || q.content      || q.field_13 || "",
          questionType:  q.QuestionType || q.questionType || q.field_11 || "mc",
          suggestions:   q.Suggestions  || q.suggestions  || q.field_12 || "",
          fieldLabels:   q.FieldLabels  || q.fieldLabels  || q.field_14 || "",
          imageType:     (q.ImageType   || q.field_3 || "none").toLowerCase(),
          imageUrl:      q.ImageUrl     || q.field_4 || null,
          options: (() => {
            const codes = ["A","B","C","D","E","F","G","H"];
            const fields = [5,6,7,8,9,10,11,12];
            return codes.map((code, i) => ({
              code,
              label: q["Option" + code] || q["field_" + fields[i]] || ""
            })).filter(o => o.label !== "");
          })(),
          correctAnswer: q.CorrectAnswer || q.field_9  || "A",
          explanation:   q.Explanation  || q.field_10 || ""
        }));

      console.log("Case", caseId, "matched", qs.length, "questions");
      return {
        intro:     c.Title   || c.title   || "",
        content:   c.Content || c.content || "",
        questions: qs
      };
    });

    if (cases.length === 0) {
      alert("No cases found in SharePoint. Please check your lists.");
      return;
    }

    // Hide loading, show welcome
    if (loading) { loading.classList.remove("active"); }
    if (welcome) welcome.classList.add("active");
  })
  .catch(err => {
    console.error("Failed to load cases:", err);
    if (loading) loading.classList.remove("active");
    if (welcome) welcome.classList.add("active");
    const el = document.getElementById("loadingError");
    if (el) el.style.display = "block";
    // Mark that cases failed so Start button shows proper message
    window.caseLoadFailed = true;
  });
}

// Load cases as soon as page is ready
// =======================
// POWER AUTOMATE
// =======================

const FLOW_URL = "https://defaultc49fb86316014b5bb7fa930a71704c.39.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/d50cd79685cc4bc3a7452afdc487e9ae/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=sVNU58FUOCBk2BOTCX8J3VLK5CSkQQyTv1RlX_klbVg";
const FLOW_POST_URL = FLOW_URL;
const FLOW_GET_URL  = FLOW_URL;

document.addEventListener("DOMContentLoaded", () => {
  // Set timer display to 45:00 without starting it
  const display = document.getElementById("courseTimeDisplay");
  if (display) display.innerText = "45:00";
  loadCasesFromSharePoint();
});

// =======================
// VARIABLES GLOBALES
// =======================

let score = 0;
let playerName = "";
let playerEmail = "";

let currentCaseIndex = 0;
let currentQuestionIndex = 0;

// Calculate total questions across all cases for scoring
function totalQuestions() {
  return cases.reduce((sum, c) => sum + c.questions.length, 0);
}

// Tiempo TOTAL del curso (45 min)
let courseTimeLeft = 45 * 60;
let courseTimer = null;

// Tiempo POR CASO (not used but kept for compatibility)
let timeLeft = 90;
let timerInterval = null;


// =======================
// NAVEGACIÓN Y CASOS
// =======================

function showScreen(screenId) {
  document.querySelectorAll(".screen").forEach(screen => {
    screen.classList.remove("active");
  });
  document.getElementById(screenId).classList.add("active");
  updateTopBar();
}

function updateProgress() {
  // Count completed cases (not questions) for progress bar
  const total = cases.length;
  const completed = currentCaseIndex;
  const pct = (completed / total) * 100;
  document.getElementById("progressFill").style.width = pct + "%";
  document.getElementById("progressLabel").innerText = completed + " / " + total + " cases completed";
}

function loadCaseIntro() {
  const c = cases[currentCaseIndex];
  document.getElementById("caseNumber").innerText = "Case " + (currentCaseIndex + 1) + " of " + cases.length;
  document.getElementById("caseIntroText").innerText = c.intro;

  // Show optional case content
  const caseContentEl = document.getElementById("caseContent");
  if (caseContentEl) {
    if (c.content && c.content.trim()) {
      caseContentEl.innerText = c.content.trim();
      caseContentEl.style.display = "block";
    } else {
      caseContentEl.style.display = "none";
    }
  }
}

function loadQuestion() {
  const c = cases[currentCaseIndex];
  const q = c.questions[currentQuestionIndex];

  document.getElementById("questionNumber").innerText =
    "Case " + (currentCaseIndex + 1) + " / " + cases.length +
    "  ·  Question " + (currentQuestionIndex + 1) + " / " + c.questions.length;

  document.getElementById("questionCaseText").innerText = q.text;
  window.mcSelectedCorrect = 0; // reset per-question tracking

  // Show optional question content inside clinical note box
  const contentEl = document.getElementById("questionContent");
  if (q.content && q.content.trim()) {
    contentEl.innerText = q.content.trim();
    contentEl.style.display = "block";
  } else {
    contentEl.style.display = "none";
  }

  const dicomSection = document.getElementById("dicomSection");
  const imageSection = document.getElementById("imageSection");

  // Hide both first
  dicomSection.style.display = "none";
  imageSection.style.display = "none";

  if (q.imageType === "dicom" && q.imageUrl) {
    // DICOM interactive viewer
    dicomSection.style.display = "block";
    const oldFrame = document.getElementById("dicomFrame");
    if (oldFrame) oldFrame.remove();
    const newFrame = document.createElement("iframe");
    newFrame.id = "dicomFrame";
    newFrame.allowFullscreen = true;
    newFrame.onload = () => {
      try {
        const iframeDoc = newFrame.contentDocument || newFrame.contentWindow.document;
        const style = iframeDoc.createElement("style");
        style.textContent = ".sidebar, .table-of-contents, nav, #sidebar, [class*='sidebar'], [class*='contents'], [class*='navigation'] { display: none !important; } .main-content, .content, [class*='content'] { margin-left: 0 !important; width: 100% !important; }";
        iframeDoc.head.appendChild(style);
      } catch(e) {}
    };
    newFrame.src = q.imageUrl;
    dicomSection.appendChild(newFrame);

  } else if (q.imageType === "image" && q.imageUrl) {
    // Static radiology image
    imageSection.style.display = "block";
    document.getElementById("caseImage").src = q.imageUrl;

  }
  // imageType === "none" → both stay hidden, question is text-only

  const freetextContainer = document.getElementById("freetextContainer");
  const optionsContainer  = document.getElementById("optionsContainer");
  const questionType = (q.questionType || "mc").toLowerCase();
  const isFreetext = questionType === "freetext" || questionType === "free";

  if (isFreetext) {
    // Show freetext, hide buttons
    freetextContainer.style.display = "block";
    optionsContainer.style.display  = "none";
    if (document.getElementById("multiHint"))   document.getElementById("multiHint").style.display = "none";
    if (document.getElementById("submitMcBtn")) document.getElementById("submitMcBtn").style.display = "none";

    const submitBtn = document.getElementById("freetextSubmit");
    const hint      = document.getElementById("freetextHint");
    if (submitBtn) { submitBtn.disabled = false; submitBtn.style.display = "block"; }
    if (hint)      { hint.innerText = "Press Tab or → to accept a suggestion"; }

    // Build suggestion list from Suggestions column or options
    let suggestionList = q.options.map(o => o.label);
    if (q.suggestions && q.suggestions.trim()) {
      suggestionList = q.suggestions.split(",").map(s => s.trim()).filter(s => s);
    }
    window.currentOptions = suggestionList.map((l, i) => ({ code: String.fromCharCode(65+i), label: l }));

    // Build correct answers list (resolve letter codes to labels)
    const correctAnswers = q.correctAnswer.split(",").map(a => {
      const trimmed = a.trim();
      const opt = q.options.find(o => o.code.toUpperCase() === trimmed.toUpperCase());
      return opt ? opt.label : trimmed;
    });

    window.freetextCorrectAnswers = correctAnswers;
    window.selectedAutocomplete = null;
    fieldSuggestions = {};

    // Build one input per correct answer
    buildFreetextFields(correctAnswers.length, suggestionList);

  } else {
    // Show buttons, hide freetext
    freetextContainer.style.display = "none";
    document.getElementById("freetextSubmit") && (document.getElementById("freetextSubmit").style.display = "none");
    optionsContainer.style.display  = "grid";
    optionsContainer.innerHTML = "";

    const correctAnswers = q.correctAnswer.split(",").map(a => a.trim().toUpperCase());
    const isMulti = correctAnswers.length > 1;

    // Show/hide multi-select hint and submit button
    const multiHint    = document.getElementById("multiHint");
    const submitMcBtn  = document.getElementById("submitMcBtn");
    if (multiHint)   multiHint.style.display   = isMulti ? "block" : "none";
    if (submitMcBtn) submitMcBtn.style.display  = isMulti ? "block" : "none";
    if (submitMcBtn) submitMcBtn.disabled = false;

    // Track selected options for multi-select
    window.selectedCodes = [];

    q.options.forEach(opt => {
      const btn = document.createElement("button");
      btn.className = "answer-btn";
      btn.dataset.code = opt.code;
      btn.innerHTML = "<strong>" + opt.code + "</strong> — " + opt.label;

      if (isMulti) {
        // Multi-select: toggle selection
        btn.onclick = () => {
          if (btn.disabled) return;
          const idx = window.selectedCodes.indexOf(opt.code);
          if (idx > -1) {
            window.selectedCodes.splice(idx, 1);
            btn.classList.remove("selected");
          } else {
            window.selectedCodes.push(opt.code);
            btn.classList.add("selected");
          }
        };
      } else {
        // Single select: answer immediately
        btn.onclick = () => answerQuestion(opt.code);
      }
      optionsContainer.appendChild(btn);
    });
  }
}

// Called by the Start button in the welcome screen
function startCourse() {
  const nameInput = document.getElementById("nameInput").value.trim();
  const emailInput = document.getElementById("emailInput").value.trim();

  const codeInput = document.getElementById("accessCode")
    ? document.getElementById("accessCode").value.trim().toUpperCase()
    : ACCESS_CODE;

  let valid = true;

  if (!nameInput) {
    document.getElementById("nameError").style.display = "block";
    valid = false;
  } else {
    document.getElementById("nameError").style.display = "none";
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailInput || !emailRegex.test(emailInput)) {
    document.getElementById("emailError").style.display = "block";
    valid = false;
  } else {
    document.getElementById("emailError").style.display = "none";
  }

  if (codeInput !== ACCESS_CODE) {
    document.getElementById("codeError").style.display = "block";
    valid = false;
  } else {
    document.getElementById("codeError").style.display = "none";
  }

  if (!valid) return;

  playerName = nameInput;
  playerEmail = emailInput;

  if (cases.length === 0) {
    if (window.caseLoadFailed) {
      alert("Could not load cases from SharePoint. Please check your Power Automate flow and refresh the page.");
    } else {
      alert("Cases are still loading. Please wait a moment and try again.");
    }
    return;
  }

  currentCaseIndex = 0;
  currentQuestionIndex = 0;
  score = 0;

  startCourseTimer();
  updateProgress();
  loadCaseIntro();
  showScreen("caseIntro");
}

function goToQuestion() {
  currentQuestionIndex = 0;
  showScreen("question");
  loadQuestion();
  startCaseTimer();
}

function nextCase() {
  currentCaseIndex++;
  currentQuestionIndex = 0;
  updateProgress();

  if (currentCaseIndex < cases.length) {
    loadCaseIntro();
    showScreen("caseIntro");
  } else {
    goToResults();
  }
}

function goToResults() {
  clearInterval(timerInterval);
  clearInterval(courseTimer);

  // Calculate and store final score before sending
  const totalQ = totalQuestions();
  window.finalScoreOutOf10 = totalQ > 0
    ? Math.round((score / (totalQ * 10)) * 100) / 10
    : 0;

  sendResultToSharePoint();

  const maxScore = totalQ * 10;
  const finalScore = window.finalScoreOutOf10 || Math.round((score / maxScore) * 100) / 10;
  const pct = Math.round((score / maxScore) * 100);

  let message = "";
  if (pct >= 80) message = "Excellent performance! You're well prepared.";
  else if (pct >= 60) message = "Good effort! Review the cases you missed.";
  else message = "Keep practising — radiology takes time to master.";

  document.getElementById("finalScore").innerText = finalScore + " / 10";
  document.getElementById("finalName").innerText = playerName;
  document.getElementById("resultMessage").innerText = message;
  showScreen("results");
}

function goToLeaderboard() {
  showScreen("leaderboard");

  const el = document.getElementById("leaderboardMsg");
  el.innerHTML = "<p style='color:var(--muted);font-size:14px;text-align:center;padding:20px'>Loading scores\u2026</p>";

  fetch(FLOW_GET_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "getLeaderboard" })
  })
  .then(res => {
    if (!res.ok) throw new Error("HTTP " + res.status);
    return res.json();
  })
  .then(data => {
    // SharePoint Get items returns { value: [...] }
    // Each item has Title (name), Email, Score fields
    console.log("Leaderboard raw:", JSON.stringify(data).slice(0, 800));
    const raw = Array.isArray(data) ? data : (data.value || []);

    const rows = raw.map(item => ({
      name:  item.Name || item.name || item.Title || "—",
      email: item.Email || item.email || "",
      score: item.Score !== undefined ? Number(item.Score) : (item.score !== undefined ? Number(item.score) : 0)
    }));

    if (rows.length === 0) {
      el.innerHTML = "<p style='color:var(--muted);font-size:14px;text-align:center;padding:40px'>No scores yet. Be the first to finish!</p>";
      return;
    }

    rows.sort((a, b) => b.score - a.score);

    let html = "<table style='width:100%;border-collapse:collapse;font-size:14px;'>";
    html += "<thead><tr style='border-bottom:2px solid var(--border);'>"
          + "<th style='text-align:left;padding:10px 8px;color:var(--muted);font-weight:600'>#</th>"
          + "<th style='text-align:left;padding:10px 8px;color:var(--muted);font-weight:600'>Name</th>"
          + "<th style='text-align:right;padding:10px 8px;color:var(--muted);font-weight:600'>Score</th>"
          + "</tr></thead><tbody>";

    rows.forEach((row, i) => {
      const medal     = i === 0 ? "\uD83E\uDD47" : i === 1 ? "\uD83E\uDD48" : i === 2 ? "\uD83E\uDD49" : (i + 1) + ".";
      const isMe      = row.name === playerName;
      const highlight = isMe ? "background:rgba(92,45,126,0.07);font-weight:600;" : "";
      html += "<tr style='border-bottom:1px solid var(--border);" + highlight + "'>"
            + "<td style='padding:12px 8px'>" + medal + "</td>"
            + "<td style='padding:12px 8px'>" + row.name + (isMe ? " <span style='color:var(--accent);font-size:11px'>(you)</span>" : "") + "</td>"
            + "<td style='padding:12px 8px;text-align:right;font-family:JetBrains Mono,monospace;color:var(--accent)'>" + (Math.round(row.score * 10) / 10) + " / 10</td>"
            + "</tr>";
    });

    html += "</tbody></table>";
    el.innerHTML = html;
  })
  .catch(err => {
    console.warn("Leaderboard error:", err);
    el.innerHTML = "<p style='color:var(--muted);font-size:14px;text-align:center;padding:40px'>Could not load leaderboard.<br>Your score has been saved successfully.</p>";
  });
}

// =======================
// TOP BAR & EXIT
// =======================

function updateTopBar() {
  const center  = document.getElementById("topBarCenter");
  const crumb   = document.getElementById("topBarCrumb");
  const exitBtn = document.getElementById("exitBtn");
  if (!center || !exitBtn || !crumb) return;

  const activeScreen = document.querySelector(".screen.active");
  const screenId = activeScreen ? activeScreen.id : "";

  if (["question","caseIntro","feedback"].includes(screenId)) {
    center.style.display = "flex";
    exitBtn.style.display = "inline-flex";
    crumb.innerHTML =
      '<span class="crumb-case">Case ' + (currentCaseIndex + 1) + ' of ' + cases.length + '</span>' +
      '<span class="crumb-sep">·</span>' +
      '<span>Question ' + (currentQuestionIndex + 1) + ' / ' + cases[currentCaseIndex].questions.length + '</span>';
  } else {
    center.style.display = "none";
    exitBtn.style.display = "none";
  }
}

function confirmExit() {
  if (confirm("Are you sure you want to exit? Your progress will be lost.")) {
    location.reload();
  }
}

// =======================
// TEMPORIZADOR CURSO
// =======================

function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return minutes + ":" + (remainingSeconds < 10 ? "0" : "") + remainingSeconds;
}

function startCourseTimer() {
  // Reset time every time a new course starts
  courseTimeLeft = 45 * 60;
  courseTimer = null;

  const display = document.getElementById("courseTimeDisplay");
  if (display) display.innerText = formatTime(courseTimeLeft);

  courseTimer = setInterval(() => {
    courseTimeLeft--;
    if (display) display.innerText = formatTime(courseTimeLeft);
    if (courseTimeLeft <= 0) {
      clearInterval(courseTimer);
      goToResults();
    }
  }, 1000);
}

function startCaseTimer() {
  // Per-case timer removed — only the 45-min course timer is used.
}


// =======================
// RESPUESTAS
// =======================

function answerQuestion(selectedAnswer) {
  clearInterval(timerInterval);

  const c = cases[currentCaseIndex];
  const q = c.questions[currentQuestionIndex];

  // Support multiple correct answers separated by comma e.g. "A,C"
  const correctAnswers = q.correctAnswer.split(",").map(a => a.trim().toUpperCase());
  const isCorrect = correctAnswers.includes(selectedAnswer.toUpperCase());

  // Disable whichever input is active
  document.querySelectorAll(".answer-btn").forEach(btn => btn.disabled = true);
  const ft = document.getElementById("freetextInput");
  if (ft) ft.disabled = true;
  const fs = document.getElementById("freetextSubmit");
  if (fs) fs.disabled = true;

  // Partial scoring: track how many correct answers have been selected
  if (!window.mcSelectedCorrect) window.mcSelectedCorrect = 0;
  if (isCorrect) window.mcSelectedCorrect++;

  // Award points proportionally, ensuring total = exactly 10 pts
  const totalCorrect = correctAnswers.length;
  const pointsPerAnswer = Math.floor(10 / totalCorrect);
  const bonusPoint = 10 % totalCorrect; // extra point for first answer if not divisible
  const pointsEarned = isCorrect
    ? (window.mcSelectedCorrect === 1 ? pointsPerAnswer + bonusPoint : pointsPerAnswer)
    : 0;
  score += pointsEarned;

  showFeedback(isCorrect, q, correctAnswers.length, pointsEarned);
}

function showFeedback(isCorrect, q, totalCorrect, pointsEarned) {
  const c = cases[currentCaseIndex];
  const isLastQuestion = currentQuestionIndex >= c.questions.length - 1;
  const isLastCase     = currentCaseIndex >= cases.length - 1;
  const numCorrect     = totalCorrect || 1;
  if (pointsEarned === undefined) {
    pointsEarned = isCorrect ? Math.floor(10 / numCorrect) + (isCorrect && numCorrect === 1 ? 0 : 10 % numCorrect) : 0;
  }

  document.getElementById("feedbackIcon").innerText  = isCorrect ? "✅" : "❌";
  document.getElementById("feedbackTitle").innerText = isCorrect ? "Correct!" : "Incorrect";
  document.getElementById("scoreGained").innerText   = isCorrect
    ? "+" + pointsEarned + " pts" + (numCorrect > 1 ? " (" + pointsEarned + " of 10)" : "")
    : "+0 pts";
  document.getElementById("scoreGained").style.color = isCorrect ? "var(--accent)" : "var(--danger)";

  // Find labels for ALL correct answers
  const correctCodes = q.correctAnswer.split(",").map(a => a.trim().toUpperCase());
  const correctLabels = correctCodes.map(code => {
    const opt = q.options.find(o => o.code === code);
    return opt ? opt.label : code;
  });
  document.getElementById("feedbackCorrectAnswer").innerText =
    (correctLabels.length > 1 ? "Correct answers: " : "Correct answer: ") +
    correctLabels.join(" / ");

  document.getElementById("feedbackExplanation").innerText = q.explanation || "";

  // Update Next button label
  const nextBtn = document.getElementById("nextBtn");
  if (nextBtn) {
    if (!isLastQuestion) {
      nextBtn.innerText = "Next Question →";
    } else if (!isLastCase) {
      nextBtn.innerText = "Next Case →";
    } else {
      nextBtn.innerText = "See Results →";
    }
  }

  showScreen("feedback");
}

function handleNext() {
  const c = cases[currentCaseIndex];
  const isLastQuestion = currentQuestionIndex >= c.questions.length - 1;

  if (!isLastQuestion) {
    // More questions in this case — stay on same DICOM, load next question
    currentQuestionIndex++;
    showScreen("question");
    loadQuestion();
  } else {
    // Move to next case
    nextCase();
  }
}




function sendResultToSharePoint() {
  fetch(FLOW_POST_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name:  playerName,
      email: playerEmail,
      score: window.finalScoreOutOf10 || 0
    })
  })
  .then(res => console.log("Score saved, status:", res.status))
  .catch(err => console.error("Save error:", err));
}

// =======================
// DICOM REFRESH
// =======================

function refreshDicom() {
  const c = cases[currentCaseIndex];
  const q = c.questions[currentQuestionIndex];
  if (!q || q.imageType !== "dicom" || !q.imageUrl) return;

  const btn = document.getElementById("dicomRefreshBtn");
  if (btn) { btn.innerText = "↺ Reloading..."; btn.disabled = true; }

  const dicomSection = document.getElementById("dicomSection");
  const oldFrame = document.getElementById("dicomFrame");
  if (oldFrame) oldFrame.remove();

  const newFrame = document.createElement("iframe");
  newFrame.id = "dicomFrame";
  newFrame.allowFullscreen = true;
  newFrame.onload = () => {
    if (btn) { btn.innerText = "↺ Reload viewer"; btn.disabled = false; }
    // Try to hide EBR platform sidebar via injected CSS
    try {
      const iframeDoc = newFrame.contentDocument || newFrame.contentWindow.document;
      const style = iframeDoc.createElement("style");
      style.textContent = ".sidebar, .table-of-contents, nav, #sidebar, [class*='sidebar'], [class*='contents'], [class*='navigation'] { display: none !important; } .main-content, .content, [class*='content'] { margin-left: 0 !important; width: 100% !important; }";
      iframeDoc.head.appendChild(style);
    } catch(e) {
      // Cross-origin restriction — cannot inject CSS into external iframe
    }
  };
  newFrame.src = q.imageUrl;
  dicomSection.appendChild(newFrame);
}

// =======================
// FREETEXT + INLINE AUTOCOMPLETE (multi-field)
// =======================

function buildFreetextFields(numFields, suggestions) {
  const container = document.getElementById("freetextFields");
  container.innerHTML = "";
  window.fieldSuggestions = {}; // track current ghost suggestion per field

  for (let i = 0; i < numFields; i++) {
    const label = document.createElement("div");
    label.className = "freetext-field-label";
    const q = cases[currentCaseIndex].questions[currentQuestionIndex];
    const fieldLabels = q.fieldLabels ? q.fieldLabels.split(",").map(l => l.trim()) : [];
    label.innerText = fieldLabels[i] || (numFields > 1 ? "Answer " + (i + 1) : "Your answer");

    const wrap = document.createElement("div");
    wrap.className = "freetext-field-wrap";

    const ghost = document.createElement("div");
    ghost.className = "freetext-ghost";
    ghost.id = "ghost_" + i;

    const input = document.createElement("input");
    input.type = "text";
    input.className = "freetext-input";
    input.id = "freetext_" + i;
    input.placeholder = "Start typing...";
    input.autocomplete = "off";
    input.dataset.index = i;

    input.addEventListener("input",   () => onFieldInput(i, suggestions));
    input.addEventListener("keydown", (e) => onFieldKeyDown(e, i));

    wrap.appendChild(ghost);
    wrap.appendChild(input);
    container.appendChild(label);
    container.appendChild(wrap);
  }
}

function onFieldInput(idx, suggestions) {
  const input = document.getElementById("freetext_" + idx);
  const ghost = document.getElementById("ghost_" + idx);
  const val   = input.value;
  window.fieldSuggestions[idx] = null;

  if (!val) { ghost.innerHTML = ""; return; }

  const match = suggestions.find(s => s.toLowerCase().startsWith(val.toLowerCase()));
  if (match) {
    window.fieldSuggestions[idx] = match;
    const completion = match.slice(val.length);
    ghost.innerHTML = val + '<span class="ghost-completion">' + completion + '</span>';
    // Update hint
    const hint = document.getElementById("freetextHint");
    if (hint) hint.innerText = 'Press Tab or → to accept: "' + match + '"';
  } else {
    ghost.innerHTML = "";
    const hint = document.getElementById("freetextHint");
    if (hint) hint.innerText = "No suggestion — keep typing";
  }
}

function onFieldKeyDown(e, idx) {
  const input      = document.getElementById("freetext_" + idx);
  const ghost      = document.getElementById("ghost_" + idx);
  const suggestion = window.fieldSuggestions && window.fieldSuggestions[idx];

  if ((e.key === "Tab" || e.key === "ArrowRight") && suggestion) {
    if (e.key === "ArrowRight" && input.selectionStart !== input.value.length) return;
    e.preventDefault();
    input.value = suggestion;
    ghost.innerHTML = "";
    window.fieldSuggestions[idx] = null;
    const hint = document.getElementById("freetextHint");
    if (hint) hint.innerText = '✓ "' + suggestion + '" selected';
  } else if (e.key === "Enter") {
    e.preventDefault();
    if (suggestion) {
      input.value = suggestion;
      ghost.innerHTML = "";
      window.fieldSuggestions[idx] = null;
    }
    // Move to next field or submit
    const next = document.getElementById("freetext_" + (idx + 1));
    if (next) { next.focus(); }
    else { submitFreetext(); }
  }
}

function submitFreetext() {
  const q = cases[currentCaseIndex].questions[currentQuestionIndex];
  const correctAnswers = window.freetextCorrectAnswers || [];
  const numFields = correctAnswers.length || 1;

  // Collect all field values
  const typed = [];
  for (let i = 0; i < numFields; i++) {
    const input = document.getElementById("freetext_" + i);
    if (!input) break;
    const val = input.value.trim();
    if (!val) {
      input.style.borderColor = "var(--danger)";
      input.placeholder = "Please type an answer";
      setTimeout(() => { input.style.borderColor = ""; input.placeholder = "Start typing..."; }, 1200);
      return;
    }
    typed.push(val.toLowerCase());
  }

  // Check for duplicate answers
  const uniqueAnswers = new Set(typed);
  if (uniqueAnswers.size < typed.length) {
    // Find and highlight duplicates
    const seen = {};
    for (let i = 0; i < numFields; i++) {
      const input = document.getElementById("freetext_" + i);
      if (!input) break;
      if (seen[typed[i]]) {
        input.style.borderColor = "var(--danger)";
        input.style.boxShadow = "0 0 0 3px rgba(192,57,43,0.15)";
        setTimeout(() => {
          input.style.borderColor = "";
          input.style.boxShadow = "";
        }, 1500);
      }
      seen[typed[i]] = true;
    }
    const hint = document.getElementById("freetextHint");
    if (hint) {
      hint.innerText = "⚠️ Each answer must be different!";
      hint.style.color = "var(--danger)";
      setTimeout(() => {
        hint.innerText = "Press Tab or → to accept a suggestion";
        hint.style.color = "";
      }, 1500);
    }
    return;
  }

  // Disable all fields
  for (let i = 0; i < numFields; i++) {
    const input = document.getElementById("freetext_" + i);
    if (input) input.disabled = true;
  }
  document.getElementById("freetextSubmit").disabled = true;

  // Score: 10 / numFields per correct answer (e.g. 3 fields = 3.33 pts each)
  const pointsPerField = 10 / numFields;
  let correctCount = 0;
  const fieldResults = [];

  // Check each field — each correct answer matched only once
  const usedAnswers = new Set();
  typed.forEach(t => {
    const matchIdx = correctAnswers.findIndex(
      (ca, ci) => ca.toLowerCase() === t && !usedAnswers.has(ci)
    );
    if (matchIdx > -1) {
      usedAnswers.add(matchIdx);
      fieldResults.push(true);
      correctCount++;
    } else {
      fieldResults.push(false);
    }
  });

  const pointsEarned = Math.round(correctCount * pointsPerField * 10) / 10;

  // Color each field green/red
  for (let i = 0; i < numFields; i++) {
    const input = document.getElementById("freetext_" + i);
    if (!input) break;
    input.style.borderColor = fieldResults[i] ? "var(--accent)" : "var(--danger)";
    input.style.background  = fieldResults[i] ? "rgba(92,45,126,0.06)" : "rgba(192,57,43,0.06)";
  }

  score += pointsEarned;

  const allCorrect  = correctCount === numFields;
  const someCorrect = correctCount > 0 && correctCount < numFields;

  // Feedback
  document.getElementById("feedbackIcon").innerText  = allCorrect ? "✅" : someCorrect ? "⚠️" : "❌";
  document.getElementById("feedbackTitle").innerText = allCorrect ? "Correct!" : someCorrect ? "Partially Correct" : "Incorrect";
  document.getElementById("scoreGained").innerText   = pointsEarned > 0 ? "+" + pointsEarned + " pts" : "+0 pts";
  document.getElementById("scoreGained").style.color = pointsEarned > 0 ? "var(--accent)" : "var(--danger)";
  document.getElementById("feedbackCorrectAnswer").innerText =
    (numFields > 1 ? "Correct answers: " : "Correct answer: ") + correctAnswers.join(" / ");
  document.getElementById("feedbackExplanation").innerText = q.explanation || "";

  const c = cases[currentCaseIndex];
  const isLastQuestion = currentQuestionIndex >= c.questions.length - 1;
  const isLastCase     = currentCaseIndex >= cases.length - 1;
  const nextBtn = document.getElementById("nextBtn");
  if (nextBtn) {
    nextBtn.innerText = !isLastQuestion ? "Next Question →" : !isLastCase ? "Next Case →" : "See Results →";
  }

  showScreen("feedback");
}

// =======================
// MULTI-SELECT SUBMIT
// =======================

function submitMultiSelect() {
  if (!window.selectedCodes || window.selectedCodes.length === 0) {
    const hint = document.getElementById("multiHint");
    if (hint) {
      hint.innerText = "⚠️ Please select at least one answer!";
      hint.style.color = "var(--danger)";
      setTimeout(() => {
        hint.innerText = "Select all correct answers, then click Submit";
        hint.style.color = "";
      }, 1500);
    }
    return;
  }

  // Disable all buttons and submit
  document.querySelectorAll(".answer-btn").forEach(btn => btn.disabled = true);
  document.getElementById("submitMcBtn").disabled = true;

  const q = cases[currentCaseIndex].questions[currentQuestionIndex];
  const correctAnswers = q.correctAnswer.split(",").map(a => a.trim().toUpperCase());

  // Calculate how many selected answers are correct
  const correctSelected = window.selectedCodes.filter(c =>
    correctAnswers.includes(c.toUpperCase())
  );
  const wrongSelected = window.selectedCodes.filter(c =>
    !correctAnswers.includes(c.toUpperCase())
  );

  // Give partial points: points per correct answer selected, minus wrong selections
  const pointsPerCorrect = Math.round(10 / correctAnswers.length);
  const earned = Math.max(0, (correctSelected.length * pointsPerCorrect) - (wrongSelected.length * pointsPerCorrect));
  score += earned;

  const isCorrect = correctSelected.length > 0 && wrongSelected.length === 0;
  const isPartial = correctSelected.length > 0 && (wrongSelected.length > 0 || correctSelected.length < correctAnswers.length);

  // Show feedback
  const feedbackIcon  = document.getElementById("feedbackIcon");
  const feedbackTitle = document.getElementById("feedbackTitle");
  const scoreGained   = document.getElementById("scoreGained");

  if (isCorrect) {
    feedbackIcon.innerText  = "✅";
    feedbackTitle.innerText = "Correct!";
  } else if (isPartial) {
    feedbackIcon.innerText  = "⚠️";
    feedbackTitle.innerText = "Partially Correct";
  } else {
    feedbackIcon.innerText  = "❌";
    feedbackTitle.innerText = "Incorrect";
  }

  scoreGained.innerText = earned > 0 ? "+" + earned + " pts" : "+0 pts";
  scoreGained.style.color = earned > 0 ? "var(--accent)" : "var(--danger)";

  // Show correct answers
  const correctLabels = correctAnswers.map(code => {
    const opt = q.options.find(o => o.code === code);
    return opt ? opt.label : code;
  });
  document.getElementById("feedbackCorrectAnswer").innerText =
    "Correct answers: " + correctLabels.join(" / ");
  document.getElementById("feedbackExplanation").innerText = q.explanation || "";

  // Update next button
  const c = cases[currentCaseIndex];
  const isLastQuestion = currentQuestionIndex >= c.questions.length - 1;
  const isLastCase     = currentCaseIndex >= cases.length - 1;
  const nextBtn = document.getElementById("nextBtn");
  if (nextBtn) {
    nextBtn.innerText = !isLastQuestion ? "Next Question →" : !isLastCase ? "Next Case →" : "See Results →";
  }

  showScreen("feedback");
}
