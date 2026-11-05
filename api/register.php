<?php
require __DIR__ . '/lib.php';
start_session('anka_s', '/', 14 * 86400);
require_post_csrf();

$ip = client_ip();
if (throttle_blocked('reg:' . $ip, 8, 3600)) json_out(['error' => 'Too many sign-ups from this connection. Please try again later.'], 429);

$d = json_input();
if (!empty($d['website'])) json_out(['error' => 'Could not register.'], 400);   // honeypot
$name  = cl($d['name'] ?? '', 80);
$phone = cl($d['phone'] ?? '', 25);
$email = strtolower(cl($d['email'] ?? '', 120));
$pass  = (string)($d['password'] ?? '');
$level = (string)($d['level'] ?? '');

$errors = [];
if (mb_strlen($name) < 2) $errors['name'] = 'Please enter your name.';
if (!phone_ok($phone)) $errors['phone'] = 'Enter a valid phone / WhatsApp number.';
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) $errors['email'] = 'Enter a valid email address.';
if (strlen($pass) < 8) $errors['password'] = 'Use at least 8 characters.';
if (strlen($pass) > 200) $errors['password'] = 'Password is too long.';
if (!in_array($level, A_LEVELS, true)) $errors['level'] = 'Choose a class.';
if ($errors) json_out(['error' => 'Please fix the highlighted fields.', 'fields' => $errors], 422);

$pdo = db();
$x = $pdo->prepare('SELECT 1 FROM students WHERE email = ?');
$x->execute([$email]);
if ($x->fetch()) json_out(['error' => 'An account with this email already exists. Try logging in.', 'fields' => ['email' => 'Already registered.']], 409);

$pdo->prepare('INSERT INTO students(name, phone, email, password_hash, level, created_at, last_login) VALUES(?,?,?,?,?,?,?)')
    ->execute([$name, $phone, $email, password_hash($pass, PASSWORD_DEFAULT), $level, now(), now()]);
$id = (int)$pdo->lastInsertId();
throttle_hit('reg:' . $ip);

session_regenerate_id(true);
unset($_SESSION['csrf']);
$_SESSION['sid'] = $id;
notify_owner("ANKA: new student registered ($name)", "New registration\n\nName: $name\nPhone: $phone\nEmail: $email\nClass: $level\n");
json_out(['user' => ['id' => $id, 'name' => $name, 'phone' => $phone, 'email' => $email, 'level' => $level], 'csrf' => csrf_token()], 201);
