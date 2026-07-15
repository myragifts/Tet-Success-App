/* =========================================================
   TET SUCCESS - learnRoadmap.js
   Roadmap Logic Engine
   No DOM | No Supabase | No Events
   Depends on: learnData.js
   ========================================================= */

"use strict";

window.TETLearnRoadmap = (function () {
    const DATA = window.TETLearnData;

    if (!DATA) {
        console.error("TETLearnRoadmap failed: learnData.js missing");
        return {};
    }

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

    function normalizeGroupId(groupId) {
        if (!groupId) return "Primary";
        return String(groupId).trim();
    }

    function normalizeLevel(levelNo) {
        return safeNumber(levelNo, 1);
    }

    function getGroups() {
        return Array.isArray(DATA.groups) ? DATA.groups : [];
    }

    function getGroup(groupId) {
        const id = normalizeGroupId(groupId);
        return DATA.getGroup ? DATA.getGroup(id) : getGroups().find((g) => g.id === id) || null;
    }

    function getLevel(groupId, levelNo) {
        const group = getGroup(groupId);
        const level = normalizeLevel(levelNo);

        if (!group || !Array.isArray(group.levels)) return null;

        return group.levels.find((item) => Number(item.level) === level) || null;
    }

    function getDefaultProgress() {
        return clone(DATA.defaultProgress || {
            current_group: "Primary",
            current_level: 1,
            completed_questions: 0,
            total_questions: 25,
            completed_levels: { Primary: [] }
        });
    }

    function normalizeCompletedLevels(value) {
        if (!value) return { Primary: [] };

        if (typeof value === "string") {
            try {
                const parsed = JSON.parse(value);
                return normalizeCompletedLevels(parsed);
            } catch {
                return { Primary: [] };
            }
        }

        if (Array.isArray(value)) {
            const output = {};

            value.forEach((item) => {
                if (typeof item !== "string") return;

                const parts = item.split(":");
                if (parts.length !== 2) return;

                const group = normalizeGroupId(parts[0]);
                const level = normalizeLevel(parts[1]);

                if (!output[group]) output[group] = [];
                if (!output[group].map(Number).includes(level)) {
                    output[group].push(level);
                }
            });

            return output;
        }

        if (typeof value === "object") {
            const output = {};

            Object.keys(value).forEach((group) => {
                const list = Array.isArray(value[group]) ? value[group] : [];
                output[normalizeGroupId(group)] = list
                    .map((level) => normalizeLevel(level))
                    .filter((level) => level > 0)
                    .sort((a, b) => a - b);
            });

            if (!output.Primary) output.Primary = [];

            return output;
        }

        return { Primary: [] };
    }

    function normalizeProgress(progress) {
        const base = getDefaultProgress();

        const next = {
            ...base,
            ...(progress || {})
        };

        next.current_group = normalizeGroupId(
            next.current_group || next.currentGroup || base.current_group
        );

        next.current_level = normalizeLevel(
            next.current_level || next.currentLevel || base.current_level
        );

        next.completed_questions = safeNumber(
            next.completed_questions || next.completedQuestions,
            base.completed_questions || 0
        );

        next.total_questions = safeNumber(
            next.total_questions || next.totalQuestions,
            getTotalQuestions(next.current_group, next.current_level)
        );

        next.completed_levels = normalizeCompletedLevels(
            next.completed_levels || next.completedLevels || base.completed_levels
        );

        return next;
    }

    /* =====================================================
       02. COMPLETION RULES
    ===================================================== */

    function isLevelCompleted(progress, groupId, levelNo) {
        const safeProgress = normalizeProgress(progress);
        const group = normalizeGroupId(groupId);
        const level = normalizeLevel(levelNo);

        const completed = normalizeCompletedLevels(safeProgress.completed_levels);
        const list = completed[group] || [];

        return list.map(Number).includes(level);
    }

    function addCompletedLevel(progress, groupId, levelNo) {
        const next = normalizeProgress(progress);
        const group = normalizeGroupId(groupId);
        const level = normalizeLevel(levelNo);

        if (!next.completed_levels[group]) {
            next.completed_levels[group] = [];
        }

        if (!next.completed_levels[group].map(Number).includes(level)) {
            next.completed_levels[group].push(level);
        }

        next.completed_levels[group] = next.completed_levels[group]
            .map((item) => normalizeLevel(item))
            .filter((item) => item > 0)
            .sort((a, b) => a - b);

        next.current_group = group;
        next.current_level = level;
        next.completed_questions = getTotalQuestions(group, level);
        next.total_questions = getTotalQuestions(group, level);

        return next;
    }

    function removeCompletedLevel(progress, groupId, levelNo) {
        const next = normalizeProgress(progress);
        const group = normalizeGroupId(groupId);
        const level = normalizeLevel(levelNo);

        if (!next.completed_levels[group]) return next;

        next.completed_levels[group] = next.completed_levels[group]
            .map(Number)
            .filter((item) => item !== level);

        return next;
    }

    /* =====================================================
       03. GROUP UNLOCK RULES
    ===================================================== */

    function isGroupUnlocked(progress, groupId) {
        const safeProgress = normalizeProgress(progress);
        const group = getGroup(groupId);

        if (!group) return false;

        if (group.unlockedByDefault) return true;

        if (!group.prerequisite) return false;

        return isLevelCompleted(
            safeProgress,
            group.prerequisite.group,
            group.prerequisite.level
        );
    }

    function getGroupLockedMessage(progress, groupId) {
        const group = getGroup(groupId);

        if (!group) return "Group not found";

        if (isGroupUnlocked(progress, groupId)) return "";

        const prerequisite = String(group.prerequisiteText || "previous level")
            .replace(/\s+\d+$/,"");

        return "First clear " + prerequisite;
    }

    /* =====================================================
       04. LEVEL UNLOCK RULES
    ===================================================== */

    function isPremiumLevel(groupId, levelNo) {
        const level = getLevel(groupId, levelNo);
        return Boolean(level && level.premium);
    }

    function isLevelUnlocked(progress, groupId, levelNo, isPremiumUser = false) {
        const safeProgress = normalizeProgress(progress);
        const group = getGroup(groupId);
        const level = getLevel(groupId, levelNo);

        if (!group || !level) return false;

        if (!isGroupUnlocked(safeProgress, groupId)) return false;

        if (level.premium && !isPremiumUser) return false;

        if (Number(level.level) === 1) return true;

        return isLevelCompleted(
            safeProgress,
            groupId,
            Number(level.level) - 1
        );
    }

    function getLevelLockedMessage(progress, groupId, levelNo, isPremiumUser = false) {
        const group = getGroup(groupId);
        const level = getLevel(groupId, levelNo);

        if (!group || !level) return "Level not found";

        if (!isGroupUnlocked(progress, groupId)) {
            return getGroupLockedMessage(progress, groupId);
        }

        if (level.premium && !isPremiumUser) {
            return "Premium required to unlock this level";
        }

        if (Number(level.level) > 1 && !isLevelCompleted(progress, groupId, Number(level.level) - 1)) {
            return "First clear " + group.id + " Level " + (Number(level.level) - 1);
        }

        return "";
    }

    function getLevelState(progress, groupId, levelNo, isPremiumUser = false) {
        const group = getGroup(groupId);
        const level = getLevel(groupId, levelNo);

        if (!group || !level) {
            return {
                exists: false,
                completed: false,
                unlocked: false,
                premium: false,
                premiumLocked: false,
                status: "missing",
                message: "Level not found"
            };
        }

        const completed = isLevelCompleted(progress, groupId, levelNo);
        const premium = Boolean(level.premium);
        const unlocked = isLevelUnlocked(progress, groupId, levelNo, isPremiumUser);
        const premiumLocked = premium && !isPremiumUser;
        const message = unlocked ? "" : getLevelLockedMessage(progress, groupId, levelNo, isPremiumUser);

        let status = "locked";

        if (completed) status = "completed";
        else if (premiumLocked) status = "premium";
        else if (unlocked) status = "active";

        return {
            exists: true,
            groupId: group.id,
            groupTitle: group.title,
            levelNo: Number(level.level),
            totalQuestions: getTotalQuestions(groupId, levelNo),
            completed,
            unlocked,
            premium,
            premiumLocked,
            status,
            message
        };
    }

    /* =====================================================
       05. ROADMAP SUMMARY
    ===================================================== */

    function getTotalLevels() {
        return getGroups().reduce((sum, group) => {
            return sum + (Array.isArray(group.levels) ? group.levels.length : 0);
        }, 0);
    }

    function getCompletedLevelCount(progress) {
        const safeProgress = normalizeProgress(progress);
        let count = 0;

        getGroups().forEach((group) => {
            group.levels.forEach((level) => {
                if (isLevelCompleted(safeProgress, group.id, level.level)) {
                    count++;
                }
            });
        });

        return count;
    }

    function getOverallProgress(progress) {
        const total = getTotalLevels();
        const completed = getCompletedLevelCount(progress);

        if (!total) return 0;

        return Number(((completed / total) * 100).toFixed(2));
    }

    function getTotalQuestions(groupId, levelNo) {
        if (DATA.getTotalQuestions) {
            return DATA.getTotalQuestions(groupId, levelNo);
        }

        const level = getLevel(groupId, levelNo);
        return Number(level?.totalQuestions || 25);
    }

    function getCurrentPointer(progress) {
        const safeProgress = normalizeProgress(progress);

        return {
            groupId: safeProgress.current_group || "Primary",
            levelNo: normalizeLevel(safeProgress.current_level || 1),
            totalQuestions: getTotalQuestions(
                safeProgress.current_group || "Primary",
                safeProgress.current_level || 1
            ),
            completedQuestions: safeNumber(safeProgress.completed_questions, 0)
        };
    }

    /* =====================================================
       06. NEXT LEVEL LOGIC
    ===================================================== */

    function getNextLevel(progress, isPremiumUser = false) {
        const safeProgress = normalizeProgress(progress);

        for (const group of getGroups()) {
            if (!isGroupUnlocked(safeProgress, group.id)) continue;

            for (const level of group.levels) {
                const state = getLevelState(
                    safeProgress,
                    group.id,
                    level.level,
                    isPremiumUser
                );

                if (state.unlocked && !state.completed) {
                    return {
                        groupId: group.id,
                        groupTitle: group.title,
                        levelNo: Number(level.level),
                        totalQuestions: getTotalQuestions(group.id, level.level),
                        premium: Boolean(level.premium)
                    };
                }
            }
        }

        return null;
    }

    function getNextLockedTarget(progress, isPremiumUser = false) {
        const safeProgress = normalizeProgress(progress);

        for (const group of getGroups()) {
            for (const level of group.levels) {
                const state = getLevelState(
                    safeProgress,
                    group.id,
                    level.level,
                    isPremiumUser
                );

                if (!state.completed && !state.unlocked) {
                    return state;
                }
            }
        }

        return null;
    }

    function getContinueTarget(progress, isPremiumUser = false) {
        const pointer = getCurrentPointer(progress);

        if (isLevelUnlocked(progress, pointer.groupId, pointer.levelNo, isPremiumUser)) {
            return pointer;
        }

        const next = getNextLevel(progress, isPremiumUser);

        if (next) {
            return {
                groupId: next.groupId,
                levelNo: next.levelNo,
                totalQuestions: next.totalQuestions,
                completedQuestions: 0
            };
        }

        return pointer;
    }

    /* =====================================================
       07. GROUP VIEW MODEL
    ===================================================== */

    function getGroupState(progress, groupId, isPremiumUser = false) {
        const group = getGroup(groupId);

        if (!group) {
            return {
                exists: false,
                unlocked: false,
                completed: false,
                levels: [],
                message: "Group not found"
            };
        }

        const unlocked = isGroupUnlocked(progress, groupId);

        const levels = group.levels.map((level) => {
            return getLevelState(progress, groupId, level.level, isPremiumUser);
        });

        const completed = levels.length > 0 && levels.every((level) => level.completed);

        return {
            exists: true,
            id: group.id,
            title: group.title,
            icon: group.icon,
            unlocked,
            completed,
            prerequisiteText: group.prerequisiteText || "",
            message: unlocked ? "" : getGroupLockedMessage(progress, groupId),
            levels
        };
    }

    function getRoadmapState(progress, isPremiumUser = false) {
        const safeProgress = normalizeProgress(progress);

        return {
            groups: getGroups().map((group) => {
                return getGroupState(safeProgress, group.id, isPremiumUser);
            }),
            totalLevels: getTotalLevels(),
            completedLevels: getCompletedLevelCount(safeProgress),
            overallProgress: getOverallProgress(safeProgress),
            current: getCurrentPointer(safeProgress),
            next: getNextLevel(safeProgress, isPremiumUser),
            nextLocked: getNextLockedTarget(safeProgress, isPremiumUser)
        };
    }

    /* =====================================================
       08. COMPLETION ARRAY CONVERSION
    ===================================================== */

    function completedObjectToArray(progress) {
        const safeProgress = normalizeProgress(progress);
        const output = [];

        Object.keys(safeProgress.completed_levels || {}).forEach((group) => {
            const levels = safeProgress.completed_levels[group] || [];
            levels.forEach((level) => {
                output.push(group + ":" + Number(level));
            });
        });

        return output;
    }

    function completedArrayToObject(arr) {
        return normalizeCompletedLevels(arr);
    }

    /* =====================================================
       09. PUBLIC API
    ===================================================== */

    return {
        normalizeProgress,
        normalizeCompletedLevels,

        getGroups,
        getGroup,
        getLevel,
        getTotalQuestions,

        isLevelCompleted,
        addCompletedLevel,
        removeCompletedLevel,

        isGroupUnlocked,
        getGroupLockedMessage,

        isPremiumLevel,
        isLevelUnlocked,
        getLevelLockedMessage,
        getLevelState,

        getTotalLevels,
        getCompletedLevelCount,
        getOverallProgress,
        getCurrentPointer,

        getNextLevel,
        getNextLockedTarget,
        getContinueTarget,

        getGroupState,
        getRoadmapState,

        completedObjectToArray,
        completedArrayToObject
    };
})();
