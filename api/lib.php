<?php
// ANKA backend: shared helpers (database, sessions, CSRF, throttling). Works on PHP 7.4+.
$CFG = require __DIR__ . '/config.php';
date_default_timezone_set($CFG['timezone'] ?? 'Asia/Kathmandu');

const A_LEVELS   = ['Class 6–8', 'Class 9–10 (SEE)', 'Class 11–12 (+2)', 'Other'];
const A_SUBJECTS = ['Mathematics', 'Optional Maths', 'Science', 'English', 'Computer', 'Physics', 'Chemistry'];
const A_TIMES    = ['Morning', 'Afternoon', 'Evening', 'Flexible'];
const A_MODES    = ['group' => 'Group batch', 'one' => 'One-to-one'];
const A_TYPES    = ['demo' => 'Free demo', 'enrol' => 'Enrolment'];
const A_STATUSES = ['pending', 'confirmed', 'completed', 'cancelled'];

function db() {
    static $pdo = null;
    if ($pdo) return $pdo;
    global $CFG;
    $path = $CFG['db_path'];
    $dir = dirname($path);
    if (!is_dir($dir)) @mkdir($dir, 0750, true);
    $pdo = new PDO('sqlite:' . $path);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
    $pdo->exec('PRAGMA foreign_keys = ON');
    $pdo->exec('PRAGMA busy_timeout = 5000');
    $pdo->exec("
    CREATE TABLE IF NOT EXISTS students(
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL, phone TEXT NOT NULL, email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL, level TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL, last_login TEXT);
    CREATE TABLE IF NOT EXISTS bookings(
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      type TEXT NOT NULL, level TEXT NOT NULL, mode TEXT NOT NULL,
      subjects TEXT NOT NULL, preferred_time TEXT NOT NULL, note TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'pending', admin_note TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS idx_b_student ON bookings(student_id);
    CREATE INDEX IF NOT EXISTS idx_b_status ON bookings(status);
    CREATE TABLE IF NOT EXISTS inquiries(
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL, phone TEXT NOT NULL, level TEXT, preferred_time TEXT,
      subjects TEXT, message TEXT, status TEXT NOT NULL DEFAULT 'new', created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS admins(
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS attempts(k TEXT NOT NULL, ts INTEGER NOT NULL);
    CREATE INDEX IF NOT EXISTS idx_att ON attempts(k, ts);
    ");
    return $pdo;
}

function now() { return date('Y-m-d H:i:s'); }
function h($s) { return htmlspecialchars((string)$s, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); }
function client_ip() { return $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0'; }

// Single-line cleaned text
function cl($v, $max = 200) {
    $v = trim(strip_tags((string)$v));
    $v = preg_replace('/\s+/u', ' ', $v);
    return mb_substr($v, 0, $max);
}
// Multi-line cleaned text
function cl_multi($v, $max = 800) {
    $v = trim(strip_tags((string)$v));
    $v = str_replace("\r", '', $v);
    return mb_substr($v, 0, $max);
}
function phone_ok($p) { return (bool)preg_match('/^\d{7,15}$/', preg_replace('/[\s\-+()]/', '', $p)); }
function wa_link($phone) {
    $d = preg_replace('/\D/', '', $phone);
    if (strlen($d) === 10 && $d[0] === '9') $d = '977' . $d;   // Nepal mobile -> international
    return 'https://wa.me/' . $d;
}

function start_session($name, $path = '/', $cookieLife = 0) {
    if (session_status() === PHP_SESSION_ACTIVE) return;
    $https = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');
    $dir = __DIR__ . '/data/sessions';
    if (!is_dir($dir)) @mkdir($dir, 0700, true);
    if (is_dir($dir) && is_writable($dir)) session_save_path($dir);
    ini_set('session.gc_maxlifetime', (string)(14 * 86400));
    ini_set('session.use_strict_mode', '1');
    ini_set('session.use_only_cookies', '1');
    session_name($name);
    session_set_cookie_params(['lifetime' => $cookieLife, 'path' => $path, 'secure' => $https, 'httponly' => true, 'samesite' => 'Lax']);
    session_start();
}

function csrf_token() {
    if (empty($_SESSION['csrf'])) $_SESSION['csrf'] = bin2hex(random_bytes(32));
    return $_SESSION['csrf'];
}
function csrf_ok($t) { return is_string($t) && !empty($_SESSION['csrf']) && hash_equals($_SESSION['csrf'], $t); }

function same_origin() {
    $o = $_SERVER['HTTP_ORIGIN'] ?? '';
    if ($o === '') return true;
    $oh = parse_url($o, PHP_URL_HOST);
    $hh = preg_replace('/:\d+$/', '', $_SERVER['HTTP_HOST'] ?? '');
    return $oh && strcasecmp($oh, $hh) === 0;
}

function json_out($data, $code = 200) {
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    header('X-Content-Type-Options: nosniff');
    echo json_encode($data, JSON_UNESCAPED_UNICODE);
    exit;
}
function json_input() {
    $d = json_decode(file_get_contents('php://input'), true);
    return is_array($d) ? $d : [];
}
// Standard guard for state-changing JSON endpoints
function require_post_csrf() {
    if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') json_out(['error' => 'POST only'], 405);
    if (!same_origin()) json_out(['error' => 'Request blocked.'], 403);
    if (!csrf_ok($_SERVER['HTTP_X_CSRF_TOKEN'] ?? '')) json_out(['error' => 'Your session expired. Please refresh the page and try again.'], 403);
}

// ---- rate limiting (stored in SQLite) ----
function throttle_blocked($key, $max, $window) {
    $s = db()->prepare('SELECT COUNT(*) FROM attempts WHERE k = ? AND ts > ?');
    $s->execute([$key, time() - $window]);
    return (int)$s->fetchColumn() >= $max;
}
function throttle_hit($key) {
    db()->prepare('INSERT INTO attempts(k, ts) VALUES(?, ?)')->execute([$key, time()]);
    if (mt_rand(1, 50) === 1) db()->prepare('DELETE FROM attempts WHERE ts < ?')->execute([time() - 86400]);
}
function throttle_clear($key) { db()->prepare('DELETE FROM attempts WHERE k = ?')->execute([$key]); }

function notify_owner($subject, $body) {
    global $CFG;
    $to = $CFG['notify_email'] ?? '';
    if (!$to) return;
    $dom = $CFG['mail_domain'] ?? 'localhost';
    @mail($to, '=?UTF-8?B?' . base64_encode($subject) . '?=', $body,
        "From: ANKA Website <no-reply@$dom>\r\nContent-Type: text/plain; charset=UTF-8\r\n");
}

function student_public($s) {
    return ['id' => (int)$s['id'], 'name' => $s['name'], 'phone' => $s['phone'], 'email' => $s['email'], 'level' => $s['level']];
}
function current_student() {
    if (empty($_SESSION['sid'])) return null;
    $s = db()->prepare('SELECT * FROM students WHERE id = ?');
    $s->execute([(int)$_SESSION['sid']]);
    $r = $s->fetch();
    if (!$r) { unset($_SESSION['sid']); return null; }
    return $r;
}
