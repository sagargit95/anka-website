<?php
require __DIR__ . '/_auth.php';
if (admin_user()) { header('Location: index.php'); exit; }
$err = '';
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $user = trim((string)($_POST['username'] ?? ''));
    $pass = (string)($_POST['password'] ?? '');
    $ip = client_ip(); $k1 = 'adm:' . $ip . ':' . strtolower($user); $k2 = 'admip:' . $ip;
    if (!same_origin() || !csrf_ok($_POST['csrf'] ?? '')) $err = 'Session expired. Reload and try again.';
    elseif (throttle_blocked($k1, 5, 900) || throttle_blocked($k2, 20, 900)) $err = 'Too many attempts. Wait 15 minutes.';
    else {
        $s = db()->prepare('SELECT * FROM admins WHERE username = ?');
        $s->execute([$user]);
        $a = $s->fetch();
        $hash = $a ? $a['password_hash'] : '$2y$10$usesomesillystringforsalt.abcdefghijklmnopqrstuvwxyzABCDE';
        if ($a && password_verify($pass, $hash)) {
            throttle_clear($k1);
            session_regenerate_id(true);
            $_SESSION['aid'] = (int)$a['id']; $_SESSION['t'] = time();
            unset($_SESSION['csrf']);
            header('Location: index.php'); exit;
        }
        throttle_hit($k1); throttle_hit($k2);
        $err = 'Incorrect username or password.';
    }
}
a_head('Login');
?>
<section class="a-narrow"><div class="card">
<h1 class="h3">Admin login</h1>
<?php if ($err) echo '<div class="alert bad" style="margin-top:1rem">' . h($err) . '</div>'; ?>
<form method="post">
  <input type="hidden" name="csrf" value="<?= h(csrf_token()) ?>">
  <label class="l" for="username">Username</label><input id="username" name="username" type="text" required autocomplete="username">
  <label class="l" for="password">Password</label><input id="password" name="password" type="password" required autocomplete="current-password">
  <div class="form-actions"><button class="btn btn-primary" type="submit">Log in</button></div>
</form>
</div></section>
<?php a_foot();
