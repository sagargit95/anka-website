<?php
// ================= SETTINGS =================
$to = "info@nsagar.com.np";   // create this mailbox in cPanel > Email Accounts
$domain = "nsagar.com.np";
// ============================================

if ($_SERVER["REQUEST_METHOD"] !== "POST") { header("Location: contact.html"); exit; }

// Spam trap: real visitors leave this hidden field empty
if (!empty($_POST["website"])) { header("Location: contact.html?sent=1"); exit; }

// Simple rate limit: one request per 20 seconds per visitor
session_start();
if (isset($_SESSION["last"]) && time() - $_SESSION["last"] < 20) { header("Location: contact.html?sent=0"); exit; }

function clean($v, $max = 200) {
    $v = trim(strip_tags((string)$v));
    $v = str_replace(["\r", "\n"], " ", $v);          // blocks email-header injection
    return mb_substr($v, 0, $max);
}

$name  = clean($_POST["name"] ?? "", 80);
$phone = clean($_POST["phone"] ?? "", 25);
$level = clean($_POST["level"] ?? "", 40);
$time  = clean($_POST["time"] ?? "", 40);
$subs  = [];
if (!empty($_POST["subjects"]) && is_array($_POST["subjects"])) {
    foreach (array_slice($_POST["subjects"], 0, 12) as $s) { $subs[] = clean($s, 40); }
}
$message = mb_substr(trim(strip_tags((string)($_POST["message"] ?? ""))), 0, 800);

if ($name === "" || $phone === "") { header("Location: contact.html?sent=0"); exit; }

$subject = "ANKA: new demo request from " . $name;
$body  = "New request from nsagar.com.np\n\n";
$body .= "Name: $name\nPhone/WhatsApp: $phone\nClass: $level\n";
$body .= "Subjects: " . (count($subs) ? implode(", ", $subs) : "-") . "\n";
$body .= "Preferred time: $time\n\nMessage:\n$message\n";

$headers = "From: ANKA Website <no-reply@$domain>\r\nContent-Type: text/plain; charset=UTF-8\r\n";
// Save to the database so it shows in the admin panel (even if email delivery fails)
$saved = false;
try {
    require __DIR__ . "/api/lib.php";
    db()->prepare("INSERT INTO inquiries(name, phone, level, preferred_time, subjects, message, status, created_at) VALUES(?,?,?,?,?,?,?,?)")
        ->execute([$name, $phone, $level, $time, implode(", ", $subs), $message, "new", date("Y-m-d H:i:s")]);
    $saved = true;
} catch (Throwable $e) { /* database not ready: fall back to email only */ }

$ok = @mail($to, $subject, $body, $headers);
$ok = $ok || $saved;
if ($ok) { $_SESSION["last"] = time(); }
header("Location: contact.html?sent=" . ($ok ? "1" : "0"));
exit;
