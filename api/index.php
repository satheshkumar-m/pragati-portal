<?php
// Pragati Learn API router. URLs mirror the PocketBase subset the front end uses.
declare(strict_types=1);
require __DIR__ . '/lib.php';

$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
$path = preg_replace('#^.*?/api/#', '', $path);
$seg = array_values(array_filter(explode('/', $path), fn($s) => $s !== ''));
$method = $_SERVER['REQUEST_METHOD'];

try {
  if (($seg[0] ?? '') === 'health') ok(['ok' => true, 'installed' => (bool)cfg()]);

  /* ---- files: /api/files/{col}/{id}/{filename} ---- */
  if (($seg[0] ?? '') === 'files') {
    [$_, $col, $id, $name] = $seg + [null, null, null, null];
    if (!isset(SCHEMA[$col])) fail(404, 'No such collection');
    $u = current_user(); $params = []; $scope = scope_sql($col, $u, $params);
    $st = db()->prepare('SELECT * FROM ' . q($col) . ' WHERE id = ? AND ' . $scope); $st->execute(array_merge([$id], $params)); $row = $st->fetch();
    if (!$row || ($row['file'] ?? '') !== $name) fail(404, 'File not found');
    $fp = dirname(__DIR__) . '/uploads/' . basename($name); if (!file_exists($fp)) fail(404, 'File missing');
    header_remove('Content-Type'); header('Content-Type: ' . (mime_content_type($fp) ?: 'application/octet-stream')); header('Content-Disposition: inline; filename="' . preg_replace('/^[a-z0-9]{15}_/', '', basename($name)) . '"'); readfile($fp); exit;
  }

  if (($seg[0] ?? '') !== 'collections' || !isset($seg[1])) fail(404, 'Not found');
  $col = $seg[1]; if (!isset(SCHEMA[$col])) fail(404, 'No such collection');
  $action = $seg[2] ?? '';

  /* ---- auth ---- */
  if ($col === 'users' && $action === 'auth-with-password' && $method === 'POST') {
    $b = body(); $st = db()->prepare('SELECT * FROM `users` WHERE email = ?'); $st->execute([strtolower(trim((string)($b['identity'] ?? '')))]); $u = $st->fetch();
    if (!$u || !password_verify((string)($b['password'] ?? ''), (string)$u['password_hash'])) fail(400, 'Failed to authenticate.');
    ok(['token' => make_token($u['id']), 'record' => out('users', $u)]);
  }
  if ($col === 'users' && $action === 'auth-refresh' && $method === 'POST') {
    $u = current_user(); if (!$u) fail(401, 'The request requires valid record authorization token.');
    ok(['token' => make_token($u['id']), 'record' => out('users', $u)]);
  }
  if ($action !== 'records') fail(404, 'Not found');
  $id = $seg[3] ?? null;
  $u = current_user();

  /* ---- list ---- */
  if ($method === 'GET' && !$id) {
    $params = []; $where = parse_filter($col, (string)($_GET['filter'] ?? ''), $params);
    $scope = scope_sql($col, $u, $params);
    $page = max(1, (int)($_GET['page'] ?? 1)); $per = min(500, max(1, (int)($_GET['perPage'] ?? 30)));
    $sql = 'FROM ' . q($col) . ' WHERE (' . $where . ') AND ' . $scope;
    $cnt = db()->prepare('SELECT COUNT(*) ' . $sql); $cnt->execute($params); $total = (int)$cnt->fetchColumn();
    $st = db()->prepare('SELECT * ' . $sql . ' ORDER BY ' . parse_sort($col, (string)($_GET['sort'] ?? '')) . ' LIMIT ' . $per . ' OFFSET ' . (($page - 1) * $per)); $st->execute($params);
    $items = array_map(fn($r) => out($col, $r), $st->fetchAll());
    expand($col, $items, (string)($_GET['expand'] ?? ''));
    ok(['page' => $page, 'perPage' => $per, 'totalItems' => $total, 'totalPages' => (int)ceil($total / $per), 'items' => $items]);
  }
  /* ---- view ---- */
  if ($method === 'GET' && $id) {
    $params = []; $scope = scope_sql($col, $u, $params);
    $st = db()->prepare('SELECT * FROM ' . q($col) . ' WHERE id = ? AND ' . $scope); $st->execute(array_merge([$id], $params)); $row = $st->fetch();
    if (!$row) fail(404, "The requested resource wasn't found.");
    $items = [out($col, $row)]; expand($col, $items, (string)($_GET['expand'] ?? '')); ok($items[0]);
  }
  /* ---- create ---- */
  if ($method === 'POST' && !$id) {
    $b = body(); if (!can_create($col, $u, $b)) fail(403, 'You are not allowed to perform this request.');
    $row = ['id' => rid(), 'created' => now(), 'updated' => now()];
    foreach (SCHEMA[$col] as $f => $t) {
      $base = explode(':', $t)[0];
      if ($f === 'password_hash') continue;
      if ($base === 'file') { if (!empty($_FILES[$f]['tmp_name']) && is_uploaded_file($_FILES[$f]['tmp_name'])) { if ($_FILES[$f]['size'] > 10 * 1024 * 1024) fail(400, 'File too large (10 MB max)'); $safe = preg_replace('/[^A-Za-z0-9._-]/', '_', basename($_FILES[$f]['name'])); $name = $row['id'] . '_' . $safe; if (!is_dir(dirname(__DIR__) . '/uploads')) mkdir(dirname(__DIR__) . '/uploads', 0755, true); move_uploaded_file($_FILES[$f]['tmp_name'], dirname(__DIR__) . '/uploads/' . $name); $row[$f] = $name; } continue; }
      if (!array_key_exists($f, $b)) continue;
      $v = $b[$f];
      $row[$f] = match ($base) { 'bool' => (int)(filter_var($v, FILTER_VALIDATE_BOOLEAN)), 'int' => $v === null || $v === '' ? null : (int)$v, 'json' => is_string($v) ? $v : json_encode($v, JSON_UNESCAPED_UNICODE), default => $v === null ? null : (string)$v };
    }
    if ($col === 'users') {
      $row['email'] = strtolower(trim((string)($b['email'] ?? ''))); if (!filter_var($row['email'], FILTER_VALIDATE_EMAIL)) fail(400, 'Valid email required');
      $pw = (string)($b['password'] ?? ''); if (strlen($pw) < 8) fail(400, 'Password must be at least 8 characters');
      $row['password_hash'] = password_hash($pw, PASSWORD_DEFAULT);
      if (!isset($row['role'])) $row['role'] = 'student';
    }
    $cols = array_keys($row); $st = db()->prepare('INSERT INTO ' . q($col) . ' (' . implode(',', array_map('q', $cols)) . ') VALUES (' . implode(',', array_fill(0, count($cols), '?')) . ')');
    try { $st->execute(array_values($row)); } catch (PDOException $e) { if (str_contains($e->getMessage(), 'Duplicate')) fail(400, 'That email is already registered'); throw $e; }
    ok(out($col, fetch_one($col, $row['id'])), 200);
  }
  /* ---- update ---- */
  if (($method === 'PATCH' || $method === 'POST') && $id) {
    $b = body(); $row = fetch_one($col, $id); if (!$row) fail(404, 'Not found');
    if (!can_update($col, $u, $row, $b)) fail(403, 'You are not allowed to perform this request.');
    $upd = ['updated' => now()];
    foreach (SCHEMA[$col] as $f => $t) {
      if (!array_key_exists($f, $b) || $f === 'password_hash') continue; $base = explode(':', $t)[0]; $v = $b[$f];
      $upd[$f] = match ($base) { 'bool' => (int)(filter_var($v, FILTER_VALIDATE_BOOLEAN)), 'int' => $v === null || $v === '' ? null : (int)$v, 'json' => is_string($v) ? $v : json_encode($v, JSON_UNESCAPED_UNICODE), 'file' => $row[$f], default => $v === null ? null : (string)$v };
    }
    if ($col === 'users' && !empty($b['password'])) { if (strlen((string)$b['password']) < 8) fail(400, 'Password must be at least 8 characters'); $upd['password_hash'] = password_hash((string)$b['password'], PASSWORD_DEFAULT); }
    $sets = implode(', ', array_map(fn($k) => q($k) . ' = ?', array_keys($upd)));
    $st = db()->prepare('UPDATE ' . q($col) . ' SET ' . $sets . ' WHERE id = ?'); $st->execute(array_merge(array_values($upd), [$id]));
    ok(out($col, fetch_one($col, $id)));
  }
  /* ---- delete ---- */
  if ($method === 'DELETE' && $id) {
    if (!is_admin($u)) fail(403, 'Admins only');
    $st = db()->prepare('DELETE FROM ' . q($col) . ' WHERE id = ?'); $st->execute([$id]); http_response_code(204); exit;
  }
  fail(404, 'Not found');
} catch (PDOException $e) {
  fail(500, 'Database error', ['detail' => substr($e->getMessage(), 0, 200)]);
}
