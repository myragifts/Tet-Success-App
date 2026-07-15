/* =========================================================
   TET SUCCESS - learnProgress.js
   Progress Controller
   No DOM | No Events
   Depends on:
   - learnData.js
   - learnRoadmap.js
   - learnSupabase.js
   ========================================================= */

"use strict";

window.TETLearnProgress = (function () {
    const DATA = window.TETLearnData;
    const ROADMAP = window.TETLearnRoadmap;
    const DB = window.TETLearnSupabase;

    if (!DATA || !ROADMAP || !DB) {
        console.error("TETLearnProgress failed: missing dependency");
        return {};
    }

    let currentUser = null;
    let currentProgress = ROADMAP.normalizeProgress(DATA.defaultProgress);
    let currentStatus = null;
    let isPremium = false;
    let loading = false;

    /* =====================================================
       01. BASIC HELPERS
    ===================================================== */

    function clone(value) {
        return JSON.parse(JSON.stringify(value));
    }

    function safeNumber(value, fallback = 0) {
        const num = Number(value);
        return Number.isFinite(num) ? num : fallback;
    }

    function nowISO() {
        return new Date().toISOString();
    }

    function getUserId(user) {
        return user?.id || user?.user_id || user?.uid || "";
    }

    function calculatePremium(status, user) {
        if (user?.isPremium || user?.premium || user?.is_premium) return true;

        if (!status) return false;

        if (status.status === "premium") return true;
        if (status.paymentVerified || status.payment_verified) return true;

        const valid =
            status.premiumValidUntil ||
            status.premium_valid_until ||
            "";

        if (valid) {
            const date = new Date(valid);
            if (!Number.isNaN(date.getTime()) && date >= new Date()) {
                return true;
            }
        }

        return false;
    }

    function setUser(user) {
        currentUser = user || null;
    }

    function getUser() {
        return currentUser;
    }

    function getStatus() {
        return currentStatus;
    }

    function getProgress() {
        return currentProgress;
    }

    function setProgress(progress) {
        currentProgress = ROADMAP.normalizeProgress(progress);
        return currentProgress;
    }

    function getPremiumStatus() {
        return isPremium;
    }

    function isLoading() {
        return loading;
    }

    /* =====================================================
       02. LOAD STATUS / PROGRESS
    ===================================================== */

    async function loadStatus(user) {
        currentUser = user || currentUser;

        if (!currentUser) {
            currentStatus = null;
            isPremium = false;
            return currentStatus;
        }

        try {
            currentStatus = await DB.loadStatus(currentUser);
            isPremium = calculatePremium(currentStatus, currentUser);
            return currentStatus;
        } catch (error) {
            console.warn("Learn status load failed:", error);
            currentStatus = null;
            isPremium = calculatePremium(null, currentUser);
            return currentStatus;
        }
    }

    async function loadProgress(user) {
        currentUser = user || currentUser;

        if (!currentUser) {
            currentProgress = ROADMAP.normalizeProgress(DATA.defaultProgress);
            return currentProgress;
        }

        loading = true;

        try {
            const loaded = await DB.loadProgress(currentUser);
            currentProgress = ROADMAP.normalizeProgress(loaded);
            currentProgress.overall_progress = ROADMAP.getOverallProgress(currentProgress);
            return currentProgress;
        } catch (error) {
            console.warn("Learn progress load failed:", error);
            currentProgress = ROADMAP.normalizeProgress(DATA.defaultProgress);
            return currentProgress;
        } finally {
            loading = false;
        }
    }

    async function loadAll(user) {
        currentUser = user || currentUser;

        await loadStatus(currentUser);
        await loadProgress(currentUser);

        return {
            user: currentUser,
            status: currentStatus,
            progress: currentProgress,
            isPremium
        };
    }

    /* =====================================================
       03. SAVE PROGRESS
    ===================================================== */

    async function saveProgress() {
        if (!currentUser) return false;

        currentProgress = ROADMAP.normalizeProgress(currentProgress);
        currentProgress.overall_progress = ROADMAP.getOverallProgress(currentProgress);
        currentProgress.updated_at = nowISO();

        try {
            return await DB.saveProgress(currentUser, currentProgress);
        } catch (error) {
            console.warn("Learn progress save failed:", error);
            return false;
        }
    }

    async function updateProgress(patch = {}, autoSave = true) {
        currentProgress = ROADMAP.normalizeProgress({
            ...currentProgress,
            ...patch
        });

        currentProgress.overall_progress = ROADMAP.getOverallProgress(currentProgress);
        currentProgress.updated_at = nowISO();

        if (autoSave) {
            await saveProgress();
        }

        return currentProgress;
    }

    /* =====================================================
       04. CURRENT POINTER
    ===================================================== */

    function getCurrentPointer() {
        return ROADMAP.getCurrentPointer(currentProgress);
    }

    async function setCurrentLevel(groupId, levelNo, options = {}) {
        const group = ROADMAP.getGroup(groupId);
        const level = ROADMAP.getLevel(groupId, levelNo);

        if (!group || !level) {
            return currentProgress;
        }

        currentProgress.current_group = group.id;
        currentProgress.current_level = safeNumber(level.level, 1);
        currentProgress.total_questions = ROADMAP.getTotalQuestions(group.id, level.level);

        if (typeof options.completedQuestions !== "undefined") {
            currentProgress.completed_questions = safeNumber(options.completedQuestions, 0);
        }

        if (options.action === "read") {
            currentProgress.last_read_subject = group.id;
            currentProgress.last_read_chapter = "Level " + level.level;
        }

        if (options.action === "practice") {
            currentProgress.last_attempt_group = group.id;
            currentProgress.last_attempt_level = safeNumber(level.level, 1);
        }

        currentProgress.updated_at = nowISO();

        if (options.save !== false) {
            await saveProgress();
        }

        return currentProgress;
    }

    /* =====================================================
       05. COMPLETION
    ===================================================== */

    async function markLevelCompleted(groupId, levelNo, result = {}) {
        const group = ROADMAP.getGroup(groupId);
        const level = ROADMAP.getLevel(groupId, levelNo);

        if (!group || !level) {
            return {
                ok: false,
                message: "Level not found"
            };
        }

        currentProgress = ROADMAP.addCompletedLevel(
            currentProgress,
            group.id,
            level.level
        );

        const score = safeNumber(
            result.score ||
            result.percent ||
            result.best_score ||
            result.last_attempt_score,
            0
        );

        const completedQuestions = safeNumber(
            result.completed_questions ||
            result.correct ||
            result.completedQuestions,
            ROADMAP.getTotalQuestions(group.id, level.level)
        );

        const totalQuestions = safeNumber(
            result.total_questions ||
            result.total ||
            result.totalQuestions,
            ROADMAP.getTotalQuestions(group.id, level.level)
        );

        currentProgress.current_group = group.id;
        currentProgress.current_level = safeNumber(level.level, 1);
        currentProgress.completed_questions = completedQuestions;
        currentProgress.total_questions = totalQuestions;

        currentProgress.best_score = Math.max(
            safeNumber(currentProgress.best_score, 0),
            score
        );

        currentProgress.last_attempt_group = group.id;
        currentProgress.last_attempt_level = safeNumber(level.level, 1);
        currentProgress.last_attempt_score = score;
        currentProgress.last_result = result.result || (score >= 40 ? "pass" : "completed");

        currentProgress.overall_progress = ROADMAP.getOverallProgress(currentProgress);
        currentProgress.updated_at = nowISO();

        await saveProgress();

        return {
            ok: true,
            progress: currentProgress,
            group,
            level,
            score
        };
    }

    function isCompleted(groupId, levelNo) {
        return ROADMAP.isLevelCompleted(currentProgress, groupId, levelNo);
    }

    function isUnlocked(groupId, levelNo) {
        return ROADMAP.isLevelUnlocked(
            currentProgress,
            groupId,
            levelNo,
            isPremium
        );
    }

    function getLockedMessage(groupId, levelNo) {
        return ROADMAP.getLevelLockedMessage(
            currentProgress,
            groupId,
            levelNo,
            isPremium
        );
    }

    /* =====================================================
       06. RESULT CONSUMERS
    ===================================================== */

    async function consumeURLResult() {
        const params = new URLSearchParams(window.location.search);

        if (params.get("completed") !== "1") {
            return {
                consumed: false
            };
        }

        const groupId = params.get("group") || "Primary";
        const levelNo = safeNumber(params.get("level"), 1);

        const result = {
            score: safeNumber(params.get("score"), 0),
            completed_questions: safeNumber(params.get("completed_questions") || params.get("correct"), 0),
            total_questions: safeNumber(params.get("total_questions") || params.get("total"), ROADMAP.getTotalQuestions(groupId, levelNo)),
            result: params.get("result") || ""
        };

        const response = await markLevelCompleted(groupId, levelNo, result);

        window.history.replaceState({}, document.title, window.location.pathname);

        return {
            consumed: true,
            response
        };
    }

    async function consumeStorageResult() {
        let raw = null;

        try {
            raw = localStorage.getItem("tet_success_learn_result");
        } catch {}

        if (!raw) {
            return {
                consumed: false
            };
        }

        try {
            localStorage.removeItem("tet_success_learn_result");

            const data = JSON.parse(raw);
            const groupId = data.group || data.groupId || "Primary";
            const levelNo = safeNumber(data.level || data.levelNo, 1);

            const response = await markLevelCompleted(groupId, levelNo, data);

            return {
                consumed: true,
                response
            };
        } catch (error) {
            console.warn("Learn storage result consume failed:", error);
            return {
                consumed: false,
                error
            };
        }
    }

    async function consumeAnyResult() {
        const urlResult = await consumeURLResult();

        if (urlResult.consumed) return urlResult;

        return await consumeStorageResult();
    }

    /* =====================================================
       07. ROADMAP VIEW MODEL
    ===================================================== */

    function getRoadmapState() {
        return ROADMAP.getRoadmapState(currentProgress, isPremium);
    }

    function getGroupState(groupId) {
        return ROADMAP.getGroupState(currentProgress, groupId, isPremium);
    }

    function getLevelState(groupId, levelNo) {
        return ROADMAP.getLevelState(currentProgress, groupId, levelNo, isPremium);
    }

    function getContinueTarget() {
        return ROADMAP.getContinueTarget(currentProgress, isPremium);
    }

    function getOverallProgress() {
        return ROADMAP.getOverallProgress(currentProgress);
    }

    function getCompletedLevelCount() {
        return ROADMAP.getCompletedLevelCount(currentProgress);
    }

    function getTotalLevelCount() {
        return ROADMAP.getTotalLevels();
    }

    /* =====================================================
       08. DEBUG / TEST HELPERS
    ===================================================== */

    async function resetProgress() {
        currentProgress = ROADMAP.normalizeProgress(DATA.defaultProgress);
        await saveProgress();
        return currentProgress;
    }

    async function completeForTesting(groupId = "Primary", levelNo = 1) {
        return await markLevelCompleted(groupId, levelNo, {
            score: 100,
            result: "test_complete"
        });
    }

    /* =====================================================
       09. PUBLIC API
    ===================================================== */

    return {
        setUser,
        getUser,

        loadStatus,
        loadProgress,
        loadAll,

        getStatus,
        getPremiumStatus,
        isLoading,

        getProgress,
        setProgress,
        saveProgress,
        updateProgress,

        getCurrentPointer,
        setCurrentLevel,

        markLevelCompleted,
        isCompleted,
        isUnlocked,
        getLockedMessage,

        consumeURLResult,
        consumeStorageResult,
        consumeAnyResult,

        getRoadmapState,
        getGroupState,
        getLevelState,
        getContinueTarget,

        getOverallProgress,
        getCompletedLevelCount,
        getTotalLevelCount,

        resetProgress,
        completeForTesting
    };
})();
