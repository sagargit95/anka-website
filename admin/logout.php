<?php
require __DIR__ . '/_auth.php';
$_SESSION = [];
session_regenerate_id(true);
header('Location: login.php');
