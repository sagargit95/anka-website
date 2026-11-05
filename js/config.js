/*
 * ANKA by SAGAR — site settings.
 * Edit ONLY this file to change your phone, WhatsApp, email and fees.
 * Every page reads these values automatically.
 */
window.ANKA = {
  brand: "ANKA by SAGAR",
  whatsapp: "9779849852212",        // country code 977 + your number, no + or spaces
  phone: "+977 9849852212",
  email: "info@nsagar.com.np",

  // SAMPLE FEES (Nepali Rupees) — change to your real prices.
  // group = per subject, per month.  one = per one-to-one class.
  prices: {
    levels: {
      "6-8": { label: "Class 6–8", group: 1500, one: 800 },
      "9-10": { label: "Class 9–10 (SEE)", group: 1800, one: 1000 },
      "11-12": { label: "Class 11–12 (+2)", group: 2200, one: 1200 }
    },
    // discount % when a student takes this many group subjects (or more)
    discounts: { 3: 10, 4: 15, 5: 20 },
    weeksPerMonth: 4
  }
};

/* ==========================================================
 * Supabase Backend Configuration (Authentication & Database)
 * ========================================================== */
const SUPABASE_URL = "https://ulcrytzfettocolcddiq.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_5SihTkMgwPZ-nggmU_C6kA_mqjVimEG";

// Initialize the global Supabase client
window.supabaseClient = window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;