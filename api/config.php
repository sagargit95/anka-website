<?php
// ===================== ANKA BACKEND SETTINGS =====================
// Edit these values BEFORE uploading to your server.
return [
    // One-time secret that lets YOU create the first admin account at /admin/setup.php.
    // Use a long random phrase. The setup page refuses to run while this is the default.
    'setup_token'  => 'CHANGE-ME-TO-A-LONG-RANDOM-PHRASE',

    // Where new-registration / new-booking alerts are emailed (optional but handy).
    'notify_email' => 'info@nsagar.com.np',
    'mail_domain'  => 'nsagar.com.np',

    // SQLite database file. The default folder is blocked from the web by api/data/.htaccess.
    // The file name is random on purpose so it cannot be guessed. For extra safety you can point this OUTSIDE public_html, e.g. '/home/CPANELUSER/anka-data/anka.sqlite'
    'db_path'      => __DIR__ . '/data/anka-b0841c9d06a0ba55def5.sqlite',

    'timezone'     => 'Asia/Kathmandu',
];
