/* =========================================================
   TET Success
   common.js
   Global Utility Engine
   Production Version
   ========================================================= */

"use strict";

/* =========================================================
   GLOBAL CONSTANTS
========================================================= */

const TET_SESSION_KEY = "tet_success_user_session";
const TET_ADMIN_SESSION_KEY = "tet_success_admin_session";
const TET_LANGUAGE_KEY = "tet_success_language";
const TET_SCROLL_PREFIX = "tet_scroll_";

let toastQueue = [];
let toastActive = false;
let loadingActive = false;
let animationLocked = false;
let lastTapTime = 0;

/* =========================================================
   1. PREMIUM TOAST SYSTEM
========================================================= */

function showToast(message, type = "info", duration = 2500) {
    toastQueue.push({ message, type, duration });
    if (!toastActive) processToastQueue();
}

function processToastQueue() {
    if (!toastQueue.length) {
        toastActive = false;
        return;
    }

    toastActive = true;
    const { message, type, duration } = toastQueue.shift();

    const oldToast = document.querySelector(".tet-toast");
    if (oldToast) oldToast.remove();

    const toast = document.createElement("div");
    toast.className = `tet-toast tet-toast-${type}`;
    toast.textContent = message;

    document.body.appendChild(toast);

    requestAnimationFrame(() => {
        toast.classList.add("show");
    });

    setTimeout(() => {
        toast.classList.remove("show");
        setTimeout(() => {
            toast.remove();
            processToastQueue();
        }, 300);
    }, duration);
}

/* =========================================================
   2. SESSION MANAGEMENT
========================================================= */

function saveUserSession(user) {
    localStorage.setItem(TET_SESSION_KEY, JSON.stringify(user));
}

function getUserSession() {
    try {
        return JSON.parse(localStorage.getItem(TET_SESSION_KEY));
    } catch {
        return null;
    }
}

function clearUserSession() {
    localStorage.removeItem(TET_SESSION_KEY);
}

function isUserLoggedIn() {
    return !!getUserSession();
}

function requireUserLogin() {
    if (!isUserLoggedIn()) {
        window.location.href = CONFIG.LOGIN_PAGE;
        return false;
    }
    return true;
}

function saveAdminSession(data = { loggedIn: true }) {
    sessionStorage.setItem(TET_ADMIN_SESSION_KEY, JSON.stringify(data));
}

function getAdminSession() {
    try {
        return JSON.parse(sessionStorage.getItem(TET_ADMIN_SESSION_KEY));
    } catch {
        return null;
    }
}

function clearAdminSession() {
    sessionStorage.removeItem(TET_ADMIN_SESSION_KEY);
}

function requireAdminLogin() {
    if (!getAdminSession()) {
        window.location.href = CONFIG.ADMIN_LOGIN_PAGE;
        return false;
    }
    return true;
}

/* =========================================================
   3. INTERNET DETECTION
========================================================= */

function initInternetDetection() {
    window.addEventListener("offline", () => {
        showToast("No Internet Connection", "error");
    });

    window.addEventListener("online", () => {
        showToast("Back Online", "success");
    });
}

/* =========================================================
   4. PREMIUM LOADING OVERLAY
========================================================= */

function showLoading(text = "Please wait...") {
    if (loadingActive) return;

    loadingActive = true;

    const overlay = document.createElement("div");
    overlay.className = "tet-loading-overlay";
    overlay.innerHTML = `
        <div class="tet-loading-card">
            <div class="tet-loader"></div>
            <div class="tet-loading-text">${escapeHTML(text)}</div>
        </div>
    `;

    document.body.appendChild(overlay);

    requestAnimationFrame(() => {
        overlay.classList.add("show");
    });
}

function hideLoading() {
    const overlay = document.querySelector(".tet-loading-overlay");
    if (!overlay) {
        loadingActive = false;
        return;
    }

    overlay.classList.remove("show");

    setTimeout(() => {
        overlay.remove();
        loadingActive = false;
    }, 250);
}

/* =========================================================
   5. WHATSAPP HELPER
========================================================= */

function openWhatsApp(phone, message) {
    if (!phone) {
        showToast("WhatsApp number missing", "error");
        return;
    }

    const cleanPhone = String(phone).replace(/\D/g, "");
    const encodedMessage = encodeURIComponent(message || "");
    const url = `https://wa.me/${cleanPhone}?text=${encodedMessage}`;

    openExternalLink(url);
}

/* =========================================================
   6. PREMIUM CONFIRMATION MODAL
========================================================= */

function showConfirmModal({
    title = "Confirm",
    message = "",
    confirmText = "Confirm",
    cancelText = "Cancel",
    onConfirm = null,
    onCancel = null
}) {
    if (animationLocked) return;

    lockAnimation();

    const modal = document.createElement("div");
    modal.className = "tet-modal-overlay";
    modal.innerHTML = `
        <div class="tet-modal-card">
            <h3>${escapeHTML(title)}</h3>
            <p>${escapeHTML(message)}</p>
            <div class="tet-modal-actions">
                <button class="tet-btn tet-btn-light" data-cancel>${escapeHTML(cancelText)}</button>
                <button class="tet-btn tet-btn-primary" data-confirm>${escapeHTML(confirmText)}</button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    requestAnimationFrame(() => {
        modal.classList.add("show");
    });

    modal.querySelector("[data-cancel]").addEventListener("click", () => {
        closeModal(modal);
        if (typeof onCancel === "function") onCancel();
    });

    modal.querySelector("[data-confirm]").addEventListener("click", async () => {
        if (typeof onConfirm === "function") await onConfirm();
        closeModal(modal);
    });
}

function closeModal(modal) {
    if (!modal) return;
    modal.classList.remove("show");
    setTimeout(() => modal.remove(), 250);
}

/* =========================================================
   7. PAGE NAVIGATION
========================================================= */

function navigateTo(page) {
    if (!page || isDoubleTap()) return;

    saveScrollPosition();
    window.location.href = page;
}

function setActiveBottomNav(activeName) {
    document.querySelectorAll("[data-nav]").forEach(item => {
        item.classList.toggle("active", item.dataset.nav === activeName);
    });
}

/* =========================================================
   8. DATE & TIME HELPERS
========================================================= */

function formatDate(dateValue) {
    if (!dateValue) return "";

    const date = new Date(dateValue);
    if (Number.isNaN(date.getTime())) return "";

    return date.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric"
    });
}

function calculateDaysRemaining(endDate) {
    if (!endDate) return 0;

    const today = new Date();
    const end = new Date(endDate);

    today.setHours(0, 0, 0, 0);
    end.setHours(0, 0, 0, 0);

    const diff = end - today;
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}

function formatTimer(seconds) {
    const min = Math.floor(seconds / 60);
    const sec = seconds % 60;
    return `${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

/* =========================================================
   9. DOUBLE TAP PROTECTION
========================================================= */

function isDoubleTap(delay = 800) {
    const now = Date.now();

    if (now - lastTapTime < delay) {
        return true;
    }

    lastTapTime = now;
    return false;
}

function lockButton(button, text = "Please wait...") {
    if (!button) return;

    button.dataset.originalText = button.innerHTML;
    button.disabled = true;
    button.classList.add("is-loading");
    button.innerHTML = `<span class="tet-btn-spinner"></span>${escapeHTML(text)}`;
}

function unlockButton(button) {
    if (!button) return;

    button.disabled = false;
    button.classList.remove("is-loading");

    if (button.dataset.originalText) {
        button.innerHTML = button.dataset.originalText;
        delete button.dataset.originalText;
    }
}

/* =========================================================
   10. CLIPBOARD HELPER
========================================================= */

async function copyToClipboard(text) {
    try {
        await navigator.clipboard.writeText(text);
        showToast("Link copied successfully", "success");
        return true;
    } catch {
        showToast("Unable to copy link", "error");
        return false;
    }
}

/* =========================================================
   11. EXTERNAL LINK HELPER
========================================================= */

function openExternalLink(url) {
    if (!url) {
        showToast("Link not available", "error");
        return;
    }

    window.open(url, "_blank", "noopener,noreferrer");
}

/* =========================================================
   12. LANGUAGE HELPER
========================================================= */

function saveLanguage(language) {
    localStorage.setItem(TET_LANGUAGE_KEY, language || "english");
}

function getCurrentLanguage() {
    return localStorage.getItem(TET_LANGUAGE_KEY) || "english";
}

/* =========================================================
   13. APP RESTART HELPER
========================================================= */

async function restartApp() {
    showLoading("Refreshing app...");
    await loadTetAppSettings();
    setTimeout(() => {
        window.location.reload();
    }, 500);
}

/* =========================================================
   14. APP VERSION CHECKER
========================================================= */

function checkAppVersion() {
    if (!APP || !APP.app_version || !CONFIG.APP_VERSION) return;

    if (APP.app_version !== CONFIG.APP_VERSION) {
        showConfirmModal({
            title: "A new version of TET Success is available.",
            message: "Please refresh the app to continue with the latest version.",
            confirmText: "Refresh App",
            cancelText: "Later",
            onConfirm: () => window.location.reload()
        });
    }
}

/* =========================================================
   15. PREVENT MULTIPLE LOADING
========================================================= */

function isLoadingActive() {
    return loadingActive;
}

/* =========================================================
   16. SCROLL POSITION REMEMBER
========================================================= */

function saveScrollPosition() {
    const key = TET_SCROLL_PREFIX + location.pathname;
    sessionStorage.setItem(key, String(window.scrollY));
}

function restoreScrollPosition() {
    const key = TET_SCROLL_PREFIX + location.pathname;
    const value = sessionStorage.getItem(key);

    if (value !== null) {
        setTimeout(() => {
            window.scrollTo({
                top: Number(value),
                behavior: "smooth"
            });
        }, 150);
    }
}

/* =========================================================
   17. ANIMATION LOCK
========================================================= */

function lockAnimation(duration = 300) {
    animationLocked = true;
    setTimeout(() => {
        animationLocked = false;
    }, duration);
}

function isAnimationLocked() {
    return animationLocked;
}

/* =========================================================
   18. GLOBAL ERROR HANDLER
========================================================= */

window.addEventListener("error", function (event) {
    console.error("Global Error:", event.error || event.message);
    showToast("Something went wrong. Please try again.", "error");
});

window.addEventListener("unhandledrejection", function (event) {
    console.error("Unhandled Promise Error:", event.reason);
    showToast("Something went wrong. Please try again.", "error");
});

/* =========================================================
   19. HTML ESCAPE HELPER
========================================================= */

function escapeHTML(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

/* =========================================================
   20. PREMIUM BADGE HELPER
========================================================= */

function getStatusBadge(status, premiumValidUntil = "") {
    if (status === "premium" || status === "Premium Member") {
        return `
            <div class="tet-badge premium">
                👑 Premium Member
                <small>Valid Until: ${escapeHTML(formatDate(premiumValidUntil || "2028-09-30"))}</small>
            </div>
        `;
    }

    return `
        <div class="tet-badge trial">
            Trial Version
        </div>
    `;
}

/* =========================================================
   21. INITIALIZE COMMON
========================================================= */

function initializeCommon() {
    initInternetDetection();
    restoreScrollPosition();

    document.addEventListener("click", function (event) {
        const nav = event.target.closest("[data-nav-url]");
        if (nav) {
            event.preventDefault();
            navigateTo(nav.dataset.navUrl);
        }
    });

    console.log("TET Success Common Utilities Loaded");
}

document.addEventListener("DOMContentLoaded", initializeCommon);
