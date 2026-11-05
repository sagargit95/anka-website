<?php
require __DIR__ . '/lib.php';
start_session('anka_s', '/', 14 * 86400);
require_post_csrf();
$_SESSION = [];
session_regenerate_id(true);
json_out(['ok' => true, 'csrf' => csrf_token()]);
