<?php
declare(strict_types=1);

require __DIR__ . '/../bootstrap.php';

session_destroy();
session_start();

cms_json(['ok' => true]);
