/* ========================================================
   SnapDown — logic file
   API gratis yang dipakai: tikwm.com (tidak resmi, tanpa API key)
   Catatan: API pihak ketiga gratis bisa berubah/limit sewaktu-waktu.
   ======================================================== */

const TIKWM_BASE = "https://www.tikwm.com/api";
const TRIAL_DAYS = 7;

/* ---------------- STORAGE HELPERS ---------------- */
const store = {
  get(key, fallback = null) {
    const v = localStorage.getItem(key);
    return v === null ? fallback : JSON.parse(v);
  },
  set(key, val) { localStorage.setItem(key, JSON.stringify(val)); }
};

function initTrial() {
  if (!store.get("sd_first_visit")) {
    store.set("sd_first_visit", Date.now());
  }
}
function trialDaysLeft() {
  const first = store.get("sd_first_visit", Date.now());
  const diff = Date.now() - first;
  const left = TRIAL_DAYS - Math.floor(diff / 86400000);
  return Math.max(left, 0);
}
function isPremium() { return !!store.get("sd_premium", false); }
function hasFreeTrialLeft() { return trialDaysLeft() > 0; }

/* ---------------- NAVIGATION ---------------- */
const pages = ["home", "search", "profile", "settings"];

function showPage(name) {
  pages.forEach(p => {
    document.getElementById(`page-${p}`).classList.toggle("active", p === name);
  });
  document.querySelectorAll(".nav-btn").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.page === name);
  });
  if (name === "profile") renderProfile();
}

document.querySelectorAll(".nav-btn").forEach(btn => {
  btn.addEventListener("click", () => showPage(btn.dataset.page));
});
document.getElementById("settingsBtn").addEventListener("click", () => showPage("settings"));
document.getElementById("closeSettingsBtn").addEventListener("click", () => showPage("home"));

/* ---------------- THEME & BACKGROUND ---------------- */
function applyTheme(theme) {
  document.body.setAttribute("data-theme", theme);
  store.set("sd_theme", theme);
  document.querySelectorAll("[data-theme-opt]").forEach(b =>
    b.classList.toggle("active", b.dataset.themeOpt === theme));
}
function applyBg(bg) {
  document.body.setAttribute("data-bg", bg);
  store.set("sd_bg", bg);
  document.querySelectorAll("[data-bg-opt]").forEach(b =>
    b.classList.toggle("active", b.dataset.bgOpt === bg));
}
document.querySelectorAll("[data-theme-opt]").forEach(b =>
  b.addEventListener("click", () => applyTheme(b.dataset.themeOpt)));
document.querySelectorAll("[data-bg-opt]").forEach(b =>
  b.addEventListener("click", () => applyBg(b.dataset.bgOpt)));

/* ---------------- TOAST ---------------- */
let toastTimer;
function toast(msg) {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.classList.remove("hidden");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.add("hidden"), 2800);
}

/* ---------------- AD GATE (2 sponsor ads, sequential) ---------------- */
const AD_SEQUENCE = [
  { tag: "SPONSOR", title: "Alight Motion", body: "Edit video kamu jadi lebih keren dengan Alight Motion — coba sekarang!" },
  { tag: "SPONSOR", title: "TikTok", body: "Temukan lebih banyak video seru di TikTok. Ikuti tren terbaru hari ini!" }
];

function showAdGate() {
  return new Promise((resolve) => {
    const modal = document.getElementById("adModal");
    const tagEl = document.getElementById("adTag");
    const titleEl = document.getElementById("adTitle");
    const bodyEl = document.getElementById("adBody");
    const countdownEl = document.getElementById("adCountdown");
    const btn = document.getElementById("adContinueBtn");

    let idx = 0;
    modal.classList.remove("hidden");

    function runAd() {
      const ad = AD_SEQUENCE[idx];
      tagEl.textContent = ad.tag;
      titleEl.textContent = ad.title;
      bodyEl.textContent = ad.body;
      btn.disabled = true;
      btn.textContent = "Lanjutkan";
      let t = 5;
      countdownEl.textContent = t;
      const timer = setInterval(() => {
        t--;
        countdownEl.textContent = t;
        if (t <= 0) {
          clearInterval(timer);
          btn.disabled = false;
        }
      }, 1000);
    }

    function onContinue() {
      idx++;
      if (idx >= AD_SEQUENCE.length) {
        btn.removeEventListener("click", onContinue);
        modal.classList.add("hidden");
        resolve();
      } else {
        runAd();
      }
    }
    btn.addEventListener("click", onContinue);
    runAd();
  });
}

/* ---------------- TRIAL BANNER ---------------- */
function refreshTrialBanner() {
  const el = document.getElementById("trialBanner");
  if (isPremium()) {
    el.textContent = "✓ Akun Premium aktif — tanpa iklan.";
  } else if (hasFreeTrialLeft()) {
    el.textContent = `Masa coba gratis: ${trialDaysLeft()} hari tersisa (tanpa iklan).`;
  } else {
    el.textContent = "Masa coba gratis habis. 1 iklan sponsor akan tampil sebelum download.";
  }
}

/* ---------------- DOWNLOAD LOGIC ---------------- */
function extractTikTokUrl() {
  const val = document.getElementById("urlInput").value.trim();
  if (!val || !val.includes("tiktok")) {
    toast("Masukkan link TikTok yang valid.");
    return null;
  }
  return val;
}

async function fetchTikTokData(url) {
  const res = await fetch(`${TIKWM_BASE}/?url=${encodeURIComponent(url)}&hd=1`);
  if (!res.ok) throw new Error("Gagal menghubungi server API.");
  const json = await res.json();
  if (json.code !== 0 || !json.data) throw new Error(json.msg || "Video tidak ditemukan.");
  return json.data;
}

function showResult(html) {
  const box = document.getElementById("resultBox");
  box.innerHTML = html;
  box.classList.remove("hidden");
}

async function handleDownload(type) {
  const url = extractTikTokUrl();
  if (!url) return;

  const proceed = async () => {
    showResult("⏳ Memproses link, mohon tunggu...");
    try {
      const data = await fetchTikTokData(url);
      const quality = document.getElementById("qualitySelect").value;
      const fps = document.getElementById("fpsSelect").value;

      if (type === "mp4") {
        const videoUrl = data.hdplay || data.play;
        showResult(`
          <b>${escapeHtml(data.title || "Video TikTok")}</b><br>
          Kualitas dipilih: ${quality}p • ${fps} FPS<br><br>
          <a href="${videoUrl}" target="_blank" rel="noopener">⬇ Unduh MP4</a>
          <p style="margin-top:8px;opacity:.65;font-size:.75rem">
            Catatan: sumber video mengikuti kualitas asli dari server; pilihan di atas dipakai sebagai preferensi permintaan.
          </p>
        `);
      } else {
        const musicUrl = data.music;
        showResult(`
          <b>${escapeHtml(data.title || "Audio TikTok")}</b><br><br>
          <a href="${musicUrl}" target="_blank" rel="noopener">⬇ Unduh MP3</a>
        `);
      }
    } catch (err) {
      showResult(`⚠ ${escapeHtml(err.message || "Terjadi kesalahan.")}`);
    }
  };

  if (isPremium() || hasFreeTrialLeft()) {
    await proceed();
  } else {
    await showAdGate();
    await proceed();
  }
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

document.getElementById("downloadMp4Btn").addEventListener("click", () => handleDownload("mp4"));
document.getElementById("downloadMp3Btn").addEventListener("click", () => handleDownload("mp3"));

/* ---------------- SEARCH ---------------- */
async function runSearch() {
  const kw = document.getElementById("searchInput").value.trim();
  const box = document.getElementById("searchResults");
  if (!kw) { toast("Masukkan kata kunci pencarian."); return; }
  box.innerHTML = "⏳ Mencari...";
  try {
    const res = await fetch(`${TIKWM_BASE}/feed/search/?keywords=${encodeURIComponent(kw)}&count=10`);
    const json = await res.json();
    const list = (json.data && json.data.videos) || [];
    if (!list.length) { box.innerHTML = "Tidak ada hasil ditemukan."; return; }
    box.innerHTML = list.map(v => `
      <div class="result-item">
        <img src="${v.cover}" alt="">
        <div class="meta">
          <b>${escapeHtml(v.title || "Tanpa judul").slice(0, 60)}</b>
          ${escapeHtml(v.author?.nickname || "")}
        </div>
        <button class="btn small use-video-btn" data-url="https://www.tiktok.com/@${v.author?.unique_id}/video/${v.video_id}">Pilih</button>
      </div>
    `).join("");
    box.querySelectorAll(".use-video-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        document.getElementById("urlInput").value = btn.dataset.url;
        showPage("home");
        toast("Link dimasukkan ke halaman Home.");
      });
    });
  } catch (e) {
    box.innerHTML = "⚠ Gagal mengambil hasil pencarian. API gratis mungkin sedang sibuk.";
  }
}
document.getElementById("searchBtn").addEventListener("click", runSearch);
document.getElementById("searchInput").addEventListener("keydown", e => {
  if (e.key === "Enter") runSearch();
});

/* ---------------- PROFILE (mock login, client-side only) ---------------- */
function renderProfile() {
  const card = document.getElementById("profileCard");
  const user = store.get("sd_user", null);

  if (!user) {
    card.innerHTML = `
      <h2>Masuk Akun</h2>
      <p class="sub">Masuk untuk menyimpan preferensi & status premium kamu.</p>
      <input id="loginName" type="text" placeholder="Nama pengguna">
      <input id="loginPass" type="password" placeholder="Password">
      <button id="loginBtn" class="btn transparent">Masuk</button>
      <button id="googleLoginBtn" class="btn transparent" style="margin-top:10px;">Lanjutkan dengan Google</button>
      <p style="margin-top:14px;font-size:.72rem;opacity:.6;">
        Catatan: login Google asli memerlukan konfigurasi OAuth (Google Cloud Console) di sisi server.
        Tombol ini adalah tampilan contoh (mock) untuk keperluan demo.
      </p>
    `;
    document.getElementById("loginBtn").addEventListener("click", () => {
      const name = document.getElementById("loginName").value.trim();
      const pass = document.getElementById("loginPass").value.trim();
      if (!name || !pass) { toast("Isi nama & password terlebih dahulu."); return; }
      store.set("sd_user", { name, method: "local" });
      renderProfile();
      toast(`Selamat datang, ${name}!`);
    });
    document.getElementById("googleLoginBtn").addEventListener("click", () => {
      store.set("sd_user", { name: "Pengguna Google (mock)", method: "google" });
      renderProfile();
      toast("Masuk dengan akun Google (mock).");
    });
  } else {
    const initials = user.name.slice(0, 1).toUpperCase();
    card.innerHTML = `
      <div class="profile-view">
        <div class="avatar-circle">${initials}</div>
        <h2>${escapeHtml(user.name)}</h2>
        <div class="premium-badge">${isPremium() ? "PREMIUM" : hasFreeTrialLeft() ? `Trial • ${trialDaysLeft()} hari` : "Gratis"}</div>
        <br>
        ${!isPremium() ? '<button id="upgradeBtn" class="btn transparent" style="margin-top:16px;">Upgrade ke Premium</button>' : ""}
        <button id="logoutBtn" class="btn transparent" style="margin-top:10px;">Keluar</button>
      </div>
    `;
    const upgradeBtn = document.getElementById("upgradeBtn");
    if (upgradeBtn) upgradeBtn.addEventListener("click", () => {
      store.set("sd_premium", true);
      renderProfile();
      refreshTrialBanner();
      toast("Selamat! Akun kamu sekarang Premium.");
    });
    document.getElementById("logoutBtn").addEventListener("click", () => {
      localStorage.removeItem("sd_user");
      renderProfile();
      toast("Berhasil keluar.");
    });
  }
}

/* ---------------- INIT ---------------- */
(function init() {
  initTrial();
  applyTheme(store.get("sd_theme", "dark"));
  applyBg(store.get("sd_bg", "video"));
  refreshTrialBanner();
})();
