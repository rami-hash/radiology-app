// =======================
// CASES — loaded from SharePoint at runtime
// =======================

const PROXY_URL = "https://radiology-course-proxy.ramanjit-kaur.workers.dev";

let cases = [];  // populated by loadCasesFromSharePoint()

// Fetch cases and questions from SharePoint via Power Automate
function loadCasesFromSharePoint() {
  const loading = document.getElementById("loadingScreen");
  const welcome = document.getElementById("welcome");
  if (loading) loading.classList.add("active");
  if (welcome) welcome.classList.remove("active");

  fetch(PROXY_URL, {
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
// All calls go through PROXY_URL above.

// =======================
// SAVE / LOAD PROGRESS
// =======================

function saveProgress() {
  if (!playerEmail) return;
  fetch(PROXY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action:        "saveProgress",
      email:         playerEmail,
      name:          playerName,
      caseIndex:     currentCaseIndex,
      questionIndex: currentQuestionIndex,
      score:         score,
      answers:       JSON.stringify(userAnswers),
      timeLeft:      courseTimeLeft
    })
  })
  .then(res => console.log("Progress saved, status:", res.status, "case:", currentCaseIndex, "q:", currentQuestionIndex, "score:", score))
  .catch(err => console.error("Progress save error:", err));
}

function clearProgress() {
  console.log("clearProgress called, email:", playerEmail);
  if (!playerEmail) { console.warn("No email — skipping clearProgress"); return; }
  fetch(PROXY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "clearProgress",
      email:  playerEmail
    })
  })
  .then(res => { console.log("Progress cleared, status:", res.status); return res.text(); })
  .then(txt => console.log("Clear response:", txt))
  .catch(err => console.error("Progress clear error:", err));
}

function loadProgress(email) {
  return fetch(PROXY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "getProgress", email: email })
  })
  .then(res => res.json())
  .then(data => {
    console.log("Progress raw data:", JSON.stringify(data).slice(0, 500));
    const rows = Array.isArray(data) ? data : (data.value || []);
    if (rows.length === 0) { console.log("No progress found"); return null; }
    const row = rows[0];
    console.log("Progress row:", JSON.stringify(row).slice(0, 300));
    return {
      name:          row.PlayerName   || row.field_1     || "",
      caseIndex:     row.CaseIndex    !== undefined ? Number(row.CaseIndex)    : (row.field_2 !== undefined ? Number(row.field_2) : 0),
      questionIndex: row.QuestionIndex !== undefined ? Number(row.QuestionIndex) : (row.field_3 !== undefined ? Number(row.field_3) : 0),
      score:         row.Score        !== undefined ? Number(row.Score)        : (row.field_4 !== undefined ? Number(row.field_4) : 0),
      answers:       row.Answers      || row.field_5      || "{}",
      timeLeft:      row.TimeLeft     !== undefined ? Number(row.TimeLeft)     : (row.field_6 !== undefined ? Number(row.field_6) : 2700)
    };
  })
  .catch(err => {
    console.error("Progress load error:", err);
    return null;
  });
}

// =======================
// DARK / LIGHT MODE
// =======================
function toggleTheme() {
  const html = document.documentElement;
  const isDark = html.getAttribute("data-theme") === "dark";
  const newTheme = isDark ? "light" : "dark";
  html.setAttribute("data-theme", newTheme);
  document.getElementById("themeToggle").textContent = isDark ? "🌙" : "☀️";
  localStorage.setItem("theme", newTheme);
}
(function () {
  const saved = localStorage.getItem("theme") || "light";
  if (saved === "dark") {
    document.documentElement.setAttribute("data-theme", "dark");
    const btn = document.getElementById("themeToggle");
    if (btn) btn.textContent = "☀️";
  }
})();

// =======================
// CASE GALLERY
// =======================
function buildGallery() {
  const grid = document.getElementById("galleryGrid");
  if (!grid) return;
  grid.innerHTML = "";
  const icons = ["🫁","🧠","🦴","🫀","🦷","🔬","💊","🩻"];
  cases.forEach((c, i) => {
    const icon = icons[i % icons.length];
    const qCount = c.questions ? c.questions.length : "?";
    const card = document.createElement("div");
    card.className = "gallery-card";
    card.innerHTML = `
      <div class="gallery-card-thumb">
        <span class="gallery-card-num">Case ${i + 1}</span>
        ${icon}
      </div>
      <div class="gallery-card-body">
        <div class="gallery-card-title">${c.title || c.intro || "Case " + (i + 1)}</div>
        <div class="gallery-card-meta"><span>📋 ${qCount} question${qCount !== 1 ? "s" : ""}</span></div>
      </div>`;
    grid.appendChild(card);
  });
}

function startFromGallery() {
  currentCaseIndex = 0; currentQuestionIndex = 0; score = 0; userAnswers = {};
  startCourseTimer();
  updateProgress();
  loadCaseIntro();
  showScreen("caseIntro");
}

// =======================
// TIME TRACKING
// =======================
let questionStartTime = null;
let questionTimings = {};
function startQuestionTimer() { questionStartTime = Date.now(); }
function recordQuestionTime() {
  if (!questionStartTime) return;
  const elapsed = Math.round((Date.now() - questionStartTime) / 1000);
  const key = currentCaseIndex + "_" + currentQuestionIndex;
  if (!questionTimings[key]) questionTimings[key] = [];
  questionTimings[key].push(elapsed);
  questionStartTime = null;
}

document.addEventListener("DOMContentLoaded", () => {
  const display = document.getElementById("courseTimeDisplay");
  if (display) display.innerText = "45:00";
  loadCasesFromSharePoint();
  loadCourseSettings();
});

// =======================
// VARIABLES GLOBALES
// =======================

let score = 0;
let playerName = "";
let playerEmail = "";

let currentCaseIndex = 0;
let currentQuestionIndex = 0;

// Store user answers for review mode
// Format: { caseIndex_questionIndex: { userAnswer, isCorrect, pointsEarned } }
let userAnswers = {};

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

  // Show Dr. Ray only during course, not on welcome/admin/login
  const tutorScreens = ["caseIntro","question","feedback","results","review","leaderboard"];
  const tutorBubble = document.getElementById("tutorBubble");
  if (tutorBubble) tutorBubble.style.display = tutorScreens.includes(screenId) ? "block" : "none";
  const tutorPanel = document.getElementById("tutorPanel");
  if (tutorPanel) tutorPanel.classList.remove("open");
  tutorOpen = false;

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
  startQuestionTimer();
  // Update Dr. Ray context as soon as question loads
  updateTutorContext({
    caseTitle:    c.intro || c.title || "",
    caseContent:  c.content || "",
    questionText: q.text || "",
    options:      (q.options || []).map(o => o.code + ": " + o.label).join(", "),
    correctAnswer: q.correctAnswer || "",
    explanation:  q.explanation || "",
    userAnswer:   ""
  });

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
    dicomSection.style.display = "block";

    const isMobile = window.innerWidth <= 768;

    if (isMobile) {
      // On mobile: show a button to open in new tab
      const oldFrame = document.getElementById("dicomFrame");
      if (oldFrame) oldFrame.remove();
      const oldBtn = document.getElementById("dicomMobileOpenBtn");
      if (oldBtn) oldBtn.remove();

      const mobileBtn = document.createElement("div");
      mobileBtn.id = "dicomMobileOpenBtn";
      mobileBtn.style.cssText = "display:flex;flex-direction:column;align-items:center;justify-content:center;height:200px;background:#000;border-radius:12px;border:1px solid var(--border);gap:16px;";
      mobileBtn.innerHTML = `
        <div style="font-size:28px;margin-bottom:4px;">🖥️</div>
        <div style="color:#fff;font-size:15px;font-weight:600;text-align:center;padding:0 24px;">
          Best viewed on desktop
        </div>
        <div style="color:rgba(255,255,255,0.55);font-size:13px;text-align:center;padding:0 24px;line-height:1.5;">
          For the best experience with DICOM viewers, please use a desktop browser.
        </div>
        <button onclick="window.open('${q.imageUrl}', '_blank')" style="background:rgba(255,255,255,0.15);color:#fff;border:1px solid rgba(255,255,255,0.3);border-radius:10px;padding:11px 22px;font-size:13px;font-family:'DM Sans',sans-serif;font-weight:600;cursor:pointer;">
          Try anyway →
        </button>
      `;
      dicomSection.appendChild(mobileBtn);
    } else {
      // On desktop: show iframe as normal
      const oldMobileBtn = document.getElementById("dicomMobileOpenBtn");
      if (oldMobileBtn) oldMobileBtn.remove();
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
    }

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
  const nameInput  = document.getElementById("nameInput").value.trim();
  const emailInput = document.getElementById("emailInput").value.trim();
  const codeEl     = document.getElementById("accessCode");
  const codeInput  = codeEl ? codeEl.value.trim() : "";

  let valid = true;
  if (!nameInput) { document.getElementById("nameError").style.display = "block"; valid = false; }
  else              document.getElementById("nameError").style.display = "none";

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailInput || !emailRegex.test(emailInput)) { document.getElementById("emailError").style.display = "block"; valid = false; }
  else document.getElementById("emailError").style.display = "none";

  if (!codeInput) { document.getElementById("codeError").style.display = "block"; valid = false; }
  else document.getElementById("codeError").style.display = "none";

  if (!valid) return;

  const loadingEl = document.getElementById("loadingScreen");
  const welcomeEl = document.getElementById("welcome");
  if (loadingEl) loadingEl.classList.add("active");
  if (welcomeEl) welcomeEl.classList.remove("active");

  fetch(PROXY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "validateAccessCode", code: codeInput })
  })
  .then(r => r.json())
  .then(data => {
    if (!data.valid) {
      if (loadingEl) loadingEl.classList.remove("active");
      if (welcomeEl) welcomeEl.classList.add("active");
      document.getElementById("codeError").style.display = "block";
      return;
    }
    document.getElementById("codeError").style.display = "none";
    playerName  = nameInput;
    playerEmail = emailInput;

    if (cases.length === 0) {
      if (loadingEl) loadingEl.classList.remove("active");
      if (welcomeEl) welcomeEl.classList.add("active");
      alert(window.caseLoadFailed
        ? "Could not load cases from SharePoint. Please check your Power Automate flow and refresh."
        : "Cases are still loading. Please wait a moment and try again.");
      return;
    }

    const access = checkCourseAccess();
    if (!access.allowed) {
      if (loadingEl) loadingEl.classList.remove("active");
      if (welcomeEl) welcomeEl.classList.add("active");
      alert(access.message);
      return;
    }

    loadProgress(emailInput).then(saved => {
      if (loadingEl) loadingEl.classList.remove("active");

      if (saved && saved.answers && saved.answers !== "{}" && saved.caseIndex !== -1) {
        currentCaseIndex     = saved.caseIndex;
        currentQuestionIndex = saved.questionIndex;
        score                = saved.score;
        courseTimeLeft       = saved.timeLeft;
        try { userAnswers = JSON.parse(saved.answers); } catch(e) { userAnswers = {}; }
        playerName = saved.name || playerName;

        startCourseTimer();
        updateProgress();
        showScreen("question");
        setTimeout(() => loadQuestion(), 50);
      } else {
        currentCaseIndex = 0; currentQuestionIndex = 0; score = 0; userAnswers = {};
        startCourseTimer();
        updateProgress();
        loadCaseIntro();
        showScreen("caseIntro");
      }
    });
  })
  .catch(err => {
    if (loadingEl) loadingEl.classList.remove("active");
    if (welcomeEl) welcomeEl.classList.add("active");
    alert("Could not verify access code. Please check your connection and try again.");
  });
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
  saveProgress(); // save with updated caseIndex
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

  clearProgress(); // remove saved progress on completion
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

  const badge = pct >= 90 ? "🏆" : pct >= 75 ? "🥇" : pct >= 60 ? "🥈" : pct >= 40 ? "🥉" : "📋";
  const rankLabel = pct >= 90 ? "Top Performer" : pct >= 75 ? "High Scorer" : pct >= 60 ? "Good Standing" : "Keep Practising";
  const rcBadge = document.getElementById("rcBadge"); if (rcBadge) rcBadge.textContent = badge;
  const rcName = document.getElementById("rcName"); if (rcName) rcName.textContent = playerName;
  const rcScore = document.getElementById("rcScore"); if (rcScore) rcScore.textContent = finalScore + " / 10";
  const rcMessage = document.getElementById("rcMessage"); if (rcMessage) rcMessage.textContent = message;
  const rcRank = document.getElementById("rcRank"); if (rcRank) rcRank.textContent = "⭐ " + rankLabel;

  showScreen("results");
}

function goToLeaderboard() {
  showScreen("leaderboard");

  const el = document.getElementById("leaderboardMsg");
  el.innerHTML = "<p style='color:var(--muted);font-size:14px;text-align:center;padding:20px'>Loading scores\u2026</p>";

  fetch(PROXY_URL, {
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

  if (["question","caseIntro","feedback"].includes(screenId) && screenId !== "admin" && screenId !== "adminLogin") {
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
  recordQuestionTime();
  // Update tutor context
  const _c = cases[currentCaseIndex]; const _q = _c.questions[currentQuestionIndex];
  updateTutorContext({ caseTitle: _c.intro || _c.title || "", caseContent: _c.content || "", questionText: _q.text || "", options: (_q.options||[]).map(o => o.code+": "+o.label).join(", "), correctAnswer: _q.correctAnswer || "", userAnswer: selectedAnswer, explanation: _q.explanation || "" });

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

  // Store answer for review mode
  const answerKey = currentCaseIndex + "_" + currentQuestionIndex;
  if (!userAnswers[answerKey]) userAnswers[answerKey] = { userAnswers: [], isCorrect: false, pointsEarned: 0 };
  userAnswers[answerKey].userAnswers.push(selectedAnswer);

  // Partial scoring: track how many correct answers have been selected
  if (!window.mcSelectedCorrect) window.mcSelectedCorrect = 0;
  if (isCorrect) window.mcSelectedCorrect++;

  // Award points proportionally, ensuring total = exactly 10 pts
  const totalCorrect = correctAnswers.length;
  const pointsPerAnswer = Math.floor(10 / totalCorrect);
  const bonusPoint = 10 % totalCorrect; // extra point for first answer if not divisible
  const pointsEarned = Math.min(10, isCorrect
    ? (window.mcSelectedCorrect === 1 ? pointsPerAnswer + bonusPoint : pointsPerAnswer)
    : 0);
  score += pointsEarned;

  showFeedback(isCorrect, q, correctAnswers.length, pointsEarned);
}

function showFeedback(isCorrect, q, totalCorrect, pointsEarned) {
  notifyTutor(isCorrect);
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

  // Update review tracking
  const answerKey = currentCaseIndex + "_" + currentQuestionIndex;
  if (!userAnswers[answerKey]) userAnswers[answerKey] = { userAnswers: [], isCorrect: false, pointsEarned: 0 };
  userAnswers[answerKey].isCorrect    = isCorrect;
  userAnswers[answerKey].pointsEarned = pointsEarned;

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
    currentQuestionIndex++;
    saveProgress(); // save with updated questionIndex
    showScreen("question");
    loadQuestion();
  } else {
    nextCase();
  }
}




function sendResultToSharePoint() {
  fetch(PROXY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "saveScore",
      name:   playerName,
      email:  playerEmail,
      score:  window.finalScoreOutOf10 || 0
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

  const isMobile = window.innerWidth <= 768;
  if (isMobile) {
    // On mobile just open in new tab
    const q2 = cases[currentCaseIndex].questions[currentQuestionIndex];
    if (q2 && q2.imageUrl) window.open(q2.imageUrl, "_blank");
    return;
  }
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

  const pointsEarned = Math.min(10, Math.round(correctCount * pointsPerField * 10) / 10);

  // Color each field green/red
  for (let i = 0; i < numFields; i++) {
    const input = document.getElementById("freetext_" + i);
    if (!input) break;
    input.style.borderColor = fieldResults[i] ? "var(--accent)" : "var(--danger)";
    input.style.background  = fieldResults[i] ? "rgba(92,45,126,0.06)" : "rgba(192,57,43,0.06)";
  }

  score += pointsEarned;

  // Store for review mode
  const ftKey = currentCaseIndex + "_" + currentQuestionIndex;
  userAnswers[ftKey] = {
    userAnswers:  typed,
    isCorrect:    correctCount === numFields,
    pointsEarned: pointsEarned,
    isFreetext:   true
  };

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
  const earned = Math.min(10, Math.max(0, (correctSelected.length * pointsPerCorrect) - (wrongSelected.length * pointsPerCorrect)));
  score += earned;

  const isCorrect = correctSelected.length > 0 && wrongSelected.length === 0;
  const isPartial = correctSelected.length > 0 && (wrongSelected.length > 0 || correctSelected.length < correctAnswers.length);

  // Store for review mode
  const msKey = currentCaseIndex + "_" + currentQuestionIndex;
  userAnswers[msKey] = {
    userAnswers: window.selectedCodes || [],
    isCorrect:   isCorrect || isPartial,
    pointsEarned: earned
  };

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

// =======================
// REVIEW MODE
// =======================

function goToReview() {
  showScreen("review");
  const container = document.getElementById("reviewContent");
  container.innerHTML = "";

  // Build overall summary
  let totalEarned = 0;
  let totalMax    = 0;
  let totalCorrect = 0;
  let totalQs     = 0;

  cases.forEach((c, ci) => {
    c.questions.forEach((q, qi) => {
      const ua = userAnswers[ci + "_" + qi] || {};
      totalEarned  += ua.pointsEarned || 0;
      totalMax     += 10;
      totalQs++;
      if (ua.isCorrect) totalCorrect++;
    });
  });

  const overallPct = totalMax > 0 ? Math.round((totalEarned / totalMax) * 100) : 0;
  const finalDisplay = Math.round(totalEarned * 10) / 10;

  // Summary banner
  const summary = document.createElement("div");
  summary.className = "review-summary";
  summary.innerHTML = `
    <div class="review-summary-stat">
      <div class="review-summary-num">${finalDisplay} / ${totalMax}</div>
      <div class="review-summary-lbl">Total points</div>
    </div>
    <div class="review-summary-divider"></div>
    <div class="review-summary-stat">
      <div class="review-summary-num">${overallPct}%</div>
      <div class="review-summary-lbl">Overall score</div>
    </div>
    <div class="review-summary-divider"></div>
    <div class="review-summary-stat">
      <div class="review-summary-num">${totalCorrect} / ${totalQs}</div>
      <div class="review-summary-lbl">Correct answers</div>
    </div>
  `;
  container.appendChild(summary);

  cases.forEach((c, ci) => {
    const caseDiv = document.createElement("div");
    caseDiv.className = "review-case";

    // Calculate case stats
    let caseEarned = 0;
    let caseMax    = 0;
    c.questions.forEach((q, qi) => {
      const ua = userAnswers[ci + "_" + qi] || {};
      caseEarned += ua.pointsEarned || 0;
      caseMax    += 10;
    });
    const casePct = caseMax > 0 ? Math.round((caseEarned / caseMax) * 100) : 0;
    const caseDisplay = Math.round(caseEarned * 10) / 10;

    // Case header
    const header = document.createElement("div");
    header.className = "review-case-header";
    header.innerHTML = "Case " + (ci + 1) + " — " + c.intro;
    caseDiv.appendChild(header);

    // Case stats bar
    const statsBar = document.createElement("div");
    statsBar.className = "review-case-stats";
    statsBar.innerHTML = `
      <div class="stats-bar-wrapper">
        <div class="stats-label">Score</div>
        <div class="stats-bar-track">
          <div class="stats-bar-fill" style="width:${casePct}%"></div>
        </div>
      </div>
      <div class="stats-score">${caseDisplay} / ${caseMax} pts</div>
    `;
    caseDiv.appendChild(statsBar);

    // Questions
    c.questions.forEach((q, qi) => {
      const key = ci + "_" + qi;
      const ua  = userAnswers[key] || {};
      const correctCodes = q.correctAnswer.split(",").map(a => a.trim().toUpperCase());

      // Resolve correct answer labels
      const correctLabels = correctCodes.map(code => {
        const opt = q.options.find(o => o.code === code);
        return opt ? opt.label : code;
      });

      // Resolve user answer labels
      // For freetext, answers are already text labels
      // For MC, answers are codes that need resolving
      const userAnswerList = (ua.userAnswers || []).map(a => {
        if (ua.isFreetext) return a; // already a text label
        const opt = q.options.find(o => o.code === a);
        return opt ? opt.label : a;
      });

      const qDiv = document.createElement("div");
      qDiv.className = "review-question";

      // Question text
      const qText = document.createElement("div");
      qText.className = "review-q-text";
      qText.innerHTML = "Q" + (qi + 1) + ": " + q.text;
      qDiv.appendChild(qText);

      // User answer
      const userRow = document.createElement("div");
      userRow.className = "review-answer-row";
      const userTag = document.createElement("span");
      userTag.className = "review-tag " + (ua.isCorrect ? "user-ok" : "user-bad");
      userTag.innerText = ua.isCorrect ? "✅ Your answer" : "❌ Your answer";
      const userVal = document.createElement("span");
      userVal.innerText = userAnswerList.length > 0 ? userAnswerList.join(", ") : "Not answered";
      userRow.appendChild(userTag);
      userRow.appendChild(userVal);
      qDiv.appendChild(userRow);

      // Correct answer (only show if wrong)
      if (!ua.isCorrect) {
        const correctRow = document.createElement("div");
        correctRow.className = "review-answer-row";
        const correctTag = document.createElement("span");
        correctTag.className = "review-tag correct";
        correctTag.innerText = "✓ Correct";
        const correctVal = document.createElement("span");
        correctVal.innerText = correctLabels.join(" / ");
        correctRow.appendChild(correctTag);
        correctRow.appendChild(correctVal);
        qDiv.appendChild(correctRow);
      }

      // Points
      const pts = document.createElement("div");
      pts.className = "review-points";
      pts.innerText = "+" + (ua.pointsEarned || 0) + " pts";
      qDiv.appendChild(pts);

      // Explanation
      if (q.explanation) {
        const exp = document.createElement("div");
        exp.className = "review-explanation";
        exp.innerText = q.explanation;
        qDiv.appendChild(exp);
      }

      caseDiv.appendChild(qDiv);
    });

    container.appendChild(caseDiv);
  });
}


// =======================
// ADMIN PANEL
// =======================

function openAdmin() {
  const pwd = document.getElementById("adminPassword");
  if (!pwd) return;
  fetch(PROXY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "validateAdminCode", code: pwd.value.trim() })
  })
  .then(r => r.json())
  .then(data => {
    if (!data.valid) { document.getElementById("adminError").style.display = "block"; return; }
    document.getElementById("adminError").style.display = "none";
    showScreen("admin");
    loadAdminData();
  })
  .catch(() => { document.getElementById("adminError").style.display = "block"; });
}

function loadAdminData() {
  const statusEl = document.getElementById("adminStatus");
  statusEl.innerText = "Loading data...";

  // Set today as default dates
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 16);
  const endDefault = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16);
  const startInput  = document.getElementById("adminStartDate");
  const endInput    = document.getElementById("adminEndDate");
  const activeInput = document.getElementById("adminIsActive");
  if (startInput) startInput.value = todayStr;
  if (endInput)   endInput.value   = endDefault;

  // Load current settings into form
  loadCourseSettings().then(s => {
    if (!s) return;
    if (startInput && s.startDate) startInput.value = s.startDate.slice(0, 16);
    if (endInput   && s.endDate)   endInput.value   = s.endDate.slice(0, 16);
    if (activeInput) activeInput.checked = s.isActive !== false;

    // Show course status badge
    const statusEl = document.getElementById("adminCourseStatus");
    if (statusEl) {
      const access = checkCourseAccess();
      if (access.allowed) {
        statusEl.innerText = "🟢 Active";
        statusEl.style.cssText = "font-size:12px;padding:3px 12px;border-radius:20px;font-weight:600;background:rgba(46,160,67,0.12);color:#2ea043;";
      } else {
        statusEl.innerText = "🔴 Closed";
        statusEl.style.cssText = "font-size:12px;padding:3px 12px;border-radius:20px;font-weight:600;background:rgba(192,57,43,0.12);color:var(--danger);";
      }
    }
  });

  // Load all data from admin flow
  fetch(PROXY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "getAdminData" })
  })
  .then(r => r.json())
  .then(data => {
    const scores   = Array.isArray(data.scores)   ? data.scores   : (data.scores?.value   || []);
    const progress = Array.isArray(data.progress) ? data.progress : (data.progress?.value || []);

    renderAdminStats(scores, progress);
    renderAdminScores(scores);
    renderAdminProgress(progress);
    statusEl.innerText = "Last updated: " + new Date().toLocaleTimeString();
  }).catch(err => {
    statusEl.innerText = "Error loading data: " + err.message;
  });
}

function renderAdminStats(scores, progress) {
  const total     = scores.length;
  const avg       = total > 0 ? (scores.reduce((s, r) => s + Number(r.Score || r.score || 0), 0) / total).toFixed(1) : 0;
  const best      = total > 0 ? Math.max(...scores.map(r => Number(r.Score || r.score || 0))) : 0;
  const inProgress = progress.filter(p => {
    const ci = Number(p.CaseIndex || p.field_2 || 0);
    return ci >= 0;
  }).length;

  document.getElementById("adminStatTotal").innerText    = total;
  document.getElementById("adminStatAvg").innerText      = avg;
  document.getElementById("adminStatBest").innerText     = best;
  document.getElementById("adminStatProgress").innerText = inProgress;
}

let adminScoresData = [];
let adminProgressData = [];

function filterAdminScores() {
  const q = (document.getElementById("adminSearchInput")?.value || "").toLowerCase().trim();
  const filtered = q ? adminScoresData.filter(row => {
    const name  = (row.Name || row.name || row.Title || row.field_1 || "").toLowerCase();
    const email = (row.Email || row.email || row.field_2 || "").toLowerCase();
    return name.includes(q) || email.includes(q);
  }) : adminScoresData;
  _renderScoreRows(filtered);
}

function renderAdminScores(scores) {
  adminScoresData = scores;
  _renderScoreRows(scores);
}

function _renderScoreRows(scores) {
  const tbody = document.getElementById("adminScoresBody");
  tbody.innerHTML = "";

  if (scores.length === 0) {
    tbody.innerHTML = "<tr><td colspan='4' style='text-align:center;color:var(--muted);padding:20px'>No results found</td></tr>";
    return;
  }
  const sorted = [...scores].sort((a, b) => Number(b.Score || b.score || 0) - Number(a.Score || a.score || 0));
  sorted.forEach((row, i) => {
    const name  = row.Name  || row.name  || row.Title || row.field_1 || "—";
    const email = row.Email || row.email || row.field_2 || "—";
    const score = Number(row.Score || row.score || row.field_3 || 0);
    const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1 + ".";
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td style="font-size:16px">${medal}</td>
      <td style="font-weight:500">${name}</td>
      <td style="color:var(--muted);font-size:13px">${email}</td>
      <td style="text-align:right;font-family:'JetBrains Mono',monospace;font-weight:600;color:var(--accent)">${score} / 10</td>
    `;
    tbody.appendChild(tr);
  });
}

function renderAdminProgress(progress) {
  adminProgressData = progress;
  const tbody = document.getElementById("adminProgressBody");
  tbody.innerHTML = "";

  const active = progress.filter(p => Number(p.CaseIndex || p.field_2 || 0) >= 0);

  if (active.length === 0) {
    tbody.innerHTML = "<tr><td colspan='3' style='text-align:center;color:var(--muted);padding:20px'>No one currently in progress</td></tr>";
    return;
  }

  active.forEach(row => {
    const name        = row.PlayerName    || row.field_1 || "—";
    const email       = row.Title         || "—";
    const caseIdx     = Number(row.CaseIndex     || row.field_2 || 0) + 1;
    const questionIdx = Number(row.QuestionIndex || row.field_3 || 0) + 1;
    const score       = Number(row.Score         || row.field_4 || 0);
    if (Number(row.CaseIndex || row.field_2 || 0) === -1) return; // skip completed
    const progressPct = Math.round((caseIdx / (cases.length || 5)) * 100);
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td style="font-weight:500">${name}</td>
      <td style="color:var(--muted);font-size:13px">${email}</td>
      <td>
        <span style="font-size:12px;background:rgba(92,45,126,0.1);color:var(--accent);padding:3px 10px;border-radius:20px;font-weight:600;">
          Case ${caseIdx} · Q${questionIdx}
        </span>
      </td>
      <td style="text-align:right;font-family:'JetBrains Mono',monospace;font-weight:600;color:var(--accent)">${score} pts</td>
    `;
    tbody.appendChild(tr);
  });
}

function exportAdminCSV() {
  // Build data directly from scores array for clean export
  const headers = ["Rank", "Name", "Email", "Score"];
  const dataRows = [];

  const tbody = document.getElementById("adminScoresBody");
  tbody.querySelectorAll("tr").forEach((tr, i) => {
    const cells = tr.querySelectorAll("td");
    if (cells.length >= 4) {
      dataRows.push([
        String(i + 1),
        cells[1].innerText.trim(),
        cells[2].innerText.trim(),
        cells[3].innerText.trim().replace(" / 10", "")
      ]);
    }
  });

  // Build Excel-compatible CSV with semicolons and UTF-8 BOM
  const bom = "\uFEFF";
  const lines = [headers.join(";")];
  dataRows.forEach(row => {
    lines.push(row.map(v => `"${v.replace(/"/g, '""')}"`).join(";"));
  });

  const csv  = bom + lines.join("\r\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = "radiology_results_" + new Date().toISOString().slice(0, 10) + ".csv";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function exportAdminXLSX() {
  if (!adminScoresData.length) { alert("No data to export."); return; }
  const sorted = [...adminScoresData].sort((a,b) => Number(b.Score||b.score||0) - Number(a.Score||a.score||0));
  const wsData = [["Rank","Name","Email","Score"]];
  sorted.forEach((row,i) => {
    wsData.push([i+1, row.Name||row.name||row.Title||"—", row.Email||row.email||"—", Number(row.Score||row.score||0)]);
  });
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(wsData);
  ws["!cols"] = [{wch:6},{wch:30},{wch:35},{wch:10}];
  XLSX.utils.book_append_sheet(wb, ws, "Results");
  XLSX.writeFile(wb, "radiology_results_" + new Date().toISOString().slice(0,10) + ".xlsx");
}

// =======================
// COURSE SETTINGS
// =======================

let courseSettings = null;

function loadCourseSettings() {
  return fetch(PROXY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "getSettings" })
  })
  .then(r => r.json())
  .then(data => {
    const rows = Array.isArray(data) ? data : (data.value || []);
    if (rows.length === 0) return null;
    const row = rows[0];
    courseSettings = {
      startDate: row.StartDate || row.field_1 || null,
      endDate:   row.EndDate   || row.field_2 || null,
      isActive:  row.IsActive  !== undefined ? row.IsActive : true
    };
    return courseSettings;
  })
  .catch(err => {
    console.error("Settings load error:", err);
    return null;
  });
}

function checkCourseAccess() {
  if (!courseSettings) return { allowed: true };

  const now   = new Date();
  const start = courseSettings.startDate ? new Date(courseSettings.startDate) : null;
  const end   = courseSettings.endDate   ? new Date(courseSettings.endDate)   : null;

  if (!courseSettings.isActive) {
    return { allowed: false, message: "This course is currently not available." };
  }
  if (start && now < start) {
    return { allowed: false, message: "The course has not started yet.\n\nStart date: " + start.toLocaleDateString() + " " + start.toLocaleTimeString() };
  }
  if (end && now > end) {
    return { allowed: false, message: "This course has ended.\n\nEnd date: " + end.toLocaleDateString() + " " + end.toLocaleTimeString() };
  }
  return { allowed: true };
}

function saveSettings() {
  const startDate = document.getElementById("adminStartDate").value;
  const endDate   = document.getElementById("adminEndDate").value;
  const isActive  = document.getElementById("adminIsActive").checked;

  const saveBody = {
    action:    "saveSettings",
    startDate: startDate,
    endDate:   endDate,
    isActive:  isActive
  };
  console.log("Saving settings:", JSON.stringify(saveBody));
  fetch(PROXY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(saveBody)
  })
  .then(r => { console.log("Save status:", r.status); return r.json(); })
  .then(data => { console.log("Save response:", JSON.stringify(data)); })
  .then(() => {
    courseSettings = { startDate, endDate, isActive };
    const msg = document.getElementById("adminSettingsMsg");
    if (msg) { msg.innerText = "✅ Settings saved!"; setTimeout(() => msg.innerText = "", 3000); }
  })
  .catch(err => console.error("Settings save error:", err));
}

// =======================
// ADMIN TABS
// =======================

function switchAdminTab(tab) {
  // Update tab buttons
  document.querySelectorAll(".admin-tab").forEach(btn => {
    btn.classList.toggle("active", btn.getAttribute("onclick") === `switchAdminTab('${tab}')`);
  });

  // Show correct panel
  document.querySelectorAll(".admin-panel").forEach(panel => {
    panel.classList.remove("active");
  });
  const activePanel = document.getElementById("adminPanel" + tab.charAt(0).toUpperCase() + tab.slice(1));
  if (activePanel) activePanel.classList.add("active");
}

// =======================
// SHARE RESULTS
// =======================

function downloadResultCard() {
  const btn = document.getElementById("downloadCardBtn");
  const card = document.getElementById("resultCardInner");
  if (!card) { alert("Card not found."); return; }
  btn.textContent = "⏳ Generating…"; btn.disabled = true;
  html2canvas(card, { scale: 3, useCORS: true, backgroundColor: null, logging: false })
    .then(canvas => {
      const link = document.createElement("a");
      link.download = "radiology-result.png";
      link.href = canvas.toDataURL("image/png");
      link.click();
      btn.textContent = "📸 Download Card"; btn.disabled = false;
    }).catch(() => { btn.textContent = "📸 Download Card"; btn.disabled = false; });
}

function getShareText() {
  const score = window.finalScoreOutOf10 || 0;
  const name  = playerName || "I";
  return `${name} scored ${score}/10 on the EBR Radiology Challenge! 🩻 #Radiology #EDiR #EBR`;
}

function shareLinkedIn() {
  const text = encodeURIComponent(getShareText());
  const url  = `https://www.linkedin.com/sharing/share-offsite/?url=https://www.myebr.org&summary=${text}`;
  window.open(url, "_blank", "width=600,height=600");
}

function shareTwitter() {
  const text = encodeURIComponent(getShareText());
  const url  = `https://twitter.com/intent/tweet?text=${text}`;
  window.open(url, "_blank", "width=600,height=400");
}

function shareWhatsApp() {
  const text = encodeURIComponent(getShareText());
  const url  = `https://wa.me/?text=${text}`;
  window.open(url, "_blank");
}

function copyToClipboard(text, btn, original) {
  navigator.clipboard.writeText(text).then(() => {
    if (btn) { btn.innerText = "✅ Copied!"; setTimeout(() => btn.innerText = original, 2000); }
  }).catch(() => {
    const ta = document.createElement("textarea");
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    document.body.removeChild(ta);
    if (btn) { btn.innerText = "✅ Copied!"; setTimeout(() => btn.innerText = original, 2000); }
  });
}

function copyResult() {
  const btn = document.querySelector(".share-btn-copy");
  copyToClipboard(getShareText(), btn, "📋 Copy");
}


// =======================
// DR. RAY — AI RADIOLOGY TUTOR
// =======================

let tutorOpen = false;
let tutorHistory = []; // conversation history
let tutorTyping  = false;

// Current case context (updated when question loads)
let tutorContext = {
  caseTitle: "", caseContent: "", questionText: "",
  options: "", correctAnswer: "", userAnswer: "", explanation: ""
};

function updateTutorContext(ctx) {
  tutorContext = { ...tutorContext, ...ctx };
}

function toggleTutor() {
  tutorOpen ? closeTutor() : openTutor();
}

function openTutor() {
  tutorOpen = true;
  document.getElementById("tutorPanel").classList.add("open");
  document.getElementById("tutorBadge").style.display = "none";
  setTimeout(() => document.getElementById("tutorInput").focus(), 200);
  scrollTutorToBottom();
}

function closeTutor() {
  tutorOpen = false;
  document.getElementById("tutorPanel").classList.remove("open");
}

function scrollTutorToBottom() {
  const msgs = document.getElementById("tutorMessages");
  if (msgs) msgs.scrollTop = msgs.scrollHeight;
}

function addTutorMessage(text, role) {
  const msgs = document.getElementById("tutorMessages");
  const div = document.createElement("div");
  div.className = "tutor-msg " + (role === "user" ? "user" : "dr");
  div.innerHTML = text.replace(/\n/g, "<br>");
  msgs.appendChild(div);
  scrollTutorToBottom();
  return div;
}

function sendSuggestion(text) {
  document.getElementById("tutorInput").value = text;
  sendTutorMessage();
}

async function sendTutorMessage() {
  const input = document.getElementById("tutorInput");
  const question = input.value.trim();
  if (!question || tutorTyping) return;

  input.value = "";
  addTutorMessage(question, "user");

  // Hide suggestions after first message
  const suggestions = document.getElementById("tutorSuggestions");
  if (suggestions) suggestions.style.display = "none";

  // Add to history
  tutorHistory.push({ role: "user", content: question });

  // Show typing indicator
  tutorTyping = true;
  const sendBtn = document.getElementById("tutorSend");
  if (sendBtn) sendBtn.disabled = true;
  const typingDiv = addTutorMessage("Dr. Ray is thinking… 🩻", "dr typing");

  try {
    const res = await fetch(PROXY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "askTutor",
        question,
        conversationHistory: tutorHistory.slice(-6), // last 3 exchanges
        ...tutorContext
      })
    });

    const data = await res.json();
    typingDiv.remove();

    const reply = data.reply || "Sorry, I couldn't respond right now. Please try again!";
    addTutorMessage(reply, "dr");
    tutorHistory.push({ role: "assistant", content: reply });

  } catch (err) {
    typingDiv.remove();
    addTutorMessage("Oops! I had trouble connecting. Please check your connection and try again. 🩻", "dr");
  }

  tutorTyping = false;
  if (sendBtn) sendBtn.disabled = false;
  input.focus();
}

// Show badge when user answers (nudge to ask Dr. Ray)
function notifyTutor(isCorrect) {
  if (!tutorOpen) {
    const badge = document.getElementById("tutorBadge");
    if (badge) badge.style.display = isCorrect ? "none" : "flex";
  }
}
