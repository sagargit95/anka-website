<?php
require __DIR__ . '/lib.php';
start_session('anka_s', '/', 14 * 86400);
$u = current_student();
json_out(['user' => $u ? student_public($u) : null, 'csrf' => csrf_token(), 'options' => [
    'levels' => A_LEVELS, 'subjects' => A_SUBJECTS, 'times' => A_TIMES, 'modes' => A_MODES, 'types' => A_TYPES]]);
