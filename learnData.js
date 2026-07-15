/* =========================================================
   TET SUCCESS - learnData.js
   Roadmap Data + Unlock Rules + Page Targets
   ========================================================= */

"use strict";

window.TETLearnData = {
  appName: "TET Success",

  defaultTrialEndText: "Ends 09 Jul 2026",

  pages: {
    login: "index.html",
    home: "home2.html",
    info: "info.html",
    profile: "profile.html",
    read: "read.html",
    practice: "practice.html",
    bookmarks: "bookmarks.html",
    premium: "premium.html"
  },

  groups: [
    {
      id: "Primary",
      title: "PRIMARY",
      icon: "📖",
      unlockedByDefault: true,
      prerequisite: "",
      levels: [
        { level: 1, totalQuestions: 25, free: true },
        { level: 2, totalQuestions: 25, free: true },
        { level: 3, totalQuestions: 25, free: true },
        { level: 4, totalQuestions: 25, premium: true },
        { level: 5, totalQuestions: 25, premium: true }
      ]
    },
    {
      id: "Basic",
      title: "BASIC",
      icon: "▰",
      unlockedByDefault: false,
      prerequisite: { group: "Primary", level: 1 },
      prerequisiteText: "Primary Level 1",
      levels: [
        { level: 1, totalQuestions: 25, free: true },
        { level: 2, totalQuestions: 25, free: true },
        { level: 3, totalQuestions: 25, premium: true },
        { level: 4, totalQuestions: 25, premium: true },
        { level: 5, totalQuestions: 25, premium: true }
      ]
    },
    {
      id: "Growth",
      title: "GROWTH",
      icon: "▟",
      unlockedByDefault: false,
      prerequisite: { group: "Basic", level: 1 },
      prerequisiteText: "Basic Level 1",
      levels: [
        { level: 1, totalQuestions: 30, free: true },
        { level: 2, totalQuestions: 30, premium: true },
        { level: 3, totalQuestions: 30, premium: true },
        { level: 4, totalQuestions: 30, premium: true },
        { level: 5, totalQuestions: 30, premium: true }
      ]
    },
    {
      id: "Focus",
      title: "FOCUS",
      icon: "◎",
      unlockedByDefault: false,
      prerequisite: { group: "Growth", level: 1 },
      prerequisiteText: "Growth Level 1",
      levels: [
        { level: 1, totalQuestions: 30, premium: true },
        { level: 2, totalQuestions: 30, premium: true },
        { level: 3, totalQuestions: 30, premium: true },
        { level: 4, totalQuestions: 30, premium: true },
        { level: 5, totalQuestions: 30, premium: true }
      ]
    },
    {
      id: "Target",
      title: "TARGET",
      icon: "⚑",
      unlockedByDefault: false,
      prerequisite: { group: "Focus", level: 1 },
      prerequisiteText: "Focus Level 1",
      levels: [
        { level: 1, totalQuestions: 40, premium: true },
        { level: 2, totalQuestions: 40, premium: true },
        { level: 3, totalQuestions: 40, premium: true },
        { level: 4, totalQuestions: 40, premium: true },
        { level: 5, totalQuestions: 40, premium: true }
      ]
    },
    {
      id: "Advance",
      title: "ADVANCE",
      icon: "🚀",
      unlockedByDefault: false,
      prerequisite: { group: "Target", level: 1 },
      prerequisiteText: "Target Level 1",
      levels: [
        { level: 1, totalQuestions: 50, premium: true },
        { level: 2, totalQuestions: 50, premium: true },
        { level: 3, totalQuestions: 50, premium: true },
        { level: 4, totalQuestions: 50, premium: true },
        { level: 5, totalQuestions: 50, premium: true }
      ]
    },
    {
      id: "Real Exam Test",
      title: "REAL EXAM TEST",
      icon: "☷",
      unlockedByDefault: false,
      prerequisite: { group: "Advance", level: 1 },
      prerequisiteText: "Advance Level 1",
      levels: [
        { level: 1, totalQuestions: 150, premium: true },
        { level: 2, totalQuestions: 150, premium: true },
        { level: 3, totalQuestions: 150, premium: true }
      ]
    }
  ],

  defaultProgress: {
    current_group: "Primary",
    current_level: 1,
    completed_questions: 0,
    total_questions: 25,
    completed_levels: {
      Primary: []
    }
  },

  getPage(name) {
    const fromConfig = window.CONFIG && window.CONFIG[name.toUpperCase() + "_PAGE"];
    return fromConfig || this.pages[name] || "#";
  },

  getGroup(groupId) {
    return this.groups.find((group) => group.id === groupId) || null;
  },

  getLevel(groupId, levelNo) {
    const group = this.getGroup(groupId);
    if (!group) return null;
    return group.levels.find((item) => Number(item.level) === Number(levelNo)) || null;
  },

  isLevelPremium(groupId, levelNo) {
    const level = this.getLevel(groupId, levelNo);
    return Boolean(level && level.premium);
  },

  getTotalQuestions(groupId, levelNo) {
    const level = this.getLevel(groupId, levelNo);
    return Number(level?.totalQuestions || 25);
  },

  normalizeCompletedLevels(value) {
    if (!value) return { Primary: [] };

    if (typeof value === "string") {
      try {
        return JSON.parse(value);
      } catch {
        return { Primary: [] };
      }
    }

    if (typeof value === "object") return value;

    return { Primary: [] };
  },

  isCompleted(progress, groupId, levelNo) {
    const completed = this.normalizeCompletedLevels(progress.completed_levels);
    const list = completed[groupId] || completed[String(groupId).toLowerCase()] || [];
    return Array.isArray(list) && list.map(Number).includes(Number(levelNo));
  },

  isGroupUnlocked(progress, groupId) {
    const group = this.getGroup(groupId);
    if (!group) return false;

    if (group.unlockedByDefault) return true;

    const rule = group.prerequisite;
    if (!rule) return false;

    return this.isCompleted(progress, rule.group, rule.level);
  },

  isLevelUnlocked(progress, groupId, levelNo, isPremiumUser) {
    const group = this.getGroup(groupId);
    if (!group) return false;

    const level = this.getLevel(groupId, levelNo);
    if (!level) return false;

    if (!this.isGroupUnlocked(progress, groupId)) return false;

    if (level.premium && !isPremiumUser) return false;

    if (Number(levelNo) === 1) return true;

    return this.isCompleted(progress, groupId, Number(levelNo) - 1);
  },

  getLockedMessage(progress, groupId, levelNo, isPremiumUser) {
    const group = this.getGroup(groupId);
    const level = this.getLevel(groupId, levelNo);

    if (!group || !level) return "Level not found";

    if (!this.isGroupUnlocked(progress, groupId)) {
      return "First clear " + (group.prerequisiteText || "previous level");
    }

    if (level.premium && !isPremiumUser) {
      return "Premium required to unlock this level";
    }

    if (Number(levelNo) > 1 && !this.isCompleted(progress, groupId, Number(levelNo) - 1)) {
      return "First clear " + groupId + " Level " + (Number(levelNo) - 1);
    }

    return "";
  }
};
