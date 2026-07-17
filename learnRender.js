/* =========================================================
   TET SUCCESS - learnRender.js
   UI Render Controller
   DOM Rendering Only | No Supabase | No Events
   Depends on:
   - learnData.js
   - learnRoadmap.js
   - learnProgress.js
   - learnBookmarks.js
   ========================================================= */

"use strict";

window.TETLearnRender = (function () {
    const DATA = window.TETLearnData;
    const ROADMAP = window.TETLearnRoadmap;
    const PROGRESS = window.TETLearnProgress;
    const BOOKMARKS = window.TETLearnBookmarks;

    if (!DATA || !ROADMAP || !PROGRESS || !BOOKMARKS) {
        console.error("TETLearnRender failed: missing dependency");
        return {};
    }

    /* =====================================================
       01. DOM HELPERS
    ===================================================== */

    function $(selector, root = document) {
        return root.querySelector(selector);
    }

    function $all(selector, root = document) {
        return Array.from(root.querySelectorAll(selector));
    }

    function byId(id) {
        return document.getElementById(id);
    }

    function safeNumber(value, fallback = 0) {
        const num = Number(value);
        return Number.isFinite(num) ? num : fallback;
    }

    function escapeSafe(value) {
        if (typeof escapeHTML === "function") return escapeHTML(value);

        return String(value ?? "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function formatDate(value) {
        if (!value) return "";

        try {
            const date = new Date(value);
            if (!Number.isNaN(date.getTime())) {
                return date.toLocaleDateString("en-IN", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric"
                });
            }
        } catch {}

        return String(value);
    }

    /* =====================================================
       02. DOM CACHE
    ===================================================== */

    const DOM = {
        statusBadge: null,
        currentGroupText: null,
        currentLevelText: null,
        completedQuestionsText: null,
        totalQuestionsText: null,
        bookmarkedMainBtn: null,
        primaryRoadmapCard: null,
        primaryLevelList: null
    };

    function cacheDOM() {
        DOM.statusBadge = byId("learnStatusBadge");
        DOM.currentGroupText = byId("currentGroupText");
        DOM.currentLevelText = byId("currentLevelText");
        DOM.completedQuestionsText = byId("completedQuestionsText");
        DOM.totalQuestionsText = byId("totalQuestionsText");
        DOM.bookmarkedMainBtn = byId("bookmarkedMainBtn");
        DOM.primaryRoadmapCard = byId("primaryRoadmapCard");
        DOM.primaryLevelList = byId("primaryLevelList");
    }

    function setText(el, value) {
        if (el) el.textContent = value;
    }

    /* =====================================================
       03. STATUS BADGE
    ===================================================== */

    function getTrialText(status) {
        const end = status?.trialEndDate || status?.trial_end_date || "";

        if (!end) return DATA.defaultTrialEndText || "Trial Version";

        return "Ends " + formatDate(end);
    }

    function getPremiumText(status) {
        const valid = status?.premiumValidUntil || status?.premium_valid_until || "";

        if (!valid) return "Premium Active";

        return "Valid Until " + formatDate(valid);
    }

    function renderStatusBadge() {
        if (!DOM.statusBadge) return;

        const status = PROGRESS.getStatus();
        const user = typeof getUserSession === "function" ? getUserSession() : null;

        if (typeof renderTrialPremiumBadge === "function") {
            renderTrialPremiumBadge(DOM.statusBadge,status,user,{mode:"end"});
            return;
        }

        DOM.statusBadge.innerHTML = `
            <b>Trial Version</b>
            <small>Ends Today</small>
        `;
    }

    /* =====================================================
       04. PROGRESS CARD
    ===================================================== */

    function renderProgressCard() {
        const progress = PROGRESS.getProgress();
        const pointer = PROGRESS.getCurrentPointer();

        const group = pointer.groupId || progress.current_group || "Primary";
        const level = safeNumber(pointer.levelNo || progress.current_level, 1);

        const totalQuestions = ROADMAP.getTotalQuestions(group, level);

        const completedQuestions = Math.min(
            totalQuestions,
            safeNumber(progress.completed_questions || progress.completedQuestions, 0)
        );

        setText(DOM.currentGroupText, String(group).toUpperCase());
        setText(DOM.currentLevelText, "Level " + level);
        setText(DOM.completedQuestionsText, completedQuestions);
        setText(DOM.totalQuestionsText, totalQuestions);
    }

    /* =====================================================
       05. PRIMARY ROADMAP ROWS
    ===================================================== */

    function renderPrimaryRows() {
        const progress = PROGRESS.getProgress();
        const premium = PROGRESS.getPremiumStatus();

        $all(".level-row").forEach((row) => {
            const groupId = row.dataset.group || "Primary";
            const levelNo = safeNumber(row.dataset.level, 1);

            const state = ROADMAP.getLevelState(
                progress,
                groupId,
                levelNo,
                premium
            );

            applyLevelRowState(row, state);
        });
    }

    function applyLevelRowState(row, state) {
        if (!row || !state) return;

        const dot = $(".level-dot", row);
        const status = $(".level-status", row);
        const actions = $(".level-actions", row);

        row.dataset.unlocked = state.unlocked ? "true" : "false";
        row.dataset.completed = state.completed ? "true" : "false";
        row.dataset.premium = state.premium ? "true" : "false";
        row.dataset.status = state.status;

        row.classList.toggle("completed", state.completed);
        row.classList.toggle("active", state.unlocked && !state.completed);
        row.classList.toggle("locked", !state.unlocked);
        row.classList.toggle("premium-locked", state.premiumLocked);

        if (dot) {
            dot.textContent = getLevelDotText(state);
        }

        if (status) {
            status.textContent = getLevelStatusText(state);
        }

        if (actions) {
            actions.style.display = state.unlocked ? "flex" : "none";
        } else if (state.unlocked) {
            const title = $(".level-title", row);
            if (title) {
                title.insertAdjacentHTML("beforeend", getLevelActionsMarkup(row.dataset.group || "Primary", row.dataset.level || 1, true));
            }
        }
    }

    function getLevelDotText(state) {
        if (state.completed) return "✓";
        if (state.premiumLocked) return "💎";
        if (state.unlocked) return "▶";
        return "🔒";
    }

    function getLevelStatusText(state) {
        if (state.completed) return "Completed";
        if (state.premiumLocked) return "Premium";
        if (state.unlocked) return "Active";
        return "Locked";
    }

    function getLevelLabel(groupId, levelNo) {
        return groupId === "Real Exam Test"
            ? "Test " + levelNo
            : "Level " + levelNo;
    }

    function getLevelActionsMarkup(groupId, levelNo, unlocked) {
        if (!unlocked) return "";

        const group = escapeSafe(groupId);
        const level = escapeSafe(levelNo);

        return [
            '<div class="level-actions">',
            '<button class="level-action-btn" type="button" data-action="read" data-group="' + group + '" data-level="' + level + '"><span>📖</span> Read</button>',
            '<button class="level-action-btn" type="button" data-action="practice" data-group="' + group + '" data-level="' + level + '"><span>✎</span> Practice</button>',
            '</div>'
        ].join("");
    }

    /* =====================================================
       07. DYNAMIC GROUP CARDS
    ===================================================== */

    function removeDynamicGroupCards() {
        $all(".dynamic-roadmap-card").forEach((card) => card.remove());
    }

    function createGroupCard(groupId) {
        const progress = PROGRESS.getProgress();
        const premium = PROGRESS.getPremiumStatus();
        const state = ROADMAP.getGroupState(progress, groupId, premium);

        if (!state.exists || !state.unlocked) return null;

        const card = document.createElement("section");
        card.className = "roadmap-card dynamic-roadmap-card";
        card.dataset.group = state.id;

        card.innerHTML = `
            <button class="group-header" type="button" data-group="${escapeSafe(state.id)}" data-unlocked="true">
                <span class="group-icon">${escapeSafe(state.icon || "📘")}</span>
                <span class="group-name">${escapeSafe(state.title)}</span>
                <span class="group-arrow">⌃</span>
            </button>

            <div class="group-body">
                <div class="timeline-wrap">
                    <div class="timeline-line" aria-hidden="true"></div>
                    <div class="level-list"></div>
                </div>
            </div>
        `;

        const list = $(".level-list", card);

        state.levels.forEach((levelState) => {
            list.appendChild(createLevelRow(levelState));
        });

        return card;
    }

    function createLevelRow(state) {
        const row = document.createElement("div");

        row.className = "level-row";
        row.dataset.group = state.groupId;
        row.dataset.level = String(state.levelNo);
        row.dataset.unlocked = state.unlocked ? "true" : "false";
        row.dataset.completed = state.completed ? "true" : "false";
        row.dataset.premium = state.premium ? "true" : "false";
        row.dataset.status = state.status;

        row.classList.toggle("completed", state.completed);
        row.classList.toggle("active", state.unlocked && !state.completed);
        row.classList.toggle("locked", !state.unlocked);
        row.classList.toggle("premium-locked", state.premiumLocked);

        row.innerHTML = `
            <div class="level-dot">${escapeSafe(getLevelDotText(state))}</div>

            <div class="level-title">
                <b>${escapeSafe(getLevelLabel(state.groupId, state.levelNo))}</b>${getLevelActionsMarkup(state.groupId, state.levelNo, state.unlocked)}
            </div>

            <div class="level-status">${escapeSafe(getLevelStatusText(state))}</div>
        `;

        return row;
    }

    function openGroup(groupId) {
        const progress = PROGRESS.getProgress();
        const premium = PROGRESS.getPremiumStatus();
        const groupState = ROADMAP.getGroupState(progress, groupId, premium);

        if (!groupState.exists || !groupState.unlocked) {
            return false;
        }

        removeDynamicGroupCards();

        const button = $(`.collapsed-group[data-group="${CSS.escape(groupId)}"]`);
        if (!button) return false;

        const card = createGroupCard(groupId);
        if (!card) return false;

        button.insertAdjacentElement("afterend", card);

        return true;
    }

    function focusLevel(groupId, levelNo) {
        const group = groupId || "Primary";
        const level = safeNumber(levelNo, 1);

        if (group !== "Primary") {
            openGroup(group);
        }

        const row = $(`.level-row[data-group="${CSS.escape(group)}"][data-level="${CSS.escape(String(level))}"]`);
        if (!row) return false;

        row.scrollIntoView({
            behavior: "smooth",
            block: "center"
        });

        row.classList.add("continue-focus");

        window.setTimeout(() => {
            row.classList.remove("continue-focus");
        }, 1800);

        return true;
    }

    /* =====================================================
       08. BOOKMARK BUTTON
    ===================================================== */

    function renderBookmarkButton() {
        if (!DOM.bookmarkedMainBtn) return;

        const count = BOOKMARKS.getCount ? BOOKMARKS.getCount() : 0;

        DOM.bookmarkedMainBtn.dataset.count = String(count);

        if (count > 0) {
            DOM.bookmarkedMainBtn.title = count + " bookmarked questions";
        } else {
            DOM.bookmarkedMainBtn.title = "Bookmarked Question";
        }
    }

    /* =====================================================
       09. PAGE STATE
    ===================================================== */

    function setLoading() {
        document.body.classList.add("learn-loading");
        document.body.classList.remove("learn-ready");
    }

    function setReady() {
        document.body.classList.remove("learn-loading");
        document.body.classList.add("learn-ready");
    }

    function setError() {
        document.body.classList.remove("learn-loading");
        document.body.classList.add("learn-error");
    }

    /* =====================================================
       10. FULL RENDER
    ===================================================== */

    function renderAll() {
        cacheDOM();
        renderStatusBadge();
        renderProgressCard();
        renderPrimaryRows();
        renderCollapsedGroups();
        renderBookmarkButton();
        setReady();
    }

    function refreshRoadmapOnly() {
        renderPrimaryRows();
        renderCollapsedGroups();
        renderBookmarkButton();
    }

    /* =====================================================
       11. PUBLIC API
    ===================================================== */

    return {
        cacheDOM,

        renderAll,
        refreshRoadmapOnly,

        renderStatusBadge,
        renderProgressCard,
        renderPrimaryRows,
        renderCollapsedGroups,
        renderBookmarkButton,

        openGroup,
        focusLevel,
        removeDynamicGroupCards,
        createGroupCard,
        createLevelRow,

        setLoading,
        setReady,
        setError
    };
})();
