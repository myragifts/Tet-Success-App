/* =========================================================
   TET SUCCESS - learnSupabase.js
   Real Supabase Integration for Learn Page
   Uses:
   - CONFIG.TABLES.USER_PROGRESS = tet_user_progress
   - CONFIG.TABLES.TRIAL_PREMIUM = tet_trial_premium
   - CONFIG.TABLES.BOOKMARKS = tet_bookmarks
   ========================================================= */

"use strict";

window.TETLearnSupabase = (function () {
  const DATA = window.TETLearnData;

  const LOCAL_PROGRESS_KEY = "tet_success_learn_progress_backup";
  const LOCAL_STATUS_KEY = "tet_success_learn_status_backup";
  const LOCAL_BOOKMARK_KEY = "tet_success_learn_bookmark_backup";

  function client() {
    return window.tetSupabase || window.supabase || null;
  }

  function table(name) {
    return CONFIG?.TABLES?.[name] || "";
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function saveLocal(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {}
  }

  function loadLocal(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch {
      return fallback;
    }
  }

  function getUserId(user) {
    return user?.id || user?.user_id || user?.uid || "";
  }

  function normalizeCompletedLevels(value) {
    if (!value) return {};

    if (Array.isArray(value)) {
      const output = {};
      value.forEach((item) => {
        if (typeof item !== "string") return;
        const parts = item.split(":");
        if (parts.length !== 2) return;
        const group = parts[0];
        const level = Number(parts[1]);
        if (!output[group]) output[group] = [];
        if (!output[group].includes(level)) output[group].push(level);
      });
      return output;
    }

    if (typeof value === "object") return value;

    if (typeof value === "string") {
      try {
        return JSON.parse(value);
      } catch {
        return {};
      }
    }

    return {};
  }

  function completedObjectToTextArray(completed) {
    const arr = [];

    Object.keys(completed || {}).forEach((group) => {
      const levels = completed[group] || [];
      levels.forEach((level) => {
        arr.push(`${group}:${Number(level)}`);
      });
    });

    return arr;
  }

  function normalizeProgress(row) {
    const base = clone(DATA.defaultProgress);

    if (!row) return base;

    const completedLevels = normalizeCompletedLevels(row.completed_levels);

    const group = row.current_group || base.current_group || "Primary";
    const level = Number(row.current_level || base.current_level || 1);

    return {
      current_group: group,
      current_level: level,
      completed_questions: 0,
      total_questions: DATA.getTotalQuestions(group, level),
      completed_levels: completedLevels,
      best_score: Number(row.best_score || 0),
      overall_progress: Number(row.overall_progress || 0),
      last_attempt_group: row.last_attempt_group || "",
      last_attempt_level: Number(row.last_attempt_level || 0),
      last_attempt_score: Number(row.last_attempt_score || 0),
      last_result: row.last_result || "",
      last_read_subject: row.last_read_subject || "",
      last_read_chapter: row.last_read_chapter || ""
    };
  }

  async function loadStatus(user) {
    const fallback = {
      status: "trial",
      isPremium: false,
      trialStartDate: "",
      trialEndDate: "",
      premiumActivatedDate: "",
      premiumValidUntil: "",
      paymentStatus: "pending",
      paymentVerified: false
    };

    const local = loadLocal(LOCAL_STATUS_KEY, null);

    const db = client();
    const tableName = table("TRIAL_PREMIUM");
    const userId = getUserId(user);

    if (!db || !tableName || !userId) {
      return local || fallback;
    }

    try {
      const { data, error } = await db
        .from(tableName)
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();

      if (error) {
        console.warn("Learn status load failed:", error);
        return local || fallback;
      }

      if (!data) return local || fallback;

      const status = {
        status: data.status || "trial",
        isPremium:
          data.status === "premium" ||
          Boolean(data.payment_verified) ||
          Boolean(data.premium_valid_until && new Date(data.premium_valid_until) >= new Date()),
        trialStartDate: data.trial_start_date || "",
        trialEndDate: data.trial_end_date || "",
        premiumActivatedDate: data.premium_activated_date || "",
        premiumValidUntil: data.premium_valid_until || "",
        paymentStatus: data.payment_status || "pending",
        paymentVerified: Boolean(data.payment_verified)
      };

      saveLocal(LOCAL_STATUS_KEY, status);
      return status;
    } catch (error) {
      console.warn("Learn status error:", error);
      return local || fallback;
    }
  }

  async function loadProgress(user) {
    const local = loadLocal(LOCAL_PROGRESS_KEY, null);
    const fallback = local || clone(DATA.defaultProgress);

    const db = client();
    const tableName = table("USER_PROGRESS");
    const userId = getUserId(user);

    if (!db || !tableName || !userId) return fallback;

    try {
      const { data, error } = await db
        .from(tableName)
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();

      if (error) {
        console.warn("Learn progress load failed:", error);
        return fallback;
      }

      if (!data) return fallback;

      const progress = normalizeProgress(data);
      saveLocal(LOCAL_PROGRESS_KEY, progress);

      return progress;
    } catch (error) {
      console.warn("Learn progress error:", error);
      return fallback;
    }
  }

  async function saveProgress(user, progress) {
    saveLocal(LOCAL_PROGRESS_KEY, progress);

    const db = client();
    const tableName = table("USER_PROGRESS");
    const userId = getUserId(user);

    if (!db || !tableName || !userId) return false;

    try {
      const payload = {
        user_id: userId,
        current_group: progress.current_group || "Primary",
        current_level: Number(progress.current_level || 1),
        completed_levels: completedObjectToTextArray(progress.completed_levels || {}),
        best_score: Number(progress.best_score || 0),
        overall_progress: Number(progress.overall_progress || 0),
        last_attempt_group: progress.last_attempt_group || null,
        last_attempt_level: progress.last_attempt_level || null,
        last_attempt_score: progress.last_attempt_score || null,
        last_result: progress.last_result || null,
        last_read_subject: progress.last_read_subject || null,
        last_read_chapter: progress.last_read_chapter || null,
        updated_at: new Date().toISOString()
      };

      const { error } = await db
        .from(tableName)
        .upsert(payload, { onConflict: "user_id" });

      if (error) {
        console.warn("Learn progress save failed:", error);
        return false;
      }

      return true;
    } catch (error) {
      console.warn("Learn progress save error:", error);
      return false;
    }
  }

  function loadBookmarksLocal() {
    return loadLocal(LOCAL_BOOKMARK_KEY, []);
  }

  function saveBookmarksLocal(bookmarks) {
    saveLocal(LOCAL_BOOKMARK_KEY, Array.isArray(bookmarks) ? bookmarks : []);
  }

  async function loadBookmarks(user) {
    const local = loadBookmarksLocal();

    const db = client();
    const tableName = table("BOOKMARKS");
    const userId = getUserId(user);

    if (!db || !tableName || !userId) return local;

    try {
      const { data, error } = await db
        .from(tableName)
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });

      if (error) {
        console.warn("Learn bookmarks load failed:", error);
        return local;
      }

      const bookmarks = Array.isArray(data) ? data : [];
      saveBookmarksLocal(bookmarks);

      return bookmarks;
    } catch (error) {
      console.warn("Learn bookmarks error:", error);
      return local;
    }
  }

  async function addBookmark(user, bookmark) {
    const db = client();
    const tableName = table("BOOKMARKS");
    const userId = getUserId(user);

    if (!db || !tableName || !userId) return false;

    try {
      const payload = {
        user_id: userId,
        bookmark_type: bookmark.bookmark_type || "learn",
        bookmark_ref_id: bookmark.bookmark_ref_id || null,
        subject: bookmark.subject || "",
        chapter_name: bookmark.chapter_name || "",
        exam_year: bookmark.exam_year || null,
        created_at: new Date().toISOString()
      };

      const { error } = await db.from(tableName).insert(payload);

      if (error) {
        console.warn("Add bookmark failed:", error);
        return false;
      }

      return true;
    } catch (error) {
      console.warn("Add bookmark error:", error);
      return false;
    }
  }

  async function removeBookmark(user, bookmarkId) {
    const db = client();
    const tableName = table("BOOKMARKS");
    const userId = getUserId(user);

    if (!db || !tableName || !userId || !bookmarkId) return false;

    try {
      const { error } = await db
        .from(tableName)
        .delete()
        .eq("user_id", userId)
        .eq("id", bookmarkId);

      if (error) {
        console.warn("Remove bookmark failed:", error);
        return false;
      }

      return true;
    } catch (error) {
      console.warn("Remove bookmark error:", error);
      return false;
    }
  }

  function addCompletedLevel(progress, groupId, levelNo) {
    const next = clone(progress || DATA.defaultProgress);

    if (!next.completed_levels) next.completed_levels = {};
    if (!Array.isArray(next.completed_levels[groupId])) {
      next.completed_levels[groupId] = [];
    }

    const level = Number(levelNo);

    if (!next.completed_levels[groupId].map(Number).includes(level)) {
      next.completed_levels[groupId].push(level);
      next.completed_levels[groupId].sort((a, b) => Number(a) - Number(b));
    }

    next.current_group = groupId;
    next.current_level = level;
    next.completed_questions = DATA.getTotalQuestions(groupId, level);
    next.total_questions = DATA.getTotalQuestions(groupId, level);

    next.overall_progress = calculateOverallProgress(next);

    return next;
  }

  function calculateOverallProgress(progress) {
    let total = 0;
    let completed = 0;

    DATA.groups.forEach((group) => {
      group.levels.forEach((level) => {
        total++;
        if (DATA.isCompleted(progress, group.id, level.level)) completed++;
      });
    });

    return total ? Number(((completed / total) * 100).toFixed(2)) : 0;
  }

  return {
    loadStatus,
    loadProgress,
    saveProgress,
    loadBookmarks,
    addBookmark,
    removeBookmark,
    addCompletedLevel,
    calculateOverallProgress,
    normalizeProgress
  };
})();
