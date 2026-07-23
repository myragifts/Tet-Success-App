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
    clearExpiredTrialReminderMemory();
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
   4B. TET QUESTION CACHE
========================================================= */

const TET_QUESTION_CACHE_PREFIX = "tet_question_cache_";
const TET_QUESTION_CACHE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

function getQuestionCacheVersion() {
    try {
        const fromSettings = typeof getAppSetting === "function"
            ? getAppSetting("question_bank_version", null)
            : null;

        return String(
            fromSettings ||
            CONFIG?.QUESTION_BANK_VERSION ||
            CONFIG?.APP_VERSION ||
            "1"
        );
    } catch {
        return "1";
    }
}

function getQuestionCacheKey(groupName, levelNo) {
    const version = getQuestionCacheVersion();
    const group = String(groupName || "Primary").trim().toLowerCase().replace(/[^a-z0-9]+/g, "_");
    const level = Number(levelNo || 1);
    return `${TET_QUESTION_CACHE_PREFIX}${version}_${group}_${level}`;
}

function loadQuestionCache(groupName, levelNo) {
    try {
        const raw = localStorage.getItem(getQuestionCacheKey(groupName, levelNo));
        if (!raw) return null;

        const cached = JSON.parse(raw);
        const savedAt = Number(cached?.saved_at || 0);
        const items = Array.isArray(cached?.questions) ? cached.questions : [];

        if (!items.length) return null;
        if (Date.now() - savedAt > TET_QUESTION_CACHE_MAX_AGE_MS) return null;

        return items;
    } catch {
        return null;
    }
}

function saveQuestionCache(groupName, levelNo, questions) {
    if (!Array.isArray(questions) || !questions.length) return false;

    try {
        localStorage.setItem(getQuestionCacheKey(groupName, levelNo), JSON.stringify({
            version: getQuestionCacheVersion(),
            group_name: groupName,
            level_no: Number(levelNo || 1),
            saved_at: Date.now(),
            questions
        }));
        return true;
    } catch {
        return false;
    }
}

/* =========================================================
   4C. CACHE-FIRST QUESTION BOOKMARKS
========================================================= */

const TET_QUESTION_BOOKMARK_KEY = "tet_question_bookmarks_v1";
const TET_QUESTION_BOOKMARK_QUEUE_KEY = "tet_question_bookmark_queue_v1";

function getBookmarkUserKey(user) {
    const value = user?.id || user?.user_id || user?.phone || user?.mobile || "guest";
    return String(value || "guest");
}

function getQuestionBookmarkId(user, questionId, source) {
    return [getBookmarkUserKey(user), source || "read", questionId].map(String).join(":");
}

function readQuestionBookmarkStore() {
    try {
        const raw = localStorage.getItem(TET_QUESTION_BOOKMARK_KEY);
        const parsed = raw ? JSON.parse(raw) : {};
        return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
        return {};
    }
}

function writeQuestionBookmarkStore(store) {
    try {
        localStorage.setItem(TET_QUESTION_BOOKMARK_KEY, JSON.stringify(store || {}));
        return true;
    } catch {
        return false;
    }
}

function loadQuestionBookmarks(user) {
    const store = readQuestionBookmarkStore();
    const userKey = getBookmarkUserKey(user);
    const list = Array.isArray(store[userKey]) ? store[userKey] : [];
    return list.map(item => ({ ...item, local_question: true }));
}

function isQuestionBookmarked(user, questionId, source) {
    const id = getQuestionBookmarkId(user, questionId, source);
    return loadQuestionBookmarks(user).some(item => item.id === id);
}

function readQuestionBookmarkQueue() {
    try {
        const raw = localStorage.getItem(TET_QUESTION_BOOKMARK_QUEUE_KEY);
        const parsed = raw ? JSON.parse(raw) : [];
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

function writeQuestionBookmarkQueue(queue) {
    try {
        localStorage.setItem(TET_QUESTION_BOOKMARK_QUEUE_KEY, JSON.stringify(queue || []));
        return true;
    } catch {
        return false;
    }
}

function queueQuestionBookmarkSync(action, bookmark) {
    if (!bookmark?.bookmark_ref_id) return;

    const queue = readQuestionBookmarkQueue();
    const key = action + ":" + bookmark.bookmark_ref_id;
    const filtered = queue.filter(item => item.key !== key);

    filtered.push({
        key,
        action,
        bookmark: {
            user_key: bookmark.user_key,
            question_id: bookmark.question_id,
            bookmark_ref_id: bookmark.bookmark_ref_id,
            bookmark_type: "question",
            source: bookmark.source,
            group_name: bookmark.group_name,
            level_no: bookmark.level_no,
            subject: bookmark.subject,
            chapter_name: bookmark.chapter_name,
            created_at: bookmark.created_at || new Date().toISOString()
        },
        queued_at: new Date().toISOString()
    });

    writeQuestionBookmarkQueue(filtered);
}

function saveQuestionBookmarkLocal(user, payload) {
    if (!payload?.question_id) return { ok: false, saved: false, message: "Question missing" };

    const userKey = getBookmarkUserKey(user);
    const source = payload.source || "read";
    const id = getQuestionBookmarkId(user, payload.question_id, source);
    const ref = [payload.group_name || "Primary", payload.level_no || 1, source, payload.question_id].map(String).join(":");
    const store = readQuestionBookmarkStore();
    const list = Array.isArray(store[userKey]) ? store[userKey] : [];
    const createdAt = new Date().toISOString();

    const bookmark = {
        id,
        user_key: userKey,
        user_id: user?.id || user?.user_id || null,
        bookmark_type: "question",
        bookmark_ref_id: ref,
        question_id: String(payload.question_id),
        source,
        group_name: payload.group_name || "Primary",
        level_no: Number(payload.level_no || 1),
        subject: payload.subject || "General",
        chapter_name: payload.chapter_name || payload.chapter || "Question",
        question_text: payload.question_text || "",
        correct_answer: payload.correct_answer || "",
        explanation: payload.explanation || "",
        created_at: createdAt,
        local_question: true
    };

    store[userKey] = list.filter(item => item.id !== id).concat(bookmark);

    if (!writeQuestionBookmarkStore(store)) {
        return { ok: false, saved: false, message: "Bookmark storage full" };
    }

    queueQuestionBookmarkSync("save", bookmark);
    return { ok: true, saved: true, bookmark, message: "Bookmark saved" };
}

function removeQuestionBookmarkLocal(user, questionId, source) {
    if (!questionId) return { ok: false, saved: false, message: "Question missing" };

    const userKey = getBookmarkUserKey(user);
    const id = getQuestionBookmarkId(user, questionId, source || "read");
    const store = readQuestionBookmarkStore();
    const list = Array.isArray(store[userKey]) ? store[userKey] : [];
    const found = list.find(item => item.id === id);

    store[userKey] = list.filter(item => item.id !== id);

    if (!writeQuestionBookmarkStore(store)) {
        return { ok: false, saved: true, message: "Bookmark update failed" };
    }

    if (found) queueQuestionBookmarkSync("remove", found);
    return { ok: true, saved: false, message: "Bookmark removed" };
}

function toggleQuestionBookmarkLocal(user, payload) {
    const source = payload?.source || "read";
    if (isQuestionBookmarked(user, payload?.question_id, source)) {
        return removeQuestionBookmarkLocal(user, payload.question_id, source);
    }
    return saveQuestionBookmarkLocal(user, payload);
}

async function syncQuestionBookmarkQueue(user) {
    const activeUser = user || (typeof getUserSession === "function" ? getUserSession() : null);
    const userId = activeUser?.id || activeUser?.user_id;
    if (!userId || !window.tetSupabase || !CONFIG?.TABLES?.BOOKMARKS) return { ok: false, synced: 0 };

    const queue = readQuestionBookmarkQueue();
    if (!queue.length) return { ok: true, synced: 0 };

    const remaining = [];
    let synced = 0;

    for (const item of queue) {
        const bookmark = item.bookmark || {};
        if (bookmark.user_key && bookmark.user_key !== getBookmarkUserKey(activeUser)) {
            remaining.push(item);
            continue;
        }

        try {
            if (item.action === "remove") {
                const { error } = await window.tetSupabase
                    .from(CONFIG.TABLES.BOOKMARKS)
                    .delete()
                    .eq("user_id", userId)
                    .eq("bookmark_ref_id", bookmark.bookmark_ref_id);
                if (error) throw error;
            } else {
                const { error } = await window.tetSupabase
                    .from(CONFIG.TABLES.BOOKMARKS)
                    .insert({
                        user_id: userId,
                        bookmark_type: "question",
                        bookmark_ref_id: bookmark.bookmark_ref_id,
                        subject: bookmark.subject || "General",
                        chapter_name: bookmark.chapter_name || "Question",
                        exam_year: null
                    });
                if (error && !String(error.message || "").toLowerCase().includes("duplicate")) throw error;
            }
            synced += 1;
        } catch (error) {
            console.warn("Question bookmark sync skipped", error);
            remaining.push(item);
        }
    }

    writeQuestionBookmarkQueue(remaining);
    return { ok: true, synced };
}

window.addEventListener("online", function () {
    syncQuestionBookmarkQueue();
});

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

function shouldShowGlobalErrorToast() {
    return window.TET_SHOW_GLOBAL_ERROR_TOAST === true;
}

window.addEventListener("error", function (event) {
    console.error("Global Error:", event.error || event.message);
    if (shouldShowGlobalErrorToast()) {
        showToast("Something went wrong. Please try again.", "error");
    }
});

window.addEventListener("unhandledrejection", function (event) {
    console.error("Unhandled Promise Error:", event.reason);
    if (shouldShowGlobalErrorToast()) {
        showToast("Something went wrong. Please try again.", "error");
    }
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
   GLOBAL TRIAL / PREMIUM FLOW
========================================================= */

function getPremiumFlowSetting(key, fallback) {
    try {
        if (typeof getAppSetting === "function") {
            const value = getAppSetting(key, null);
            if (value !== null && value !== undefined && value !== "") return value;
        }
    } catch {}

    try {
        if (window.APP && APP[key] !== undefined && APP[key] !== null && APP[key] !== "") return APP[key];
    } catch {}

    return fallback;
}

function parseAppDate(value) {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
}

function addDays(date, days) {
    const next = new Date(date.getTime());
    next.setDate(next.getDate() + Number(days || 0));
    return next;
}

function formatShortDotDate(value) {
    const date = value instanceof Date ? value : parseAppDate(value);
    if (!date) return "";
    const dd = String(date.getDate()).padStart(2, "0");
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const yy = String(date.getFullYear()).slice(-2);
    return dd + "." + mm + "." + yy;
}

function getTrialStartDate(status, user) {
    return parseAppDate(
        status?.trial_start_at ||
        status?.trial_start_date ||
        status?.started_at ||
        status?.created_at ||
        user?.trial_start_at ||
        user?.created_at ||
        user?.createdAt ||
        new Date().toISOString()
    );
}

function getTrialEndDate(status, user) {
    const fixedEnd = parseAppDate(status?.trial_end_date || status?.trial_valid_until || status?.trialEndDate);
    if (fixedEnd) return fixedEnd;

    const start = getTrialStartDate(status, user) || new Date();
    return addDays(start, 7);
}

function isPremiumStatus(status, user) {
    if (!status) return false;

    const subscriptionStatus = String(
        status.subscription_status ||
        status.status ||
        ""
    ).toLowerCase();

    const validUntil = parseAppDate(status.premium_valid_until || status.valid_until || status.expiry_date || status.premiumValidUntil);
    if (subscriptionStatus !== "premium" || !validUntil) return false;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    validUntil.setHours(23, 59, 59, 999);

    return validUntil.getTime() >= today.getTime();
}

function getTrialDaysLeft(status, user) {
    const end = getTrialEndDate(status, user);
    const diff = end.getTime() - Date.now();
    return Math.max(0, Math.ceil(diff / (24 * 60 * 60 * 1000)));
}

const TET_EXPIRED_REMINDER_KEY = "tet_expired_trial_later_at";
const TET_EXPIRED_REMINDER_WAIT_MS = 5 * 60 * 1000;
const TET_EXPIRED_REMINDER_DELAY_MS = 2000;

function getExpiredTrialReminderKey(user) {
    const activeUser = user || (window.TETPremiumState && window.TETPremiumState.user) || (typeof getUserSession === "function" ? getUserSession() : null) || {};
    const userKey = activeUser.id || activeUser.user_id || activeUser.phone || activeUser.mobile || "guest";
    return TET_EXPIRED_REMINDER_KEY + "_" + String(userKey);
}

function isExpiredPremiumStatus(status) {
    if (!status) return false;

    const subscriptionStatus = String(
        status.subscription_status ||
        status.status ||
        ""
    ).toLowerCase();

    const validUntil = parseAppDate(status.premium_valid_until || status.valid_until || status.expiry_date || status.premiumValidUntil);
    if (subscriptionStatus !== "premium" || !validUntil) return false;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    validUntil.setHours(23, 59, 59, 999);

    return validUntil.getTime() < today.getTime();
}

function isTrialExpiredStatus(status, user) {
    return isExpiredPremiumStatus(status) || (!isPremiumStatus(status, user) && getTrialDaysLeft(status, user) <= 0);
}

function markExpiredTrialReminderLater(user) {
    try {
        localStorage.setItem(getExpiredTrialReminderKey(user), String(Date.now()));
    } catch {}
}

function clearExpiredTrialReminderMemory() {
    try {
        Object.keys(localStorage).forEach(function (key) {
            if (key === TET_EXPIRED_REMINDER_KEY || key.indexOf(TET_EXPIRED_REMINDER_KEY + "_") === 0) {
                localStorage.removeItem(key);
            }
        });
    } catch {}
}

function canShowExpiredTrialReminder(status, user) {
    if (!isTrialExpiredStatus(status, user)) return false;
    if (document.querySelector(".premium-global-modal")) return false;

    const lastLater = Number(localStorage.getItem(getExpiredTrialReminderKey(user)) || 0);
    return !lastLater || Date.now() - lastLater >= TET_EXPIRED_REMINDER_WAIT_MS;
}

function closeGlobalPremiumModalAsLater() {
    const context = getActivePremiumContext();
    if (isTrialExpiredStatus(context.status, context.user)) {
        markExpiredTrialReminderLater(context.user);
    }
    removeGlobalPremiumModal();
}

function scheduleExpiredTrialReminder(status, user, options = {}) {
    const context = getActivePremiumContext(status, user);
    if (!isTrialExpiredStatus(context.status, context.user)) return false;

    window.clearTimeout(window.__tetExpiredTrialReminderTimer);
    window.__tetExpiredTrialReminderTimer = window.setTimeout(function () {
        const latest = getActivePremiumContext(context.status, context.user);
        if (canShowExpiredTrialReminder(latest.status, latest.user)) {
            showGlobalPremiumEntry(latest.status, latest.user);
        }
    }, Number(options.delayMs || TET_EXPIRED_REMINDER_DELAY_MS));

    return true;
}
const TET_PREMIUM_STATUS_CACHE_PREFIX = "tet_latest_premium_status_";

function getPremiumStatusCacheUserKey(user) {
    const activeUser = user || (typeof getUserSession === "function" ? getUserSession() : null) || {};
    return String(activeUser.id || activeUser.user_id || activeUser.phone || activeUser.mobile || activeUser.phone_number || activeUser.user_phone || "guest");
}

function getPremiumStatusCacheKey(user) {
    return TET_PREMIUM_STATUS_CACHE_PREFIX + getPremiumStatusCacheUserKey(user);
}

function saveCachedTrialPremiumStatus(user, status) {
    try {
        if (!user || !status) return;
        localStorage.setItem(getPremiumStatusCacheKey(user), JSON.stringify({
            saved_at: Date.now(),
            status: status
        }));
    } catch {}
}

function getCachedTrialPremiumStatus(user) {
    try {
        if (!user) return null;
        const raw = localStorage.getItem(getPremiumStatusCacheKey(user));
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        return parsed && parsed.status ? parsed.status : null;
    } catch {
        return null;
    }
}
function getStatusSortTime(status) {
    const date = parseAppDate(
        status?.updated_at ||
        status?.last_renewed_at ||
        status?.premium_valid_until ||
        status?.premium_activated_date ||
        status?.trial_end_date ||
        status?.created_at
    );
    return date ? date.getTime() : 0;
}

function chooseCurrentTrialPremiumStatus(rows, user) {
    const list = Array.isArray(rows) ? rows.filter(Boolean) : [];
    if (!list.length) return null;

    const activePremiumRows = list
        .filter(function (row) { return isPremiumStatus(row, user); })
        .sort(function (a, b) {
            const aUntil = parseAppDate(a?.premium_valid_until || a?.valid_until || a?.expiry_date || a?.premiumValidUntil);
            const bUntil = parseAppDate(b?.premium_valid_until || b?.valid_until || b?.expiry_date || b?.premiumValidUntil);
            return (bUntil ? bUntil.getTime() : 0) - (aUntil ? aUntil.getTime() : 0);
        });

    if (activePremiumRows.length) return activePremiumRows[0];

    return list.sort(function (a, b) {
        return getStatusSortTime(b) - getStatusSortTime(a);
    })[0];
}

async function fetchFreshTrialPremiumStatus(user) {
    try {
        if (!user || !window.supabase || !CONFIG?.TABLES?.TRIAL_PREMIUM) return null;

        const userId = user.id || user.user_id || null;
        const phone = user.phone || user.mobile || user.phone_number || user.user_phone || null;
        let query = supabase.from(CONFIG.TABLES.TRIAL_PREMIUM).select("*").limit(10);

        if (userId) query = query.eq("user_id", userId);
        else if (phone) query = query.eq("phone", phone);
        else return null;

        const { data, error } = await query.order("created_at", { ascending: false });

        if (error) {
            console.warn("Trial/premium status refresh failed:", error.message || error);
            return null;
        }

        const freshStatus = chooseCurrentTrialPremiumStatus(data, user);
        saveCachedTrialPremiumStatus(user, freshStatus);
        return freshStatus;
    } catch (error) {
        console.warn("Trial/premium status refresh failed:", error?.message || error);
        return null;
    }
}
function normalizeSessionPremiumStatus(user, status) {
    if (!user || !status) return user;
    const nextUser = Object.assign({}, user, {
        subscription_status: status.subscription_status || status.status || user.subscription_status || user.status,
        status: status.status || status.subscription_status || user.status,
        trial_start_date: status.trial_start_date || user.trial_start_date,
        trial_end_date: status.trial_end_date || user.trial_end_date,
        premium_started_at: status.premium_started_at || status.premium_activated_date || user.premium_started_at,
        premium_valid_until: status.premium_valid_until || status.valid_until || status.expiry_date || user.premium_valid_until
    });

    try { saveUserSession(nextUser); } catch {}
    saveCachedTrialPremiumStatus(nextUser, status);
    return nextUser;
}
function getTrialPremiumModel(status, user, mode) {
    const validUntil = status?.premium_valid_until || status?.valid_until || status?.expiry_date || status?.premiumValidUntil;

    if (isPremiumStatus(status, user)) {
        return {
            state: "premium",
            title: "Premium Member",
            small: "Valid Until " + (formatDate(validUntil) || "")
        };
    }

    const end = getTrialEndDate(status, user);
    const days = getTrialDaysLeft(status, user);

    if (isExpiredPremiumStatus(status) || days <= 0) {
        return {
            state: "expired",
            title: "Go Premium",
            small: "Unlock all benefits"
        };
    }

    if (mode === "days") {
        return {
            state: "trial",
            title: "Trial Version",
            small: days + (days === 1 ? " Day Left" : " Days Left")
        };
    }

    return {
        state: "trial",
        title: "Trial Version",
        small: "Ends " + formatShortDotDate(end)
    };
}

function renderTrialPremiumBadge(elementOrId, status, user, options = {}) {
    const el = typeof elementOrId === "string" ? document.getElementById(elementOrId) : elementOrId;
    if (!el) return null;

    let currentUser = user;
    let currentStatus = getCachedTrialPremiumStatus(currentUser) || status;
    if (currentStatus !== status) {
        currentUser = normalizeSessionPremiumStatus(currentUser, currentStatus);
    }
    window.TETPremiumState = { status: currentStatus, user: currentUser };

    function applyBadge(nextStatus, nextUser) {
        currentStatus = nextStatus;
        currentUser = nextUser;
        window.TETPremiumState = { status: currentStatus, user: currentUser };

        const model = getTrialPremiumModel(currentStatus, currentUser, options.mode || "end");
        const titleHTML = model.state === "premium"
            ? "&#9818; " + escapeHTML(model.title)
            : escapeHTML(model.title);

        el.classList.toggle("premium", model.state === "premium");
        el.classList.toggle("expired", model.state === "expired");
        el.dataset.subscriptionState = model.state;
        el.innerHTML = "<b>" + titleHTML + "</b><small>" + escapeHTML(model.small) + "</small>";

        if (model.state === "expired") {
            el.setAttribute("role", "button");
            el.tabIndex = 0;
            el.onclick = function () { showGlobalPremiumEntry(currentStatus, currentUser); };
        } else {
            el.removeAttribute("role");
            el.removeAttribute("tabindex");
            el.onclick = null;
        }

        return model;
    }

    const model = applyBadge(currentStatus, currentUser);

    if (currentUser && !options.skipFreshStatus) {
        fetchFreshTrialPremiumStatus(currentUser).then(function (freshStatus) {
            if (!freshStatus) return;
            const freshUser = normalizeSessionPremiumStatus(currentUser, freshStatus);
            const oldSignature = JSON.stringify({
                state: model.state,
                title: model.title,
                small: model.small
            });
            const freshModel = getTrialPremiumModel(freshStatus, freshUser, options.mode || "end");
            const freshSignature = JSON.stringify({
                state: freshModel.state,
                title: freshModel.title,
                small: freshModel.small
            });

            if (freshSignature !== oldSignature) {
                applyBadge(freshStatus, freshUser);
                window.dispatchEvent(new CustomEvent("tetPremiumStatusUpdated", {
                    detail: { status: freshStatus, user: freshUser }
                }));
            }
        });
    }

    return model;
}

function getPremiumWhatsAppMessage() {
    const user = typeof getUserSession === "function" ? (getUserSession() || {}) : {};
    const fee = 299;
    const paymentLink = getPremiumFlowSetting("payment_link", "https://tinyurl.com/Tet-Success-Pay-now");
    const name = user.full_name || user.name || "Not available";
    const phone = user.phone || user.mobile || "Not available";

    return `Hello,

I want to upgrade to TET Success Premium.

Name: ${name}
Phone: ${phone}

Plan:
Premium Membership

Subscription Fee:
â‚¹${fee} (One-Time Payment)

Premium Validity:
3 months premium access

Access:
Premium access for 3 months after admin approval / renewal.

Self Declaration:
I have read and accepted that TET Success provides educational guidance and learning resources only. I understand that passing the examination depends on my own preparation and performance, and TET Success does not guarantee exam success.

Payment Link:
${paymentLink}

After payment send screenshot for confirmation.

Thank you.`;
}

function removeGlobalPremiumModal() {
    document.querySelectorAll(".premium-global-modal").forEach(modal => modal.remove());
}

function getActivePremiumContext(status, user) {
    const saved = window.TETPremiumState || {};
    let sessionUser = null;
    try {
        sessionUser = typeof getUserSession === "function" ? getUserSession() : null;
    } catch {
        sessionUser = null;
    }

    return {
        status: status || saved.status || null,
        user: user || saved.user || sessionUser || null
    };
}

function showGlobalPremiumEntry(status, user) {
    const context = getActivePremiumContext(status, user);
    if (isPremiumStatus(context.status, context.user)) {
        showGlobalPremiumUserModal(context.status, context.user);
        return;
    }

    showGlobalPremiumModal();
}

function showGlobalPremiumUserModal(status, user) {
    removeGlobalPremiumModal();

    const validUntil = status?.premium_valid_until || status?.valid_until || status?.expiry_date || status?.premiumValidUntil;
    const validText = formatDate(validUntil) || "your premium validity date";
    const modal = document.createElement("div");
    modal.className = "premium-global-modal";
    modal.innerHTML = `
        <div class="premium-global-card" role="dialog" aria-modal="true">
            <button class="premium-global-close" type="button" data-premium-close>&times;</button>
            <span class="premium-global-badge">Premium Member</span>
            <h2>Premium User</h2>
            <p class="premium-global-sub">Enjoy all premium benefits up to ${escapeHTML(validText)}.</p>
            <div class="premium-global-actions">
                <button class="premium-global-btn primary" type="button" data-premium-close>Back</button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
    requestAnimationFrame(() => modal.classList.add("show"));
    modal.querySelectorAll("[data-premium-close]").forEach(btn => btn.addEventListener("click", removeGlobalPremiumModal));
}
function showGlobalPremiumModal() {
    const context = getActivePremiumContext();
    if (isPremiumStatus(context.status, context.user)) {
        showGlobalPremiumUserModal(context.status, context.user);
        return;
    }

    removeGlobalPremiumModal();

    const fee = 299;
    const modal = document.createElement("div");
    modal.className = "premium-global-modal";
    modal.innerHTML = `
        <div class="premium-global-card" role="dialog" aria-modal="true">
            <button class="premium-global-close" type="button" data-premium-close>&times;</button>
            <span class="premium-global-badge">Premium Access</span>
            <h2>Unlock Premium Access</h2>
            <p class="premium-global-price">â‚¹${escapeHTML(fee)} Only - One Time Payment</p>
            <p class="premium-global-sub">Premium access for 3 months.</p>
            <p class="premium-global-note">This small one-time amount can support your preparation, confidence, and long-term teaching career.</p>
            <div class="premium-global-actions">
                <button class="premium-global-btn light" type="button" data-premium-later>Later</button>
                <button class="premium-global-btn primary" type="button" data-premium-subscribe>Subscribe Now</button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
    requestAnimationFrame(() => modal.classList.add("show"));
    modal.querySelectorAll("[data-premium-close]").forEach(btn => btn.addEventListener("click", removeGlobalPremiumModal));
    modal.querySelectorAll("[data-premium-later]").forEach(btn => btn.addEventListener("click", closeGlobalPremiumModalAsLater));
    modal.querySelector("[data-premium-subscribe]").addEventListener("click", showGlobalDeclarationModal);
}

function showGlobalDeclarationModal() {
    removeGlobalPremiumModal();

    const modal = document.createElement("div");
    modal.className = "premium-global-modal";
    modal.innerHTML = `
        <div class="premium-global-card" role="dialog" aria-modal="true">
            <button class="premium-global-close" type="button" data-premium-close>&times;</button>
            <span class="premium-global-badge">Self Declaration</span>
            <h2>Self Declaration</h2>
            <p class="premium-global-text">TET Success is an educational learning platform designed to help you prepare for the TET examination through study materials, practice questions, mock tests, and guidance.</p>
            <p class="premium-global-text">While we are committed to providing high-quality learning resources, we do not guarantee success or selection in any examination. Your result depends on your own preparation, effort, and performance.</p>
            <label class="premium-global-check"><input id="globalAgreeDeclaration" type="checkbox"> <span>I have read and understood the above declaration and agree to continue.</span></label>
            <div class="premium-global-actions">
                <button class="premium-global-btn light" type="button" data-premium-later>Later</button>
                <button class="premium-global-btn primary" id="globalContinuePayment" type="button" disabled>CONTINUE TO PAYMENT</button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
    requestAnimationFrame(() => modal.classList.add("show"));

    const agree = modal.querySelector("#globalAgreeDeclaration");
    const continueBtn = modal.querySelector("#globalContinuePayment");
    modal.querySelectorAll("[data-premium-close]").forEach(btn => btn.addEventListener("click", removeGlobalPremiumModal));
    modal.querySelectorAll("[data-premium-later]").forEach(btn => btn.addEventListener("click", closeGlobalPremiumModalAsLater));
    agree.addEventListener("change", () => { continueBtn.disabled = !agree.checked; });
    continueBtn.addEventListener("click", function () {
        if (!agree.checked) {
            showToast("Please agree before continuing", "warning");
            return;
        }
        removeGlobalPremiumModal();
        const adminPhone = getPremiumFlowSetting("admin_whatsapp_number", getPremiumFlowSetting("admin_whatsapp", "9836697502"));
        openWhatsApp(adminPhone, getPremiumWhatsAppMessage());
        showToast("Subscription request opened", "success");
    });
}

/* =========================================================
   20. PREMIUM BADGE HELPER
========================================================= */

function getStatusBadge(status, premiumValidUntil = "") {
    if (status === "premium" || status === "Premium Member") {
        return `
            <div class="tet-badge premium">
                &#9818; Premium Member
                <small>Valid Until: ${escapeHTML(formatDate(premiumValidUntil))}</small>
            </div>
        `;
    }

    return `
        <div class="tet-badge trial">
            Trial Version
        </div>
    `;
}


function isEditableTarget(target) {
    if (!target) return false;
    return !!target.closest('input, textarea, select, [contenteditable="true"]');
}

function initAppSelectionGuard() {
    document.addEventListener("selectstart", function (event) {
        if (!isEditableTarget(event.target)) event.preventDefault();
    }, { passive: false });

    document.addEventListener("contextmenu", function (event) {
        if (!isEditableTarget(event.target)) event.preventDefault();
    }, { passive: false });

    document.addEventListener("copy", function (event) {
        if (!isEditableTarget(event.target)) event.preventDefault();
    }, { passive: false });

    document.addEventListener("dragstart", function (event) {
        event.preventDefault();
    }, { passive: false });
}

/* =========================================================
   21. INITIALIZE COMMON
========================================================= */

function initializeCommon() {
    initAppSelectionGuard();
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











