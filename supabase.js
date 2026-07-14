/* =========================================================
   TET Success - Supabase Connection
========================================================= */

const tetSupabase = window.supabase.createClient(
  CONFIG.SUPABASE_URL,
  CONFIG.SUPABASE_PUBLISHABLE_KEY,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false
    },
    global: {
      headers: {
        "X-Client-Info": "TET-Success-Web"
      }
    }
  }
);

window.supabase = tetSupabase;

async function checkSupabaseConnection() {
  try {
    const { error } = await supabase
      .from(CONFIG.TABLES.APP_SETTINGS)
      .select("id")
      .limit(1);

    if (error) {
      console.error("Supabase Connection Failed:", error);
      return false;
    }

    console.log("Supabase Connected Successfully");
    return true;

  } catch (err) {
    console.error("Unexpected Supabase Error:", err);
    return false;
  }
}

async function initializeBackend() {
  try {
    const connected = await checkSupabaseConnection();

    if (!connected) {
      console.error("Unable to connect to Supabase.");
      return false;
    }

    const settingsLoaded = await loadTetAppSettings();

    if (!settingsLoaded) {
      console.error("Unable to load App Settings.");
      return false;
    }

    console.log("Backend Initialized Successfully");
    return true;

  } catch (err) {
    console.error("Backend Initialization Failed:", err);
    return false;
  }
}

function isBackendReady() {
  return (
    typeof supabase !== "undefined" &&
    isAppSettingsLoaded()
  );
}
