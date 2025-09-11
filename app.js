/** ======================
 * JobSwipe – app.js
 * Endless swipe + anytime report
 * API + fallback
 * =====================*/

/* ---------- Constants & State ---------- */
let profile = null;

const STORAGE_KEYS = {
  PROFILE: "jobswipe_profile",
  LIKES: "jobswipe_likes",
  PASSES: "jobswipe_passes",
  APPLIED: "jobswipe_applied",
  USER: "jobswipe_user",
  USERS: "jobswipe_users",
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
const insightsBadges = $("insightsBadges");
const favoritesList = $("favoritesList");
const appliedList = $("appliedList");
const actionsList = $("actionsList");

// Profile inputs
const pfName = $("pfName");
const pfMajor = $("pfMajor");
const pfSkills = $("pfSkills");
const pfLocation = $("pfLocation");
const pfWorkType = $("pfWorkType");
const pfLevel = $("pfLevel");
const pfMinSalary = $("pfMinSalary");

// Buttons
document.addEventListener("DOMContentLoaded", () => {
  $("mainTitle").onclick = resetAllData;
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
  $("downloadPDF").onclick = downloadPDF;
  $("shareReport").onclick = shareReport;
  $("resetDeck").onclick = resetDeck;
});

// Core state
let deck = [];
let cursor = 0;
let loading = false;
let seen = new Set();

let likes = new Set();
let passes = new Set();
let applied = new Set();

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
  const userApplied = JSON.parse(
    localStorage.getItem(`${STORAGE_KEYS.APPLIED}_${userKey}`) || "[]"
  );

  likes = new Set(userLikes);
  passes = new Set(userPasses);
  applied = new Set(userApplied);
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
  localStorage.setItem(
    `${STORAGE_KEYS.APPLIED}_${userKey}`,
    JSON.stringify([...applied])
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

// 연봉 파싱 함수 (다양한 형식 지원)
function parseSalary(salaryStr) {
  if (!salaryStr) return null;

  // 숫자만 추출
  const numbers = salaryStr.match(/\d+/g);
  if (!numbers || numbers.length === 0) return null;

  // 첫 번째 숫자를 기준으로 연봉 추정
  let baseSalary = parseInt(numbers[0]);

  // K, M 단위 처리
  if (salaryStr.includes("K") && !salaryStr.includes("M")) {
    baseSalary *= 1000;
  } else if (salaryStr.includes("M")) {
    baseSalary *= 1000000;
  }

  // 월급인 경우 연봉으로 변환
  if (salaryStr.includes("/month") || salaryStr.includes("월")) {
    baseSalary *= 12;
  }

  // 범위가 있는 경우 평균값 사용
  if (numbers.length > 1) {
    const secondNum = parseInt(numbers[1]);
    if (salaryStr.includes("K") && !salaryStr.includes("M")) {
      baseSalary = (baseSalary + secondNum * 1000) / 2;
    } else if (salaryStr.includes("M")) {
      baseSalary = (baseSalary + secondNum * 1000000) / 2;
    } else {
      baseSalary = (baseSalary + secondNum) / 2;
    }
  }

  return Math.round(baseSalary);
}

// 인사이트 분석 함수
function generateInsights() {
  const likedJobs = [...likes]
    .map((id) => deck.find((job) => job.id === id))
    .filter(Boolean);

  const insights = [];

  if (likedJobs.length === 0) return insights;

  // 원격 근무 선호도 분석
  const remoteJobs = likedJobs.filter(
    (job) => job.workType === "remote"
  ).length;
  const remotePercentage = (remoteJobs / likedJobs.length) * 100;
  if (remotePercentage >= 70) {
    insights.push({
      type: "remote",
      text: `You liked ${Math.round(remotePercentage)}% remote jobs`,
      emoji: "🏠",
      color: "bg-blue-100 text-blue-800",
    });
  }

  // 회사 크기 선호도 분석 (스폰서드 = 대기업)
  const sponsoredJobs = likedJobs.filter((job) => job.sponsored).length;
  const sponsoredPercentage = (sponsoredJobs / likedJobs.length) * 100;
  if (sponsoredPercentage >= 60) {
    insights.push({
      type: "big-company",
      text: `You prefer big companies (${Math.round(sponsoredPercentage)}%)`,
      emoji: "🏢",
      color: "bg-purple-100 text-purple-800",
    });
  }

  // 연봉 선호도 분석
  const jobsWithSalary = likedJobs.filter((job) => job.salary).length;
  if (jobsWithSalary > 0) {
    const salaries = likedJobs
      .filter((job) => job.salary)
      .map((job) => parseSalary(job.salary))
      .filter((salary) => salary > 0);

    if (salaries.length > 0) {
      const avgSalary = salaries.reduce((a, b) => a + b, 0) / salaries.length;
      if (avgSalary > 100000) {
        insights.push({
          type: "high-salary",
          text: `You prefer high-paying jobs (avg $${Math.round(
            avgSalary
          ).toLocaleString()})`,
          emoji: "💰",
          color: "bg-green-100 text-green-800",
        });
      }
    }
  }

  // 기술 스택 선호도 분석
  const allSkills = likedJobs.flatMap((job) => job.skills || []);
  const skillCounts = {};
  allSkills.forEach((skill) => {
    skillCounts[skill] = (skillCounts[skill] || 0) + 1;
  });

  const topSkills = Object.entries(skillCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3);

  if (topSkills.length > 0) {
    insights.push({
      type: "skills",
      text: `Top skills: ${topSkills.map(([skill]) => skill).join(", ")}`,
      emoji: "⚡",
      color: "bg-orange-100 text-orange-800",
    });
  }

  // 위치 선호도 분석
  const locations = likedJobs.map((job) => job.location).filter(Boolean);
  const locationCounts = {};
  locations.forEach((location) => {
    locationCounts[location] = (locationCounts[location] || 0) + 1;
  });

  const topLocation = Object.entries(locationCounts).sort(
    ([, a], [, b]) => b - a
  )[0];

  if (topLocation && topLocation[1] >= 2) {
    insights.push({
      type: "location",
      text: `You like jobs in ${topLocation[0]} (${topLocation[1]} times)`,
      emoji: "📍",
      color: "bg-pink-100 text-pink-800",
    });
  }

  // 스와이프 패턴 분석
  const totalSwipes = likes.size + passes.size;
  const likeRate = (likes.size / totalSwipes) * 100;

  if (likeRate < 20) {
    insights.push({
      type: "selective",
      text: `You're very selective (${Math.round(likeRate)}% like rate)`,
      emoji: "🎯",
      color: "bg-red-100 text-red-800",
    });
  } else if (likeRate > 60) {
    insights.push({
      type: "open",
      text: `You're open to many opportunities (${Math.round(
        likeRate
      )}% like rate)`,
      emoji: "🌟",
      color: "bg-yellow-100 text-yellow-800",
    });
  }

  return insights;
}

// 개선된 스와이프 애니메이션
function enhancedSwipeAnimation(card, isLike) {
  if (isLike) {
    // 카드 애니메이션 강화
    card.style.transition =
      "transform 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94)";
    card.style.transform = "translateX(100vw) rotate(20deg) scale(1.1)";
    card.style.boxShadow = "0 0 30px rgba(34, 197, 94, 0.5)";
  } else {
    // 패스 애니메이션
    card.style.transition =
      "transform 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94)";
    card.style.transform = "translateX(-100vw) rotate(-20deg) scale(0.9)";
    card.style.boxShadow = "0 0 30px rgba(239, 68, 68, 0.5)";
  }
}

function sortJobsByPriority(jobs) {
  return jobs.sort((a, b) => {
    // 스폰서드 공고는 약간의 가중치만 주고 랜덤으로 섞기
    const aWeight = a.sponsored ? Math.random() * 0.3 : Math.random();
    const bWeight = b.sponsored ? Math.random() * 0.3 : Math.random();

    return aWeight - bWeight;
  });
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
        return sortJobsByPriority(JOBS_FALLBACK).slice(0, 30);
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
  return sortJobsByPriority(JOBS_FALLBACK).slice(0, 30);
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
    minSalary: pfMinSalary.value ? parseInt(pfMinSalary.value) : null,
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
  pfMinSalary.value = profile.minSalary || "";
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
  pfMinSalary.value = "";
  pfSkills
    .querySelectorAll(".skill-tag")
    .forEach((b) => b.classList.remove("selected"));
  alert("Profile cleared.");
}

/* ---------- Deck & Swipe ---------- */
async function startDeck() {
  console.log("startDeck called");
  deck = [];
  cursor = 0;
  seen = new Set();
  loadUserData(); // 사용자별 데이터 로드
  console.log(
    "After loadUserData - likes:",
    likes.size,
    "passes:",
    passes.size,
    "applied:",
    applied.size
  );
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
            ? `<div class="w-12 h-12 rounded-lg flex items-center justify-center text-white font-bold text-sm flex-shrink-0 bg-gradient-to-br from-blue-500 to-purple-600">
                 <img src="${job.logo}" alt="${
                job.company
              }" class="w-full h-full rounded-lg object-cover" onerror="this.parentElement.innerHTML='${job.company
                .substring(0, 2)
                .toUpperCase()}'">
               </div>`
            : `<div class="w-12 h-12 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0">${
                job.company ? job.company.substring(0, 2).toUpperCase() : "CO"
              }</div>`
        }
        <div class="flex-1">
          <div class="flex items-center gap-2 mb-1">
            <h3 class="text-lg font-bold">${job.title || "Role"}</h3>
            ${
              job.sponsored
                ? '<span class="text-xs bg-gradient-to-r from-purple-500 to-pink-500 text-white px-2 py-1 rounded-full font-semibold">SPONSORED</span>'
                : ""
            }
          </div>
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
      <button 
        class="apply-btn underline hover:text-blue-600 ${
          applied.has(job.id) ? "text-green-600 font-semibold" : ""
        }" 
        data-job-id="${job.id}"
        data-apply-url="${job.applyUrl || "#"}"
      >
        ${applied.has(job.id) ? "✓ Applied" : "Apply Now"}
      </button>
      <span class="text-xs">ID: ${job.id}</span>
    </div>
    <div class="swipe-badge swipe-like">LIKE</div>
    <div class="swipe-badge swipe-pass">PASS</div>
  `;
  enableDrag(el, (dir) => {
    if (dir === "right") onSwipe(true);
    else if (dir === "left") onSwipe(false);
  });

  // Apply 버튼 이벤트 리스너 추가
  const applyBtn = el.querySelector(".apply-btn");
  if (applyBtn) {
    applyBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      handleApplyClick(applyBtn);
    });
  }

  return el;
}

// Apply 버튼 클릭 핸들러
function handleApplyClick(applyBtn) {
  const jobId = applyBtn.getAttribute("data-job-id");
  const applyUrl = applyBtn.getAttribute("data-apply-url");

  if (applied.has(jobId)) {
    // 이미 지원한 경우
    alert("You have already applied to this job!");
    return;
  }

  // 지원 기록에 추가
  applied.add(jobId);
  saveUserData();

  // 버튼 상태 업데이트
  applyBtn.textContent = "✓ Applied";
  applyBtn.classList.add("text-green-600", "font-semibold");
  applyBtn.classList.remove("hover:text-blue-600");

  // 성공 메시지
  alert("Application recorded! Good luck! 🍀");

  // 실제 지원 페이지로 이동 (선택사항)
  if (applyUrl && applyUrl !== "#") {
    if (confirm("Would you like to open the application page?")) {
      window.open(applyUrl, "_blank");
    }
  }
}

/* ---------- Swipe Handlers ---------- */
function onSwipe(isLike) {
  const job = deck[cursor];
  if (!job) return;

  // 현재 카드 요소 가져오기
  const currentCard = cardStack.querySelector(".job-card");
  if (currentCard) {
    // 개선된 애니메이션 효과 사용
    enhancedSwipeAnimation(currentCard, isLike);
    currentCard.classList.add(isLike ? "swipe-right" : "swipe-left");
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
  }, 400);
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
      <div><strong>Min Salary:</strong> ${
        profile.minSalary
          ? `$${profile.minSalary.toLocaleString()}/year`
          : "Any"
      }</div>
      <div class="md:col-span-2"><strong>Skills:</strong> ${
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

  // High Salary Matches

  // Insights Badges
  const insights = generateInsights();
  insightsBadges.innerHTML =
    insights.length > 0
      ? insights
          .map(
            (insight) => `
      <div class="px-4 py-2 rounded-full text-sm font-medium ${insight.color} flex items-center gap-2">
        <span>${insight.emoji}</span>
        <span>${insight.text}</span>
      </div>
    `
          )
          .join("")
      : '<div class="text-center text-slate-500 py-4">Complete more swipes to see your insights!</div>';

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

  // Applied Jobs
  const appliedJobs = [...applied]
    .map((id) => deck.find((job) => job.id === id))
    .filter(Boolean);
  appliedList.innerHTML =
    appliedJobs.length > 0
      ? appliedJobs
          .map(
            (job) => `
    <li class="p-3 border border-green-200 rounded-lg shadow-sm hover:shadow-md transition-shadow mb-2 bg-green-50">
      <div class="font-medium text-green-800">${job.title}</div>
      <div class="text-sm text-green-600">${job.company} · ${job.location}</div>
      ${
        job.salary
          ? `<div class="text-sm font-semibold text-green-700 mt-1">${job.salary}</div>`
          : ""
      }
      <div class="text-xs text-green-500 mt-1">✓ Applied</div>
    </li>
  `
          )
          .join("")
      : '<li class="text-slate-500 italic">No applications yet. Start applying to your favorite jobs!</li>';

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
  console.log("resetDeck called");
  if (confirm("Reset all your swipes? This cannot be undone.")) {
    console.log("User confirmed reset");
    console.log(
      "Before reset - likes:",
      likes.size,
      "passes:",
      passes.size,
      "applied:",
      applied.size
    );

    // 데이터 클리어
    likes.clear();
    passes.clear();
    applied.clear();

    // 로컬스토리지에서 사용자별 데이터 제거
    const userKey = getUserKey();
    localStorage.removeItem(`${STORAGE_KEYS.LIKES}_${userKey}`);
    localStorage.removeItem(`${STORAGE_KEYS.PASSES}_${userKey}`);
    localStorage.removeItem(`${STORAGE_KEYS.APPLIED}_${userKey}`);

    console.log(
      "After reset - likes:",
      likes.size,
      "passes:",
      passes.size,
      "applied:",
      applied.size
    );

    // UI 업데이트
    stepNowEl.textContent = "0";
    updateProgressBar();

    // 새로운 덱 시작
    console.log("Starting new deck...");
    deck = [];
    cursor = 0;
    seen = new Set();
    loadMore().then(() => {
      renderTopCard();
    });
  }
}

// 모든 데이터 리셋하고 웰컴 화면으로 돌아가기
function resetAllData() {
  // 모든 데이터 클리어
  likes.clear();
  passes.clear();
  applied.clear();
  profile = null;

  // 모든 로컬스토리지 데이터 제거
  const userKey = getUserKey();
  localStorage.removeItem(`${STORAGE_KEYS.LIKES}_${userKey}`);
  localStorage.removeItem(`${STORAGE_KEYS.PASSES}_${userKey}`);
  localStorage.removeItem(`${STORAGE_KEYS.APPLIED}_${userKey}`);
  localStorage.removeItem(`${STORAGE_KEYS.PROFILE}_${userKey}`);

  // 덱 상태 초기화
  deck = [];
  cursor = 0;
  seen = new Set();

  // 모든 섹션 숨기기
  loginSection.classList.add("hidden");
  profileSection.classList.add("hidden");
  progressSection.classList.add("hidden");
  deckSection.classList.add("hidden");
  resultSection.classList.add("hidden");

  // 웰컴 화면 표시
  welcomeSection.classList.remove("hidden");
}

function copyReportText() {
  const reportText = `
JobSwipe Match Report
====================

Profile: ${profile.name || "Not specified"}
Major: ${profile.major || "Not specified"}
Location: ${profile.location || "Any"}
Work Type: ${profile.workType || "Any"}
Level: ${profile.level || "Any"}
Min Salary: ${
    profile.minSalary ? `$${profile.minSalary.toLocaleString()}/year` : "Any"
  }
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

function downloadPDF() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  // 제목
  doc.setFontSize(20);
  doc.text("JobSwipe Match Report", 20, 30);

  // 프로필 정보
  doc.setFontSize(12);
  let y = 50;
  doc.text(`Name: ${profile.name || "Not specified"}`, 20, y);
  y += 10;
  doc.text(`Major: ${profile.major || "Not specified"}`, 20, y);
  y += 10;
  doc.text(`Location: ${profile.location || "Any"}`, 20, y);
  y += 10;
  doc.text(`Work Type: ${profile.workType || "Any"}`, 20, y);
  y += 10;
  doc.text(`Level: ${profile.level || "Any"}`, 20, y);
  y += 10;
  doc.text(
    `Min Salary: ${
      profile.minSalary ? `$${profile.minSalary.toLocaleString()}/year` : "Any"
    }`,
    20,
    y
  );
  y += 10;
  doc.text(`Skills: ${profile.skills?.join(", ") || "None selected"}`, 20, y);
  y += 20;

  // 매칭 정보
  doc.text(
    `Confidence: ${Math.round(
      Math.min((likes.size / CONFIDENCE_TARGET) * 100, 100)
    )}%`,
    20,
    y
  );
  y += 10;
  doc.text(`Total Swipes: ${likes.size + passes.size}`, 20, y);
  y += 10;
  doc.text(`Likes: ${likes.size}`, 20, y);
  y += 10;
  doc.text(`Passes: ${passes.size}`, 20, y);
  y += 20;

  // 좋아요한 잡들
  doc.text("Your Favorite Jobs:", 20, y);
  y += 10;

  const favoriteJobs = [...likes]
    .map((id) => deck.find((job) => job.id === id))
    .filter(Boolean);

  favoriteJobs.forEach((job, index) => {
    if (y > 250) {
      doc.addPage();
      y = 20;
    }
    doc.text(`${index + 1}. ${job.title} at ${job.company}`, 30, y);
    y += 8;
    if (job.location) {
      doc.text(`   Location: ${job.location}`, 30, y);
      y += 8;
    }
    if (job.salary) {
      doc.text(`   Salary: ${job.salary}`, 30, y);
      y += 8;
    }
    y += 5;
  });

  // PDF 다운로드
  const fileName = `JobSwipe_Report_${profile.name || "User"}_${
    new Date().toISOString().split("T")[0]
  }.pdf`;
  doc.save(fileName);
}

function shareReport() {
  const reportData = {
    title: "JobSwipe Match Report",
    text: `Check out my job matches on JobSwipe! I found ${likes.size} great opportunities.`,
    url: window.location.href,
  };

  if (navigator.share) {
    navigator
      .share(reportData)
      .then(() => {
        console.log("Report shared successfully");
      })
      .catch((error) => {
        console.log("Error sharing:", error);
        fallbackShare();
      });
  } else {
    fallbackShare();
  }
}

function fallbackShare() {
  const shareText = `Check out my JobSwipe match report! I found ${likes.size} great job opportunities. Try JobSwipe at ${window.location.href}`;

  if (navigator.clipboard) {
    navigator.clipboard.writeText(shareText).then(() => {
      alert("Share link copied to clipboard!");
    });
  } else {
    // Fallback for older browsers
    const textArea = document.createElement("textarea");
    textArea.value = shareText;
    document.body.appendChild(textArea);
    textArea.select();
    document.execCommand("copy");
    document.body.removeChild(textArea);
    alert("Share link copied to clipboard!");
  }
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

    // Salary match
    if (profile.minSalary && job.salary) {
      const jobSalary = parseSalary(job.salary);
      if (jobSalary) {
        if (jobSalary >= profile.minSalary) {
          // 연봉이 희망 연봉 이상이면 보너스 점수
          const salaryRatio = jobSalary / profile.minSalary;
          score += Math.min(0.2, (salaryRatio - 1) * 0.1);
        } else {
          // 연봉이 희망 연봉보다 낮으면 감점
          const salaryRatio = jobSalary / profile.minSalary;
          score += (salaryRatio - 1) * 0.1;
        }
      }
    }

    scores.push({ ...job, score, parsedSalary: parseSalary(job.salary) });
  }

  return scores.sort((a, b) => b.score - a.score);
}

/* ---------- Fallback Data ---------- */
const JOBS_FALLBACK = [
  // 스폰서드 채용공고 (우선 노출)
  {
    id: "sponsored-1",
    company: "Meta",
    title: "Senior Software Engineer",
    location: "Menlo Park, CA",
    workType: "hybrid",
    level: "any",
    salary: "$180K - $250K",
    skills: ["React", "TypeScript", "GraphQL"],
    logo: "https://logo.clearbit.com/meta.com",
    applyUrl: "https://meta.com/careers",
    sponsored: true,
    priority: 1,
  },
  {
    id: "sponsored-2",
    company: "Tesla",
    title: "Full Stack Developer",
    location: "Austin, TX",
    workType: "onsite",
    level: "any",
    salary: "$150K - $200K",
    skills: ["Python", "React", "AWS"],
    logo: "https://logo.clearbit.com/tesla.com",
    applyUrl: "https://tesla.com/careers",
    sponsored: true,
    priority: 2,
  },
  {
    id: "sponsored-3",
    company: "Airbnb",
    title: "Product Designer",
    location: "San Francisco, CA",
    workType: "hybrid",
    level: "any",
    salary: "$140K - $180K",
    skills: ["Figma", "User Research", "Prototyping"],
    logo: "https://logo.clearbit.com/airbnb.com",
    applyUrl: "https://airbnb.com/careers",
    sponsored: true,
    priority: 3,
  },
  // 일반 채용공고
  {
    id: "fallback-1",
    company: "TechCorp",
    title: "Frontend Developer",
    location: "Seoul, Korea",
    workType: "hybrid",
    level: "junior",
    salary: "₩40M - ₩60M",
    skills: ["React", "JavaScript", "CSS"],
    logo: "https://logo.clearbit.com/google.com",
    applyUrl: "https://techcorp.com/careers",
    sponsored: false,
    priority: 10,
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
    logo: "https://logo.clearbit.com/microsoft.com",
    applyUrl: "http://startupxyz.com/",
    sponsored: false,
    priority: 10,
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
    logo: "https://logo.clearbit.com/apple.com",
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
    logo: "https://logo.clearbit.com/figma.com",
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
    logo: "https://logo.clearbit.com/tableau.com",
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
    logo: "https://logo.clearbit.com/samsung.com",
    applyUrl: "https://samsung.com/careers",
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
    logo: "https://logo.clearbit.com/amazon.com",
    applyUrl: "https://amazon.jobs",
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
    logo: "https://logo.clearbit.com/openai.com",
    applyUrl: "https://openai.com/careers",
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
    logo: "https://logo.clearbit.com/paypal.com",
    applyUrl: "https://paypal.com/careers",
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
    logo: "https://logo.clearbit.com/unity.com",
    applyUrl: "https://unity.com/careers",
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
