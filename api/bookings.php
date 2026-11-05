<?php
require __DIR__ . '/lib.php';
start_session('anka_s', '/', 14 * 86400);
$u = current_student();
$pdo = db();

function booking_public($b) {
    return ['id' => (int)$b['id'], 'type' => $b['type'], 'level' => $b['level'], 'mode' => $b['mode'],
        'subjects' => $b['subjects'], 'time' => $b['preferred_time'], 'note' => $b['note'],
        'status' => $b['status'], 'created' => $b['created_at']];
}

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    if (!$u) json_out(['error' => 'Please log in.'], 401);
    $s = $pdo->prepare('SELECT * FROM bookings WHERE student_id = ? ORDER BY id DESC LIMIT 100');
    $s->execute([$u['id']]);
    json_out(['bookings' => array_map('booking_public', $s->fetchAll())]);
}

require_post_csrf();
if (!$u) json_out(['error' => 'Please log in.'], 401);
$d = json_input();
$action = (string)($d['action'] ?? 'create');

if ($action === 'cancel') {
    $id = (int)($d['id'] ?? 0);
    $s = $pdo->prepare("UPDATE bookings SET status = 'cancelled', updated_at = ? WHERE id = ? AND student_id = ? AND status = 'pending'");
    $s->execute([now(), $id, $u['id']]);
    if (!$s->rowCount()) json_out(['error' => 'Only pending bookings can be cancelled. Message us on WhatsApp to change a confirmed one.'], 409);
    json_out(['ok' => true]);
}

if ($action !== 'create') json_out(['error' => 'Unknown action.'], 400);

$type  = (string)($d['type'] ?? '');
$level = (string)($d['level'] ?? '');
$mode  = (string)($d['mode'] ?? '');
$time  = (string)($d['time'] ?? '');
$subs  = is_array($d['subjects'] ?? null) ? array_values(array_unique(array_map('strval', $d['subjects']))) : [];
$note  = cl_multi($d['note'] ?? '', 500);

if (!isset(A_TYPES[$type]) || !in_array($level, A_LEVELS, true) || !isset(A_MODES[$mode]) || !in_array($time, A_TIMES, true))
    json_out(['error' => 'Please complete all the booking options.'], 422);
if (!$subs || count($subs) > 8 || array_diff($subs, A_SUBJECTS))
    json_out(['error' => 'Choose at least one subject.'], 422);

$c = $pdo->prepare("SELECT COUNT(*) FROM bookings WHERE student_id = ? AND status = 'pending'");
$c->execute([$u['id']]);
if ((int)$c->fetchColumn() >= 5) json_out(['error' => 'You already have 5 pending bookings. We will confirm those first.'], 429);

$pdo->prepare('INSERT INTO bookings(student_id, type, level, mode, subjects, preferred_time, note, status, created_at, updated_at) VALUES(?,?,?,?,?,?,?,?,?,?)')
    ->execute([$u['id'], $type, $level, $mode, implode(', ', $subs), $time, $note, 'pending', now(), now()]);
$id = (int)$pdo->lastInsertId();

notify_owner('ANKA: new ' . strtolower(A_TYPES[$type]) . ' booking from ' . $u['name'],
    "New booking #$id\n\nStudent: {$u['name']}\nPhone: {$u['phone']}\nEmail: {$u['email']}\nType: " . A_TYPES[$type] .
    "\nClass: $level\nMode: " . A_MODES[$mode] . "\nSubjects: " . implode(', ', $subs) . "\nPreferred time: $time\n\nNote:\n$note\n");
json_out(['ok' => true, 'id' => $id], 201);
