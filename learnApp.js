/* =========================================================
   TET SUCCESS - learnApp.js
   Master Learn Page Controller
   Starts and connects all Learn modules
   Depends on:
   - config.js
   - common.js
   - supabase.js
   - tet_app_settings.js
   - learnData.js
   - learnSupabase.js
   - learnRoadmap.js
   - learnProgress.js
   - learnBookmarks.js
   - learnRender.js
   - learnEvents.js
   ========================================================= */

"use strict";

window.TETLearnApp = (function () {
    const DATA = window.TETLearnData;
    const PROGRESS = window.TETLearnProgress;
    const BOOKMARKS = window.TETLearnBookmarks;
    const RENDER = window.TETLearnRender;
    const EVENTS = window.TETLearnEvents;

    if (!DATA || !PROGRESS || !BOOKMARKS || !RENDER || !EVENTS) {
        console.error("TETLearnApp failed: missing dependency");
        return {};
    }

    let initialized = false;
    let currentUser = null;

    function toast(message, type = "info") {
        if (typeof showToast === "function") {
            showToast(message, type);
            return;
        }

        const toastEl = document.getElementById("learnToast");
        if (!toastEl) return;

        toastEl.textContent = message;
        toastEl.classList.add("show");

        clearTimeout(toast.timer);
        toast.timer = setTimeout(() => {
            toastEl.classList.remove("show");
        }, 2500);
    }

    function showPageLoading(message = "Loading Learn...") {
        clearTimeout(showPageLoading.timer);
        showPageLoading.visible = false;

        showPageLoading.timer = setTimeout(() => {
            if (typeof showLoading === "function") {
                showLoading(message);
                showPageLoading.visible = true;
            }
        }, 300);
    }

    function hidePageLoading() {
        clearTimeout(showPageLoading.timer);
        showPageLoading.timer = null;

        if (showPageLoading.visible && typeof hideLoading === "function") {
            hideLoading();
        }

        showPageLoading.visible = false;
    }

    function getLoginPage() {
        try {
            return CONFIG?.LOGIN_PAGE || DATA.pages.login || "index.html";
        } catch {
            return DATA.pages.login || "index.html";
        }
    }

    function getUser() {
        try {
            if (typeof getUserSession === "function") {
                const user = getUserSession();
                if (user) return user;
            }

            const keys = [
                "tet_success_user_session",
                "tet_user",
                "tetUser",
                "TET_USER",
                "user",
                "currentUser",
                "current_user"
            ];

            for (const key of keys) {
                const raw = localStorage.getItem(key);
                if (!raw) continue;

                try {
                    const parsed = JSON.parse(raw);
                    if (parsed) return parsed;
                } catch {
                    return { phone: raw };
                }
            }
        } catch (error) {
            console.warn("Learn user load failed:", error);
        }

        return null;
    }

    function requireLogin() {
        try {
            if (typeof requireUserLogin === "function") {
                const allowed = requireUserLogin();
                if (!allowed) return null;
            }
        } catch {}

        const user = getUser();

        if (!user) {
            window.location.href = getLoginPage();
            return null;
        }

        return user;
    }

    async function loadAppSettingsIfNeeded() {
        try {
            if (
                typeof isAppSettingsLoaded === "function" &&
                typeof loadTetAppSettings === "function"
            ) {
                if (!isAppSettingsLoaded()) {
                    await loadTetAppSettings();
                }
            }
        } catch (error) {
            console.warn("Learn app settings load skipped:", error);
        }
    }

    async function loadModules(user) {
        PROGRESS.setUser(user);
        BOOKMARKS.setUser(user);

        await PROGRESS.loadAll(user);
        await BOOKMARKS.load(user);

        await PROGRESS.consumeAnyResult();
    }

    function renderAndBind() {
        RENDER.renderAll();
        if (typeof scheduleExpiredTrialReminder === "function") {
            scheduleExpiredTrialReminder(PROGRESS.getStatus(), currentUser);
        }
        EVENTS.bindAll();
        focusContinueTarget();
    }

    function focusContinueTarget() {
        const params = new URLSearchParams(window.location.search);

        if (params.get("focus") !== "1") return;

        const group = params.get("group") || PROGRESS.getProgress()?.current_group || "Primary";
        const level = Number(params.get("level") || PROGRESS.getProgress()?.current_level || 1);

        window.setTimeout(() => {
            if (RENDER.focusLevel) {
                RENDER.focusLevel(group, level);
            }
        }, 250);
    }

    async function refresh() {
        if (!currentUser) return false;

        showPageLoading("Refreshing Learn...");

        try {
            await loadModules(currentUser);
            renderAndBind();
            toast("Learn updated", "success");
            return true;
        } catch (error) {
            console.error("Learn refresh failed:", error);
            toast("Unable to refresh Learn page", "error");
            return false;
        } finally {
            hidePageLoading();
        }
    }

    async function init() {
        if (initialized) return;

        initialized = true;

        RENDER.setLoading();
        showPageLoading("Loading Learn...");

        try {
            currentUser = requireLogin();

            if (!currentUser) return;

            await loadAppSettingsIfNeeded();
            await loadModules(currentUser);

            renderAndBind();

            document.body.classList.add("learn-app-ready");

            console.log("TET Learn App Loaded");
        } catch (error) {
            console.error("Learn app init failed:", error);
            RENDER.setError();
            toast("Learn page failed to load", "error");
        } finally {
            hidePageLoading();
        }
    }

    function getState() {
        return {
            user: currentUser,
            progress: PROGRESS.getProgress(),
            status: PROGRESS.getStatus(),
            isPremium: PROGRESS.getPremiumStatus(),
            bookmarks: BOOKMARKS.getBookmarks()
        };
    }

    window.addEventListener("online", function () {
        toast("Back online", "success");
        refresh();
    });

    window.addEventListener("offline", function () {
        toast("Offline mode", "warning");
    });

    document.addEventListener("DOMContentLoaded", init);

    return {
        init,
        refresh,
        getState
    };
})();

