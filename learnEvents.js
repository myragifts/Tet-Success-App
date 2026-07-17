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

        try {
            await PROGRESS.setCurrentLevel(groupId, levelNo, {
                action,
                save: true
            });
            RENDER.renderAll();
        } catch (error) {
            console.warn("Learn action progress save skipped:", error);
        }

        goToPage(buildLearningUrl(action, groupId, levelNo));
    }

    const RESET_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;

    function getResetUserKey() {
        const user = getCurrentUser() || {};
        return String(user.id || user.user_id || user.phone || user.mobile || "guest");
    }

    function getResetCooldownKey() {
        return "tet_success_progress_reset_at_" + getResetUserKey();
    }

    function canResetProgressNow() {
        try {
            const last = Number(localStorage.getItem(getResetCooldownKey()) || 0);
            return !last || Date.now() - last >= RESET_COOLDOWN_MS;
        } catch {
            return true;
        }
    }

    function markProgressResetNow() {
        try {
            localStorage.setItem(getResetCooldownKey(), String(Date.now()));
        } catch {}
    }

    function clearLearnProgressLocalCache() {
        try {
            localStorage.removeItem("tet_success_learn_progress_backup");
            localStorage.removeItem("tet_success_learn_result");
        } catch {}

        try {
            sessionStorage.removeItem("tet_scroll_" + location.pathname);
        } catch {}
    }

    function removeResetModal() {
        const modal = document.querySelector(".learn-reset-modal");
        if (modal) modal.remove();
    }

    function showResetProgressModal() {
        removeResetModal();

        const modal = document.createElement("div");
        modal.className = "learn-reset-modal";
        modal.innerHTML = `
            <div class="learn-reset-card" role="dialog" aria-modal="true">
                <button class="learn-reset-close" type="button" data-reset-close>&times;</button>
                <h2>Reset Learning Progress?</h2>
                <p>Do you want to start your learning journey from Primary Level 1 again?</p>
                <p>Use this only if you want to start again from the beginning.</p>
                <div class="learn-reset-actions">
                    <button class="learn-reset-btn back" type="button" data-reset-close>Back</button>
                    <button class="learn-reset-btn confirm" type="button" data-reset-confirm>Confirm</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        requestAnimationFrame(() => modal.classList.add("show"));
        modal.querySelectorAll("[data-reset-close]").forEach((btn) => btn.addEventListener("click", removeResetModal));

        const confirmBtn = modal.querySelector("[data-reset-confirm]");
        confirmBtn.addEventListener("click", async function () {
            confirmBtn.disabled = true;
            confirmBtn.textContent = "Resetting...";

            try {
                await PROGRESS.resetProgress();
                clearLearnProgressLocalCache();
                markProgressResetNow();
                RENDER.renderAll();
                removeResetModal();
                toast("Learning progress reset successfully", "success");
                setTimeout(() => {
                    window.location.href = "learn.html";
                }, 700);
            } catch (error) {
                console.error("Progress reset failed:", error);
                confirmBtn.disabled = false;
                confirmBtn.textContent = "Confirm";
                toast("Unable to reset progress. Please try again.", "error");
            }
        });
    }

    function handleResetProgressClick() {
        if (!canResetProgressNow()) {
            toast("Reset once every 7 days", "warning");
            return;
        }

        showResetProgressModal();
    }

    function bindResetProgressButton() {
        const btn = document.getElementById("resetProgressBtn");
        if (!btn || btn.dataset.bound === "1") return;

        btn.dataset.bound = "1";
        btn.addEventListener("click", handleResetProgressClick);
    }
    function getCurrentUser() {
        try {
            return typeof getUserSession === "function" ? getUserSession() : null;
        } catch {
            return null;
        }
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
    function getPremiumSetting(key, fallback) {
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

    function removePremiumModal() {
        const modal = document.querySelector(".premium-learn-modal");
        if (modal) modal.remove();
    }

    function showPremiumModal(groupId, levelNo) {
        if (typeof showGlobalPremiumEntry === "function") {
            showGlobalPremiumEntry(PROGRESS.getStatus(), getCurrentUser());
            return;
        }

        removePremiumModal();

        const isExam = groupId === "Real Exam Test";
        const itemLabel = isExam ? "Test " + levelNo : groupId + " Level " + levelNo;
        const fee = getPremiumSetting("subscription_fee", 799);
        const validText = getPremiumSetting("premium_valid_text", "30 September 2028");

        const modal = document.createElement("div");
        modal.className = "premium-learn-modal";
        modal.innerHTML =
            '<div class="premium-learn-card" role="dialog" aria-modal="true">' +
                '<button class="premium-close-btn" type="button" data-premium-close>×</button>' +
                '<span class="premium-access-badge">Premium Access</span>' +
                '<h2>Unlock Premium Access</h2>' +
                '<p class="premium-price-line">₹' + escapeSafe(fee) + ' Only - One Time Payment</p>' +
                '<p class="premium-subtext">Full premium access to all features until ' + escapeSafe(validText) + '.</p>' +
                '<p class="premium-motivation">Go premium and unlock deep practice questions, advanced levels, full exam tests, and complete premium preparation support for WB Primary TET.</p>' +
                '<ul class="premium-benefits">' +
                    '<li>' + escapeSafe(itemLabel) + ' premium practice</li>' +
                    '<li>Level 3-5 deep practice in every group</li>' +
                    '<li>Real Exam Test 2-20</li>' +
                    '<li>Full premium access until ' + escapeSafe(validText) + '</li>' +
                '</ul>' +
                '<div class="premium-actions">' +
                    '<button class="premium-btn light" type="button" data-premium-later>Later</button>' +
                    '<button class="premium-btn primary" type="button" data-premium-subscribe>Subscribe Now</button>' +
                '</div>' +
            '</div>';

        document.body.appendChild(modal);
        requestAnimationFrame(() => modal.classList.add("show"));

        modal.querySelectorAll("[data-premium-close],[data-premium-later]").forEach((btn) => {
            btn.addEventListener("click", removePremiumModal);
        });

        modal.querySelector("[data-premium-subscribe]").addEventListener("click", () => {
            removePremiumModal();
            showDeclarationModal();
        });
    }

    function showDeclarationModal() {
        removePremiumModal();

        const modal = document.createElement("div");
        modal.className = "premium-learn-modal";
        modal.innerHTML =
            '<div class="premium-learn-card" role="dialog" aria-modal="true">' +
                '<button class="premium-close-btn" type="button" data-premium-close>×</button>' +
                '<span class="premium-access-badge">Self Declaration</span>' +
                '<h2>Self Declaration</h2>' +
                '<p class="declaration-text">TET Success is an educational learning platform designed to help you prepare for the TET examination through study materials, practice questions, mock tests, and guidance.</p>' +
                '<p class="declaration-text">We do not guarantee success or selection in any examination. Your result depends on your own preparation, effort, and performance.</p>' +
                '<label class="declaration-check"><input type="checkbox" id="learnAgreeDeclaration"> <span>I have read and understood the above declaration and agree to continue.</span></label>' +
                '<div class="premium-actions">' +
                    '<button class="premium-btn light" type="button" data-premium-later>Later</button>' +
                    '<button class="premium-btn primary" id="learnContinuePayment" type="button" disabled>CONTINUE TO PAYMENT</button>' +
                '</div>' +
            '</div>';

        document.body.appendChild(modal);
        requestAnimationFrame(() => modal.classList.add("show"));

        const agree = modal.querySelector("#learnAgreeDeclaration");
        const continueBtn = modal.querySelector("#learnContinuePayment");

        modal.querySelectorAll("[data-premium-close],[data-premium-later]").forEach((btn) => {
            btn.addEventListener("click", removePremiumModal);
        });

        agree.addEventListener("change", () => {
            continueBtn.disabled = !agree.checked;
        });

        continueBtn.addEventListener("click", () => {
            if (!agree.checked) {
                toast("Please agree before continuing", "warning");
                return;
            }

            removePremiumModal();
            openPremiumWhatsApp();
        });
    }

    function openPremiumWhatsApp() {
        const user = getCurrentUser() || {};
        const fee = getPremiumSetting("subscription_fee", 799);
        const validText = getPremiumSetting("premium_valid_text", "30 September 2028");
        const paymentLink = getPremiumSetting("payment_link", "https://tinyurl.com/Tet-Success-Pay-now");
        const adminPhone = getPremiumSetting("admin_whatsapp_number", getPremiumSetting("admin_whatsapp", "9836697502"));
        const name = user.full_name || user.name || "Student";
        const phone = user.phone || user.mobile || "";

        const message = `Hello,

I want to upgrade to TET Success Premium.

Name: ${name}
Phone: ${phone}

Plan:
Premium Membership

Subscription Fee:
₹${fee} (One-Time Payment)

Premium Validity:
${validText}

Access:
Full Premium Access to all features until ${validText}.

Self Declaration:
I have read and accepted that TET Success provides educational guidance and learning resources only. I understand that passing the examination depends on my own preparation and performance, and TET Success does not guarantee exam success.

Payment Link:
${paymentLink}

After payment send screenshot for confirmation.

Thank you.`;

        if (typeof openWhatsApp === "function") {
            openWhatsApp(adminPhone, message);
        } else {
            window.open("https://wa.me/" + String(adminPhone).replace(/\D/g, "") + "?text=" + encodeURIComponent(message), "_blank");
        }

        toast("Subscription request opened", "success");
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

            btn.addEventListener("click", function (event) {
                event.preventDefault();
                event.stopPropagation();

                const page = btn.dataset.page;
                if (page) window.location.href = page;
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
        bindResetProgressButton();
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
