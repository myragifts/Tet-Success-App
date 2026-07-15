/* =========================================================
   TET SUCCESS - learnBookmarks.js
   Bookmark Controller
   No DOM Rendering | No Events
   Depends on:
   - learnSupabase.js
   ========================================================= */

"use strict";

window.TETLearnBookmarks = (function () {
    const DB = window.TETLearnSupabase;

    if (!DB) {
        console.error("TETLearnBookmarks failed: learnSupabase.js missing");
        return {};
    }

    let currentUser = null;
    let bookmarks = [];
    let loading = false;

    /* =====================================================
       01. BASIC HELPERS
    ===================================================== */

    function clone(value) {
        return JSON.parse(JSON.stringify(value));
    }

    function getUserId(user) {
        return user?.id || user?.user_id || user?.uid || "";
    }

    function normalizeText(value) {
        return String(value || "").trim();
    }

    function normalizeBookmark(row) {
        if (!row) return null;

        return {
            id: row.id || "",
            user_id: row.user_id || "",
            bookmark_type: row.bookmark_type || "learn",
            bookmark_ref_id: row.bookmark_ref_id || null,
            subject: row.subject || "",
            chapter_name: row.chapter_name || "",
            exam_year: row.exam_year || null,
            created_at: row.created_at || ""
        };
    }

    function normalizeList(list) {
        if (!Array.isArray(list)) return [];

        return list
            .map(normalizeBookmark)
            .filter(Boolean);
    }

    function makeLearnBookmarkRef(groupId, levelNo, action = "practice") {
        return `${normalizeText(groupId)}:${Number(levelNo || 1)}:${normalizeText(action || "practice")}`;
    }

    function findIndexByRef(bookmarkRefId) {
        return bookmarks.findIndex((item) => {
            return String(item.bookmark_ref_id) === String(bookmarkRefId);
        });
    }

    function findIndexById(bookmarkId) {
        return bookmarks.findIndex((item) => {
            return String(item.id) === String(bookmarkId);
        });
    }

    /* =====================================================
       02. USER SETUP
    ===================================================== */

    function setUser(user) {
        currentUser = user || null;
    }

    function getUser() {
        return currentUser;
    }

    function getBookmarks() {
        return clone(bookmarks);
    }

    function getCount() {
        return bookmarks.length;
    }

    function isLoading() {
        return loading;
    }

    /* =====================================================
       03. LOAD / REFRESH
    ===================================================== */

    async function load(user) {
        currentUser = user || currentUser;

        if (!currentUser) {
            bookmarks = [];
            return bookmarks;
        }

        loading = true;

        try {
            const list = await DB.loadBookmarks(currentUser);
            bookmarks = normalizeList(list);
            return getBookmarks();
        } catch (error) {
            console.warn("Learn bookmarks load failed:", error);
            bookmarks = [];
            return bookmarks;
        } finally {
            loading = false;
        }
    }

    async function refresh() {
        return await load(currentUser);
    }

    /* =====================================================
       04. CHECK BOOKMARK
    ===================================================== */

    function isBookmarkedRef(bookmarkRefId) {
        if (!bookmarkRefId) return false;
        return findIndexByRef(bookmarkRefId) !== -1;
    }

    function isLevelBookmarked(groupId, levelNo, action = "practice") {
        const ref = makeLearnBookmarkRef(groupId, levelNo, action);
        return isBookmarkedRef(ref);
    }

    function getBookmarkByRef(bookmarkRefId) {
        const index = findIndexByRef(bookmarkRefId);
        return index >= 0 ? clone(bookmarks[index]) : null;
    }

    function getLevelBookmark(groupId, levelNo, action = "practice") {
        const ref = makeLearnBookmarkRef(groupId, levelNo, action);
        return getBookmarkByRef(ref);
    }

    /* =====================================================
       05. ADD BOOKMARK
    ===================================================== */

    async function addBookmark(data = {}) {
        if (!currentUser) {
            return {
                ok: false,
                message: "User not found"
            };
        }

        const bookmarkRefId =
            data.bookmark_ref_id ||
            makeLearnBookmarkRef(data.group || data.subject || "Primary", data.level || 1, data.action || "practice");

        if (isBookmarkedRef(bookmarkRefId)) {
            return {
                ok: true,
                alreadyExists: true,
                message: "Already bookmarked",
                bookmark: getBookmarkByRef(bookmarkRefId)
            };
        }

        const payload = {
            bookmark_type: data.bookmark_type || "learn",
            bookmark_ref_id: bookmarkRefId,
            subject: data.subject || data.group || "Primary",
            chapter_name: data.chapter_name || data.chapter || ("Level " + Number(data.level || 1)),
            exam_year: data.exam_year || null
        };

        const saved = await DB.addBookmark(currentUser, payload);

        if (!saved) {
            return {
                ok: false,
                message: "Bookmark save failed"
            };
        }

        await refresh();

        return {
            ok: true,
            message: "Bookmark added",
            bookmark: getBookmarkByRef(bookmarkRefId)
        };
    }

    async function addLevelBookmark(groupId, levelNo, action = "practice") {
        return await addBookmark({
            group: groupId,
            level: levelNo,
            action,
            subject: groupId,
            chapter_name: "Level " + Number(levelNo || 1),
            bookmark_type: "learn",
            bookmark_ref_id: makeLearnBookmarkRef(groupId, levelNo, action)
        });
    }

    /* =====================================================
       06. REMOVE BOOKMARK
    ===================================================== */

    async function removeBookmark(bookmarkId) {
        if (!currentUser || !bookmarkId) {
            return {
                ok: false,
                message: "Bookmark not found"
            };
        }

        const index = findIndexById(bookmarkId);

        const removed = await DB.removeBookmark(currentUser, bookmarkId);

        if (!removed) {
            return {
                ok: false,
                message: "Bookmark remove failed"
            };
        }

        if (index >= 0) {
            bookmarks.splice(index, 1);
        } else {
            await refresh();
        }

        return {
            ok: true,
            message: "Bookmark removed"
        };
    }

    async function removeBookmarkByRef(bookmarkRefId) {
        const bookmark = getBookmarkByRef(bookmarkRefId);

        if (!bookmark || !bookmark.id) {
            return {
                ok: false,
                message: "Bookmark not found"
            };
        }

        return await removeBookmark(bookmark.id);
    }

    async function removeLevelBookmark(groupId, levelNo, action = "practice") {
        const ref = makeLearnBookmarkRef(groupId, levelNo, action);
        return await removeBookmarkByRef(ref);
    }

    /* =====================================================
       07. TOGGLE BOOKMARK
    ===================================================== */

    async function toggleLevelBookmark(groupId, levelNo, action = "practice") {
        const ref = makeLearnBookmarkRef(groupId, levelNo, action);

        if (isBookmarkedRef(ref)) {
            return await removeBookmarkByRef(ref);
        }

        return await addLevelBookmark(groupId, levelNo, action);
    }

    /* =====================================================
       08. FILTER HELPERS
    ===================================================== */

    function getLearnBookmarks() {
        return bookmarks.filter((item) => item.bookmark_type === "learn");
    }

    function getPracticeBookmarks() {
        return bookmarks.filter((item) => {
            return String(item.bookmark_ref_id || "").includes(":practice");
        });
    }

    function getReadBookmarks() {
        return bookmarks.filter((item) => {
            return String(item.bookmark_ref_id || "").includes(":read");
        });
    }

    function getBookmarksBySubject(subject) {
        const text = normalizeText(subject).toLowerCase();

        return bookmarks.filter((item) => {
            return normalizeText(item.subject).toLowerCase() === text;
        });
    }

    /* =====================================================
       09. PUBLIC API
    ===================================================== */

    return {
        setUser,
        getUser,

        load,
        refresh,
        isLoading,

        getBookmarks,
        getCount,
        getLearnBookmarks,
        getPracticeBookmarks,
        getReadBookmarks,
        getBookmarksBySubject,

        makeLearnBookmarkRef,

        isBookmarkedRef,
        isLevelBookmarked,
        getBookmarkByRef,
        getLevelBookmark,

        addBookmark,
        addLevelBookmark,

        removeBookmark,
        removeBookmarkByRef,
        removeLevelBookmark,

        toggleLevelBookmark
    };
})();
