/* =========================================================
   TET SUCCESS - learnEvents.js
   Event Controller
   Depends on:
   - learnData.js
   - learnRoadmap.js
   - learnProgress.js
   - learnBookmarks.js
   - learnRender.js
   ========================================================= */

"use strict";

window.TETLearnEvents = (function () {
    const DATA = window.TETLearnData;
    const ROADMAP = window.TETLearnRoadmap;
    const PROGRESS = window.TETLearnProgress;
    const BOOKMARKS = window.TETLearnBookmarks;
    const RENDER = window.TETLearnRender;

    if (!DATA || !ROADMAP || !PROGRESS || !BOOKMARKS || !RENDER) {
        console.error("TETLearnEvents failed: missing dependency");
        return {};
    }

    let bound = false;

    function $(selector, root = document) {
        return root.querySelector(selector);
    }

    function $all(selector, root = document) {
        return Array.from(root.querySelectorAll(selector));
    }

    function safeNumber(value, fallback = 1) {
        const num = Number(value);
        return Number.isFinite(num) ? num : fallback;
    }

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

    function pageFromConfig(key, fallback) {
        try {
            return CONFIG?.[key] || fallback;
        } catch {
            return fallback;
        }
    }

    function goToPage(page) {
        if (!page) return;

        if (typeof navigateTo === "function") {
            navigateTo(page);
            return;
        }

        window.location.href = page;
    }

    function getReadPage() {
        return pageFromConfig("READ_PAGE", DATA.pages.read || "read.html");
    }

    function getPracticePage() {
        return pageFromConfig("PRACTICE_PAGE", DATA.pages.practice || "practice.html");
    }

    function getBookmarksPage() {
        return pageFromConfig("BOOKMARKS_PAGE", DATA.pages.bookmarks || "bookmarks.html");
    }

    function getPremiumPage() {
        return pageFromConfig("PREMIUM_PAGE", DATA.pages.premium || "premium.html");
    }

    function buildLearningUrl(action, groupId, levelNo) {
        const base = action === "read" ? getReadPage() : getPracticePage();

        const params = new URLSearchParams({
            group: groupId,
            level: String(levelNo),
            from: "learn"
        });

        return base + "?" + params.toString();
    }

    async function openLearning(action, groupId, levelNo) {
        const progress = PROGRESS.getProgress();
        const premium = PROGRESS.getPremiumStatus();
        const state = ROADMAP.getLevelState(progress, groupId, levelNo, premium);

        if (!state.exists) {
            toast("Level not found", "error");
            return;
        }

        if (!state.unlocked) {
            if (state.premiumLocked) {
                showPremiumModal(groupId, levelNo);
                return;
            }

            toast(state.message || "This level is locked", "warning");
            return;
        }

        await PROGRESS.setCurrentLevel(groupId, levelNo, {
            action,
            save: true
        });

        RENDER.renderAll();

        goToPage(buildLearningUrl(action, groupId, levelNo));
    }

    function showPremiumModal(groupId, levelNo) {
        const message = `${groupId} Level ${levelNo} is available for Premium students.`;

        if (typeof showConfirmModal === "function") {
            showConfirmModal({
                title: "Premium Level Locked",
                message,
                confirmText: "Upgrade Now",
                cancelText: "Not Now",
                onConfirm: () => goToPage(getPremiumPage())
            });
            return;
        }

        toast("Premium required to unlock this level", "warning");
    }

    function handleLockedRow(row) {
        const groupId = row.dataset.group || "Primary";
        const levelNo = safeNumber(row.dataset.level, 1);

        const progress = PROGRESS.getProgress();
        const premium = PROGRESS.getPremiumStatus();
        const state = ROADMAP.getLevelState(progress, groupId, levelNo, premium);

        if (state.premiumLocked) {
            showPremiumModal(groupId, levelNo);
            return;
        }

        toast(state.message || "This level is locked", "warning");
    }

    function handleCollapsedGroup(btn) {
        const groupId = btn.dataset.group;
        if (!groupId) return;

        const progress = PROGRESS.getProgress();
        const premium = PROGRESS.getPremiumStatus();
        const state = ROADMAP.getGroupState(progress, groupId, premium);

        if (!state.exists) {
            toast("Group not found", "error");
            return;
        }

        if (!state.unlocked) {
            toast(state.message || "First clear previous level", "warning");
            return;
        }

        const opened = RENDER.openGroup(groupId);

        if (opened) {
            bindDynamicEvents();
        }
    }

    async function handleBookmarkMain() {
        goToPage(getBookmarksPage());
    }

    async function toggleLevelBookmark(groupId, levelNo, action = "practice") {
        const result = await BOOKMARKS.toggleLevelBookmark(groupId, levelNo, action);

        if (result?.ok) {
            toast(result.message || "Bookmark updated", "success");
        } else {
            toast(result?.message || "Bookmark update failed", "error");
        }

        RENDER.renderBookmarkButton();
    }

    function bindActionButtons(root = document) {
        $all("[data-action]", root).forEach((btn) => {
            if (btn.dataset.learnActionBound === "true") return;
            btn.dataset.learnActionBound = "true";

            btn.addEventListener("click", function (event) {
                event.preventDefault();
                event.stopPropagation();

                const action = btn.dataset.action || "read";
                const groupId = btn.dataset.group || "Primary";
                const levelNo = safeNumber(btn.dataset.level, 1);

                openLearning(action, groupId, levelNo);
            });
        });
    }

    function bindLevelRows(root = document) {
        $all(".level-row", root).forEach((row) => {
            if (row.dataset.learnRowBound === "true") return;
            row.dataset.learnRowBound = "true";

            row.addEventListener("click", function () {
                if (row.dataset.unlocked === "true") return;
                handleLockedRow(row);
            });
        });
    }

    function bindCollapsedGroups() {
        $all(".collapsed-group").forEach((btn) => {
            if (btn.dataset.learnGroupBound === "true") return;
            btn.dataset.learnGroupBound = "true";

            btn.addEventListener("click", function () {
                handleCollapsedGroup(btn);
            });
        });
    }

    function bindBookmarkButton() {
        const btn = document.getElementById("bookmarkedMainBtn");
        if (!btn || btn.dataset.learnBookmarkBound === "true") return;

        btn.dataset.learnBookmarkBound = "true";

        btn.addEventListener("click", function () {
            handleBookmarkMain();
        });
    }

    function bindBottomNav() {
        $all(".home-bottom-nav [data-page]").forEach((btn) => {
            if (btn.dataset.learnNavBound === "true") return;
            btn.dataset.learnNavBound = "true";

            btn.addEventListener("click", function () {
                const page = btn.dataset.page;
                if (page) goToPage(page);
            });
        });
    }

    function bindDynamicEvents() {
        bindActionButtons(document);
        bindLevelRows(document);
    }

    function bindStorageResultListener() {
        if (window.__tetLearnStorageListenerBound) return;
        window.__tetLearnStorageListenerBound = true;

        window.addEventListener("storage", async function (event) {
            if (event.key !== "tet_success_learn_result") return;

            await PROGRESS.consumeStorageResult();
            RENDER.renderAll();
        });
    }

    function setupBackRule() {
        if (window.__tetLearnBackRuleBound) return;
        window.__tetLearnBackRuleBound = true;

        try {
            history.pushState(null, "", location.href);

            window.addEventListener("popstate", function () {
                goToPage(pageFromConfig("INFO_PAGE", DATA.pages.info || "info.html"));
            });
        } catch (error) {
            console.warn("Learn back rule failed:", error);
        }
    }

    function bindAll() {
        if (bound) {
            bindDynamicEvents();
            return;
        }

        bound = true;

        bindBookmarkButton();
        bindActionButtons(document);
        bindLevelRows(document);
        bindCollapsedGroups();
        bindBottomNav();
        bindStorageResultListener();
        setupBackRule();
    }

    return {
        bindAll,
        bindDynamicEvents,
        openLearning,
        toggleLevelBookmark,
        showPremiumModal,
        goToPage
    };
})();
