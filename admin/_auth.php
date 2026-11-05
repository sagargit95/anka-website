<?php
require __DIR__ . '/../api/lib.php';
$ADMIN_PATH = rtrim(str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME'] ?? '/admin/x.php')), '/');
if ($ADMIN_PATH === '') $ADMIN_PATH = '/';
start_session('anka_a', $ADMIN_PATH, 0);
header('X-Robots-Tag: noindex, nofollow');
header('Cache-Control: no-store');
header('X-Frame-Options: DENY');
header('Referrer-Policy: same-origin');

function admin_user() {
    if (empty($_SESSION['aid'])) return null;
    if (time() - ($_SESSION['t'] ?? 0) > 7200) { $_SESSION = []; return null; }   // 2h idle logout
    $_SESSION['t'] = time();
    $s = db()->prepare('SELECT * FROM admins WHERE id = ?');
    $s->execute([(int)$_SESSION['aid']]);
    $a = $s->fetch();
    if (!$a) { $_SESSION = []; return null; }
    return $a;
}
function require_admin() {
    $a = admin_user();
    if (!$a) { header('Location: login.php'); exit; }
    return $a;
}
function flash($type, $msg) { $_SESSION['flash'] = [$type, $msg]; }
function take_flash() { $f = $_SESSION['flash'] ?? null; unset($_SESSION['flash']); return $f; }

function a_head($title, $admin = null, $tab = '') {
    $tabs = ['bookings' => 'Bookings', 'students' => 'Students', 'inquiries' => 'Inquiries', 'account' => 'Account'];
    ?><!DOCTYPE html>
<html lang="en" data-theme="dark"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title><?= h($title) ?> · ANKA Admin</title>
<link rel="icon" href="../favicon.ico" sizes="48x48"><link rel="icon" href="../img/favicon-32.png" type="image/png" sizes="32x32">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700;800&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
<script>try{var t=localStorage.getItem('anka-theme');if(t)document.documentElement.setAttribute('data-theme',t)}catch(e){}</script>
<link rel="stylesheet" href="../css/style.css"><link rel="stylesheet" href="../css/admin.css">
</head><body class="adm">
<header class="a-top"><div class="a-wrap a-top-in">
  <a class="a-brand" href="index.php" aria-label="ANKA Admin"><img class="logo logo-dk" src="../img/logo-dark.png" alt="ANKA" width="68" height="48"><img class="logo logo-lt" src="../img/logo.png" alt="" width="68" height="48"><span class="a-tag">Admin</span></a>
  <?php if ($admin): ?>
  <nav class="a-tabs" aria-label="Admin sections">
    <?php foreach ($tabs as $k => $v): ?><a href="index.php?tab=<?= $k ?>"<?= $tab === $k ? ' aria-current="page"' : '' ?>><?= $v ?></a><?php endforeach; ?>
  </nav>
  <div class="a-user"><span class="muted"><?= h($admin['username']) ?></span> <a class="btn btn-ghost btn-sm" href="logout.php">Log out</a></div>
  <?php endif; ?>
</div></header>
<main class="a-wrap a-main"><?php
}
function a_foot() { ?></main></body></html><?php }
function a_flash() {
    $f = take_flash();
    if ($f) echo '<div class="alert ' . ($f[0] === 'ok' ? 'ok' : 'bad') . '" role="status">' . h($f[1]) . '</div>';
}
