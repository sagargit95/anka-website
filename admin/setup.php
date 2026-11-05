<?php
require __DIR__ . '/_auth.php';
$pdo = db();
$exists = (int)$pdo->query('SELECT COUNT(*) FROM admins')->fetchColumn() > 0;
$cfgTok = $CFG['setup_token'] ?? '';
$tokDefault = ($cfgTok === '' || strpos($cfgTok, 'CHANGE-ME') === 0);
$err = '';

if (!$exists && !$tokDefault && $_SERVER['REQUEST_METHOD'] === 'POST') {
    $ip = client_ip();
    if (!same_origin() || !csrf_ok($_POST['csrf'] ?? '')) $err = 'Session expired. Reload and try again.';
    elseif (throttle_blocked('setup:' . $ip, 5, 3600)) $err = 'Too many attempts. Try later.';
    else {
        $user = trim((string)($_POST['username'] ?? ''));
        $pass = (string)($_POST['password'] ?? '');
        if (!hash_equals($cfgTok, (string)($_POST['token'] ?? ''))) { throttle_hit('setup:' . $ip); $err = 'Setup token is wrong.'; }
        elseif (!preg_match('/^[A-Za-z0-9_.-]{3,30}$/', $user)) $err = 'Username: 3–30 letters, numbers, dot, dash or underscore.';
        elseif (strlen($pass) < 10) $err = 'Password must be at least 10 characters.';
        elseif ($pass !== (string)($_POST['password2'] ?? '')) $err = 'Passwords do not match.';
        else {
            $pdo->prepare('INSERT INTO admins(username, password_hash, created_at) VALUES(?,?,?)')->execute([$user, password_hash($pass, PASSWORD_DEFAULT), now()]);
            session_regenerate_id(true);
            $_SESSION['aid'] = (int)$pdo->lastInsertId();
            $_SESSION['t'] = time();
            flash('ok', 'Admin account created. For safety, delete admin/setup.php from your server now.');
            header('Location: index.php'); exit;
        }
    }
}
a_head('Setup');
?>
<section class="a-narrow"><div class="card">
<h1 class="h3">Create admin account</h1>
<?php if ($exists): ?>
  <p class="muted" style="margin-top:.8rem">Setup is already complete. <a class="grad-text" href="login.php"><b>Go to login</b></a>. You can delete <code>admin/setup.php</code> from your server.</p>
<?php elseif ($tokDefault): ?>
  <div class="alert bad" style="margin-top:1rem">Open <code>api/config.php</code> and replace <code>setup_token</code> with your own long secret phrase, upload it, then reload this page.</div>
<?php else: ?>
  <?php if ($err) echo '<div class="alert bad" style="margin-top:1rem">' . h($err) . '</div>'; ?>
  <form method="post" autocomplete="off">
    <input type="hidden" name="csrf" value="<?= h(csrf_token()) ?>">
    <label class="l" for="token">Setup token (from api/config.php)</label><input id="token" name="token" type="password" required>
    <label class="l" for="username">Admin username</label><input id="username" name="username" type="text" required maxlength="30">
    <label class="l" for="password">Password (10+ characters)</label><input id="password" name="password" type="password" required minlength="10">
    <label class="l" for="password2">Repeat password</label><input id="password2" name="password2" type="password" required minlength="10">
    <div class="form-actions"><button class="btn btn-primary" type="submit">Create admin</button></div>
  </form>
<?php endif; ?>
</div></section>
<?php a_foot();
