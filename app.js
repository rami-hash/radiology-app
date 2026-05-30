// =======================
// CASES — loaded from Cloudflare KV via Worker
// =======================

const PROXY_URL = "https://radiology-course-proxy.ramanjit-kaur.workers.dev";

let cases = [];

// Keep old name so nothing else breaks
function loadCasesFromSharePoint() { loadCases(); }

function loadCases() {
  const loading = document.getElementById("loadingScreen");
  const welcome = document.getElementById("welcome");
  if (loading) loading.classList.add("active");
  if (welcome) welcome.classList.remove("active");

  fetch(PROXY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "getQuestions" })
  })
  .then(res => {
    if (!res.ok) throw new Error("HTTP " + res.status);
    return res.json();
  })
  .then(data => {
    const raw = Array.isArray(data) ? data : [];
    cases = raw
      .sort((a, b) => (a.order || 0) - (b.order || 0))
      .map(c => ({
        id:        c.id        || "",
        order:     c.order     || 0,
        intro:     c.intro     || c.title  || "",
        content:   c.content   || "",
        imageType: (c.imageType || "none").toLowerCase(),
        imageUrl:  c.imageUrl  || "",
        questions: (c.questions || [])
          .sort((a, b) => (a.order || 0) - (b.order || 0))
          .map(q => ({
            id:            q.id            || "",
            order:         q.order         || 0,
            text:          q.text          || "",
            content:       q.content       || "",
            questionType:  q.questionType  || "mc",
            suggestions:   q.suggestions   || "",
            fieldLabels:   q.fieldLabels   || "",
            imageType:     (q.imageType    || "none").toLowerCase(),
            imageUrl:      q.imageUrl      || "",
            options:       (q.options      || []).filter(o => o.label),
            correctAnswer: q.correctAnswer || "",
            explanation:   q.explanation   || "",
            subQuestions:  q.subQuestions  || []
          }))
      }));

    if (cases.length === 0) {
      if (loading) loading.classList.remove("active");
      if (welcome) welcome.classList.add("active");
      alert("No cases found. Please add cases via the Admin → Content panel.");
      return;
    }

    if (loading) loading.classList.remove("active");
    if (welcome) welcome.classList.add("active");
    console.log("Loaded", cases.length, "cases from KV");
  })
  .catch(err => {
    console.error("Failed to load cases:", err);
    if (loading) loading.classList.remove("active");
    if (welcome) welcome.classList.add("active");
    const el = document.getElementById("loadingError");
    if (el) el.style.display = "block";
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

let currentCaseIndex    = 0;
let currentQuestionIndex = 0; // kept for compatibility — mirrors questionPath[0]

// Question path — array of indices navigating the sub-question tree
// e.g. [2] = top-level question 2
//      [2, 0] = sub-question 0 of question 2
//      [2, 0, 1] = sub-sub-question 1 of sub-question 0 of question 2
let questionPath = [0];

// Get the question object at the current path
function getCurrentQuestion() {
  const c = cases[currentCaseIndex];
  let q = c.questions[questionPath[0]];
  for (let i = 1; i < questionPath.length; i++) {
    q = (q.subQuestions || [])[questionPath[i]];
  }
  return q;
}

// Get the parent question (for image inheritance)
function getParentQuestion() {
  if (questionPath.length <= 1) return null;
  const c = cases[currentCaseIndex];
  let q = c.questions[questionPath[0]];
  for (let i = 1; i < questionPath.length - 1; i++) {
    q = (q.subQuestions || [])[questionPath[i]];
  }
  return q;
}

// Count all questions recursively in a case (including sub-questions)
function countQuestionsRecursive(questions) {
  return (questions || []).reduce((sum, q) => {
    return sum + 1 + countQuestionsRecursive(q.subQuestions);
  }, 0);
}

// Flat ordered list of all question paths in a case (for progress/scoring)
function getAllPaths(questions, prefix) {
  prefix = prefix || [];
  let paths = [];
  (questions || []).forEach((q, i) => {
    const path = prefix.concat(i);
    paths.push(path);
    paths = paths.concat(getAllPaths(q.subQuestions, path));
  });
  return paths;
}

// Get the next path after current, or null if done
function getNextPath() {
  const c = cases[currentCaseIndex];
  const allPaths = getAllPaths(c.questions);
  const currentKey = questionPath.join(",");
  const idx = allPaths.findIndex(p => p.join(",") === currentKey);
  if (idx < 0 || idx >= allPaths.length - 1) return null;
  return allPaths[idx + 1];
}

// Unique key for storing answers — path-based
function answerKey() {
  return currentCaseIndex + "_" + questionPath.join("_");
}

// Store user answers for review mode
let userAnswers = {};

// Calculate total questions across all cases for scoring
function totalQuestions() {
  return cases.reduce((sum, c) => sum + countQuestionsRecursive(c.questions), 0);
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

let caseIntroImageUrl = "";

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

  // Hide both image sections first
  const dicomEl = document.getElementById("caseIntroDicom");
  const imageEl = document.getElementById("caseIntroImage");
  if (dicomEl) dicomEl.style.display = "none";
  if (imageEl) imageEl.style.display = "none";
  caseIntroImageUrl = c.imageUrl || "";

  const itype = (c.imageType || "none").toLowerCase();

  if (itype === "dicom" && c.imageUrl) {
    if (dicomEl) dicomEl.style.display = "block";
    const frame = document.getElementById("caseIntroDicomFrame");
    if (frame) frame.src = c.imageUrl;

  } else if (itype === "image" && c.imageUrl) {
    if (imageEl) imageEl.style.display = "block";
    const img     = document.getElementById("caseIntroImg");
    const errDiv  = document.getElementById("caseIntroImgError");
    const errLink = document.getElementById("caseIntroImgLink");
    if (img) {
      img.style.display = "none";
      img.onload  = () => { img.style.display = "block"; if (errDiv) errDiv.style.display = "none"; };
      img.onerror = () => { img.style.display = "none";  if (errDiv) errDiv.style.display = "block"; if (errLink) errLink.href = c.imageUrl; };
      img.src = c.imageUrl;
    }
  }
}

function caseIntroDicomFullscreen() {
  const section = document.getElementById("caseIntroDicom");
  const frame   = document.getElementById("caseIntroDicomFrame");
  if (!section) return;
  const isFs = section.classList.toggle("dicom-fullscreen");
  if (frame) frame.style.height = isFs ? "0" : "680px";
  document.body.style.overflow = isFs ? "hidden" : "";
}

function loadQuestion() {
  const c = cases[currentCaseIndex];
  const q = getCurrentQuestion();
  const allPaths = getAllPaths(c.questions);
  const pathIdx  = allPaths.findIndex(p => p.join(",") === questionPath.join(","));
  const totalQ   = allPaths.length;

  // Update header — show depth with indentation indicator
  const depthPrefix = questionPath.length > 1 ? "↳ ".repeat(questionPath.length - 1) : "";
  document.getElementById("questionNumber").innerText =
    "Case " + (currentCaseIndex + 1) + " / " + cases.length +
    "  ·  Question " + (pathIdx + 1) + " / " + totalQ;

  document.getElementById("questionCaseText").innerText = depthPrefix + q.text;
  currentQuestionIndex = questionPath[0]; // keep compat
  window.mcSelectedCorrect = 0;
  startQuestionTimer();

  updateTutorContext({
    caseTitle:     c.intro || c.title || "",
    caseContent:   c.content || "",
    questionText:  q.text || "",
    options:       (q.options || []).map(o => o.code + ": " + o.label).join(", "),
    correctAnswer: q.correctAnswer || "",
    explanation:   q.explanation || "",
    userAnswer:    ""
  });

  // Show optional question content
  const contentEl = document.getElementById("questionContent");
  if (q.content && q.content.trim()) {
    contentEl.innerText = q.content.trim();
    contentEl.style.display = "block";
  } else {
    contentEl.style.display = "none";
  }

  // Sub-question depth badge
  let depthBadge = document.getElementById("subQuestionBadge");
  if (questionPath.length > 1) {
    if (!depthBadge) {
      depthBadge = document.createElement("div");
      depthBadge.id = "subQuestionBadge";
      depthBadge.style.cssText = "display:inline-block;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:700;background:rgba(92,45,126,0.1);color:var(--accent);border:1px solid var(--accent);margin-bottom:10px;font-family:'JetBrains Mono',monospace;";
      const qHeader = document.getElementById("questionCaseText");
      qHeader.parentNode.insertBefore(depthBadge, qHeader);
    }
    depthBadge.innerText = questionPath.length === 2 ? "↳ Sub-question" : "↳ ".repeat(questionPath.length - 1) + "Follow-up";
    depthBadge.style.display = "inline-block";
  } else {
    if (depthBadge) depthBadge.style.display = "none";
  }

  // Image: use own imageType/imageUrl, or inherit from parent if imageType is "none"
  const dicomSection = document.getElementById("dicomSection");
  const imageSection = document.getElementById("imageSection");
  dicomSection.style.display = "none";
  imageSection.style.display = "none";

  // Resolve which image to show — walk up the tree until we find one
  let imageQ = q;
  if ((!imageQ.imageType || imageQ.imageType === "none") && questionPath.length > 1) {
    let parent = getParentQuestion();
    while (parent) {
      if (parent.imageType && parent.imageType !== "none" && parent.imageUrl) {
        imageQ = parent;
        break;
      }
      parent = null; // only go up one level for now — extend if needed
    }
  }

  if (imageQ.imageType === "dicom" && imageQ.imageUrl) {
    dicomSection.style.display = "block";
    const isMobile = window.innerWidth <= 768;
    if (isMobile) {
      const oldFrame = document.getElementById("dicomFrame");
      if (oldFrame) oldFrame.remove();
      const oldBtn = document.getElementById("dicomMobileOpenBtn");
      if (oldBtn) oldBtn.remove();
      const mobileBtn = document.createElement("div");
      mobileBtn.id = "dicomMobileOpenBtn";
      mobileBtn.style.cssText = "display:flex;flex-direction:column;align-items:center;justify-content:center;height:200px;background:#000;border-radius:12px;border:1px solid var(--border);gap:16px;";
      mobileBtn.innerHTML = `
        <div style="font-size:28px;">🖥️</div>
        <div style="color:#fff;font-size:15px;font-weight:600;text-align:center;padding:0 24px;">Best viewed on desktop</div>
        <div style="color:rgba(255,255,255,0.55);font-size:13px;text-align:center;padding:0 24px;line-height:1.5;">For the best experience with DICOM viewers, please use a desktop browser.</div>
        <button onclick="window.open('${imageQ.imageUrl}', '_blank')" style="background:rgba(255,255,255,0.15);color:#fff;border:1px solid rgba(255,255,255,0.3);border-radius:10px;padding:11px 22px;font-size:13px;font-family:'DM Sans',sans-serif;font-weight:600;cursor:pointer;">Open viewer →</button>`;
      dicomSection.appendChild(mobileBtn);
    } else {
      const oldMobileBtn = document.getElementById("dicomMobileOpenBtn");
      if (oldMobileBtn) oldMobileBtn.remove();
      dicomLoadFrame(imageQ.imageUrl);
    }
  } else if (imageQ.imageType === "image" && imageQ.imageUrl) {
    imageSection.style.display = "block";
    const img     = document.getElementById("caseImage");
    const errMsg  = document.getElementById("imageErrorMsg");
    const openBtn = document.getElementById("imageOpenBtn");
    const openLnk = document.getElementById("imageOpenLink");
    img.style.display = "none";
    img.src = "";
    if (errMsg)  errMsg.style.display  = "none";
    if (openBtn) openBtn.style.display = "none";
    if (openLnk) openLnk.href = imageQ.imageUrl;
    img.onload  = () => { img.style.display = "block"; if (errMsg) errMsg.style.display = "none"; if (openBtn) openBtn.style.display = "none"; };
    img.onerror = () => {
      img.style.display = "none";
      if (errMsg) { errMsg.innerHTML = "🖼️ The image could not load automatically.<br><span style='font-size:12px;'>Click the button below to open it.</span>"; errMsg.style.display = "block"; }
      if (openBtn) openBtn.style.display = "block";
    };
    img.src = imageQ.imageUrl;
  }

  // Answer UI
  const freetextContainer = document.getElementById("freetextContainer");
  const optionsContainer  = document.getElementById("optionsContainer");
  const questionType = (q.questionType || "mc").toLowerCase();
  const isFreetext   = questionType === "freetext" || questionType === "free";

  if (isFreetext) {
    freetextContainer.style.display = "block";
    optionsContainer.style.display  = "none";
    if (document.getElementById("multiHint"))   document.getElementById("multiHint").style.display = "none";
    if (document.getElementById("submitMcBtn")) document.getElementById("submitMcBtn").style.display = "none";
    const submitBtn = document.getElementById("freetextSubmit");
    const hint      = document.getElementById("freetextHint");
    if (submitBtn) { submitBtn.disabled = false; submitBtn.style.display = "block"; }
    if (hint)      { hint.innerText = ""; }

    let suggestionList = (q.options || []).map(o => o.label);
    if (q.suggestions && q.suggestions.trim()) {
      const raw = q.suggestions.trim();
      if (raw.includes(","))      suggestionList = raw.split(",").map(s => s.trim()).filter(s => s);
      else if (raw.includes(";")) suggestionList = raw.split(";").map(s => s.trim()).filter(s => s);
      else if (raw.includes("\n"))suggestionList = raw.split("\n").map(s => s.trim()).filter(s => s);
      else                        suggestionList = [raw];
    }

    const correctAnswers = q.correctAnswer.split(",").map(a => {
      const trimmed = a.trim();
      const opt = (q.options || []).find(o => o.code.toUpperCase() === trimmed.toUpperCase());
      return opt ? opt.label : trimmed;
    });

    window.freetextCorrectAnswers = correctAnswers;
    window.selectedAutocomplete   = null;
    fieldSuggestions = {};
    buildFreetextFields(correctAnswers.length, suggestionList);

  } else {
    freetextContainer.style.display = "none";
    document.getElementById("freetextSubmit") && (document.getElementById("freetextSubmit").style.display = "none");
    optionsContainer.style.display  = "grid";
    optionsContainer.innerHTML = "";

    const correctAnswers = q.correctAnswer.split(",").map(a => a.trim().toUpperCase());
    const isMulti = correctAnswers.length > 1;
    const multiHint   = document.getElementById("multiHint");
    const submitMcBtn = document.getElementById("submitMcBtn");
    if (multiHint)   multiHint.style.display   = isMulti ? "block" : "none";
    if (submitMcBtn) submitMcBtn.style.display  = isMulti ? "block" : "none";
    if (submitMcBtn) submitMcBtn.disabled = false;
    window.selectedCodes = [];

    (q.options || []).forEach(opt => {
      const btn = document.createElement("button");
      btn.className = "answer-btn";
      btn.innerHTML = "<strong>" + opt.code + "</strong> — " + opt.label;
      if (isMulti) {
        btn.onclick = () => {
          if (btn.disabled) return;
          const idx = window.selectedCodes.indexOf(opt.code);
          if (idx > -1) { window.selectedCodes.splice(idx, 1); btn.classList.remove("selected"); }
          else           { window.selectedCodes.push(opt.code); btn.classList.add("selected"); }
        };
      } else {
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

  const c = cases[currentCaseIndex];
  const q = getCurrentQuestion();

  updateTutorContext({
    caseTitle:    c.intro || c.title || "",
    caseContent:  c.content || "",
    questionText: q.text || "",
    options:      (q.options||[]).map(o => o.code+": "+o.label).join(", "),
    correctAnswer: q.correctAnswer || "",
    userAnswer:   selectedAnswer,
    explanation:  q.explanation || ""
  });

  const correctAnswers = q.correctAnswer.split(",").map(a => a.trim().toUpperCase());
  const isCorrect = correctAnswers.includes(selectedAnswer.toUpperCase());

  document.querySelectorAll(".answer-btn").forEach(btn => btn.disabled = true);
  const fs = document.getElementById("freetextSubmit");
  if (fs) fs.disabled = true;

  const key = answerKey();
  if (!userAnswers[key]) userAnswers[key] = { userAnswers: [], isCorrect: false, pointsEarned: 0 };
  userAnswers[key].userAnswers.push(selectedAnswer);

  if (!window.mcSelectedCorrect) window.mcSelectedCorrect = 0;
  if (isCorrect) window.mcSelectedCorrect++;

  const totalCorrect    = correctAnswers.length;
  const pointsPerAnswer = Math.floor(10 / totalCorrect);
  const bonusPoint      = 10 % totalCorrect;
  const pointsEarned    = Math.min(10, isCorrect
    ? (window.mcSelectedCorrect === 1 ? pointsPerAnswer + bonusPoint : pointsPerAnswer)
    : 0);
  score += pointsEarned;

  showFeedback(isCorrect, q, correctAnswers.length, pointsEarned);
}

function showFeedback(isCorrect, q, totalCorrect, pointsEarned) {
  notifyTutor(isCorrect);

  const numCorrect = totalCorrect || 1;
  if (pointsEarned === undefined) {
    pointsEarned = isCorrect ? Math.floor(10 / numCorrect) + (10 % numCorrect) : 0;
  }

  document.getElementById("feedbackIcon").innerText  = isCorrect ? "✅" : "❌";
  document.getElementById("feedbackTitle").innerText = isCorrect ? "Correct!" : "Incorrect";
  document.getElementById("scoreGained").innerText   = isCorrect
    ? "+" + pointsEarned + " pts" + (numCorrect > 1 ? " (" + pointsEarned + " of 10)" : "")
    : "+0 pts";
  document.getElementById("scoreGained").style.color = isCorrect ? "var(--accent)" : "var(--danger)";

  const key = answerKey();
  if (!userAnswers[key]) userAnswers[key] = { userAnswers: [], isCorrect: false, pointsEarned: 0 };
  userAnswers[key].isCorrect    = isCorrect;
  userAnswers[key].pointsEarned = pointsEarned;

  const correctCodes  = q.correctAnswer.split(",").map(a => a.trim().toUpperCase());
  const correctLabels = correctCodes.map(code => {
    const opt = (q.options || []).find(o => o.code === code);
    return opt ? opt.label : code;
  });
  document.getElementById("feedbackCorrectAnswer").innerText =
    (correctLabels.length > 1 ? "Correct answers: " : "Correct answer: ") + correctLabels.join(" / ");
  document.getElementById("feedbackExplanation").innerText = q.explanation || "";

  // Next button label — check if there are more questions/sub-questions
  const nextPath = getNextPath();
  const nextBtn  = document.getElementById("nextBtn");
  if (nextBtn) {
    if (nextPath) {
      // Is the next question a sub-question of the current?
      const isSubNext = nextPath.length > questionPath.length && nextPath.slice(0,-1).join(",") === questionPath.join(",");
      nextBtn.innerText = isSubNext ? "Next Sub-question →" : "Next Question →";
    } else if (currentCaseIndex < cases.length - 1) {
      nextBtn.innerText = "Next Case →";
    } else {
      nextBtn.innerText = "See Results →";
    }
  }

  showScreen("feedback");
}

function handleNext() {
  const nextPath = getNextPath();
  if (nextPath) {
    questionPath = nextPath;
    currentQuestionIndex = questionPath[0];
    saveProgress();
    showScreen("question");
    loadQuestion();
  } else {
    nextCase();
  }
}

function goToQuestion() {
  questionPath = [0];
  currentQuestionIndex = 0;
  showScreen("question");
  loadQuestion();
  startCaseTimer();
}

function nextCase() {
  currentCaseIndex++;
  questionPath = [0];
  currentQuestionIndex = 0;
  saveProgress();
  updateProgress();
  if (currentCaseIndex < cases.length) {
    loadCaseIntro();
    showScreen("caseIntro");
  } else {
    goToResults();
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
// DICOM VIEWER
// =======================

let dicomCurrentUrl = null;

function dicomLoadFrame(url) {
  dicomCurrentUrl = url;
  const dicomSection = document.getElementById("dicomSection");
  const loading      = document.getElementById("dicomLoading");

  // Remove old frame
  const oldFrame = document.getElementById("dicomFrame");
  if (oldFrame) oldFrame.remove();

  // Show loading overlay
  if (loading) { loading.style.display = "flex"; }

  const frame = document.createElement("iframe");
  frame.id             = "dicomFrame";
  frame.allowFullscreen = true;
  frame.style.cssText  = "width:100%;height:780px;border:1px solid var(--border);border-radius:12px;background:#000;display:block;touch-action:auto;";

  frame.onload = () => {
    if (loading) loading.style.display = "none";
    // Try to suppress EBR sidebar (may be blocked cross-origin — that's fine)
    try {
      const doc = frame.contentDocument || frame.contentWindow.document;
      const s   = doc.createElement("style");
      s.textContent = ".sidebar,.table-of-contents,nav,#sidebar,[class*='sidebar'],[class*='contents'],[class*='navigation']{display:none!important}.main-content,.content,[class*='content']{margin-left:0!important;width:100%!important}";
      doc.head.appendChild(s);
    } catch(e) {}
  };

  frame.src = url;
  dicomSection.appendChild(frame);
}

function refreshDicom() {
  const q = cases[currentCaseIndex]?.questions[currentQuestionIndex];
  if (!q || q.imageType !== "dicom" || !q.imageUrl) return;

  const isMobile = window.innerWidth <= 768;
  if (isMobile) { window.open(q.imageUrl, "_blank"); return; }

  const btn = document.getElementById("dicomRefreshBtn");
  if (btn) { btn.innerText = "↺ Reloading…"; btn.disabled = true; }

  dicomLoadFrame(q.imageUrl);

  setTimeout(() => {
    if (btn) { btn.innerText = "↺ Reload"; btn.disabled = false; }
  }, 2000);
}

function dicomOpenNewTab() {
  if (dicomCurrentUrl) window.open(dicomCurrentUrl, "_blank");
}

let dicomIsFullscreen = false;

function dicomToggleFullscreen() {
  const section = document.getElementById("dicomSection");
  const frame   = document.getElementById("dicomFrame");
  const btn     = document.getElementById("dicomFullscreenBtn");

  dicomIsFullscreen = !dicomIsFullscreen;

  if (dicomIsFullscreen) {
    section.classList.add("dicom-fullscreen");
    if (frame) frame.style.height = "0";  // flex takes over
    if (btn)   btn.innerText = "✕ Exit fullscreen";
    document.body.style.overflow = "hidden";
  } else {
    section.classList.remove("dicom-fullscreen");
    if (frame) frame.style.height = "780px";
    if (btn)   btn.innerText = "⛶ Fullscreen";
    document.body.style.overflow = "";
  }
}

// Close fullscreen on Escape key
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && dicomIsFullscreen) dicomToggleFullscreen();
});



// =======================
// FREETEXT + INLINE AUTOCOMPLETE (multi-field)
// =======================

// =======================
// FREETEXT — TAG BOX + LIST
// =======================
// One input box that shows selected answers as removable tags.
// A shared suggestion list below — click to add, click tag × to remove.

let ftSelectedTags   = [];   // array of selected answer strings (in order)
let ftSuggestions    = [];   // full suggestion list for this question
let ftNumRequired    = 1;    // how many answers are required

function buildFreetextFields(numFields, suggestions) {
  ftSelectedTags  = [];
  ftSuggestions   = suggestions.slice();
  ftNumRequired   = numFields;

  const container = document.getElementById("freetextFields");
  container.innerHTML = "";

  // ── Tag input box ─────────────────────────────────────
  const boxLabel = document.createElement("div");
  boxLabel.className = "freetext-field-label";
  boxLabel.innerText = numFields > 1
    ? "Select " + numFields + " answers from the list below:"
    : "Select your answer from the list below:";
  container.appendChild(boxLabel);

  // The tag box — shows selected tags + a search input inside
  const tagBox = document.createElement("div");
  tagBox.id = "ftTagBox";
  tagBox.style.cssText = `
    display:flex;flex-wrap:wrap;align-items:center;gap:6px;
    padding:10px 12px;border:2px solid var(--border);border-radius:10px;
    background:var(--surface);min-height:50px;cursor:text;
    transition:border-color 0.2s;
  `;
  tagBox.onclick = () => document.getElementById("ftSearchInput").focus();

  // Search input inside the tag box
  const searchInput = document.createElement("input");
  searchInput.id = "ftSearchInput";
  searchInput.type = "text";
  searchInput.placeholder = suggestions.length > 0 ? "Type to filter…" : "No suggestions";
  searchInput.autocomplete = "off";
  searchInput.style.cssText = `
    border:none;outline:none;background:transparent;
    font-size:15px;font-family:'DM Sans',sans-serif;
    color:var(--text);flex:1;min-width:120px;padding:2px 4px;
  `;
  searchInput.addEventListener("input", () => ftFilterList(searchInput.value));
  tagBox.appendChild(searchInput);
  container.appendChild(tagBox);

  // Focus border
  searchInput.addEventListener("focus", () => tagBox.style.borderColor = "var(--accent)");
  searchInput.addEventListener("blur",  () => tagBox.style.borderColor = ftSelectedTags.length ? "var(--accent)" : "var(--border)");

  // ── Counter ───────────────────────────────────────────
  if (numFields > 1) {
    const counter = document.createElement("div");
    counter.id = "ftCounter";
    counter.style.cssText = "font-size:12px;color:var(--muted);text-align:right;margin-top:4px;margin-bottom:4px;";
    counter.innerText = "0 / " + numFields + " selected";
    container.appendChild(counter);
  }

  // ── Suggestion list ───────────────────────────────────
  const listLabel = document.createElement("div");
  listLabel.className = "freetext-field-label";
  listLabel.style.marginTop = "10px";
  listLabel.innerText = "Available answers:";
  container.appendChild(listLabel);

  const list = document.createElement("ul");
  list.className = "freetext-persistent-list";
  list.id = "ftSuggestionList";

  suggestions.forEach(s => {
    const li = document.createElement("li");
    li.className = "freetext-list-item";
    li.textContent = s;
    li.dataset.value = s;
    li.addEventListener("click", () => ftAddTag(s));
    list.appendChild(li);
  });
  container.appendChild(list);

  // Focus search on load
  setTimeout(() => searchInput.focus(), 100);
}

function ftAddTag(value) {
  // Don't add if already selected
  if (ftSelectedTags.includes(value)) return;
  // Don't add more than required
  if (ftSelectedTags.length >= ftNumRequired) {
    const hint = document.getElementById("freetextHint");
    if (hint) {
      hint.innerText = "⚠️ Remove an answer first — only " + ftNumRequired + " allowed";
      hint.style.color = "var(--danger)";
      setTimeout(() => { hint.innerText = ""; hint.style.color = ""; }, 2000);
    }
    return;
  }

  ftSelectedTags.push(value);
  ftRenderTags();
  ftUpdateListState();
  ftUpdateCounter();

  // Clear search
  const si = document.getElementById("ftSearchInput");
  if (si) { si.value = ""; ftFilterList(""); si.focus(); }

  const hint = document.getElementById("freetextHint");
  if (hint) { hint.innerText = ""; hint.style.color = ""; }
}

function ftRemoveTag(value) {
  ftSelectedTags = ftSelectedTags.filter(t => t !== value);
  ftRenderTags();
  ftUpdateListState();
  ftUpdateCounter();
  document.getElementById("ftSearchInput")?.focus();
}

function ftRenderTags() {
  const tagBox = document.getElementById("ftTagBox");
  if (!tagBox) return;

  // Remove existing tags (keep the search input)
  const si = document.getElementById("ftSearchInput");
  tagBox.innerHTML = "";

  ftSelectedTags.forEach(value => {
    const tag = document.createElement("div");
    tag.style.cssText = `
      display:inline-flex;align-items:center;gap:5px;
      padding:4px 10px 4px 12px;border-radius:20px;
      background:rgba(92,45,126,0.12);border:1px solid var(--accent);
      color:var(--accent);font-size:13px;font-weight:600;
      font-family:'DM Sans',sans-serif;white-space:nowrap;
    `;
    const txt = document.createElement("span");
    txt.textContent = value;

    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.innerHTML = "×";
    removeBtn.style.cssText = `
      background:none;border:none;color:var(--accent);
      cursor:pointer;font-size:16px;line-height:1;padding:0;
      display:flex;align-items:center;
    `;
    removeBtn.onclick = (e) => { e.stopPropagation(); ftRemoveTag(value); };

    tag.appendChild(txt);
    tag.appendChild(removeBtn);
    tagBox.appendChild(tag);
  });

  // Re-add search input
  tagBox.appendChild(si);
  si.focus();

  // Update border
  tagBox.style.borderColor = ftSelectedTags.length > 0 ? "var(--accent)" : "var(--border)";
}

function ftUpdateCounter() {
  const counter = document.getElementById("ftCounter");
  if (!counter) return;
  counter.innerText = ftSelectedTags.length + " / " + ftNumRequired + " selected";
  counter.style.color = ftSelectedTags.length === ftNumRequired ? "var(--accent)" : "var(--muted)";
}

function ftUpdateListState() {
  const list = document.getElementById("ftSuggestionList");
  if (!list) return;
  list.querySelectorAll(".freetext-list-item").forEach(li => {
    const val      = li.dataset.value;
    const selected = ftSelectedTags.includes(val);
    li.classList.toggle("selected", selected);
    li.style.opacity     = selected ? "0.5" : "1";
    li.style.cursor      = selected ? "default" : "pointer";
    // Show/hide checkmark
    let check = li.querySelector(".ft-check");
    if (selected) {
      if (!check) {
        check = document.createElement("span");
        check.className = "ft-check";
        check.style.cssText = "margin-left:auto;color:var(--accent);font-weight:700;";
        check.innerText = "✓";
        li.appendChild(check);
      }
    } else {
      if (check) check.remove();
    }
  });
}

function ftFilterList(val) {
  const list = document.getElementById("ftSuggestionList");
  if (!list) return;
  const lower = val.toLowerCase();
  list.querySelectorAll(".freetext-list-item").forEach(li => {
    const text    = li.dataset.value.toLowerCase();
    const matches = !val || text.includes(lower);
    li.style.display = matches ? "flex" : "none";
    if (matches) {
      const s     = li.dataset.value;
      const check = li.querySelector(".ft-check");
      const checkHtml = check ? check.outerHTML : "";
      if (val) {
        const start = s.toLowerCase().indexOf(lower);
        const end   = start + val.length;
        li.innerHTML =
          escapeHtml(s.slice(0, start)) +
          '<mark>' + escapeHtml(s.slice(start, end)) + '</mark>' +
          escapeHtml(s.slice(end)) + checkHtml;
      } else {
        li.innerHTML = escapeHtml(s) + checkHtml;
      }
      li.onclick = () => ftAddTag(s);
    }
  });
}

function submitFreetext() {
  const q = cases[currentCaseIndex].questions[currentQuestionIndex];
  const correctAnswers = window.freetextCorrectAnswers || [];
  const numFields      = correctAnswers.length || 1;
  const hint           = document.getElementById("freetextHint");

  // Validate
  if (ftSelectedTags.length < numFields) {
    const remaining = numFields - ftSelectedTags.length;
    if (hint) {
      hint.innerText = "⚠️ Please select " + remaining + " more answer" + (remaining > 1 ? "s" : "");
      hint.style.color = "var(--danger)";
      setTimeout(() => { hint.innerText = ""; hint.style.color = ""; }, 2000);
    }
    // Shake the tag box
    const tagBox = document.getElementById("ftTagBox");
    if (tagBox) {
      tagBox.style.borderColor = "var(--danger)";
      tagBox.style.boxShadow   = "0 0 0 3px rgba(192,57,43,0.15)";
      setTimeout(() => { tagBox.style.borderColor = ""; tagBox.style.boxShadow = ""; }, 1200);
    }
    return;
  }

  if (hint) { hint.innerText = ""; hint.style.color = ""; }

  // Disable
  document.getElementById("freetextSubmit").disabled = true;
  const si = document.getElementById("ftSearchInput");
  if (si) si.disabled = true;
  const list = document.getElementById("ftSuggestionList");
  if (list) list.style.pointerEvents = "none";

  // Score
  const typed        = ftSelectedTags.map(t => t.toLowerCase());
  const pointsPerField = 10 / numFields;
  let correctCount   = 0;
  const usedAnswers  = new Set();

  typed.forEach(t => {
    const matchIdx = correctAnswers.findIndex(
      (ca, ci) => ca.toLowerCase() === t && !usedAnswers.has(ci)
    );
    if (matchIdx > -1) { usedAnswers.add(matchIdx); correctCount++; }
  });

  const pointsEarned = Math.min(10, Math.round(correctCount * pointsPerField * 10) / 10);
  score += pointsEarned;

  // Colour tags green/red
  const tagBox = document.getElementById("ftTagBox");
  if (tagBox) {
    tagBox.querySelectorAll("div").forEach(tag => {
      const txt   = tag.querySelector("span")?.textContent || "";
      const lower = txt.toLowerCase();
      const isCorrect = correctAnswers.some(ca => ca.toLowerCase() === lower);
      tag.style.background   = isCorrect ? "rgba(92,45,126,0.15)" : "rgba(192,57,43,0.08)";
      tag.style.borderColor  = isCorrect ? "var(--accent)"         : "var(--danger)";
      tag.style.color        = isCorrect ? "var(--accent)"         : "var(--danger)";
    });
    tagBox.style.borderColor = correctCount === numFields ? "var(--accent)" : "var(--danger)";
    tagBox.style.boxShadow   = "none";
  }

  // Store for review
  const ftKey = currentCaseIndex + "_" + currentQuestionIndex;
  userAnswers[ftKey] = {
    userAnswers:  typed,
    isCorrect:    correctCount === numFields,
    pointsEarned,
    isFreetext:   true
  };

  const allCorrect  = correctCount === numFields;
  const someCorrect = correctCount > 0 && correctCount < numFields;

  document.getElementById("feedbackIcon").innerText  = allCorrect ? "✅" : someCorrect ? "⚠️" : "❌";
  document.getElementById("feedbackTitle").innerText = allCorrect ? "Correct!" : someCorrect ? "Partially Correct" : "Incorrect";
  document.getElementById("scoreGained").innerText   = pointsEarned > 0 ? "+" + pointsEarned + " pts" : "+0 pts";
  document.getElementById("scoreGained").style.color = pointsEarned > 0 ? "var(--accent)" : "var(--danger)";
  document.getElementById("feedbackCorrectAnswer").innerText =
    (numFields > 1 ? "Correct answers: " : "Correct answer: ") + correctAnswers.join(" / ");
  document.getElementById("feedbackExplanation").innerText = q.explanation || "";

  const c = cases[currentCaseIndex];
  const nextBtn = document.getElementById("nextBtn");
  if (nextBtn) {
    const isLastQ = currentQuestionIndex >= c.questions.length - 1;
    const isLastC = currentCaseIndex >= cases.length - 1;
    nextBtn.innerText = !isLastQ ? "Next Question →" : !isLastC ? "Next Case →" : "See Results →";
  }

  showScreen("feedback");
}

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

// =======================
// CONTENT MANAGER (GitHub backend)
// =======================

let cmCases         = [];
let cmActiveCaseIdx = -1;
let cmMode          = "";
let cmEditTarget    = null;

// ---- Helper: generate a simple unique id ----
function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function cmNewId(prefix) {
  return prefix + "_" + Date.now() + "_" + Math.floor(Math.random() * 1000);
}

// ---- Load from KV via Worker ----
function cmRefresh() {
  const list = document.getElementById("cmCaseList");
  list.innerHTML = "<p style='color:var(--muted);font-size:13px;padding:16px;text-align:center;'>Loading…</p>";
  document.getElementById("cmQuestionSection").style.display = "none";

  fetch(PROXY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "getQuestions" })
  })
  .then(r => { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
  .then(data => {
    cmCases = (Array.isArray(data) ? data : [])
      .sort((a,b) => (a.order||0) - (b.order||0))
      .map(c => ({
        id:        c.id        || cmNewId("case"),
        order:     c.order     || 0,
        title:     c.intro     || c.title   || "",
        content:   c.content   || "",
        imageType: c.imageType || "none",
        imageUrl:  c.imageUrl  || "",
        questions: (c.questions || [])
          .sort((a,b) => (a.order||0)-(b.order||0))
          .map(q => ({
            id:            q.id            || cmNewId("q"),
            order:         q.order         || 0,
            text:          q.text          || "",
            content:       q.content       || "",
            questionType:  q.questionType  || "mc",
            suggestions:   q.suggestions   || "",
            fieldLabels:   q.fieldLabels   || "",
            imageType:     q.imageType     || "none",
            imageUrl:      q.imageUrl      || "",
            options:       q.options       || [],
            correctAnswer: q.correctAnswer || "",
            explanation:   q.explanation   || "",
            subQuestions:  q.subQuestions  || []
          }))
      }));
    cmRenderCaseList();
  })
  .catch(err => {
    list.innerHTML = `<p style='color:var(--danger);font-size:13px;padding:16px;text-align:center;'>
      Failed to load: ${err.message}<br><br>
      Make sure the COURSE_DATA KV namespace is bound to your Worker.
    </p>`;
  });
}

// ---- Save entire cmCases array to KV via Worker ----
function cmSaveToGitHub(onSuccess) {  // name kept for compatibility
  const btn = document.getElementById("cmModalSave");
  if (btn) { btn.disabled = true; btn.innerText = "Saving…"; }
  cmMsg("Saving…");

  // Convert back to the questions.json format
  const payload = cmCases.map(c => ({
    id:        c.id,
    order:     c.order,
    intro:     c.title,
    content:   c.content,
    imageType: c.imageType || "none",
    imageUrl:  c.imageUrl  || "",
    questions: c.questions.map(q => ({
      id:            q.id,
      order:         q.order,
      text:          q.text,
      content:       q.content,
      questionType:  q.questionType,
      suggestions:   q.suggestions,
      fieldLabels:   q.fieldLabels,
      imageType:     q.imageType,
      imageUrl:      q.imageUrl,
      options:       q.options,
      correctAnswer: q.correctAnswer,
      explanation:   q.explanation,
      subQuestions:  q.subQuestions || []
    }))
  }));

  fetch(PROXY_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "saveQuestions", questions: payload })
  })
  .then(r => { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
  .then(() => {
    if (btn) { btn.disabled = false; btn.innerText = "💾 Save"; }
    cmMsg("✅ Saved!");
    // Also refresh the live cases array so course reflects changes immediately
    cases = payload.map(c => ({
      ...c,
      intro: c.intro || c.title || ""
    }));
    if (onSuccess) setTimeout(onSuccess, 600);
  })
  .catch(err => {
    if (btn) { btn.disabled = false; btn.innerText = "💾 Save"; }
    cmMsg("Error: " + err.message, true);
  });
}

// ---- Render case list ----
function cmRenderCaseList() {
  const list = document.getElementById("cmCaseList");
  if (cmCases.length === 0) {
    list.innerHTML = "<p style='color:var(--muted);font-size:13px;padding:16px;text-align:center;'>No cases yet. Click + New Case to add one.</p>";
    return;
  }
  list.innerHTML = "";
  cmCases.forEach((c, idx) => {
    const row = document.createElement("div");
    row.className = "cm-case-row" + (cmActiveCaseIdx === idx ? " active" : "");
    row.innerHTML = `
      <span class="cm-case-num">#${idx+1}</span>
      <span class="cm-case-title">${escapeHtml(c.title) || "<em style='color:var(--muted)'>Untitled</em>"}</span>
      <span class="cm-case-meta">${c.questions.length} question${c.questions.length!==1?"s":""}</span>
      <div class="cm-row-btns">
        <button class="cm-btn" onclick="cmSelectCase(${idx});event.stopPropagation();">📋 Questions</button>
        <button class="cm-btn" onclick="cmEditCase(${idx});event.stopPropagation();">✏️ Edit</button>
        <button class="cm-btn" onclick="cmMoveCase(${idx},-1);event.stopPropagation();" ${idx===0?"disabled":""}>↑</button>
        <button class="cm-btn" onclick="cmMoveCase(${idx},1);event.stopPropagation();" ${idx===cmCases.length-1?"disabled":""}>↓</button>
        <button class="cm-btn cm-btn-danger" onclick="cmDeleteCase(${idx});event.stopPropagation();">🗑</button>
      </div>`;
    row.onclick = () => cmSelectCase(idx);
    list.appendChild(row);
  });
}

function cmMoveCase(idx, dir) {
  const newIdx = idx + dir;
  if (newIdx < 0 || newIdx >= cmCases.length) return;
  [cmCases[idx], cmCases[newIdx]] = [cmCases[newIdx], cmCases[idx]];
  cmCases.forEach((c, i) => c.order = i + 1);
  if (cmActiveCaseIdx === idx) cmActiveCaseIdx = newIdx;
  cmRenderCaseList();
  cmSaveToGitHub(null);
}

// ---- Select case ----
function cmSelectCase(idx) {
  cmActiveCaseIdx = idx;
  cmRenderCaseList();
  const c = cmCases[idx];
  document.getElementById("cmQSectionTitle").innerText = "Questions — " + (c.title || "Case " + (idx+1));
  document.getElementById("cmQuestionSection").style.display = "block";
  cmRenderQuestionList();
}

// ---- Render questions ----
function cmRenderQuestionList() {
  const list = document.getElementById("cmQuestionList");
  const c = cmCases[cmActiveCaseIdx];
  if (!c) return;
  if (c.questions.length === 0) {
    list.innerHTML = "<p style='color:var(--muted);font-size:13px;padding:16px;text-align:center;'>No questions yet. Click + New Question.</p>";
    return;
  }
  list.innerHTML = "";
  c.questions.forEach((q, qi) => {
    const row = document.createElement("div");
    row.className = "cm-q-row";
    const typeBadge = q.questionType === "freetext" ? "Free text" : "Multiple choice";
    const imgBadge  = q.imageType && q.imageType !== "none" ? "🖼 " + q.imageType : "";
    row.innerHTML = `
      <span class="cm-q-num">Q${qi+1}</span>
      <div class="cm-q-body">
        <div class="cm-q-text">${escapeHtml(q.text) || "<em style='color:var(--muted)'>No question text</em>"}</div>
        <div class="cm-q-meta">
          <span class="cm-badge">${typeBadge}</span>
          ${imgBadge ? '<span class="cm-badge">'+imgBadge+'</span>' : ""}
          ${q.correctAnswer ? '<span class="cm-badge">✓ '+escapeHtml(q.correctAnswer)+'</span>' : ""}
        </div>
      </div>
      <div class="cm-row-btns">
        <button class="cm-btn" onclick="cmMoveQuestion(${qi},-1);" ${qi===0?"disabled":""}>↑</button>
        <button class="cm-btn" onclick="cmMoveQuestion(${qi},1);" ${qi===c.questions.length-1?"disabled":""}>↓</button>
        <button class="cm-btn" onclick="cmEditQuestion(${qi});">✏️ Edit</button>
        <button class="cm-btn cm-btn-danger" onclick="cmDeleteQuestion(${qi});">🗑</button>
      </div>`;
    list.appendChild(row);
  });
}

function cmMoveQuestion(qi, dir) {
  const c = cmCases[cmActiveCaseIdx];
  const newQi = qi + dir;
  if (newQi < 0 || newQi >= c.questions.length) return;
  [c.questions[qi], c.questions[newQi]] = [c.questions[newQi], c.questions[qi]];
  c.questions.forEach((q, i) => q.order = i + 1);
  cmRenderQuestionList();
  cmSaveToGitHub(null);
}

// ---- Case modal ----
function cmNewCase() {
  cmMode = "newCase"; cmEditTarget = null;
  document.getElementById("cmModalTitle").innerText = "New Case";
  document.getElementById("cmModalBody").innerHTML = cmCaseForm({});
  document.getElementById("cmModalMsg").innerText = "";
  document.getElementById("cmModal").style.display = "block";
}

function cmEditCase(idx) {
  cmMode = "editCase"; cmEditTarget = { caseIdx: idx };
  const c = cmCases[idx];
  document.getElementById("cmModalTitle").innerText = "Edit Case";
  document.getElementById("cmModalBody").innerHTML = cmCaseForm(c);
  document.getElementById("cmModalMsg").innerText = "";
  document.getElementById("cmModal").style.display = "block";
}

function cmCaseForm(c) {
  const itype    = c.imageType || "none";
  const isBase64 = c.imageUrl && c.imageUrl.startsWith("data:");
  const urlValue = isBase64 ? "" : (c.imageUrl || "");

  return `
    <div class="cm-field">
      <label class="cm-label">Case Title / Clinical Presentation</label>
      <textarea class="cm-textarea" id="cmF_title" placeholder="e.g. 65-year-old male with chest pain and dyspnoea…" style="min-height:70px;">${escapeHtml(c.title||"")}</textarea>
    </div>
    <div class="cm-field">
      <label class="cm-label">Additional Content (optional — extra clinical details, labs, etc.)</label>
      <textarea class="cm-textarea" id="cmF_content" placeholder="Hypertensive for 10 years. O2 sat 91%…">${escapeHtml(c.content||"")}</textarea>
    </div>

    <div class="cm-field">
      <label class="cm-label">Image Type</label>
      <select class="cm-select" id="cmF_itype" onchange="cmToggleImageFields()" style="width:auto;">
        <option value="none"  ${itype==="none" ?"selected":""}>No image</option>
        <option value="dicom" ${itype==="dicom"?"selected":""}>DICOM (EBR viewer)</option>
        <option value="image" ${itype==="image"?"selected":""}>Static image (jpg/png)</option>
      </select>
    </div>

    <!-- Hidden field stores base64 data between renders -->
    <input type="hidden" id="cmF_imageBase64" value="${isBase64 ? escapeHtml(c.imageUrl) : ""}">

    <div id="cmImageSection" style="display:${itype!=="none"?"block":"none"}">
      <div class="cm-field">
        <label class="cm-label">${itype==="dicom"?"EBR Viewer URL":"Image URL or upload from laptop"}</label>

        <div id="cmUploadArea" style="display:${itype==="image"?"block":"none"}">
          <div onclick="document.getElementById('cmFileInput').click()" style="border:2px dashed var(--border);border-radius:10px;padding:16px;text-align:center;cursor:pointer;color:var(--muted);font-size:13px;margin-bottom:8px;transition:border-color 0.2s;" onmouseover="this.style.borderColor='var(--accent)'" onmouseout="this.style.borderColor='var(--border)'">
            📁 Click to upload image from your laptop<br>
            <span style="font-size:11px;margin-top:4px;display:block;">JPG or PNG — auto-resized to max 1200px</span>
          </div>
          <input type="file" id="cmFileInput" accept="image/*" style="display:none" onchange="cmHandleFileUpload(this)">
          <img id="cmUploadPreview" src="${isBase64 ? escapeHtml(c.imageUrl) : ""}" style="display:${isBase64?"block":"none"};width:100%;max-height:150px;object-fit:contain;border-radius:8px;border:1px solid var(--border);margin-bottom:8px;">
          ${isBase64 ? `<div style="font-size:12px;color:var(--accent);padding:6px 8px;background:var(--surface2);border-radius:8px;margin-bottom:6px;">✅ Image already uploaded — upload a new one to replace it</div>` : ""}
          <div style="text-align:center;font-size:12px;color:var(--muted);margin-bottom:6px;">— or paste a URL below —</div>
        </div>

        <input class="cm-input" id="cmF_imageUrl" value="${escapeHtml(urlValue)}" placeholder="${itype==="dicom"?"https://www.myebr.org/viewer/case123":"https://…"}">

        <div id="cmImagePreviewArea" style="margin-top:8px;display:${itype==="dicom"&&c.imageUrl?"block":"none"}">
          ${itype==="dicom"&&c.imageUrl?`<div style="font-size:12px;color:var(--muted);padding:8px;background:var(--surface2);border-radius:8px;">🖥️ DICOM will load as iframe in the course</div>`:""}
        </div>
      </div>
    </div>`;
}

// ---- Question modal ----
function cmNewQuestion() {
  if (cmActiveCaseIdx < 0) return;
  cmMode = "newQuestion"; cmEditTarget = { caseIdx: cmActiveCaseIdx };
  document.getElementById("cmModalTitle").innerText = "New Question";
  document.getElementById("cmModalBody").innerHTML = cmQuestionForm({});
  document.getElementById("cmModalMsg").innerText = "";
  document.getElementById("cmModal").style.display = "block";
  cmBuildFtAnswerList("");
  cmBuildSubQuestionList([]);
}

function cmEditQuestion(qi) {
  const q = cmCases[cmActiveCaseIdx].questions[qi];
  cmMode = "editQuestion"; cmEditTarget = { caseIdx: cmActiveCaseIdx, questionIdx: qi };
  document.getElementById("cmModalTitle").innerText = "Edit Question";
  document.getElementById("cmModalBody").innerHTML = cmQuestionForm(q);
  document.getElementById("cmModalMsg").innerText = "";
  document.getElementById("cmModal").style.display = "block";
  if (q.questionType === "freetext") cmBuildFtAnswerList(q.correctAnswer || "");
  cmBuildSubQuestionList(q.subQuestions || []);
}

function cmQuestionForm(q) {
  const opts = ["A","B","C","D","E","F"];
  const existing = q.options || [];
  const optRows = opts.map((code, i) => {
    const val = existing[i] ? existing[i].label : "";
    return `<div class="cm-option-row">
      <span class="cm-option-code">${code}</span>
      <input class="cm-input" id="cmF_opt${code}" value="${escapeHtml(val)}" placeholder="Option ${code}…">
    </div>`;
  }).join("");

  const qtype = q.questionType || "mc";
  const itype = q.imageType    || "none";

  return `
    <div class="cm-field">
      <label class="cm-label">Question Text</label>
      <textarea class="cm-textarea" id="cmF_text" placeholder="What is the most likely diagnosis?">${escapeHtml(q.text||"")}</textarea>
    </div>
    <div class="cm-field">
      <label class="cm-label">Clinical Content (optional — extra text shown in the question box)</label>
      <textarea class="cm-textarea" id="cmF_content" style="min-height:60px;" placeholder="Additional clinical details shown below the question…">${escapeHtml(q.content||"")}</textarea>
    </div>

    <div class="cm-grid2">
      <div class="cm-field">
        <label class="cm-label">Question Type</label>
        <select class="cm-select" id="cmF_qtype" onchange="cmToggleFreetextFields()">
          <option value="mc"      ${qtype==="mc"?"selected":""}>Multiple Choice</option>
          <option value="freetext"${qtype==="freetext"?"selected":""}>Free Text</option>
        </select>
      </div>
      <div class="cm-field">
        <label class="cm-label">Image Type</label>
        <select class="cm-select" id="cmF_itype" onchange="cmToggleImageFields()">
          <option value="none"  ${itype==="none" ?"selected":""}>No image</option>
          <option value="dicom" ${itype==="dicom"?"selected":""}>DICOM (EBR viewer)</option>
          <option value="image" ${itype==="image"?"selected":""}>Static image (URL)</option>
        </select>
      </div>
    </div>

    <!-- Hidden field stores base64 data between renders -->
    <input type="hidden" id="cmF_imageBase64" value="${q.imageUrl&&q.imageUrl.startsWith("data:") ? escapeHtml(q.imageUrl) : ""}">

    <!-- Image URL / Upload -->
    <div id="cmImageSection" style="display:${itype!=="none"?"block":"none"}">
      <div class="cm-field">
        <label class="cm-label">${itype==="dicom"?"EBR Viewer URL (paste your platform link)":"Image URL or upload from laptop"}</label>

        <div id="cmUploadArea" style="display:${itype==="image"?"block":"none"}">
          <!-- Upload button -->
          <div onclick="document.getElementById('cmFileInput').click()" style="border:2px dashed var(--border);border-radius:10px;padding:16px;text-align:center;cursor:pointer;color:var(--muted);font-size:13px;margin-bottom:8px;transition:border-color 0.2s;" onmouseover="this.style.borderColor='var(--accent)'" onmouseout="this.style.borderColor='var(--border)'">
            📁 Click to upload image from your laptop<br>
            <span style="font-size:11px;margin-top:4px;display:block;">JPG or PNG — auto-resized to max 1200px</span>
          </div>
          <input type="file" id="cmFileInput" accept="image/*" style="display:none" onchange="cmHandleFileUpload(this)">
          <img id="cmUploadPreview" src="${q.imageUrl&&q.imageUrl.startsWith("data:")?escapeHtml(q.imageUrl):""}" style="display:${q.imageUrl&&q.imageUrl.startsWith("data:")?"block":"none"};width:100%;max-height:150px;object-fit:contain;border-radius:8px;border:1px solid var(--border);margin-bottom:8px;">
          ${q.imageUrl&&q.imageUrl.startsWith("data:") ? `<div style="font-size:12px;color:var(--accent);padding:6px 8px;background:var(--surface2);border-radius:8px;margin-bottom:6px;">✅ Image already uploaded — upload a new one to replace it</div>` : ""}
          <div style="text-align:center;font-size:12px;color:var(--muted);margin-bottom:6px;">— or paste a URL below —</div>
        </div>

        <input class="cm-input" id="cmF_imageUrl" value="${escapeHtml(q.imageUrl&&!q.imageUrl.startsWith("data:")?q.imageUrl:"")}" placeholder="${itype==="dicom"?"https://www.myebr.org/viewer/case123":"https://…"}">

        <!-- Existing image preview -->
        <div id="cmImagePreviewArea" style="margin-top:8px;display:${itype!=="none"&&q.imageUrl?"block":"none"}">
          ${itype==="dicom"&&q.imageUrl ? `<div style="font-size:12px;color:var(--muted);padding:8px;background:var(--surface2);border-radius:8px;">🖥️ DICOM will load as iframe in the course</div>` : ""}
          ${itype==="image"&&q.imageUrl&&!q.imageUrl.startsWith("data:") ? `<img src="${escapeHtml(q.imageUrl)}" style="width:100%;max-height:120px;object-fit:contain;border-radius:8px;border:1px solid var(--border);">` : ""}
          ${itype==="image"&&q.imageUrl&&q.imageUrl.startsWith("data:") ? `<div style="font-size:12px;color:var(--accent);padding:8px;background:var(--surface2);border-radius:8px;">✅ Uploaded image stored</div>` : ""}
        </div>
      </div>
    </div>

    <!-- MC options -->
    <div id="cmMcSection" style="display:${qtype==="freetext"?"none":"block"}">
      <div class="cm-field">
        <label class="cm-label">Answer Options</label>
        ${optRows}
      </div>
    </div>

    <!-- Freetext fields -->
    <div id="cmFtSection" style="display:${qtype==="freetext"?"block":"none"}">
      <div class="cm-field">
        <label class="cm-label">Suggestions (comma-separated — shown in the answer list)</label>
        <input class="cm-input" id="cmF_suggestions" value="${escapeHtml(q.suggestions||"")}" placeholder="Non-contrast CT, Contrast-enhanced CT, MRI Brain…">
      </div>
      <div class="cm-field">
        <label class="cm-label">Field Labels (comma-separated — one label per answer box)</label>
        <input class="cm-input" id="cmF_fieldLabels" value="${escapeHtml(q.fieldLabels||"")}" placeholder="Diagnosis, Modality…">
      </div>
    </div>

    <div class="cm-field" id="cmCorrectAnswerSection">
      <label class="cm-label">Correct Answer(s)</label>

      <!-- MC: simple letter selector -->
      <div id="cmCorrectMc" style="display:${qtype!=="freetext"?"block":"none"}">
        <div style="font-size:12px;color:var(--muted);margin-bottom:8px;">Select the correct option(s) — hold Ctrl/Cmd to select multiple</div>
        <div id="cmMcCorrectBtns" style="display:flex;flex-wrap:wrap;gap:8px;">
          ${["A","B","C","D","E","F"].map(code => {
            const isCorrect = (q.correctAnswer||"").split(",").map(a=>a.trim().toUpperCase()).includes(code);
            return `<button type="button" id="cmCorrectBtn_${code}" onclick="cmToggleCorrectBtn('${code}')"
              style="padding:8px 18px;border-radius:8px;border:2px solid ${isCorrect?"var(--accent)":"var(--border)"};
              background:${isCorrect?"rgba(92,45,126,0.12)":"var(--surface2)"};
              color:${isCorrect?"var(--accent)":"var(--text)"};
              font-weight:${isCorrect?"700":"400"};
              font-family:'DM Sans',sans-serif;font-size:14px;cursor:pointer;transition:all 0.15s;">
              ${code}${isCorrect?" ✓":""}
            </button>`;
          }).join("")}
        </div>
        <input type="hidden" id="cmF_correct" value="${escapeHtml(q.correctAnswer||"")}">
      </div>

      <!-- Freetext: dynamic list of correct answers -->
      <div id="cmCorrectFt" style="display:${qtype==="freetext"?"block":"none"}">
        <div style="font-size:12px;color:var(--muted);margin-bottom:10px;">
          Add one correct answer per box — each gets its own input field in the course.
          <br>The suggestions list above is what appears in the dropdown for users to select from.
        </div>
        <div id="cmFtAnswerList"></div>
        <button type="button" onclick="cmAddFtAnswer()" style="margin-top:6px;padding:7px 16px;border-radius:8px;border:1px dashed var(--border);background:none;color:var(--accent);font-size:13px;font-family:'DM Sans',sans-serif;font-weight:600;cursor:pointer;width:100%;">+ Add another answer</button>
      </div>
    </div>

    <div class="cm-field">
      <label class="cm-label">Explanation (shown after the user answers)</label>
      <textarea class="cm-textarea" id="cmF_explanation" placeholder="Explain why this is the correct answer…">${escapeHtml(q.explanation||"")}</textarea>
    </div>

    <div class="cm-field" style="margin-top:8px;">
      <label class="cm-label" style="display:flex;align-items:center;justify-content:space-between;">
        <span>Sub-questions <span style="font-weight:400;color:var(--muted);">(appear after this question is answered)</span></span>
        <button type="button" onclick="cmAddSubQuestion()" style="padding:5px 12px;border-radius:8px;border:1px dashed var(--border);background:none;color:var(--accent);font-size:12px;font-family:'DM Sans',sans-serif;font-weight:600;cursor:pointer;">+ Add sub-question</button>
      </label>
      <div id="cmSubQuestionList" style="margin-top:8px;display:flex;flex-direction:column;gap:8px;"></div>
    </div>`;
}

// ---- MC correct answer toggle ----
function cmToggleCorrectBtn(code) {
  const btn     = document.getElementById("cmCorrectBtn_" + code);
  const hidden  = document.getElementById("cmF_correct");
  if (!btn || !hidden) return;

  let current = hidden.value.split(",").map(a => a.trim().toUpperCase()).filter(a => a);
  const idx   = current.indexOf(code);

  if (idx > -1) {
    current.splice(idx, 1);
    btn.style.border     = "2px solid var(--border)";
    btn.style.background = "var(--surface2)";
    btn.style.color      = "var(--text)";
    btn.style.fontWeight = "400";
    btn.innerText        = code;
  } else {
    current.push(code);
    btn.style.border     = "2px solid var(--accent)";
    btn.style.background = "rgba(92,45,126,0.12)";
    btn.style.color      = "var(--accent)";
    btn.style.fontWeight = "700";
    btn.innerText        = code + " ✓";
  }
  hidden.value = current.join(",");
}

// ---- Freetext: build answer rows ----
function cmBuildFtAnswerList(correctAnswer) {
  const list = document.getElementById("cmFtAnswerList");
  if (!list) return;
  list.innerHTML = "";
  const answers = correctAnswer
    ? correctAnswer.split(",").map(a => a.trim()).filter(a => a)
    : [""];
  answers.forEach(a => cmAddFtAnswer(a));
}

function cmAddFtAnswer(value) {
  const list = document.getElementById("cmFtAnswerList");
  if (!list) return;
  const row = document.createElement("div");
  row.className = "cm-option-row";
  row.style.marginBottom = "8px";
  const idx = list.children.length + 1;
  row.innerHTML = `
    <span style="font-size:12px;font-weight:700;color:var(--muted);font-family:'JetBrains Mono',monospace;min-width:20px;">${idx}</span>
    <input class="cm-input cm-ft-answer" value="${escapeHtml(value||"")}" placeholder="e.g. CT Chest" style="flex:1;">
    <button type="button" onclick="this.parentElement.remove();cmRenumberFtAnswers();" style="padding:5px 10px;border-radius:7px;border:1px solid var(--danger);background:none;color:var(--danger);cursor:pointer;font-size:13px;">✕</button>`;
  list.appendChild(row);
}

function cmRenumberFtAnswers() {
  const list = document.getElementById("cmFtAnswerList");
  if (!list) return;
  Array.from(list.children).forEach((row, i) => {
    const num = row.querySelector("span");
    if (num) num.innerText = i + 1;
  });
}

// ---- Get correct answer value from form ----
function cmGetCorrectAnswer() {
  const qtype = document.getElementById("cmF_qtype").value;
  if (qtype === "freetext") {
    const inputs = document.querySelectorAll(".cm-ft-answer");
    return Array.from(inputs).map(i => i.value.trim()).filter(v => v).join(",");
  } else {
    const hidden = document.getElementById("cmF_correct");
    return hidden ? hidden.value : "";
  }
}

function cmToggleFreetextFields() {
  const isFt = document.getElementById("cmF_qtype").value === "freetext";
  document.getElementById("cmFtSection").style.display   = isFt ? "block" : "none";
  document.getElementById("cmMcSection").style.display   = isFt ? "none"  : "block";
  document.getElementById("cmCorrectMc").style.display   = isFt ? "none"  : "block";
  document.getElementById("cmCorrectFt").style.display   = isFt ? "block" : "none";
  if (isFt) {
    // Build the answer list with current values if switching to freetext
    const existing = document.getElementById("cmF_correct");
    cmBuildFtAnswerList(existing ? existing.value : "");
  }
}

function cmToggleImageFields() {
  const itype = document.getElementById("cmF_itype").value;
  document.getElementById("cmImageSection").style.display = itype !== "none" ? "block" : "none";
  const uploadArea = document.getElementById("cmUploadArea");
  if (uploadArea) uploadArea.style.display = itype === "image" ? "block" : "none";
  const lbl = document.querySelector("#cmImageSection .cm-label");
  if (lbl) lbl.innerText = itype === "dicom" ? "EBR Viewer URL (paste your platform link)" : "Image URL or upload from laptop";
  const inp = document.getElementById("cmF_imageUrl");
  if (inp) inp.placeholder = itype === "dicom" ? "https://www.myebr.org/viewer/case123" : "https://…";
}

function cmHandleFileUpload(input) {
  const file = input.files[0];
  if (!file) return;

  const preview  = document.getElementById("cmUploadPreview");
  const urlInput = document.getElementById("cmF_imageUrl");
  const b64Input = document.getElementById("cmF_imageBase64");

  if (preview)  preview.style.display = "none";
  if (urlInput) { urlInput.value = "Processing image…"; urlInput.disabled = true; }

  const reader = new FileReader();
  reader.onload = (ev) => {
    const img = new Image();
    img.onload = () => {
      const MAX = 1200;
      let w = img.width, h = img.height;
      if (w > MAX) { h = Math.round(h * MAX / w); w = MAX; }
      const canvas = document.createElement("canvas");
      canvas.width = w; canvas.height = h;
      canvas.getContext("2d").drawImage(img, 0, 0, w, h);
      const b64 = canvas.toDataURL("image/jpeg", 0.85);

      // Store in hidden field — this is what gets saved
      if (b64Input) b64Input.value = b64;

      // Clear the URL field — image is uploaded, not from URL
      if (urlInput) { urlInput.value = ""; urlInput.disabled = false; urlInput.placeholder = "(uploaded image)"; }

      // Show preview
      if (preview) { preview.src = b64; preview.style.display = "block"; }

      cmMsg("✅ Image ready — click Save to store it");
    };
    img.onerror = () => {
      if (urlInput) { urlInput.value = ""; urlInput.disabled = false; }
      cmMsg("Could not read image file", true);
    };
    img.src = ev.target.result;
  };
  reader.onerror = () => {
    if (urlInput) { urlInput.value = ""; urlInput.disabled = false; }
    cmMsg("Could not read file", true);
  };
  reader.readAsDataURL(file);
}

// ---- Close modal ----
function cmCloseModal() {
  document.getElementById("cmModal").style.display = "none";
}

function cmMsg(txt, isError) {
  const el = document.getElementById("cmModalMsg");
  if (el) { el.innerText = txt; el.style.color = isError ? "var(--danger)" : "var(--accent)"; }
}

// ---- Save dispatcher ----
function cmSave() {
  if      (cmMode === "newCase")      cmSaveCase(false);
  else if (cmMode === "editCase")     cmSaveCase(true);
  else if (cmMode === "newQuestion")  cmSaveQuestion(false);
  else if (cmMode === "editQuestion") cmSaveQuestion(true);
}

// ---- Save Case ----
function cmSaveCase(isEdit) {
  const title    = document.getElementById("cmF_title").value.trim();
  const content  = document.getElementById("cmF_content").value.trim();
  const itype    = document.getElementById("cmF_itype") ? document.getElementById("cmF_itype").value : "none";
  const urlField = document.getElementById("cmF_imageUrl") ? document.getElementById("cmF_imageUrl").value.trim() : "";
  const b64Field = document.getElementById("cmF_imageBase64") ? document.getElementById("cmF_imageBase64").value : "";

  if (!title) { cmMsg("Please enter a title.", true); return; }

  // Use uploaded base64 if available, otherwise use typed URL
  let imageUrl = "";
  if (itype !== "none") {
    if (b64Field && b64Field.startsWith("data:")) {
      imageUrl = b64Field;  // uploaded image
    } else if (urlField && !urlField.startsWith("(")) {
      imageUrl = urlField;  // typed URL
    } else if (isEdit) {
      // Keep existing imageUrl if nothing new was provided
      imageUrl = cmCases[cmEditTarget.caseIdx].imageUrl || "";
    }
  }

  if (isEdit) {
    const c = cmCases[cmEditTarget.caseIdx];
    c.title     = title;
    c.content   = content;
    c.imageType = itype;
    c.imageUrl  = imageUrl;
  } else {
    cmCases.push({
      id:        cmNewId("case"),
      order:     cmCases.length + 1,
      title, content,
      imageType: itype,
      imageUrl,
      questions: []
    });
  }

  cmSaveToGitHub(() => {
    cmCloseModal();
    cmRenderCaseList();
    if (isEdit && cmActiveCaseIdx === cmEditTarget.caseIdx) {
      document.getElementById("cmQSectionTitle").innerText = "Questions — " + title;
    }
  });
}

// ---- Save Question ----
function cmSaveQuestion(isEdit) {
  const text        = document.getElementById("cmF_text").value.trim();
  const content     = document.getElementById("cmF_content").value.trim();
  const qtype       = document.getElementById("cmF_qtype").value;
  const correct     = cmGetCorrectAnswer();
  const explanation = document.getElementById("cmF_explanation").value.trim();
  const suggestions = document.getElementById("cmF_suggestions") ? document.getElementById("cmF_suggestions").value.trim() : "";
  const fieldLabels = document.getElementById("cmF_fieldLabels") ? document.getElementById("cmF_fieldLabels").value.trim() : "";
  const itype       = document.getElementById("cmF_itype").value;
  const urlField    = document.getElementById("cmF_imageUrl") ? document.getElementById("cmF_imageUrl").value.trim() : "";
  const b64Field    = document.getElementById("cmF_imageBase64") ? document.getElementById("cmF_imageBase64").value : "";

  if (!text)    { cmMsg("Please enter the question text.", true); return; }
  if (!correct) { cmMsg("Please enter the correct answer.", true); return; }

  // Resolve imageUrl — prefer uploaded base64, then typed URL, then keep existing
  let imageUrl = "";
  if (itype !== "none") {
    if (b64Field && b64Field.startsWith("data:")) {
      imageUrl = b64Field;
    } else if (urlField && !urlField.startsWith("(")) {
      imageUrl = urlField;
    } else if (isEdit) {
      imageUrl = cmCases[cmEditTarget.caseIdx].questions[cmEditTarget.questionIdx].imageUrl || "";
    }
  }

  const options = ["A","B","C","D","E","F"].map(code => ({
    code,
    label: (document.getElementById("cmF_opt"+code) ? document.getElementById("cmF_opt"+code).value.trim() : "")
  })).filter(o => o.label);

  const c = cmCases[cmEditTarget.caseIdx];

  if (isEdit) {
    const q = c.questions[cmEditTarget.questionIdx];
    Object.assign(q, { text, content, questionType: qtype, suggestions, fieldLabels, imageType: itype, imageUrl, options, correctAnswer: correct, explanation, subQuestions: JSON.parse(JSON.stringify(cmSubQuestions)) });
  } else {
    c.questions.push({
      id:            cmNewId("q"),
      order:         c.questions.length + 1,
      text, content,
      questionType:  qtype,
      suggestions,   fieldLabels,
      imageType:     itype,
      imageUrl,
      options,
      correctAnswer: correct,
      explanation,
      subQuestions:  JSON.parse(JSON.stringify(cmSubQuestions))
    });
  }

  cmSaveToGitHub(() => {
    cmCloseModal();
    cmSelectCase(cmEditTarget.caseIdx);
  });
}

// ---- Delete Case ----
function cmDeleteCase(idx) {
  const c = cmCases[idx];
  if (!confirm("Delete case \"" + (c.title||"Case "+(idx+1)) + "\" and ALL its questions?\n\nThis cannot be undone.")) return;
  cmCases.splice(idx, 1);
  cmCases.forEach((c, i) => c.order = i + 1);
  if (cmActiveCaseIdx === idx) {
    cmActiveCaseIdx = -1;
    document.getElementById("cmQuestionSection").style.display = "none";
  } else if (cmActiveCaseIdx > idx) {
    cmActiveCaseIdx--;
  }
  cmSaveToGitHub(() => cmRenderCaseList());
}

// ---- Delete Question ----
function cmDeleteQuestion(qi) {
  const q = cmCases[cmActiveCaseIdx].questions[qi];
  if (!confirm("Delete question \"" + (q.text || "Q"+(qi+1)) + "\"?\n\nThis cannot be undone.")) return;
  cmCases[cmActiveCaseIdx].questions.splice(qi, 1);
  cmCases[cmActiveCaseIdx].questions.forEach((q, i) => q.order = i + 1);
  cmSaveToGitHub(() => cmSelectCase(cmActiveCaseIdx));
}

// Auto-load when tab opened
const _origSwitchAdminTab = switchAdminTab;
switchAdminTab = function(tab) {
  _origSwitchAdminTab(tab);
  if (tab === "content" && cmCases.length === 0) cmRefresh();
};

// =======================
// SUB-QUESTION MANAGEMENT (admin panel)
// =======================

// In-memory store for sub-questions being edited
let cmSubQuestions = [];

function cmBuildSubQuestionList(subQuestions) {
  cmSubQuestions = JSON.parse(JSON.stringify(subQuestions || [])); // deep copy
  cmRenderSubQuestionList();
}

function cmRenderSubQuestionList() {
  const list = document.getElementById("cmSubQuestionList");
  if (!list) return;
  list.innerHTML = "";

  if (cmSubQuestions.length === 0) {
    list.innerHTML = "<p style='color:var(--muted);font-size:12px;padding:8px 0;'>No sub-questions yet.</p>";
    return;
  }

  cmSubQuestions.forEach((sq, idx) => {
    const row = document.createElement("div");
    row.style.cssText = "background:var(--surface2);border:1px solid var(--border);border-radius:10px;padding:12px 14px;";
    row.innerHTML = `
      <div style="display:flex;align-items:flex-start;gap:8px;">
        <span style="font-size:11px;font-weight:700;color:var(--muted);font-family:'JetBrains Mono',monospace;min-width:24px;margin-top:2px;">↳${idx+1}</span>
        <div style="flex:1;">
          <div style="font-size:14px;font-weight:500;color:var(--text);margin-bottom:6px;">${escapeHtml(sq.text)||"<em style='color:var(--muted)'>No text</em>"}</div>
          <div style="display:flex;gap:6px;flex-wrap:wrap;">
            <span style="font-size:11px;padding:2px 8px;border-radius:20px;background:var(--surface);border:1px solid var(--border);color:var(--muted);">${sq.questionType||"mc"}</span>
            ${sq.imageType&&sq.imageType!=="none"?`<span style="font-size:11px;padding:2px 8px;border-radius:20px;background:var(--surface);border:1px solid var(--border);color:var(--muted);">🖼 ${sq.imageType}</span>`:""}
            ${(sq.subQuestions||[]).length>0?`<span style="font-size:11px;padding:2px 8px;border-radius:20px;background:rgba(92,45,126,0.1);border:1px solid var(--accent);color:var(--accent);">↳ ${sq.subQuestions.length} sub-q</span>`:""}
          </div>
        </div>
        <div style="display:flex;gap:4px;flex-shrink:0;">
          <button type="button" onclick="cmEditSubQuestion(${idx})" class="cm-btn">✏️</button>
          <button type="button" onclick="cmMoveSubQuestion(${idx},-1)" class="cm-btn" ${idx===0?"disabled":""}>↑</button>
          <button type="button" onclick="cmMoveSubQuestion(${idx},1)" class="cm-btn" ${idx===cmSubQuestions.length-1?"disabled":""}>↓</button>
          <button type="button" onclick="cmDeleteSubQuestion(${idx})" class="cm-btn cm-btn-danger">🗑</button>
        </div>
      </div>`;
    list.appendChild(row);
  });
}

function cmAddSubQuestion() {
  // Open a sub-modal or inline form — we use a simple prompt-based approach
  // and open a nested edit form
  cmSubQuestions.push({
    id:            cmNewId("sq"),
    order:         cmSubQuestions.length + 1,
    text:          "",
    content:       "",
    questionType:  "mc",
    suggestions:   "",
    fieldLabels:   "",
    imageType:     "none",
    imageUrl:      "",
    options:       [],
    correctAnswer: "",
    explanation:   "",
    subQuestions:  []
  });
  cmEditSubQuestion(cmSubQuestions.length - 1);
}

function cmMoveSubQuestion(idx, dir) {
  const newIdx = idx + dir;
  if (newIdx < 0 || newIdx >= cmSubQuestions.length) return;
  [cmSubQuestions[idx], cmSubQuestions[newIdx]] = [cmSubQuestions[newIdx], cmSubQuestions[idx]];
  cmRenderSubQuestionList();
}

function cmDeleteSubQuestion(idx) {
  if (!confirm("Delete this sub-question and all its sub-questions?")) return;
  cmSubQuestions.splice(idx, 1);
  cmRenderSubQuestionList();
}

// Edit sub-question in a nested panel inside the modal
let cmEditingSubIdx = -1;
let cmSubSubQuestions = []; // for sub-sub-questions

function cmEditSubQuestion(idx) {
  cmEditingSubIdx = idx;
  const sq = cmSubQuestions[idx];

  // Replace modal body temporarily with sub-question form
  const modal = document.getElementById("cmModal");
  const title = document.getElementById("cmModalTitle");
  const body  = document.getElementById("cmModalBody");
  const saveBtn = document.getElementById("cmModalSave");

  title.innerText = "↳ Edit Sub-question " + (idx + 1);
  body.innerHTML = cmSubQuestionForm(sq);
  saveBtn.onclick = cmSaveSubQuestion;

  cmSubSubQuestions = JSON.parse(JSON.stringify(sq.subQuestions || []));
  cmRenderSubSubQuestionList();

  // Add back button
  const backBtn = document.createElement("button");
  backBtn.className = "btn btn-secondary";
  backBtn.innerText = "← Back to Question";
  backBtn.style.cssText = "margin-right:auto;";
  backBtn.onclick = cmBackFromSubQuestion;
  const btnRow = saveBtn.parentElement;
  btnRow.insertBefore(backBtn, btnRow.firstChild);
}

function cmSubQuestionForm(sq) {
  const opts = ["A","B","C","D","E","F"];
  const existing = sq.options || [];
  const optRows = opts.map((code, i) => {
    const val = existing[i] ? existing[i].label : "";
    return `<div class="cm-option-row">
      <span class="cm-option-code">${code}</span>
      <input class="cm-input" id="cmSQ_opt${code}" value="${escapeHtml(val)}" placeholder="Option ${code}…">
    </div>`;
  }).join("");

  const qtype = sq.questionType || "mc";
  const itype = sq.imageType    || "none";
  const isBase64 = sq.imageUrl && sq.imageUrl.startsWith("data:");

  return `
    <div style="background:rgba(92,45,126,0.05);border:1px solid var(--accent);border-radius:10px;padding:12px;margin-bottom:14px;font-size:12px;color:var(--accent);font-weight:600;">
      ↳ Sub-question — appears after the parent question is answered
    </div>
    <div class="cm-field">
      <label class="cm-label">Question Text</label>
      <textarea class="cm-textarea" id="cmSQ_text" placeholder="Follow-up question…">${escapeHtml(sq.text||"")}</textarea>
    </div>
    <div class="cm-field">
      <label class="cm-label">Clinical Content (optional)</label>
      <textarea class="cm-textarea" id="cmSQ_content" style="min-height:50px;">${escapeHtml(sq.content||"")}</textarea>
    </div>
    <div class="cm-grid2">
      <div class="cm-field">
        <label class="cm-label">Question Type</label>
        <select class="cm-select" id="cmSQ_qtype" onchange="cmToggleSQFreetextFields()">
          <option value="mc"      ${qtype==="mc"?"selected":""}>Multiple Choice</option>
          <option value="freetext"${qtype==="freetext"?"selected":""}>Free Text</option>
        </select>
      </div>
      <div class="cm-field">
        <label class="cm-label">Image</label>
        <select class="cm-select" id="cmSQ_itype" onchange="cmToggleSQImageFields()">
          <option value="none"  ${itype==="none" ?"selected":""}>Inherit from parent</option>
          <option value="dicom" ${itype==="dicom"?"selected":""}>DICOM (EBR viewer)</option>
          <option value="image" ${itype==="image"?"selected":""}>Static image</option>
        </select>
      </div>
    </div>
    <input type="hidden" id="cmSQ_imageBase64" value="${isBase64?escapeHtml(sq.imageUrl):""}">
    <div id="cmSQImageSection" style="display:${itype!=="none"?"block":"none"}">
      <div class="cm-field">
        <label class="cm-label">${itype==="dicom"?"EBR Viewer URL":"Image URL or upload"}</label>
        <div id="cmSQUploadArea" style="display:${itype==="image"?"block":"none"}">
          <div onclick="document.getElementById('cmSQFileInput').click()" style="border:2px dashed var(--border);border-radius:10px;padding:12px;text-align:center;cursor:pointer;color:var(--muted);font-size:12px;margin-bottom:6px;">
            📁 Upload from laptop
          </div>
          <input type="file" id="cmSQFileInput" accept="image/*" style="display:none" onchange="cmHandleSQFileUpload(this)">
          <img id="cmSQPreview" src="${isBase64?escapeHtml(sq.imageUrl):""}" style="display:${isBase64?"block":"none"};width:100%;max-height:120px;object-fit:contain;border-radius:8px;border:1px solid var(--border);margin-bottom:6px;">
        </div>
        <input class="cm-input" id="cmSQ_imageUrl" value="${escapeHtml(!isBase64?(sq.imageUrl||""):"")}" placeholder="${itype==="dicom"?"https://www.myebr.org/viewer/...":"https://…"}">
      </div>
    </div>
    <div id="cmSQMcSection" style="display:${qtype==="freetext"?"none":"block"}">
      <div class="cm-field"><label class="cm-label">Answer Options</label>${optRows}</div>
    </div>
    <div id="cmSQFtSection" style="display:${qtype==="freetext"?"block":"none"}">
      <div class="cm-field">
        <label class="cm-label">Suggestions (comma-separated)</label>
        <input class="cm-input" id="cmSQ_suggestions" value="${escapeHtml(sq.suggestions||"")}" placeholder="Option 1, Option 2…">
      </div>
    </div>
    <div class="cm-field">
      <label class="cm-label">Correct Answer</label>
      <input class="cm-input" id="cmSQ_correct" value="${escapeHtml(sq.correctAnswer||"")}" placeholder="A or A,C or exact text">
    </div>
    <div class="cm-field">
      <label class="cm-label">Explanation</label>
      <textarea class="cm-textarea" id="cmSQ_explanation" style="min-height:60px;">${escapeHtml(sq.explanation||"")}</textarea>
    </div>
    <div class="cm-field">
      <label class="cm-label" style="display:flex;align-items:center;justify-content:space-between;">
        <span>Sub-sub-questions</span>
        <button type="button" onclick="cmAddSubSubQuestion()" style="padding:4px 10px;border-radius:8px;border:1px dashed var(--border);background:none;color:var(--accent);font-size:11px;font-family:'DM Sans',sans-serif;font-weight:600;cursor:pointer;">+ Add</button>
      </label>
      <div id="cmSubSubQuestionList" style="margin-top:6px;display:flex;flex-direction:column;gap:6px;"></div>
    </div>`;
}

function cmToggleSQFreetextFields() {
  const isFt = document.getElementById("cmSQ_qtype").value === "freetext";
  document.getElementById("cmSQFtSection").style.display = isFt ? "block" : "none";
  document.getElementById("cmSQMcSection").style.display = isFt ? "none"  : "block";
}

function cmToggleSQImageFields() {
  const itype = document.getElementById("cmSQ_itype").value;
  document.getElementById("cmSQImageSection").style.display  = itype !== "none" ? "block" : "none";
  const up = document.getElementById("cmSQUploadArea");
  if (up) up.style.display = itype === "image" ? "block" : "none";
}

function cmHandleSQFileUpload(input) {
  const file = input.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    const img = new Image();
    img.onload = () => {
      const MAX = 1200;
      let w = img.width, h = img.height;
      if (w > MAX) { h = Math.round(h * MAX / w); w = MAX; }
      const canvas = document.createElement("canvas");
      canvas.width = w; canvas.height = h;
      canvas.getContext("2d").drawImage(img, 0, 0, w, h);
      const b64 = canvas.toDataURL("image/jpeg", 0.85);
      const b64Input = document.getElementById("cmSQ_imageBase64");
      if (b64Input) b64Input.value = b64;
      const urlInput = document.getElementById("cmSQ_imageUrl");
      if (urlInput) { urlInput.value = ""; urlInput.placeholder = "(uploaded image)"; }
      const preview = document.getElementById("cmSQPreview");
      if (preview) { preview.src = b64; preview.style.display = "block"; }
    };
    img.src = ev.target.result;
  };
  reader.readAsDataURL(file);
}

// Sub-sub-questions (just text + type — same pattern but simpler)
function cmAddSubSubQuestion() {
  cmSubSubQuestions.push({ id: cmNewId("ssq"), text: "", questionType: "mc", options: [], correctAnswer: "", explanation: "", imageType: "none", imageUrl: "", subQuestions: [] });
  cmRenderSubSubQuestionList();
}

function cmRenderSubSubQuestionList() {
  const list = document.getElementById("cmSubSubQuestionList");
  if (!list) return;
  list.innerHTML = "";
  if (cmSubSubQuestions.length === 0) {
    list.innerHTML = "<p style='color:var(--muted);font-size:11px;'>No sub-sub-questions.</p>";
    return;
  }
  cmSubSubQuestions.forEach((ssq, idx) => {
    const row = document.createElement("div");
    row.style.cssText = "background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:10px 12px;display:flex;gap:8px;align-items:center;";
    row.innerHTML = `
      <span style="font-size:11px;color:var(--muted);font-family:'JetBrains Mono',monospace;">↳↳${idx+1}</span>
      <input class="cm-input" style="flex:1;" value="${escapeHtml(ssq.text)}" placeholder="Sub-sub-question text…" oninput="cmSubSubQuestions[${idx}].text=this.value">
      <select class="cm-select" style="width:auto;" onchange="cmSubSubQuestions[${idx}].questionType=this.value">
        <option value="mc" ${ssq.questionType==="mc"?"selected":""}>MC</option>
        <option value="freetext" ${ssq.questionType==="freetext"?"selected":""}>Freetext</option>
      </select>
      <input class="cm-input" style="width:80px;" value="${escapeHtml(ssq.correctAnswer)}" placeholder="Answer" oninput="cmSubSubQuestions[${idx}].correctAnswer=this.value">
      <button type="button" class="cm-btn cm-btn-danger" onclick="cmSubSubQuestions.splice(${idx},1);cmRenderSubSubQuestionList()">🗑</button>`;
    list.appendChild(row);
  });
}

function cmSaveSubQuestion() {
  const text        = document.getElementById("cmSQ_text").value.trim();
  const content     = document.getElementById("cmSQ_content").value.trim();
  const qtype       = document.getElementById("cmSQ_qtype").value;
  const itype       = document.getElementById("cmSQ_itype").value;
  const correct     = document.getElementById("cmSQ_correct").value.trim();
  const explanation = document.getElementById("cmSQ_explanation").value.trim();
  const suggestions = document.getElementById("cmSQ_suggestions") ? document.getElementById("cmSQ_suggestions").value.trim() : "";
  const urlField    = document.getElementById("cmSQ_imageUrl") ? document.getElementById("cmSQ_imageUrl").value.trim() : "";
  const b64Field    = document.getElementById("cmSQ_imageBase64") ? document.getElementById("cmSQ_imageBase64").value : "";

  if (!text) { cmMsg("Please enter the question text.", true); return; }

  let imageUrl = "";
  if (itype !== "none") {
    if (b64Field && b64Field.startsWith("data:")) imageUrl = b64Field;
    else if (urlField && !urlField.startsWith("("))  imageUrl = urlField;
    else imageUrl = cmSubQuestions[cmEditingSubIdx].imageUrl || "";
  }

  const options = ["A","B","C","D","E","F"].map(code => ({
    code,
    label: document.getElementById("cmSQ_opt"+code) ? document.getElementById("cmSQ_opt"+code).value.trim() : ""
  })).filter(o => o.label);

  cmSubQuestions[cmEditingSubIdx] = {
    ...cmSubQuestions[cmEditingSubIdx],
    text, content, questionType: qtype, suggestions,
    imageType: itype, imageUrl, options, correctAnswer: correct, explanation,
    subQuestions: JSON.parse(JSON.stringify(cmSubSubQuestions))
  };

  cmBackFromSubQuestion();
}

function cmBackFromSubQuestion() {
  cmEditingSubIdx = -1;
  // Restore parent question form
  const q = cmMode === "editQuestion"
    ? cmCases[cmEditTarget.caseIdx].questions[cmEditTarget.questionIdx]
    : {};
  document.getElementById("cmModalTitle").innerText = cmMode === "editQuestion" ? "Edit Question" : "New Question";
  document.getElementById("cmModalBody").innerHTML = cmQuestionForm(q);
  document.getElementById("cmModalMsg").innerText = "";
  document.getElementById("cmModalSave").onclick = cmSave;
  // Remove back button if present
  const backBtn = document.querySelector("#cmModal .btn-secondary:first-child");
  if (backBtn && backBtn.innerText.includes("Back")) backBtn.remove();

  if (q.questionType === "freetext") cmBuildFtAnswerList(q.correctAnswer || "");
  cmRenderSubQuestionList();
}

