<?php
// One-time installer for Pragati Learn on shared hosting (PHP + MySQL).
// Writes the config file outside public_html when possible, creates tables, admin + test accounts, and seeds week-1 content.
declare(strict_types=1);
require __DIR__ . '/api/lib.php';
header('Content-Type: text/html; charset=utf-8');
$installed = (bool)cfg();
$msg = []; $err = '';

function h($s) { return htmlspecialchars((string)$s, ENT_QUOTES); }
function seed(PDO $pdo, array &$msg): void {
  $content = json_decode(file_get_contents(__DIR__ . '/content/week1.json'), true);
  $weekIds = [];
  foreach ($content['weeks'] as $w) {
    $st = $pdo->prepare('SELECT id FROM weeks WHERE number = ?'); $st->execute([$w['number']]); $id = $st->fetchColumn();
    if (!$id) { $id = rid(); $pdo->prepare('INSERT INTO weeks (id,created,updated,number,title,summary,unlock_date,product) VALUES (?,?,?,?,?,?,?,?)')->execute([$id, now(), now(), $w['number'], $w['title'], $w['summary'], $w['unlock_date'], 'teens']); $msg[] = "week {$w['number']} created"; }
    else { $pdo->prepare('UPDATE weeks SET title=?, summary=?, unlock_date=?, updated=? WHERE id=?')->execute([$w['title'], $w['summary'], $w['unlock_date'], now(), $id]); }
    $weekIds[$w['number']] = $id;
  }
  foreach ($content['lessons'] as $l) {
    $st = $pdo->prepare('SELECT id FROM lessons WHERE week = ? AND track = ? AND `order` = ?'); $st->execute([$weekIds[$l['week']], $l['track'], $l['order']]); $id = $st->fetchColumn();
    $q = json_encode($l['questions'] ?? [], JSON_UNESCAPED_UNICODE);
    if (!$id) { $pdo->prepare('INSERT INTO lessons (id,created,updated,week,track,`order`,title,minutes,video_url,body,questions,approved) VALUES (?,?,?,?,?,?,?,?,?,?,?,1)')->execute([rid(), now(), now(), $weekIds[$l['week']], $l['track'], $l['order'], $l['title'], $l['minutes'] ?? 20, $l['video_url'] ?? '', $l['body'], $q]); $msg[] = "lesson \"{$l['title']}\" created"; }
    else { $pdo->prepare('UPDATE lessons SET title=?, minutes=?, video_url=?, body=?, questions=?, updated=? WHERE id=?')->execute([$l['title'], $l['minutes'] ?? 20, $l['video_url'] ?? '', $l['body'], $q, now(), $id]); $msg[] = "lesson \"{$l['title']}\" updated"; }
  }
  foreach ($content['practice_sets'] as $p) {
    $st = $pdo->prepare('SELECT id FROM practice_sets WHERE week = ? AND stream = ? AND day = ?'); $st->execute([$weekIds[$p['week']], $p['stream'], $p['day']]); $id = $st->fetchColumn();
    $q = json_encode($p['questions'], JSON_UNESCAPED_UNICODE);
    if (!$id) { $pdo->prepare('INSERT INTO practice_sets (id,created,updated,week,stream,day,title,difficulty,questions,approved) VALUES (?,?,?,?,?,?,?,?,?,1)')->execute([rid(), now(), now(), $weekIds[$p['week']], $p['stream'], $p['day'], $p['title'], $p['difficulty'] ?? 1, $q]); $msg[] = "practice set \"{$p['title']}\" created"; }
    else { $pdo->prepare('UPDATE practice_sets SET title=?, difficulty=?, questions=?, updated=? WHERE id=?')->execute([$p['title'], $p['difficulty'] ?? 1, $q, now(), $id]); }
  }
}
function ensure_user(PDO $pdo, array $d, array &$msg): string {
  $st = $pdo->prepare('SELECT id FROM users WHERE email = ?'); $st->execute([strtolower($d['email'])]); $id = $st->fetchColumn();
  if ($id) { $msg[] = "user {$d['email']} exists, kept"; return $id; }
  $id = rid();
  $pdo->prepare('INSERT INTO users (id,created,updated,email,password_hash,name,role,product,class_level,stream,parent,phone,cohort,streak,lang,verified,emailVisibility) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,1,1)')
      ->execute([$id, now(), now(), strtolower($d['email']), password_hash($d['password'], PASSWORD_DEFAULT), $d['name'], $d['role'], 'teens', $d['class_level'] ?? null, $d['stream'] ?? null, $d['parent'] ?? null, $d['phone'] ?? null, $d['cohort'] ?? null, 0, 'en']);
  $msg[] = "user {$d['email']} ({$d['role']}) created"; return $id;
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
  try {
    if (!$installed) {
      $c = ['db_host' => '127.0.0.1', 'db_port' => 3306, 'db_name' => trim($_POST['db_name']), 'db_user' => trim($_POST['db_user']), 'db_pass' => $_POST['db_pass'], 'secret' => bin2hex(random_bytes(32))];
      $pdo = new PDO('mysql:host=127.0.0.1;dbname=' . $c['db_name'] . ';charset=utf8mb4', $c['db_user'], $c['db_pass'], [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
      $code = "<?php\n// Pragati Learn config. Keep out of the repository.\nreturn " . var_export($c, true) . ";\n";
      $outside = dirname(__DIR__) . '/pragati_config.php';
      $target = (@file_put_contents($outside, $code) !== false) ? $outside : __DIR__ . '/config.php';
      if ($target !== $outside && file_put_contents($target, $code) === false) throw new RuntimeException('Could not write config file');
      $msg[] = 'config written to ' . ($target === $outside ? 'outside public_html' : 'public_html/config.php (protected)');
      create_schema($pdo); $msg[] = 'tables ready';
      if (strlen($_POST['admin_pass']) < 8) throw new RuntimeException('Admin password: 8 characters minimum');
      ensure_user($pdo, ['email' => $_POST['admin_email'], 'password' => $_POST['admin_pass'], 'name' => 'Admin', 'role' => 'admin'], $msg);
      $pid = ensure_user($pdo, ['email' => $_POST['parent_email'], 'password' => $_POST['test_pass'], 'name' => 'Test Parent', 'role' => 'parent'], $msg);
      ensure_user($pdo, ['email' => $_POST['student_email'], 'password' => $_POST['test_pass'], 'name' => 'Test Student', 'role' => 'student', 'class_level' => '10', 'stream' => 'undecided', 'parent' => $pid, 'cohort' => 'alpha'], $msg);
      seed($pdo, $msg);
      $installed = true; $msg[] = 'DONE. Open app.html and sign in.';
    } else {
      // already installed: re-seed content, authenticated as admin
      $st = db()->prepare('SELECT * FROM users WHERE email = ? AND role = "admin"'); $st->execute([strtolower(trim($_POST['admin_email']))]); $u = $st->fetch();
      if (!$u || !password_verify($_POST['admin_pass'], $u['password_hash'])) throw new RuntimeException('Admin login failed');
      create_schema(db()); seed(db(), $msg); $msg[] = 'Content re-synced.';
    }
  } catch (Throwable $e) { $err = $e->getMessage(); }
}
?>
<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Pragati Learn — install</title><link rel="stylesheet" href="css/style.css"></head>
<body><div class="topbar"><div class="wrap"><a class="brand" href="index.html">Pragati Learn <small>install</small></a></div></div>
<div class="wrap"><div class="card">
<?php if (!$installed): ?>
  <h1>Install</h1>
  <p class="muted">Creates the database tables, your admin login, a test student and parent, and week-1 content. Runs once.</p>
  <form method="post">
    <div class="grid2">
      <div><label>Database name</label><input name="db_name" value="u978839952_pragati" required></div>
      <div><label>Database user</label><input name="db_user" value="u978839952_pragati" required></div>
      <div><label>Database password</label><input name="db_pass" type="password" required></div>
      <div></div>
      <div><label>Admin email (you)</label><input name="admin_email" value="admin@pragatilearn.in" required></div>
      <div><label>Admin password (8+)</label><input name="admin_pass" type="password" required></div>
      <div><label>Test student email</label><input name="student_email" value="student@test.pragatilearn.in"></div>
      <div><label>Test parent email</label><input name="parent_email" value="parent@test.pragatilearn.in"></div>
      <div><label>Password for both test accounts</label><input name="test_pass" value="Test1234!"></div>
    </div>
    <p style="margin-top:14px"><button class="primary">Run install</button></p>
  </form>
<?php else: ?>
  <h1>Installed</h1>
  <p class="muted">The portal is set up. To re-sync lesson content from the repo or add new fields, sign in as admin below.</p>
  <form method="post"><div class="grid2"><div><label>Admin email</label><input name="admin_email" required></div><div><label>Admin password</label><input name="admin_pass" type="password" required></div></div><p style="margin-top:14px"><button class="primary">Re-sync content</button></p></form>
<?php endif; ?>
<?php if ($err): ?><p style="color:var(--coral);font-weight:600;margin-top:12px">Error: <?= h($err) ?></p><?php endif; ?>
<?php if ($msg): ?><div id="log" style="margin-top:12px"><?php foreach ($msg as $m): ?><div class="logline ok"><?= h($m) ?></div><?php endforeach; ?></div><?php endif; ?>
</div></div></body></html>
