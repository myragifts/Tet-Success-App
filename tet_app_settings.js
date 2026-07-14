/* =========================================================
   TET Success
   Dynamic App Settings Loader
   Loads global settings from tet_app_settings table
   ========================================================= */

const APP = {};

/* ---------------------------------------------------------
   Load App Settings
--------------------------------------------------------- */
async function loadTetAppSettings() {

  const { data, error } = await supabase
    .from(CONFIG.TABLES.APP_SETTINGS)
    .select("*")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("Failed to load app settings:", error);
    return false;
  }

  if (!data) {
    console.error("No App Settings found.");
    return false;
  }

  Object.assign(APP, data);

  console.log("TET Success App Settings Loaded");

  return true;
}

/* ---------------------------------------------------------
   Get Any App Setting
--------------------------------------------------------- */
function getAppSetting(key, fallback = null) {

  if (!(key in APP)) {
    return fallback;
  }

  return APP[key];

}

/* ---------------------------------------------------------
   Check App Settings Loaded
--------------------------------------------------------- */
function isAppSettingsLoaded() {
  return Object.keys(APP).length > 0;
}
