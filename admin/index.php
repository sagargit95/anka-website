<?php
require __DIR__ . '/_auth.php';
$admin = require_admin();
$pdo = db();

$tab = $_GET['tab'] ?? 'bookings';
if (!in_array($tab, ['bookings', 'students', 'inquiries', 'account'], true)) $tab = 'bookings';

// ---------- actions (POST) ----------
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $back = preg_replace('/[^A-Za-z0-9=&_%.+\-]/', '', (string)($_POST['back'] ?? 'tab=bookings'));
    if (!same_origin() || !csrf_ok($_POST['csrf'] ?? '')) { flash('bad', 'Session expired. Please try again.'); header('Location: index.php?' . $back); exit; }
    $act = (string)($_POST['action'] ?? '');
    $id = (int)($_POST['id'] ?? 0);

    if ($act === 'update_booking') {
        $st = (string)($_POST['status'] ?? '');
        if (in_array($st, A_STATUSES, true)) {
            $pdo->prepare('UPDATE bookings SET status = ?, admin_note = ?, updated_at = ? WHERE id = ?')->execute([$st, cl_multi($_POST['admin_note'] ?? '', 500), now(), $id]);
            flash('ok', "Booking #$id updated.");
        }
    } elseif ($act === 'delete_booking') {
        $pdo->prepare('DELETE FROM bookings WHERE id = ?')->execute([$id]);
        flash('ok', "Booking #$id deleted.");
    } elseif ($act === 'inquiry_status') {
        $st = ($_POST['status'] ?? '') === 'handled' ? 'handled' : 'new';
        $pdo->prepare('UPDATE inquiries SET status = ? WHERE id = ?')->execute([$st, $id]);
        flash('ok', 'Inquiry marked ' . $st . '.');
    } elseif ($act === 'delete_inquiry') {
        $pdo->prepare('DELETE FROM inquiries WHERE id = ?')->execute([$id]);
        flash('ok', 'Inquiry deleted.');
    } elseif ($act === 'delete_student') {
        $pdo->prepare('DELETE FROM students WHERE id = ?')->execute([$id]);
        flash('ok', 'Student and their bookings deleted.');
    } elseif ($act === 'reset_pw') {
        $alpha = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        $tmp = ''; for ($i = 0; $i < 10; $i++) $tmp .= $alpha[random_int(0, strlen($alpha) - 1)];
        $s = $pdo->prepare('UPDATE students SET password_hash = ? WHERE id = ?');
        $s->execute([password_hash($tmp, PASSWORD_DEFAULT), $id]);
        if ($s->rowCount()) flash('ok', "Temporary password for this student: $tmp   (shown once. Send it to them and ask them to keep it safe.)");
    } elseif ($act === 'change_pw') {
        $cur = (string)($_POST['current'] ?? ''); $new = (string)($_POST['new'] ?? '');
        if (!password_verify($cur, $admin['password_hash'])) flash('bad', 'Current password is wrong.');
        elseif (strlen($new) < 10) flash('bad', 'New password must be at least 10 characters.');
        elseif ($new !== (string)($_POST['new2'] ?? '')) flash('bad', 'New passwords do not match.');
        else {
            $pdo->prepare('UPDATE admins SET password_hash = ? WHERE id = ?')->execute([password_hash($new, PASSWORD_DEFAULT), $admin['id']]);
            session_regenerate_id(true);
            flash('ok', 'Password changed.');
        }
    }
    header('Location: index.php?' . $back); exit;
}

// ---------- helpers ----------
function fdate($d) { return $d ? date('d M Y, H:i', strtotime($d)) : '—'; }
function like($q) { return '%' . str_replace(['\\', '%', '_'], ['\\\\', '\\%', '\\_'], $q) . '%'; }
$csrf = csrf_token();
$back = h(http_build_query(array_filter(['tab' => $tab, 'st' => $_GET['st'] ?? '', 'q' => $_GET['q'] ?? '', 'p' => $_GET['p'] ?? ''])));
function hidden($csrf, $back, $action, $id = 0) {
    return '<input type="hidden" name="csrf" value="' . h($csrf) . '"><input type="hidden" name="back" value="' . $back . '"><input type="hidden" name="action" value="' . h($action) . '">' . ($id ? '<input type="hidden" name="id" value="' . (int)$id . '">' : '');
}
$per = 25;
$page = max(1, (int)($_GET['p'] ?? 1));
$q = cl($_GET['q'] ?? '', 80);

a_head(ucfirst($tab), $admin, $tab);

// stats
$cnt = function ($sql) use ($pdo) { return (int)$pdo->query($sql)->fetchColumn(); };
$stats = [
    ['Students', $cnt('SELECT COUNT(*) FROM students')],
    ['Pending bookings', $cnt("SELECT COUNT(*) FROM bookings WHERE status='pending'")],
    ['Confirmed', $cnt("SELECT COUNT(*) FROM bookings WHERE status='confirmed'")],
    ['New inquiries', $cnt("SELECT COUNT(*) FROM inquiries WHERE status='new'")],
];
?>
<div class="a-stats"><?php foreach ($stats as $s): ?><div class="a-stat"><b><?= $s[1] ?></b><span><?= h($s[0]) ?></span></div><?php endforeach; ?></div>
<?php a_flash(); ?>

<?php if ($tab === 'bookings'):
    $st = $_GET['st'] ?? '';
    $where = []; $args = [];
    if (in_array($st, A_STATUSES, true)) { $where[] = 'b.status = ?'; $args[] = $st; }
    if ($q !== '') { $where[] = "(s.name LIKE ? ESCAPE '\\' OR s.phone LIKE ? ESCAPE '\\' OR s.email LIKE ? ESCAPE '\\' OR b.subjects LIKE ? ESCAPE '\\')"; for ($i = 0; $i < 4; $i++) $args[] = like($q); }
    $w = $where ? 'WHERE ' . implode(' AND ', $where) : '';
    $t = $pdo->prepare("SELECT COUNT(*) FROM bookings b JOIN students s ON s.id = b.student_id $w"); $t->execute($args); $total = (int)$t->fetchColumn();
    $r = $pdo->prepare("SELECT b.*, s.name sname, s.phone sphone, s.email semail FROM bookings b JOIN students s ON s.id = b.student_id $w ORDER BY b.id DESC LIMIT $per OFFSET " . (($page - 1) * $per));
    $r->execute($args); $rows = $r->fetchAll();
?>
<form class="a-filter" method="get"><input type="hidden" name="tab" value="bookings">
  <select name="st" aria-label="Status"><option value="">All statuses</option><?php foreach (A_STATUSES as $x): ?><option value="<?= $x ?>"<?= $st === $x ? ' selected' : '' ?>><?= ucfirst($x) ?></option><?php endforeach; ?></select>
  <input type="text" name="q" value="<?= h($q) ?>" placeholder="Search name, phone, email, subject" aria-label="Search">
  <button class="btn btn-primary btn-sm" type="submit">Filter</button>
  <a class="btn btn-ghost btn-sm" href="export.php?type=bookings">Export CSV</a>
</form>
<p class="muted"><?= $total ?> booking<?= $total === 1 ? '' : 's' ?></p>
<?php if (!$rows) echo '<div class="card"><p class="muted">No bookings yet.</p></div>'; ?>
<div class="a-list">
<?php foreach ($rows as $b): ?>
<article class="a-item">
  <div class="a-item-head">
    <div><h3><?= h($b['sname']) ?> <small class="muted">#<?= (int)$b['id'] ?></small></h3>
      <div class="a-contact"><a href="tel:<?= h($b['sphone']) ?>"><?= h($b['sphone']) ?></a> · <a href="<?= h(wa_link($b['sphone'])) ?>" target="_blank" rel="noopener">WhatsApp</a> · <a href="mailto:<?= h($b['semail']) ?>"><?= h($b['semail']) ?></a></div></div>
    <span class="a-pill s-<?= h($b['status']) ?>"><?= h(ucfirst($b['status'])) ?></span>
  </div>
  <div class="a-meta">
    <span><b><?= h(A_TYPES[$b['type']] ?? $b['type']) ?></b></span><span><?= h($b['level']) ?></span><span><?= h(A_MODES[$b['mode']] ?? $b['mode']) ?></span><span><?= h($b['preferred_time']) ?></span><span class="muted"><?= h(fdate($b['created_at'])) ?></span>
  </div>
  <p class="a-subj"><?= h($b['subjects']) ?></p>
  <?php if ($b['note'] !== ''): ?><p class="a-note"><b>Student note:</b> <?= nl2br(h($b['note'])) ?></p><?php endif; ?>
  <form class="a-edit" method="post"><?= hidden($csrf, $back, 'update_booking', $b['id']) ?>
    <select name="status" aria-label="Status"><?php foreach (A_STATUSES as $x): ?><option value="<?= $x ?>"<?= $b['status'] === $x ? ' selected' : '' ?>><?= ucfirst($x) ?></option><?php endforeach; ?></select>
    <input type="text" name="admin_note" value="<?= h($b['admin_note']) ?>" maxlength="500" placeholder="Private note (only you see this)" aria-label="Private note">
    <button class="btn btn-primary btn-sm" type="submit">Save</button>
  </form>
  <form method="post" onsubmit="return confirm('Delete this booking permanently?')" class="a-del"><?= hidden($csrf, $back, 'delete_booking', $b['id']) ?><button class="a-link" type="submit">Delete</button></form>
</article>
<?php endforeach; ?>
</div>
<?php
    $pages = (int)ceil($total / $per);
    if ($pages > 1): ?><nav class="a-pager"><?php for ($i = 1; $i <= $pages; $i++): ?><a<?= $i === $page ? ' aria-current="page"' : '' ?> href="?<?= h(http_build_query(['tab' => 'bookings', 'st' => $st, 'q' => $q, 'p' => $i])) ?>"><?= $i ?></a><?php endfor; ?></nav><?php endif; ?>

<?php elseif ($tab === 'students'):
    $args = []; $w = '';
    if ($q !== '') { $w = "WHERE (s.name LIKE ? ESCAPE '\\' OR s.phone LIKE ? ESCAPE '\\' OR s.email LIKE ? ESCAPE '\\')"; for ($i = 0; $i < 3; $i++) $args[] = like($q); }
    $t = $pdo->prepare("SELECT COUNT(*) FROM students s $w"); $t->execute($args); $total = (int)$t->fetchColumn();
    $r = $pdo->prepare("SELECT s.*, (SELECT COUNT(*) FROM bookings WHERE student_id = s.id) bc FROM students s $w ORDER BY s.id DESC LIMIT $per OFFSET " . (($page - 1) * $per));
    $r->execute($args); $rows = $r->fetchAll();
?>
<form class="a-filter" method="get"><input type="hidden" name="tab" value="students">
  <input type="text" name="q" value="<?= h($q) ?>" placeholder="Search name, phone, email" aria-label="Search">
  <button class="btn btn-primary btn-sm" type="submit">Search</button>
  <a class="btn btn-ghost btn-sm" href="export.php?type=students">Export CSV</a>
</form>
<p class="muted"><?= $total ?> registered student<?= $total === 1 ? '' : 's' ?></p>
<div class="table-wrap"><table>
<thead><tr><th>Student</th><th>Contact</th><th>Class</th><th>Bookings</th><th>Registered</th><th>Last login</th><th></th></tr></thead><tbody>
<?php if (!$rows) echo '<tr><td colspan="7" class="muted">No students yet.</td></tr>'; ?>
<?php foreach ($rows as $s): ?>
<tr><td><b><?= h($s['name']) ?></b></td>
<td><a href="tel:<?= h($s['phone']) ?>"><?= h($s['phone']) ?></a> · <a href="<?= h(wa_link($s['phone'])) ?>" target="_blank" rel="noopener">WA</a><br><a href="mailto:<?= h($s['email']) ?>"><?= h($s['email']) ?></a></td>
<td><?= h($s['level']) ?></td><td><?= (int)$s['bc'] ?></td><td><?= h(fdate($s['created_at'])) ?></td><td><?= h(fdate($s['last_login'])) ?></td>
<td class="a-acts">
  <form method="post" onsubmit="return confirm('Generate a new temporary password for this student?')"><?= hidden($csrf, $back, 'reset_pw', $s['id']) ?><button class="a-link" type="submit">Reset password</button></form>
  <form method="post" onsubmit="return confirm('Delete this student and ALL their bookings?')"><?= hidden($csrf, $back, 'delete_student', $s['id']) ?><button class="a-link bad" type="submit">Delete</button></form>
</td></tr>
<?php endforeach; ?>
</tbody></table></div>
<?php $pages = (int)ceil($total / $per); if ($pages > 1): ?><nav class="a-pager"><?php for ($i = 1; $i <= $pages; $i++): ?><a<?= $i === $page ? ' aria-current="page"' : '' ?> href="?<?= h(http_build_query(['tab' => 'students', 'q' => $q, 'p' => $i])) ?>"><?= $i ?></a><?php endfor; ?></nav><?php endif; ?>

<?php elseif ($tab === 'inquiries'):
    $total = $cnt('SELECT COUNT(*) FROM inquiries');
    $rows = $pdo->query("SELECT * FROM inquiries ORDER BY id DESC LIMIT $per OFFSET " . (($page - 1) * $per))->fetchAll();
?>
<div class="a-filter"><a class="btn btn-ghost btn-sm" href="export.php?type=inquiries">Export CSV</a></div>
<p class="muted">Requests sent from the public “Request a demo” form (no account needed). <?= $total ?> total.</p>
<?php if (!$rows) echo '<div class="card"><p class="muted">No inquiries yet.</p></div>'; ?>
<div class="a-list">
<?php foreach ($rows as $i): ?>
<article class="a-item">
  <div class="a-item-head"><div><h3><?= h($i['name']) ?> <small class="muted">#<?= (int)$i['id'] ?></small></h3>
    <div class="a-contact"><a href="tel:<?= h($i['phone']) ?>"><?= h($i['phone']) ?></a> · <a href="<?= h(wa_link($i['phone'])) ?>" target="_blank" rel="noopener">WhatsApp</a></div></div>
    <span class="a-pill s-<?= $i['status'] === 'new' ? 'pending' : 'completed' ?>"><?= h(ucfirst($i['status'])) ?></span></div>
  <div class="a-meta"><span><?= h($i['level']) ?></span><span><?= h($i['preferred_time']) ?></span><span class="muted"><?= h(fdate($i['created_at'])) ?></span></div>
  <p class="a-subj"><?= h($i['subjects'] ?: '—') ?></p>
  <?php if ($i['message'] !== ''): ?><p class="a-note"><?= nl2br(h($i['message'])) ?></p><?php endif; ?>
  <div class="a-acts">
    <form method="post"><?= hidden($csrf, $back, 'inquiry_status', $i['id']) ?><input type="hidden" name="status" value="<?= $i['status'] === 'new' ? 'handled' : 'new' ?>"><button class="a-link" type="submit"><?= $i['status'] === 'new' ? 'Mark handled' : 'Mark as new' ?></button></form>
    <form method="post" onsubmit="return confirm('Delete this inquiry?')"><?= hidden($csrf, $back, 'delete_inquiry', $i['id']) ?><button class="a-link bad" type="submit">Delete</button></form>
  </div>
</article>
<?php endforeach; ?>
</div>
<?php $pages = (int)ceil($total / $per); if ($pages > 1): ?><nav class="a-pager"><?php for ($n = 1; $n <= $pages; $n++): ?><a<?= $n === $page ? ' aria-current="page"' : '' ?> href="?<?= h(http_build_query(['tab' => 'inquiries', 'p' => $n])) ?>"><?= $n ?></a><?php endfor; ?></nav><?php endif; ?>

<?php else: ?>
<section class="a-narrow" style="margin:0"><div class="card">
<h2 class="h3">Change password</h2>
<form method="post" autocomplete="off"><?= hidden($csrf, $back, 'change_pw') ?>
  <label class="l" for="cur">Current password</label><input id="cur" name="current" type="password" required autocomplete="current-password">
  <label class="l" for="n1">New password (10+ characters)</label><input id="n1" name="new" type="password" required minlength="10" autocomplete="new-password">
  <label class="l" for="n2">Repeat new password</label><input id="n2" name="new2" type="password" required minlength="10" autocomplete="new-password">
  <div class="form-actions"><button class="btn btn-primary" type="submit">Update password</button></div>
</form>
<p class="muted" style="margin-top:1.4rem;font-size:.9rem">Back up your data any time with the <b>Export CSV</b> buttons, or by downloading <code>api/data/anka.sqlite</code> from your host.</p>
</div></section>
<?php endif; ?>
<?php a_foot();
