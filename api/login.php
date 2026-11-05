<?php
require __DIR__ . '/lib.php';
start_session('anka_s', '/', 14 * 86400);
require_post_csrf();

$d = json_input();
$email = strtolower(cl($d['email'] ?? '', 120));
$pass  = (string)($d['password'] ?? '');
$ip = client_ip();
$k1 = 'login:' . $ip . ':' . $email;
$k2 = 'loginip:' . $ip;
if (throttle_blocked($k1, 6, 900) || throttle_blocked($k2, 30, 900)) json_out(['error' => 'Too many attempts. Please wait 15 minutes and try again.'], 429);

$s = db()->prepare('SELECT * FROM students WHERE email = ?');
$s->execute([$email]);
$u = $s->fetch();
// Always run a hash check so response time does not reveal whether the email exists
$hash = $u ? $u['password_hash'] : '$2y$10$usesomesillystringforsalt.abcdefghijklmnopqrstuvwxyzABCDE';
$ok = password_verify($pass, $hash) && $u;
if (!$ok) {
    throttle_hit($k1); throttle_hit($k2);
    json_out(['error' => 'Incorrect email or password.'], 401);
}
throttle_clear($k1);
db()->prepare('UPDATE students SET last_login = ? WHERE id = ?')->execute([now(), $u['id']]);
session_regenerate_id(true);
unset($_SESSION['csrf']);
$_SESSION['sid'] = (int)$u['id'];
json_out(['user' => student_public($u), 'csrf' => csrf_token()]);
