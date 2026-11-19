<?php
// Pragati Learn API — shared helpers (PHP 8, PDO/MySQL). Speaks a PocketBase-compatible subset so the front end is unchanged.
declare(strict_types=1);
header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');

function config_path(): string {
  $outside = dirname(__DIR__, 2) . '/pragati_config.php';   // one level above public_html
  if (file_exists($outside)) return $outside;
  return dirname(__DIR__) . '/config.php';                   // fallback inside public_html (protected by .htaccess)
}
function cfg(): array { static $c = null; if ($c === null) { $p = config_path(); $c = file_exists($p) ? (require $p) : []; } return $c; }

function db(): PDO {
  static $pdo = null; if ($pdo) return $pdo;
  $c = cfg(); if (!$c) fail(503, 'Not installed. Open /install.php');
  $dsn = 'mysql:host=' . ($c['db_host'] ?? '127.0.0.1') . ';port=' . ($c['db_port'] ?? 3306) . ';dbname=' . $c['db_name'] . ';charset=utf8mb4';
  $pdo = new PDO($dsn, $c['db_user'], $c['db_pass'], [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC, PDO::ATTR_EMULATE_PREPARES => false]);
  return $pdo;
}

function fail(int $code, string $msg, array $data = []): never { http_response_code($code); echo json_encode(['code' => $code, 'message' => $msg, 'data' => $data]); exit; }
function ok($data, int $code = 200): never { http_response_code($code); echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES); exit; }
function rid(): string { return substr(strtolower(preg_replace('/[^a-z0-9]/', '', base_convert(bin2hex(random_bytes(12)), 16, 36))), 0, 15); }
function now(): string { return gmdate('Y-m-d H:i:s') . '.000Z'; }
function body(): array {
  if (!empty($_POST) || !empty($_FILES)) return $_POST;
  $raw = file_get_contents('php://input'); if ($raw === '' || $raw === false) return [];
  $j = json_decode($raw, true); return is_array($j) ? $j : [];
}

/* ---------- schema ---------- */
const SCHEMA = [
  'users' => ['email' => 'text', 'password_hash' => 'secret', 'name' => 'text', 'role' => 'text', 'product' => 'text', 'class_level' => 'text', 'stream' => 'text', 'parent' => 'rel:users', 'phone' => 'text', 'cohort' => 'text', 'streak' => 'int', 'lang' => 'text', 'verified' => 'bool', 'emailVisibility' => 'bool'],
  'weeks' => ['number' => 'int', 'title' => 'text', 'summary' => 'text', 'unlock_date' => 'text', 'product' => 'text'],
  'lessons' => ['week' => 'rel:weeks', 'track' => 'text', 'order' => 'int', 'title' => 'text', 'minutes' => 'int', 'video_url' => 'text', 'body' => 'text', 'questions' => 'json', 'approved' => 'bool'],
  'practice_sets' => ['week' => 'rel:weeks', 'stream' => 'text', 'day' => 'int', 'title' => 'text', 'difficulty' => 'int', 'questions' => 'json', 'approved' => 'bool'],
  'attempts' => ['user' => 'rel:users', 'lesson' => 'rel:lessons', 'answers' => 'json', 'score' => 'int', 'total' => 'int'],
  'practice_attempts' => ['user' => 'rel:users', 'set' => 'rel:practice_sets', 'answers' => 'json', 'score' => 'int', 'total' => 'int'],
  'submissions' => ['user' => 'rel:users', 'week' => 'rel:weeks', 'link' => 'text', 'notes' => 'text', 'file' => 'file', 'status' => 'text', 'feedback' => 'text', 'score' => 'int'],
  'tutor_questions' => ['user' => 'rel:users', 'lesson' => 'rel:lessons', 'question' => 'text', 'answer' => 'text', 'status' => 'text'],
  'reports' => ['user' => 'rel:users', 'week' => 'rel:weeks', 'type' => 'text', 'body' => 'text', 'approved' => 'bool', 'sent' => 'bool'],
];
function col_type(string $col, string $f): ?string { return SCHEMA[$col][$f] ?? null; }
function q(string $ident): string { return '`' . str_replace('`', '', $ident) . '`'; }

function create_schema(PDO $pdo): void {
  foreach (SCHEMA as $col => $fields) {
    $defs = ['`id` VARCHAR(15) NOT NULL PRIMARY KEY', '`created` VARCHAR(30) NOT NULL', '`updated` VARCHAR(30) NOT NULL'];
    foreach ($fields as $f => $t) {
      $base = explode(':', $t)[0];
      $sql = match ($base) { 'int' => 'INT NULL', 'bool' => 'TINYINT(1) NOT NULL DEFAULT 0', 'json' => 'LONGTEXT NULL', 'text' => in_array($f, ['body', 'notes', 'answer', 'question', 'feedback', 'summary']) ? 'LONGTEXT NULL' : 'VARCHAR(500) NULL', 'secret' => 'VARCHAR(255) NULL', 'file' => 'VARCHAR(255) NULL', 'rel' => 'VARCHAR(15) NULL', default => 'TEXT NULL' };
      $defs[] = q($f) . ' ' . $sql;
    }
    $pdo->exec('CREATE TABLE IF NOT EXISTS ' . q($col) . ' (' . implode(', ', $defs) . ') ENGINE=InnoDB DEFAULT CHARSET=utf8mb4');
    foreach ($fields as $f => $t) { if (str_starts_with($t, 'rel:')) { try { $pdo->exec('CREATE INDEX ' . q('ix_' . $col . '_' . $f) . ' ON ' . q($col) . ' (' . q($f) . ')'); } catch (Throwable) {} } }
  }
  try { $pdo->exec('CREATE UNIQUE INDEX `ux_users_email` ON `users` (`email`)'); } catch (Throwable) {}
}

/* ---------- auth ---------- */
function sign(string $payload): string { return rtrim(strtr(base64_encode(hash_hmac('sha256', $payload, cfg()['secret'], true)), '+/', '-_'), '='); }
function make_token(string $uid): string { $p = rtrim(strtr(base64_encode(json_encode(['uid' => $uid, 'exp' => time() + 86400 * 14])), '+/', '-_'), '='); return $p . '.' . sign($p); }
function current_user(): ?array {
  $h = $_SERVER['HTTP_AUTHORIZATION'] ?? ($_SERVER['REDIRECT_HTTP_AUTHORIZATION'] ?? '');
  $h = preg_replace('/^Bearer\s+/i', '', trim($h)); if (!$h || !str_contains($h, '.')) return null;
  [$p, $s] = explode('.', $h, 2); if (!hash_equals(sign($p), $s)) return null;
  $j = json_decode(base64_decode(strtr($p, '-_', '+/')), true); if (!$j || ($j['exp'] ?? 0) < time()) return null;
  $st = db()->prepare('SELECT * FROM `users` WHERE id = ?'); $st->execute([$j['uid']]); $u = $st->fetch(); return $u ?: null;
}
function is_admin(?array $u): bool { return $u && ($u['role'] ?? '') === 'admin'; }

/* ---------- records ---------- */
function out(string $col, array $row): array {
  $r = ['id' => $row['id'], 'collectionId' => $col, 'collectionName' => $col, 'created' => $row['created'], 'updated' => $row['updated']];
  foreach (SCHEMA[$col] as $f => $t) {
    if ($t === 'secret') continue;
    $v = $row[$f] ?? null; $base = explode(':', $t)[0];
    $r[$f] = match ($base) { 'bool' => (bool)$v, 'int' => $v === null ? 0 : (int)$v, 'json' => $v === null ? null : json_decode($v, true), default => $v ?? '' };
  }
  return $r;
}
function fetch_one(string $col, string $id): ?array { $st = db()->prepare('SELECT * FROM ' . q($col) . ' WHERE id = ?'); $st->execute([$id]); $r = $st->fetch(); return $r ?: null; }

/* filter: `a = "x" && b = 1 && c != "y"`  (and/&& only, which is all the front end uses) */
function parse_filter(string $col, string $filter, array &$params): string {
  $filter = trim($filter); if ($filter === '') return '1';
  $parts = preg_split('/\s*&&\s*/', $filter); $sql = [];
  foreach ($parts as $p) {
    $p = trim($p, " ()");
    if (!preg_match('/^([a-zA-Z_]+)\s*(!=|>=|<=|=|>|<|~)\s*(.+)$/', $p, $m)) fail(400, 'Bad filter: ' . $p);
    [$_, $f, $op, $val] = $m;
    if ($f !== 'id' && !isset(SCHEMA[$col][$f])) fail(400, 'Unknown field: ' . $f);
    $val = trim($val);
    if (preg_match('/^"(.*)"$/s', $val, $vm) || preg_match("/^'(.*)'\$/s", $val, $vm)) $val = $vm[1];
    elseif ($val === 'true') $val = 1; elseif ($val === 'false') $val = 0; elseif ($val === 'null') $val = null;
    elseif (is_numeric($val)) $val = $val + 0;
    if ($op === '~') { $sql[] = q($f) . ' LIKE ?'; $params[] = '%' . $val . '%'; }
    elseif ($val === null) { $sql[] = q($f) . ($op === '!=' ? ' IS NOT NULL' : ' IS NULL'); }
    else { $sql[] = q($f) . ' ' . $op . ' ?'; $params[] = $val; }
  }
  return implode(' AND ', $sql);
}
function parse_sort(string $col, string $sort): string {
  if (trim($sort) === '') return '`created` ASC';
  $out = [];
  foreach (explode(',', $sort) as $s) { $s = trim($s); $dir = 'ASC'; if (str_starts_with($s, '-')) { $dir = 'DESC'; $s = substr($s, 1); } elseif (str_starts_with($s, '+')) $s = substr($s, 1);
    if ($s === 'id' || $s === 'created' || $s === 'updated' || isset(SCHEMA[$col][$s])) $out[] = q($s) . ' ' . $dir; }
  return $out ? implode(', ', $out) : '`created` ASC';
}
function expand(string $col, array &$items, string $expand): void {
  if (trim($expand) === '') return;
  foreach (explode(',', $expand) as $f) {
    $f = trim($f); $t = SCHEMA[$col][$f] ?? ''; if (!str_starts_with($t, 'rel:')) continue;
    $target = substr($t, 4); $ids = array_values(array_unique(array_filter(array_map(fn($i) => $i[$f] ?? '', $items)))); if (!$ids) continue;
    $in = implode(',', array_fill(0, count($ids), '?')); $st = db()->prepare('SELECT * FROM ' . q($target) . ' WHERE id IN (' . $in . ')'); $st->execute($ids);
    $map = []; foreach ($st->fetchAll() as $row) $map[$row['id']] = out($target, $row);
    foreach ($items as &$it) { if (!empty($it[$f]) && isset($map[$it[$f]])) $it['expand'][$f] = $map[$it[$f]]; } unset($it);
  }
}

/* ---------- access rules (mirror of the original PocketBase rules) ---------- */
function scope_sql(string $col, ?array $u, array &$params): string {
  if (is_admin($u)) return '1';
  if (!$u) return '0';
  $me = $u['id'];
  switch ($col) {
    case 'users': $params[] = $me; $params[] = $me; return '(`id` = ? OR `parent` = ?)';
    case 'weeks': return '1';
    case 'lessons': case 'practice_sets': return '`approved` = 1';
    case 'attempts': case 'practice_attempts': case 'submissions':
      $params[] = $me; $params[] = $me; return '(`user` = ? OR `user` IN (SELECT id FROM `users` WHERE `parent` = ?))';
    case 'tutor_questions': $params[] = $me; return '`user` = ?';
    case 'reports': $params[] = $me; $params[] = $me; return '(`approved` = 1 AND (`user` = ? OR `user` IN (SELECT id FROM `users` WHERE `parent` = ?)))';
  }
  return '0';
}
function can_create(string $col, ?array $u, array $data): bool {
  if (is_admin($u)) return true;
  switch ($col) {
    case 'users': return ($data['role'] ?? '') !== 'admin';
    case 'attempts': case 'practice_attempts': case 'submissions': case 'tutor_questions': return $u && ($data['user'] ?? '') === $u['id'];
  }
  return false;
}
function can_update(string $col, ?array $u, array $row, array $data): bool {
  if (is_admin($u)) return true; if (!$u) return false;
  switch ($col) {
    case 'users': return $row['id'] === $u['id'] && !isset($data['role']) && !isset($data['parent']);
    case 'attempts': case 'practice_attempts': case 'submissions': return ($row['user'] ?? '') === $u['id'];
  }
  return false;
}
