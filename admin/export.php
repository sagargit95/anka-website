<?php
require __DIR__ . '/_auth.php';
require_admin();
$type = $_GET['type'] ?? 'bookings';
$pdo = db();
if ($type === 'students') {
    $head = ['ID', 'Name', 'Phone', 'Email', 'Class', 'Registered', 'Last login'];
    $rows = $pdo->query('SELECT id, name, phone, email, level, created_at, last_login FROM students ORDER BY id DESC')->fetchAll(PDO::FETCH_NUM);
} elseif ($type === 'inquiries') {
    $head = ['ID', 'Name', 'Phone', 'Class', 'Preferred time', 'Subjects', 'Message', 'Status', 'Received'];
    $rows = $pdo->query('SELECT id, name, phone, level, preferred_time, subjects, message, status, created_at FROM inquiries ORDER BY id DESC')->fetchAll(PDO::FETCH_NUM);
} else {
    $type = 'bookings';
    $head = ['ID', 'Student', 'Phone', 'Email', 'Type', 'Class', 'Mode', 'Subjects', 'Preferred time', 'Student note', 'Status', 'Admin note', 'Booked'];
    $rows = $pdo->query('SELECT b.id, s.name, s.phone, s.email, b.type, b.level, b.mode, b.subjects, b.preferred_time, b.note, b.status, b.admin_note, b.created_at
                         FROM bookings b JOIN students s ON s.id = b.student_id ORDER BY b.id DESC')->fetchAll(PDO::FETCH_NUM);
}
header('Content-Type: text/csv; charset=utf-8');
header('Content-Disposition: attachment; filename="anka-' . $type . '-' . date('Y-m-d') . '.csv"');
$out = fopen('php://output', 'w');
fwrite($out, "\xEF\xBB\xBF");   // UTF-8 BOM so Excel shows Nepali/special characters correctly
// Neutralise spreadsheet formulas in user-supplied text
$safe = function ($v) { $v = (string)$v; return ($v !== '' && strpos("=+-@\t\r", $v[0]) !== false) ? "'" . $v : $v; };
fputcsv($out, $head);
foreach ($rows as $r) fputcsv($out, array_map($safe, $r));
fclose($out);
