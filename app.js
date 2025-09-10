/** ======================
 * Job-Ting – app.js
 * Endless swipe + anytime report
 * API + fallback
 * =====================*/

/* ---------- Constants & State ---------- */
let profile = null;

const STORAGE_KEYS = {
  PROFILE: "jobting_profile",
  LIKES: "jobting_likes",
  PASSES: "jobting_passes",
  USER: "jobting_user",
  USERS: "jobting_users",
};

// UI refs
const $ = (id) => document.getElementById(id);
const loginSection = $("loginSection");
const welcomeSection = $("welcomeSection");
const profileSection = $("profileSection");
const progressSection = $("progressSection");
const deckSection = $("deckSection");
const resultSection = $("resultSection");
const cardStack = $("cardStack");
const emptyMsg = $("emptyMsg");
const stepNowEl = $("stepNow");
const progressFill = $("progressFill");
const confidenceBadge = $("confidenceBadge");
const profileSummary = $("profileSummary");
const topMatches = $("topMatches");
const favoritesList = $("favoritesList");
const actionsList = $("actionsList");

// Profile inputs
const pfName = $("pfName");
const pfMajor = $("pfMajor");
const pfSkills = $("pfSkills");
const pfLocation = $("pfLocation");
const pfWorkType = $("pfWorkType");
const pfLevel = $("pfLevel");

// Buttons
document.addEventListener("DOMContentLoaded", () => {
  $("mainTitle").onclick = backToWelcome;
  $("loginBtn").onclick = handleLogin;
  $("signupBtn").onclick = handleSignup;
  $("guestBtn").onclick = handleGuest;
  $("loginFromWelcome").onclick = showLoginScreen;
  $("startBtn").onclick = showProfileSection;
  $("saveProfile").onclick = onSaveProfile;
  $("loadProfile").onclick = onLoadProfile;
  $("clearProfile").onclick = onClearProfile;

  $("likeBtn").onclick = () => onSwipe(true);
  $("passBtn").onclick = () => onSwipe(false);
  $("reportBtn").onclick = showReport;
  $("backToSwipe").onclick = backToSwipe;
  $("backToWelcome").onclick = backToWelcome;
  $("copyReport").onclick = copyReportText;
  $("resetDeck").onclick = resetDeck;
});

// Core state
let deck = [];
let cursor = 0;
let loading = false;
let seen = new Set();

let likes = new Set();
let passes = new Set();

const CONFIDENCE_TARGET = 20;

/* ---------- User Data Helpers ---------- */
function getUserKey() {
  const currentUser = JSON.parse(
    localStorage.getItem(STORAGE_KEYS.USER) || "{}"
  );
  return currentUser.email || "guest";
}

function loadUserData() {
  const userKey = getUserKey();
  const userLikes = JSON.parse(
    localStorage.getItem(`${STORAGE_KEYS.LIKES}_${userKey}`) || "[]"
  );
  const userPasses = JSON.parse(
    localStorage.getItem(`${STORAGE_KEYS.PASSES}_${userKey}`) || "[]"
  );

  likes = new Set(userLikes);
  passes = new Set(userPasses);
}

function saveUserData() {
  const userKey = getUserKey();
  localStorage.setItem(
    `${STORAGE_KEYS.LIKES}_${userKey}`,
    JSON.stringify([...likes])
  );
  localStorage.setItem(
    `${STORAGE_KEYS.PASSES}_${userKey}`,
    JSON.stringify([...passes])
  );
}

/* ---------- Helpers ---------- */
function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* ---------- Skill Tags (fallback only) ---------- */
const SKILL_FALLBACK = [
  "React",
  "JavaScript",
  "TypeScript",
  "HTML",
  "CSS",
  "Figma",
  "Prototyping",
  "User Research",
  "Python",
  "SQL",
  "Data Viz",
  "Analytics",
  "API",
  "Localization",
  "Glossary",
  "QA",
  "Marketing",
  "SEO",
  "Content",
  "Spec",
  "Dashboard",
  "Git",
];

async function initSkillTags() {
  pfSkills.innerHTML = "";
  SKILL_FALLBACK.forEach((skill) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "skill-tag";
    btn.textContent = skill;
    btn.onclick = () => btn.classList.toggle("selected");
    pfSkills.appendChild(btn);
  });
}

/* ---------- Jobs loader (API + fallback) ---------- */
async function fetchNextBatch() {
  try {
    const res = await fetch(
      "/api/jobs?companies=airbnb,doordash,spotify&source=greenhouse",
      { cache: "no-store" }
    );
    if (res.ok) {
      const jobs = await res.json();
      console.log("API 성공:", jobs.length, "개 공고 로드");

      // Airbnb만 나오면 Fallback 데이터 사용
      const companies = [...new Set(jobs.map((job) => job.company))];
      if (companies.length <= 1) {
        console.log("다양한 회사가 없어서 Fallback 데이터 사용");
        return shuffle(JOBS_FALLBACK).slice(0, 30);
      }

      return shuffle(jobs).slice(0, 30);
    }
  } catch (err) {
    console.error("API fetch failed", err);
  }

  // API 실패 시 Fallback 데이터 사용
  console.log(
    "API 실패, Fallback 데이터 사용:",
    JOBS_FALLBACK.length,
    "개 공고"
  );
  return shuffle(JOBS_FALLBACK).slice(0, 30);
}

/* ---------- Login Functions ---------- */
function handleLogin() {
  const email = $("loginEmail").value.trim();
  const password = $("loginPassword").value.trim();

  if (!email || !password) {
    alert("Please enter both email and password.");
    return;
  }

  const users = JSON.parse(localStorage.getItem(STORAGE_KEYS.USERS) || "{}");
  if (users[email] && users[email].password === password) {
    // 로그인 성공
    localStorage.setItem(
      STORAGE_KEYS.USER,
      JSON.stringify({ email, name: users[email].name })
    );
    showWelcomeScreen();
  } else {
    alert("Invalid email or password.");
  }
}

function handleSignup() {
  const email = $("loginEmail").value.trim();
  const password = $("loginPassword").value.trim();

  if (!email || !password) {
    alert("Please enter both email and password.");
    return;
  }

  const users = JSON.parse(localStorage.getItem(STORAGE_KEYS.USERS) || "{}");
  if (users[email]) {
    alert("Email already exists. Please sign in instead.");
    return;
  }

  // 새 사용자 생성
  users[email] = {
    password: password,
    name: email.split("@")[0], // 이메일에서 이름 추출
    createdAt: new Date().toISOString(),
  };

  localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
  localStorage.setItem(
    STORAGE_KEYS.USER,
    JSON.stringify({ email, name: users[email].name })
  );

  alert("Account created successfully!");
  showWelcomeScreen();
}

function handleGuest() {
  localStorage.removeItem(STORAGE_KEYS.USER);
  showWelcomeScreen();
}

function showWelcomeScreen() {
  loginSection.classList.add("hidden");
  welcomeSection.classList.remove("hidden");
}

function showLoginScreen() {
  welcomeSection.classList.add("hidden");
  loginSection.classList.remove("hidden");
}

function backToWelcome() {
  // 모든 섹션 숨기기
  loginSection.classList.add("hidden");
  profileSection.classList.add("hidden");
  progressSection.classList.add("hidden");
  deckSection.classList.add("hidden");
  resultSection.classList.add("hidden");
  // 웰컴 화면 표시
  welcomeSection.classList.remove("hidden");
}

/* ---------- Welcome Screen ---------- */
function showProfileSection() {
  welcomeSection.classList.add("hidden");
  profileSection.classList.remove("hidden");
}

/* ---------- Profile Handlers ---------- */
function onSaveProfile() {
  const currentUser = JSON.parse(
    localStorage.getItem(STORAGE_KEYS.USER) || "{}"
  );
  const userKey = currentUser.email || "guest";

  profile = {
    name: pfName.value.trim(),
    major: pfMajor.value.trim(),
    skills: [...pfSkills.querySelectorAll(".skill-tag.selected")].map(
      (b) => b.textContent
    ),
    location: pfLocation.value.trim(),
    workType: pfWorkType.value,
    level: pfLevel.value,
  };

  // 사용자별 프로필 저장
  const userProfiles = JSON.parse(
    localStorage.getItem(STORAGE_KEYS.PROFILE) || "{}"
  );
  userProfiles[userKey] = profile;
  localStorage.setItem(STORAGE_KEYS.PROFILE, JSON.stringify(userProfiles));

  profileSection.classList.add("hidden");
  progressSection.classList.remove("hidden");
  deckSection.classList.remove("hidden");
  startDeck();
}

function onLoadProfile() {
  const currentUser = JSON.parse(
    localStorage.getItem(STORAGE_KEYS.USER) || "{}"
  );
  const userKey = currentUser.email || "guest";

  const userProfiles = JSON.parse(
    localStorage.getItem(STORAGE_KEYS.PROFILE) || "{}"
  );
  const userProfile = userProfiles[userKey];

  if (!userProfile) return alert("No saved profile found.");

  profile = userProfile;
  pfName.value = profile.name || "";
  pfMajor.value = profile.major || "";
  pfLocation.value = profile.location || "";
  pfWorkType.value = profile.workType || "";
  pfLevel.value = profile.level || "any";
  const set = new Set(profile.skills || []);
  pfSkills.querySelectorAll(".skill-tag").forEach((b) => {
    b.classList.toggle("selected", set.has(b.textContent));
  });
  alert("Profile loaded.");
}

function onClearProfile() {
  localStorage.removeItem(STORAGE_KEYS.PROFILE);
  pfName.value = pfMajor.value = pfLocation.value = "";
  pfWorkType.value = "";
  pfLevel.value = "any";
  pfSkills
    .querySelectorAll(".skill-tag")
    .forEach((b) => b.classList.remove("selected"));
  alert("Profile cleared.");
}

/* ---------- Deck & Swipe ---------- */
async function startDeck() {
  deck = [];
  cursor = 0;
  seen = new Set();
  loadUserData(); // 사용자별 데이터 로드
  stepNowEl.textContent = likes.size + passes.size;
  updateProgressBar();
  await loadMore();
  renderTopCard();
}

async function loadMore() {
  if (loading) return;
  loading = true;
  emptyMsg.classList.remove("hidden");
  const batch = await fetchNextBatch();
  for (const job of batch) {
    if (!job || !job.id) continue;
    if (seen.has(job.id)) continue;
    seen.add(job.id);
    deck.push(job);
  }
  emptyMsg.classList.add("hidden");
  loading = false;
}

function renderTopCard() {
  cardStack.innerHTML = "";
  const job = deck[cursor];
  if (!job) {
    emptyMsg.classList.remove("hidden");
    if (!loading) loadMore();
    return;
  }
  const el = createJobCard(job);
  cardStack.appendChild(el);
}

function createJobCard(job) {
  const el = document.createElement("div");
  el.className = "job-card";
  el.innerHTML = `
    <div>
      <div class="flex items-start gap-4 mb-3">
        ${
          job.logo
            ? `<img src="${job.logo}" alt="${job.company}" class="w-12 h-12 rounded-lg object-cover flex-shrink-0" onerror="this.style.display='none'">`
            : ""
        }
        <div class="flex-1">
          <h3 class="text-lg font-bold">${job.title || "Role"}</h3>
          <p class="text-sm text-slate-600"><span class="company-badge">${
            job.company || "Company"
          }</span> · ${job.location || "—"} · ${job.workType || "Any"} · ${
    job.level || ""
  }</p>
        </div>
      </div>
      ${
        job.salary
          ? `<p class="text-lg font-semibold text-green-600 mt-2">${job.salary}</p>`
          : ""
      }
      <div class="flex flex-wrap gap-2 mt-3">
        ${(job.skills || [])
          .map((s) => `<span class="skill-tag">${s}</span>`)
          .join("")}
      </div>
    </div>
    <div class="flex items-center justify-between text-sm text-slate-500 mt-4">
      <a class="underline hover:text-blue-600" href="${
        job.applyUrl || "#"
      }" target="_blank">Apply Now</a>
      <span class="text-xs">ID: ${job.id}</span>
    </div>
    <div class="swipe-badge swipe-like">LIKE</div>
    <div class="swipe-badge swipe-pass">PASS</div>
  `;
  enableDrag(el, (dir) => {
    if (dir === "right") onSwipe(true);
    else if (dir === "left") onSwipe(false);
  });
  return el;
}

/* ---------- Swipe Handlers ---------- */
function onSwipe(isLike) {
  const job = deck[cursor];
  if (!job) return;

  // 현재 카드 요소 가져오기
  const currentCard = cardStack.querySelector(".job-card");
  if (currentCard) {
    // 애니메이션 효과 추가
    currentCard.style.transition = "transform 0.3s ease-out";
    if (isLike) {
      currentCard.style.transform = "translateX(100vw) rotate(15deg)";
      currentCard.classList.add("swipe-right");
    } else {
      currentCard.style.transform = "translateX(-100vw) rotate(-15deg)";
      currentCard.classList.add("swipe-left");
    }
  }

  if (isLike) {
    likes.add(job.id);
  } else {
    passes.add(job.id);
  }

  saveUserData(); // 사용자별 데이터 저장

  cursor++;
  stepNowEl.textContent = likes.size + passes.size;
  updateProgressBar();

  if (cursor >= deck.length - 5) {
    loadMore();
  }

  // 애니메이션 완료 후 다음 카드 렌더링
  setTimeout(() => {
    renderTopCard();
  }, 300);
}

/* ---------- Drag & Drop ---------- */
function enableDrag(element, callback) {
  let startX = 0;
  let startY = 0;
  let isDragging = false;

  // 마우스 이벤트
  element.addEventListener("mousedown", (e) => {
    e.preventDefault();
    startX = e.clientX;
    startY = e.clientY;
    isDragging = true;
    element.style.transition = "none";
    element.style.cursor = "grabbing";
  });

  document.addEventListener("mousemove", (e) => {
    if (!isDragging) return;

    const deltaX = e.clientX - startX;
    const deltaY = e.clientY - startY;

    element.style.transform = `translate(${deltaX}px, ${deltaY}px) rotate(${
      deltaX * 0.1
    }deg)`;

    if (Math.abs(deltaX) > 100) {
      element.classList.add(deltaX > 0 ? "swipe-right" : "swipe-left");
    } else {
      element.classList.remove("swipe-right", "swipe-left");
    }
  });

  document.addEventListener("mouseup", (e) => {
    if (!isDragging) return;
    isDragging = false;
    element.style.cursor = "grab";

    const deltaX = e.clientX - startX;

    if (Math.abs(deltaX) > 100) {
      element.style.transition = "transform 0.3s ease-out";
      element.style.transform = `translate(${
        deltaX > 0 ? "100vw" : "-100vw"
      }, 0) rotate(${deltaX * 0.1}deg)`;

      setTimeout(() => {
        callback(deltaX > 0 ? "right" : "left");
      }, 300);
    } else {
      element.style.transition = "transform 0.3s ease-out";
      element.style.transform = "translate(0, 0) rotate(0deg)";
      element.classList.remove("swipe-right", "swipe-left");
    }
  });

  // 터치 이벤트 (모바일 지원)
  element.addEventListener("touchstart", (e) => {
    e.preventDefault();
    const touch = e.touches[0];
    startX = touch.clientX;
    startY = touch.clientY;
    isDragging = true;
    element.style.transition = "none";
  });

  document.addEventListener("touchmove", (e) => {
    if (!isDragging) return;
    e.preventDefault();

    const touch = e.touches[0];
    const deltaX = touch.clientX - startX;
    const deltaY = touch.clientY - startY;

    element.style.transform = `translate(${deltaX}px, ${deltaY}px) rotate(${
      deltaX * 0.1
    }deg)`;

    if (Math.abs(deltaX) > 100) {
      element.classList.add(deltaX > 0 ? "swipe-right" : "swipe-left");
    } else {
      element.classList.remove("swipe-right", "swipe-left");
    }
  });

  document.addEventListener("touchend", (e) => {
    if (!isDragging) return;
    isDragging = false;

    const touch = e.changedTouches[0];
    const deltaX = touch.clientX - startX;

    if (Math.abs(deltaX) > 100) {
      element.style.transition = "transform 0.3s ease-out";
      element.style.transform = `translate(${
        deltaX > 0 ? "100vw" : "-100vw"
      }, 0) rotate(${deltaX * 0.1}deg)`;

      setTimeout(() => {
        callback(deltaX > 0 ? "right" : "left");
      }, 300);
    } else {
      element.style.transition = "transform 0.3s ease-out";
      element.style.transform = "translate(0, 0) rotate(0deg)";
      element.classList.remove("swipe-right", "swipe-left");
    }
  });
}

/* ---------- Progress Bar ---------- */
function updateProgressBar() {
  const total = likes.size + passes.size;
  const percentage = Math.min((total / CONFIDENCE_TARGET) * 100, 100);
  progressFill.style.width = `${percentage}%`;
}

/* ---------- Report Functions ---------- */
function showReport() {
  const matches = computeMatch();
  const confidence = Math.min((likes.size / CONFIDENCE_TARGET) * 100, 100);

  confidenceBadge.textContent = `Confidence ${Math.round(confidence)}%`;

  // Profile Summary
  profileSummary.innerHTML = `
    <div class="grid md:grid-cols-2 gap-4 text-sm">
      <div><strong>Name:</strong> ${profile.name || "Not specified"}</div>
      <div><strong>Major:</strong> ${profile.major || "Not specified"}</div>
      <div><strong>Location:</strong> ${profile.location || "Any"}</div>
      <div><strong>Work Type:</strong> ${profile.workType || "Any"}</div>
      <div><strong>Level:</strong> ${profile.level || "Any"}</div>
      <div><strong>Skills:</strong> ${
        profile.skills?.join(", ") || "None selected"
      }</div>
    </div>
  `;

  // Top Matches
  topMatches.innerHTML = matches
    .slice(0, 5)
    .map(
      (job) => `
    <div class="p-4 border-2 border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-shadow mb-3">
      <div class="flex justify-between items-start">
        <div>
          <h4 class="font-medium text-lg">${job.title}</h4>
          <p class="text-sm text-slate-600 mt-1"><span class="company-badge">${
            job.company
          }</span> · ${job.location}</p>
          ${
            job.salary
              ? `<p class="text-base font-semibold text-green-600 mt-1">${job.salary}</p>`
              : ""
          }
          <div class="flex flex-wrap gap-1 mt-2">
            ${(job.skills || [])
              .slice(0, 3)
              .map(
                (s) =>
                  `<span class="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">${s}</span>`
              )
              .join("")}
          </div>
        </div>
        <span class="text-xs bg-green-100 text-green-800 px-3 py-2 rounded-full font-medium">
          ${Math.round(job.score * 100)}% match
        </span>
      </div>
    </div>
  `
    )
    .join("");

  // Favorites
  const favoriteJobs = [...likes]
    .map((id) => deck.find((job) => job.id === id))
    .filter(Boolean);
  favoritesList.innerHTML = favoriteJobs
    .map(
      (job) => `
    <li class="p-3 border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-shadow mb-2">
      <a href="${
        job.applyUrl
      }" target="_blank" class="block hover:text-blue-600 transition-colors">
        <div class="font-medium">${job.title}</div>
        <div class="text-sm text-gray-600">${job.company} · ${
        job.location
      }</div>
        ${
          job.salary
            ? `<div class="text-sm font-semibold text-green-600 mt-1">${job.salary}</div>`
            : ""
        }
      </a>
    </li>
  `
    )
    .join("");

  // Actions
  const actions = [];
  if (confidence < 20) {
    actions.push("Try swiping more jobs to improve match accuracy");
  }
  if (profile.skills?.length < 3) {
    actions.push("Add more skills to your profile for better matching");
  }
  if (favoriteJobs.length > 0) {
    actions.push(`Apply to your ${favoriteJobs.length} favorite jobs`);
  }
  actions.push("Share your profile with recruiters");

  actionsList.innerHTML = actions
    .map((action) => `<li>${action}</li>`)
    .join("");

  deckSection.classList.add("hidden");
  resultSection.classList.remove("hidden");
}

function backToSwipe() {
  resultSection.classList.add("hidden");
  deckSection.classList.remove("hidden");
}

function backToWelcome() {
  // 모든 섹션 숨기기
  profileSection.classList.add("hidden");
  progressSection.classList.add("hidden");
  deckSection.classList.add("hidden");
  resultSection.classList.add("hidden");
  // 시작화면 표시
  welcomeSection.classList.remove("hidden");
}

function resetDeck() {
  if (confirm("Reset all your swipes? This cannot be undone.")) {
    likes.clear();
    passes.clear();
    localStorage.removeItem(STORAGE_KEYS.LIKES);
    localStorage.removeItem(STORAGE_KEYS.PASSES);
    startDeck();
  }
}

function copyReportText() {
  const reportText = `
Job-Ting Match Report
====================

Profile: ${profile.name || "Not specified"}
Major: ${profile.major || "Not specified"}
Location: ${profile.location || "Any"}
Work Type: ${profile.workType || "Any"}
Level: ${profile.level || "Any"}
Skills: ${profile.skills?.join(", ") || "None selected"}

Confidence: ${Math.round(
    Math.min((likes.size / CONFIDENCE_TARGET) * 100, 100)
  )}%

Top Matches:
${[...likes]
  .map((id) => {
    const job = deck.find((j) => j.id === id);
    return job ? `- ${job.title} at ${job.company} (${job.location})` : "";
  })
  .filter(Boolean)
  .join("\n")}

Total Swipes: ${likes.size + passes.size}
Likes: ${likes.size}
Passes: ${passes.size}
  `.trim();

  navigator.clipboard.writeText(reportText).then(() => {
    alert("Report copied to clipboard!");
  });
}

/* ---------- Matching Algorithm ---------- */
function computeMatch() {
  const likedJobs = [...likes]
    .map((id) => deck.find((job) => job.id === id))
    .filter(Boolean);
  const scores = [];

  for (const job of likedJobs) {
    let score = 0;

    // Location match
    if (profile.location && job.location) {
      if (
        job.location.toLowerCase().includes(profile.location.toLowerCase()) ||
        profile.location.toLowerCase().includes(job.location.toLowerCase())
      ) {
        score += 0.3;
      }
    }

    // Work type match
    if (profile.workType && job.workType) {
      if (profile.workType === job.workType || job.workType === "any") {
        score += 0.2;
      }
    }

    // Level match
    if (profile.level && job.level) {
      if (profile.level === job.level || job.level === "any") {
        score += 0.2;
      }
    }

    // Skills match
    if (profile.skills && job.skills) {
      const commonSkills = profile.skills.filter((skill) =>
        job.skills.some(
          (jobSkill) =>
            jobSkill.toLowerCase().includes(skill.toLowerCase()) ||
            skill.toLowerCase().includes(jobSkill.toLowerCase())
        )
      );
      score += (commonSkills.length / Math.max(profile.skills.length, 1)) * 0.3;
    }

    scores.push({ ...job, score });
  }

  return scores.sort((a, b) => b.score - a.score);
}

/* ---------- Fallback Data ---------- */
const JOBS_FALLBACK = [
  {
    id: "fallback-1",
    company: "TechCorp",
    title: "Frontend Developer",
    location: "Seoul, Korea",
    workType: "hybrid",
    level: "junior",
    salary: "₩40M - ₩60M",
    skills: ["React", "JavaScript", "CSS"],
    logo: "https://logo.clearbit.com/techcorp.com",
    applyUrl: "https://techcorp.com/careers",
  },
  {
    id: "fallback-2",
    company: "StartupXYZ",
    title: "Full Stack Engineer",
    location: "Remote",
    workType: "remote",
    level: "any",
    salary: "$80K - $120K",
    skills: ["Node.js", "React", "MongoDB"],
    logo: "https://logo.clearbit.com/startupxyz.com",
    applyUrl: "http://startupxyz.com/",
  },
  {
    id: "fallback-3",
    company: "BigTech Inc",
    title: "Software Engineer Intern",
    location: "San Francisco, CA",
    workType: "onsite",
    level: "intern",
    salary: "$6K - $8K/month",
    skills: ["Python", "Machine Learning", "SQL"],
    logo: "https://logo.clearbit.com/bigtech.com",
    applyUrl: "https://bigtech.com/internships",
  },
  {
    id: "fallback-4",
    company: "DesignStudio",
    title: "UX Designer",
    location: "New York, NY",
    workType: "hybrid",
    level: "junior",
    salary: "$70K - $90K",
    skills: ["Figma", "User Research", "Prototyping"],
    logo: "https://logo.clearbit.com/designstudio.com",
    applyUrl: "https://designstudio.com/careers",
  },
  {
    id: "fallback-5",
    company: "DataCorp",
    title: "Data Analyst",
    location: "London, UK",
    workType: "remote",
    level: "any",
    salary: "£45K - £65K",
    skills: ["Python", "SQL", "Analytics"],
    logo: "https://logo.clearbit.com/datacorp.com",
    applyUrl: "https://datacorp.com/opportunities",
  },
  {
    id: "fallback-6",
    company: "MobileFirst",
    title: "Mobile Developer",
    location: "Tokyo, Japan",
    workType: "onsite",
    level: "junior",
    salary: "¥6M - ¥8M",
    skills: ["React Native", "iOS", "Android"],
    applyUrl: "#",
  },
  {
    id: "fallback-7",
    company: "CloudTech",
    title: "DevOps Engineer",
    location: "Austin, TX",
    workType: "hybrid",
    level: "any",
    salary: "$90K - $130K",
    skills: ["AWS", "Docker", "Kubernetes"],
    applyUrl: "#",
  },
  {
    id: "fallback-8",
    company: "AI Solutions",
    title: "Machine Learning Engineer",
    location: "Remote",
    workType: "remote",
    level: "any",
    salary: "$100K - $150K",
    skills: ["Python", "TensorFlow", "Deep Learning"],
    applyUrl: "#",
  },
  {
    id: "fallback-9",
    company: "FinTech Co",
    title: "Backend Developer",
    location: "Singapore",
    workType: "onsite",
    level: "junior",
    salary: "S$60K - S$80K",
    skills: ["Java", "Spring Boot", "PostgreSQL"],
    applyUrl: "#",
  },
  {
    id: "fallback-10",
    company: "GameStudio",
    title: "Game Developer",
    location: "Vancouver, Canada",
    workType: "hybrid",
    level: "any",
    salary: "C$70K - C$95K",
    skills: ["Unity", "C#", "Game Design"],
    applyUrl: "#",
  },
  {
    id: "fallback-11",
    company: "Spotify",
    title: "Frontend Engineer",
    location: "Stockholm, Sweden",
    workType: "hybrid",
    level: "junior",
    salary: "SEK 500K - SEK 700K",
    skills: ["React", "TypeScript", "Node.js"],
    logo: "https://logo.clearbit.com/spotify.com",
    applyUrl: "https://jobs.spotify.com",
  },
  {
    id: "fallback-12",
    company: "Stripe",
    title: "Backend Engineer",
    location: "San Francisco, CA",
    workType: "onsite",
    level: "any",
    salary: "$150K - $200K",
    skills: ["Ruby", "Go", "PostgreSQL"],
    logo: "https://logo.clearbit.com/stripe.com",
    applyUrl: "https://stripe.com/jobs",
  },
  {
    id: "fallback-13",
    company: "Shopify",
    title: "Full Stack Developer",
    location: "Remote",
    workType: "remote",
    level: "junior",
    salary: "$80K - $120K",
    skills: ["Ruby on Rails", "React", "GraphQL"],
    logo: "https://logo.clearbit.com/shopify.com",
    applyUrl: "https://jobs.shopify.com",
  },
  {
    id: "fallback-14",
    company: "GitHub",
    title: "Software Engineer",
    location: "Remote",
    workType: "remote",
    level: "any",
    salary: "$120K - $180K",
    skills: ["Ruby", "Go", "Git"],
    logo: "https://logo.clearbit.com/github.com",
    applyUrl: "https://github.com/careers",
  },
  {
    id: "fallback-15",
    company: "Netflix",
    title: "Senior Software Engineer",
    location: "Los Gatos, CA",
    workType: "hybrid",
    level: "any",
    salary: "$200K - $300K",
    skills: ["Java", "Spring", "Microservices"],
    logo: "https://logo.clearbit.com/netflix.com",
    applyUrl: "https://jobs.netflix.com",
  },
  {
    id: "fallback-16",
    company: "Uber",
    title: "Mobile Engineer",
    location: "San Francisco, CA",
    workType: "hybrid",
    level: "any",
    salary: "$140K - $190K",
    skills: ["Swift", "Kotlin", "iOS", "Android"],
    applyUrl: "#",
  },
  {
    id: "fallback-17",
    company: "Lyft",
    title: "Data Scientist",
    location: "San Francisco, CA",
    workType: "hybrid",
    level: "any",
    salary: "$130K - $180K",
    skills: ["Python", "Machine Learning", "SQL"],
    applyUrl: "#",
  },
  {
    id: "fallback-18",
    company: "Tesla",
    title: "Autopilot Engineer",
    location: "Austin, TX",
    workType: "onsite",
    level: "any",
    salary: "$160K - $220K",
    skills: ["C++", "Python", "Computer Vision"],
    applyUrl: "#",
  },
  {
    id: "fallback-19",
    company: "Meta",
    title: "Product Designer",
    location: "Menlo Park, CA",
    workType: "hybrid",
    level: "junior",
    salary: "$120K - $160K",
    skills: ["Figma", "User Research", "Prototyping"],
    applyUrl: "#",
  },
  {
    id: "fallback-20",
    company: "Google",
    title: "Software Engineer Intern",
    location: "Mountain View, CA",
    workType: "onsite",
    level: "intern",
    salary: "$8K - $10K/month",
    skills: ["Python", "C++", "Algorithms"],
    applyUrl: "#",
  },
];

/* ---------- Boot ---------- */
(async function boot() {
  await initSkillTags();

  const currentUser = JSON.parse(
    localStorage.getItem(STORAGE_KEYS.USER) || "{}"
  );
  const userKey = currentUser.email || "guest";

  // 사용자별 프로필 확인
  const userProfiles = JSON.parse(
    localStorage.getItem(STORAGE_KEYS.PROFILE) || "{}"
  );
  const userProfile = userProfiles[userKey];

  if (userProfile && userProfile.name) {
    // 프로필이 있으면 시작화면을 건너뛰고 바로 스와이프 시작
    profile = userProfile;
    welcomeSection.classList.add("hidden");
    progressSection.classList.remove("hidden");
    deckSection.classList.remove("hidden");
    startDeck();
    return;
  }

  // 항상 웰컴 화면을 먼저 표시
  welcomeSection.classList.remove("hidden");
})();
