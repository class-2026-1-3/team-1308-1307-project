const express = require("express");
const mysql = require("mysql2");
const path = require("path");
const fs = require("fs");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const http = require("http");
const { Server } = require("socket.io");
const multer = require("multer");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});
const port = 3000;
const JWT_SECRET = process.env.JWT_SECRET || "teamP-community-secret-key-2026";
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || "admin";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";

app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "../src")));

const uploadDir = path.join(__dirname, "..", "uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, Date.now() + "-" + Math.random().toString(36).slice(2) + ext);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = [".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg"];
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, allowed.includes(ext));
  }
});

app.post("/api/upload", authenticate, requireAuth, (req, res) => {
  upload.single("image")(req, res, (err) => {
    if (err) return res.status(400).json({ error: "업로드 오류: " + err.message });
    if (!req.file) return res.status(400).json({ error: "파일을 선택하세요" });
    res.json({ url: "/uploads/" + req.file.filename });
  });
});

app.use("/uploads", express.static(uploadDir));

const db = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "13071308",
  database: process.env.DB_NAME || "study",
  port: process.env.DB_PORT || 3306,
  waitForConnections: true,
  connectionLimit: 10,
});

db.getConnection((err, conn) => {
  if (err) {
    console.error("DB 연결 실패:", err.message);
  } else {
    console.log("MySQL 연결 성공!");
    conn.release();
    runMigration();
    seedAdmin();
    seedCategories();
    setTimeout(seedNotices, 500);
  }
});

function runMigration() {
  const dbName = process.env.DB_NAME || "study";
  const migrations = [
    "CREATE TABLE IF NOT EXISTS categories (id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(50) NOT NULL, slug VARCHAR(50) NOT NULL UNIQUE)",
    "CREATE TABLE IF NOT EXISTS post_likes (id INT AUTO_INCREMENT PRIMARY KEY, post_id INT NOT NULL, user_id INT NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, UNIQUE KEY unique_like (post_id, user_id), FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE, FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE)",
    "CREATE TABLE IF NOT EXISTS follows (id INT AUTO_INCREMENT PRIMARY KEY, follower_id INT NOT NULL, following_id INT NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, UNIQUE KEY unique_follow (follower_id, following_id), FOREIGN KEY (follower_id) REFERENCES users(id) ON DELETE CASCADE, FOREIGN KEY (following_id) REFERENCES users(id) ON DELETE CASCADE)",
    "CREATE TABLE IF NOT EXISTS chat_rooms (id INT AUTO_INCREMENT PRIMARY KEY, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)",
    "CREATE TABLE IF NOT EXISTS chat_room_members (id INT AUTO_INCREMENT PRIMARY KEY, room_id INT NOT NULL, user_id INT NOT NULL, UNIQUE KEY unique_member (room_id, user_id), FOREIGN KEY (room_id) REFERENCES chat_rooms(id) ON DELETE CASCADE, FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE)",
    "CREATE TABLE IF NOT EXISTS chat_messages (id INT AUTO_INCREMENT PRIMARY KEY, room_id INT NOT NULL, user_id INT NOT NULL, content TEXT NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (room_id) REFERENCES chat_rooms(id) ON DELETE CASCADE, FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE)",
    "CREATE TABLE IF NOT EXISTS notifications (id INT AUTO_INCREMENT PRIMARY KEY, user_id INT NOT NULL, type VARCHAR(20) NOT NULL, message TEXT NOT NULL, related_user_id INT DEFAULT NULL, related_post_id INT DEFAULT NULL, related_comment_id INT DEFAULT NULL, related_room_id INT DEFAULT NULL, is_read TINYINT(1) DEFAULT 0, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE, INDEX idx_notifications_user (user_id, is_read))",
    { table: "posts", col: "category_id", def: "INT DEFAULT NULL", fk: "FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL" },
    { table: "posts", col: "views", def: "INT DEFAULT 0" },
    { table: "posts", col: "is_pinned", def: "TINYINT(1) DEFAULT 0" },
  ];
  function run(i) {
    if (i >= migrations.length) return;
    const m = migrations[i];
    if (typeof m === "string") {
      db.query(m, (err) => {
        if (err) console.error(`마이그레이션 실패:`, err.message);
        run(i + 1);
      });
    } else {
      db.query(
        `SELECT COUNT(*) AS cnt FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
        [dbName, m.table, m.col],
        (err, result) => {
          if (err) { console.error(`확인 실패 (${m.table}.${m.col}):`, err.message); return run(i + 1); }
          if (result[0].cnt === 0) {
            let sql = `ALTER TABLE ${m.table} ADD COLUMN ${m.col} ${m.def}`;
            if (m.fk) sql += `, ADD ${m.fk}`;
            db.query(sql, (err) => {
              if (err) console.error(`마이그레이션 실패 (${m.table}.${m.col}):`, err.message);
              else console.log(`마이그레이션 완료: ${m.table}.${m.col}`);
              run(i + 1);
            });
          } else {
            run(i + 1);
          }
        }
      );
    }
  }
  run(0);
}

function seedAdmin() {
  db.query("SELECT id FROM users WHERE username = ?", [ADMIN_USERNAME], (err, users) => {
    if (err || users.length > 0) return;
    bcrypt.hash(ADMIN_PASSWORD, 10, (err, hash) => {
      if (err) return;
      db.query("INSERT INTO users (username, password_hash) VALUES (?, ?)", [ADMIN_USERNAME, hash], (err) => {
        if (!err) console.log(`admin 계정 생성 완료 (username: ${ADMIN_USERNAME})`);
      });
    });
  });
}

function seedCategories() {
  const cats = [
    [1, "자유", "free"],
    [2, "질문", "question"],
    [3, "정보", "info"],
    [4, "잡담", "chat"],
  ];
  cats.forEach(([id, name, slug]) => {
    db.query("INSERT IGNORE INTO categories (id, name, slug) VALUES (?, ?, ?)", [id, name, slug]);
  });
}

function seedNotices() {
  db.query("SELECT id FROM users WHERE username = ?", [ADMIN_USERNAME], (err, users) => {
    if (err || users.length === 0) return setTimeout(seedNotices, 1000);
    const adminId = users[0].id;
    const notices = [
      { category_id: 1, slug: "free", title: "커뮤니티 이용 안내",
        content: "## 환영합니다! 👋\n\n**자유 게시판**은 커뮤니티 회원이라면 누구나 자유롭게 이야기를 나눌 수 있는 공간입니다.\n\n### 📋 기본 규칙\n\n1. **존중과 예의** – 모든 회원을 존중하고 배려해주세요.\n2. **욕설/비방 금지** – 타인에 대한 모욕적 표현은 삼가주세요.\n3. **도배 금지** – 동일한 내용의 반복 게시를 자제해주세요.\n4. **홍보/광고 금지** – 무단 홍보 글은 삭제될 수 있습니다.\n\n---\n\n> 함께 만들어가는 커뮤니티입니다. 건전한 토론과 즐거운 대화 부탁드립니다 😊" },
      { category_id: 2, slug: "question", title: "질문 게시판 이용 가이드",
        content: "## 🙋 질문하기 전에 확인하세요!\n\n**질문 게시판**은 궁금한 점을 자유롭게 질문하고 답변을 받는 공간입니다.\n\n### 💡 좋은 질문하는 법\n\n1. **검색 먼저** – 이미 같은 질문이 있는지 검색해보세요.\n2. **구체적으로** – 상황, 시도한 방법, 에러 메시지를 상세히 적어주세요.\n3. **제목을 명확하게** – `도와주세요`보다 `Node.js MySQL 연결 오류`가 좋습니다.\n4. **해결 후 공유** – 문제를 해결했다면 답변을 남겨주세요!\n\n### ✅ 예시\n\n```\n질문: Express 서버에서 CORS 에러가 발생합니다.\n\n상황: React 앱에서 localhost:3001 Express 서버로 요청 시\n에러 메시지: Access-Control-Allow-Origin\n\n시도: cors() 미들웨어를 추가했지만 여전히 에러가 납니다.\n```" },
      { category_id: 3, slug: "info", title: "정보 게시판 이용 안내",
        content: "## 📢 유용한 정보를 공유해주세요!\n\n**정보 게시판**은 개발 팁, 기술 뉴스, 유틸리티 소개 등 유익한 정보를 공유하는 공간입니다.\n\n### 📝 정보 공유 가이드\n\n1. **출처 표기** – 인용이나 참고 자료는 반드시 출처를 남겨주세요.\n2. **검증된 정보** – 사실 여부가 확인된 정보를 공유해주세요.\n3. **카테고리 활용** – 관련 카테고리를 선택해주세요.\n4. **링크 삽입** – 참고 링크가 있다면 함께 첨부해주세요.\n\n> 예: `[MDN Web Docs](https://developer.mozilla.org/ko/)` → [MDN Web Docs](https://developer.mozilla.org/ko/)\n\n### 🖼 이미지 첨부\n\n마크다운 문법으로 이미지를 삽입할 수 있습니다:\n\n```markdown\n![설명](이미지_URL)\n```" },
      { category_id: 4, slug: "chat", title: "잡담 게시판 이용 안내",
        content: "## 🗣 자유롭게 이야기 나눠요!\n\n**잡담 게시판**은 일상, 취미, 가벼운 이야기를 자유롭게 나누는 공간입니다.\n\n### 🎯 이런 이야기 좋아요!\n\n- 일상 생활 이야기\n- 개발자 밈 & 유머 😄\n- IT 업계 잡담\n- 음악, 영화, 게임 등 취미 이야기\n- 사는 이야기\n\n### ⚠️ 주의사항\n\n- 정치/종교 등 민감한 주제는 자제해주세요.\n- 타인에게 불쾌감을 줄 수 있는 내용은 삼가주세요.\n- 과도한 친목/구인 활동은 지양해주세요.\n\n---\n\n**편하게 이야기 나누며 쉬어가는 공간입니다!** ☕" },
    ];
    notices.forEach(n => {
      db.query("SELECT id FROM posts WHERE title = ? AND user_id = ?", [n.title, adminId], (err, posts) => {
        if (err || posts.length > 0) return;
        db.query("INSERT INTO posts (user_id, title, content, category_id, is_pinned) VALUES (?, ?, ?, ?, 1)",
          [adminId, n.title, n.content, n.category_id], (err) => {
            if (!err) console.log(`공지 등록 완료: ${n.title}`);
          });
      });
    });
  });
}

function isAdminUser(username) {
  return username === ADMIN_USERNAME;
}

function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith("Bearer ")) {
    req.user = null;
    return next();
  }
  try {
    req.user = jwt.verify(header.slice(7), JWT_SECRET);
  } catch {
    req.user = null;
  }
  next();
}

function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: "로그인이 필요합니다" });
  next();
}

function canModifyPost(post, user) {
  if (user && isAdminUser(user.username)) return true;
  if (user && post.user_id === user.id) return true;
  return false;
}

function canModifyComment(comment, user) {
  if (user && isAdminUser(user.username)) return true;
  if (user && comment.user_id === user.id) return true;
  return false;
}

app.post("/api/auth/signup", (req, res) => {
  const { username, password } = req.body;
  if (!username || !username.trim())
    return res.status(400).json({ error: "닉네임을 입력하세요" });
  if (!password || password.length < 4)
    return res.status(400).json({ error: "비밀번호는 4자 이상 입력하세요" });

  const name = username.trim();
  db.query("SELECT id, password_hash FROM users WHERE username = ?", [name], (err, users) => {
    if (err) return res.status(500).json({ error: err.message });
    if (users.length > 0 && users[0].password_hash)
      return res.status(409).json({ error: "이미 가입된 닉네임입니다" });

    bcrypt.hash(password, 10, (err, hash) => {
      if (err) return res.status(500).json({ error: err.message });
      const finish = (userId) => {
        const isAdmin = isAdminUser(name);
        const token = jwt.sign({ id: userId, username: name, isAdmin }, JWT_SECRET, { expiresIn: "7d" });
        res.status(201).json({ token, user: { id: userId, username: name, isAdmin } });
      };
      if (users.length > 0) {
        db.query("UPDATE users SET password_hash = ? WHERE id = ?", [hash, users[0].id], (err) => {
          if (err) return res.status(500).json({ error: err.message });
          finish(users[0].id);
        });
      } else {
        db.query("INSERT INTO users (username, password_hash) VALUES (?, ?)", [name, hash], (err, result) => {
          if (err) return res.status(500).json({ error: err.message });
          finish(result.insertId);
        });
      }
    });
  });
});

app.post("/api/auth/login", (req, res) => {
  const { username, password } = req.body;
  if (!username || !username.trim())
    return res.status(400).json({ error: "닉네임을 입력하세요" });
  if (!password)
    return res.status(400).json({ error: "비밀번호를 입력하세요" });

  db.query(
    "SELECT id, username, password_hash FROM users WHERE username = ?",
    [username.trim()],
    (err, users) => {
      if (err) return res.status(500).json({ error: err.message });
      if (users.length === 0)
        return res.status(401).json({ error: "닉네임 또는 비밀번호가 일치하지 않습니다" });
      const user = users[0];
      if (!user.password_hash)
        return res.status(401).json({ error: "비밀번호가 설정되지 않은 계정입니다. 회원가입을 진행해주세요" });
      bcrypt.compare(password, user.password_hash, (err, match) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!match)
          return res.status(401).json({ error: "닉네임 또는 비밀번호가 일치하지 않습니다" });
        const isAdmin = isAdminUser(user.username);
        const token = jwt.sign({ id: user.id, username: user.username, isAdmin }, JWT_SECRET, { expiresIn: "7d" });
        res.json({ token, user: { id: user.id, username: user.username, isAdmin } });
      });
    }
  );
});

app.get("/api/auth/me", authenticate, (req, res) => {
  res.json({ user: req.user || null });
});

app.get("/api/categories", (req, res) => {
  db.query("SELECT id, name, slug FROM categories ORDER BY id ASC", (err, cats) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(cats);
  });
});

app.get("/api/posts", (req, res) => {
  const search = req.query.search || "";
  const category = req.query.category || "";
  const sort = req.query.sort || "latest";
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 10));
  const offset = (page - 1) * limit;

  const where = [];
  const params = [];

  if (search) {
    where.push("p.title LIKE ?");
    params.push(`%${search}%`);
  }
  if (category) {
    where.push("c.slug = ?");
    params.push(category);
  }

  const whereClause = where.length > 0 ? "WHERE " + where.join(" AND ") : "";

  let orderClause;
  if (sort === "popular") {
    orderClause = "ORDER BY p.is_pinned DESC, like_count DESC, p.created_at DESC";
  } else {
    orderClause = "ORDER BY p.is_pinned DESC, p.created_at DESC";
  }

  const countSql = `
    SELECT COUNT(*) AS total FROM posts p
    LEFT JOIN categories c ON p.category_id = c.id
    ${whereClause}
  `;
  const dataSql = `
    SELECT p.id, p.title, p.created_at, p.views, p.is_pinned,
      u.username,
      c.name AS category_name, c.slug AS category_slug,
      (SELECT COUNT(*) FROM comments co WHERE co.post_id = p.id) AS comment_count,
      (SELECT COUNT(*) FROM post_likes pl WHERE pl.post_id = p.id) AS like_count,
      CASE WHEN u.password_hash IS NOT NULL THEN 1 ELSE 0 END AS is_member,
      CASE WHEN p.password_hash IS NOT NULL THEN 1 ELSE 0 END AS has_password
    FROM posts p
    LEFT JOIN users u ON p.user_id = u.id
    LEFT JOIN categories c ON p.category_id = c.id
    ${whereClause}
    ${orderClause}
    LIMIT ? OFFSET ?
  `;

  db.query(countSql, params, (err, countResult) => {
    if (err) return res.status(500).json({ error: err.message });
    const total = countResult[0].total;
    db.query(dataSql, [...params, limit, offset], (err, posts) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ posts, total, page, totalPages: Math.ceil(total / limit) || 1 });
    });
  });
});

app.get("/api/posts/:id", authenticate, (req, res) => {
  db.query(
    `UPDATE posts SET views = views + 1 WHERE id = ?`,
    [req.params.id],
    (err) => {
      if (err) console.error("조회수 증가 실패:", err.message);
    }
  );

  const postSql = `
    SELECT p.id, p.title, p.content, p.created_at, p.views, p.is_pinned, p.user_id,
      u.username,
      c.name AS category_name, c.slug AS category_slug,
      (SELECT COUNT(*) FROM post_likes pl WHERE pl.post_id = p.id) AS like_count,
      CASE WHEN u.password_hash IS NOT NULL THEN 1 ELSE 0 END AS is_member,
      CASE WHEN p.password_hash IS NOT NULL THEN 1 ELSE 0 END AS has_password
    FROM posts p
    LEFT JOIN users u ON p.user_id = u.id
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE p.id = ?
  `;
  const commentSql = `
    SELECT co.id, co.content, co.created_at, co.user_id, u.username,
      CASE WHEN u.password_hash IS NOT NULL THEN 1 ELSE 0 END AS is_member,
      CASE WHEN co.password_hash IS NOT NULL THEN 1 ELSE 0 END AS has_password
    FROM comments co LEFT JOIN users u ON co.user_id = u.id
    WHERE co.post_id = ?
    ORDER BY co.created_at ASC
  `;

  db.query(postSql, [req.params.id], (err, posts) => {
    if (err) return res.status(500).json({ error: err.message });
    if (posts.length === 0)
      return res.status(404).json({ error: "게시글을 찾을 수 없습니다" });

    db.query(commentSql, [req.params.id], (err, comments) => {
      if (err) return res.status(500).json({ error: err.message });

      let hasLiked = false;
      if (req.user) {
        db.query(
          "SELECT id FROM post_likes WHERE post_id = ? AND user_id = ?",
          [req.params.id, req.user.id],
          (err, likes) => {
            if (!err) hasLiked = likes.length > 0;
            res.json({ ...posts[0], comments, hasLiked });
          }
        );
      } else {
        res.json({ ...posts[0], comments, hasLiked: false });
      }
    });
  });
});

app.post("/api/posts", authenticate, requireAuth, (req, res) => {
  const { title, content, category_id } = req.body;
  if (!title || !title.trim())
    return res.status(400).json({ error: "제목을 입력하세요" });
  if (!content || !content.trim())
    return res.status(400).json({ error: "내용을 입력하세요" });

  const catId = category_id ? parseInt(category_id) : null;
  db.query(
    "INSERT INTO posts (user_id, title, content, category_id) VALUES (?, ?, ?, ?)",
    [req.user.id, title.trim(), content.trim(), catId],
    (err, result) => {
      if (err) return res.status(500).json({ error: err.message });
      res.status(201).json({ id: result.insertId });
    }
  );
});

app.put("/api/posts/:id", authenticate, requireAuth, (req, res) => {
  const { title, content, category_id } = req.body;
  if (!title || !title.trim())
    return res.status(400).json({ error: "제목을 입력하세요" });
  if (!content || !content.trim())
    return res.status(400).json({ error: "내용을 입력하세요" });

  db.query(
    `SELECT p.id, p.user_id, u.username FROM posts p LEFT JOIN users u ON p.user_id = u.id WHERE p.id = ?`,
    [req.params.id],
    (err, posts) => {
      if (err) return res.status(500).json({ error: err.message });
      if (posts.length === 0)
        return res.status(404).json({ error: "게시글을 찾을 수 없습니다" });
      const post = posts[0];
      if (!canModifyPost(post, req.user))
        return res.status(403).json({ error: "작성자만 수정할 수 있습니다" });
      const catId = category_id ? parseInt(category_id) : null;
      db.query("UPDATE posts SET title = ?, content = ?, category_id = ? WHERE id = ?",
        [title.trim(), content.trim(), catId, req.params.id], (err) => {
          if (err) return res.status(500).json({ error: err.message });
          res.json({ message: "수정 완료" });
        });
    }
  );
});

app.delete("/api/posts/:id", authenticate, (req, res) => {
  db.query(
    `SELECT p.id, p.user_id, u.username FROM posts p LEFT JOIN users u ON p.user_id = u.id WHERE p.id = ?`,
    [req.params.id],
    (err, posts) => {
      if (err) return res.status(500).json({ error: err.message });
      if (posts.length === 0)
        return res.status(404).json({ error: "게시글을 찾을 수 없습니다" });
      const post = posts[0];
      if (!canModifyPost(post, req.user))
        return res.status(403).json({ error: "작성자만 삭제할 수 있습니다" });
      db.query("DELETE FROM posts WHERE id = ?", [req.params.id], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: "삭제 완료" });
      });
    }
  );
});

app.post("/api/posts/:id/like", authenticate, requireAuth, (req, res) => {
  db.query(
    "SELECT id FROM post_likes WHERE post_id = ? AND user_id = ?",
    [req.params.id, req.user.id],
    (err, likes) => {
      if (err) return res.status(500).json({ error: err.message });
      if (likes.length > 0) {
        db.query("DELETE FROM post_likes WHERE post_id = ? AND user_id = ?",
          [req.params.id, req.user.id], (err) => {
            if (err) return res.status(500).json({ error: err.message });
            db.query("SELECT COUNT(*) AS cnt FROM post_likes WHERE post_id = ?", [req.params.id], (err, result) => {
              if (err) return res.status(500).json({ error: err.message });
              res.json({ liked: false, likeCount: result[0].cnt });
            });
          });
      } else {
        db.query("INSERT INTO post_likes (post_id, user_id) VALUES (?, ?)",
          [req.params.id, req.user.id], (err) => {
            if (err) return res.status(500).json({ error: err.message });
            db.query("SELECT user_id FROM posts WHERE id = ?", [req.params.id], (err, posts) => {
              if (!err && posts.length > 0 && posts[0].user_id !== req.user.id) {
                const notifMsg = `${req.user.username}님이 회원님의 게시글을 좋아합니다.`;
                db.query(
                  "INSERT INTO notifications (user_id, type, message, related_user_id, related_post_id) VALUES (?, 'like', ?, ?, ?)",
                  [posts[0].user_id, notifMsg, req.user.id, req.params.id],
                  (err2) => {
                    if (!err2 && io) io.to(`user:${posts[0].user_id}`).emit("new-notification", { type: "like", message: notifMsg });
                  }
                );
              }
            });
            db.query("SELECT COUNT(*) AS cnt FROM post_likes WHERE post_id = ?", [req.params.id], (err, result) => {
              if (err) return res.status(500).json({ error: err.message });
              res.json({ liked: true, likeCount: result[0].cnt });
            });
          });
      }
    }
  );
});

app.put("/api/posts/:id/pin", authenticate, (req, res) => {
  if (!req.user || !isAdminUser(req.user.username))
    return res.status(403).json({ error: "관리자만 고정할 수 있습니다" });
  db.query("SELECT id, is_pinned FROM posts WHERE id = ?", [req.params.id], (err, posts) => {
    if (err) return res.status(500).json({ error: err.message });
    if (posts.length === 0)
      return res.status(404).json({ error: "게시글을 찾을 수 없습니다" });
    const newPinned = posts[0].is_pinned ? 0 : 1;
    db.query("UPDATE posts SET is_pinned = ? WHERE id = ?", [newPinned, req.params.id], (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ is_pinned: !!newPinned });
    });
  });
});

app.get("/api/users/:username/posts", (req, res) => {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 10));
  const offset = (page - 1) * limit;

  const countSql = `
    SELECT COUNT(*) AS total FROM posts p
    LEFT JOIN users u ON p.user_id = u.id
    WHERE u.username = ?
  `;
  const dataSql = `
    SELECT p.id, p.title, p.created_at, p.views, p.is_pinned,
      u.username,
      c.name AS category_name, c.slug AS category_slug,
      (SELECT COUNT(*) FROM comments co WHERE co.post_id = p.id) AS comment_count,
      (SELECT COUNT(*) FROM post_likes pl WHERE pl.post_id = p.id) AS like_count,
      CASE WHEN u.password_hash IS NOT NULL THEN 1 ELSE 0 END AS is_member,
      CASE WHEN p.password_hash IS NOT NULL THEN 1 ELSE 0 END AS has_password
    FROM posts p
    LEFT JOIN users u ON p.user_id = u.id
    LEFT JOIN categories c ON p.category_id = c.id
    WHERE u.username = ?
    ORDER BY p.created_at DESC
    LIMIT ? OFFSET ?
  `;

  db.query(countSql, [req.params.username], (err, countResult) => {
    if (err) return res.status(500).json({ error: err.message });
    const total = countResult[0].total;
    db.query(dataSql, [req.params.username, limit, offset], (err, posts) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ posts, total, page, totalPages: Math.ceil(total / limit) || 1, username: req.params.username });
    });
  });
});

app.get("/api/users/:username", authenticate, (req, res) => {
  db.query(
    "SELECT id, username, created_at FROM users WHERE username = ?",
    [req.params.username],
    (err, users) => {
      if (err) return res.status(500).json({ error: err.message });
      if (users.length === 0)
        return res.status(404).json({ error: "사용자를 찾을 수 없습니다" });
      const targetId = users[0].id;
      db.query(
        "SELECT COUNT(*) AS post_count FROM posts WHERE user_id = ?",
        [targetId], (err, postResult) => {
          if (err) return res.status(500).json({ error: err.message });
          db.query(
            "SELECT COUNT(*) AS comment_count FROM comments WHERE user_id = ?",
            [targetId], (err, commentResult) => {
              if (err) return res.status(500).json({ error: err.message });
              db.query(
                "SELECT COUNT(*) AS follower_count FROM follows WHERE following_id = ?",
                [targetId], (err, followerResult) => {
                  if (err) return res.status(500).json({ error: err.message });
                  db.query(
                    "SELECT COUNT(*) AS following_count FROM follows WHERE follower_id = ?",
                    [targetId], (err, followingResult) => {
                      if (err) return res.status(500).json({ error: err.message });
                      let is_following = false;
                      if (req.user) {
                        db.query(
                          "SELECT id FROM follows WHERE follower_id = ? AND following_id = ?",
                          [req.user.id, targetId],
                          (err, follows) => {
                            if (!err) is_following = follows.length > 0;
                            res.json({
                              ...users[0],
                              post_count: postResult[0].post_count,
                              comment_count: commentResult[0].comment_count,
                              follower_count: followerResult[0].follower_count,
                              following_count: followingResult[0].following_count,
                              is_admin: isAdminUser(users[0].username),
                              is_following,
                            });
                          }
                        );
                      } else {
                        res.json({
                          ...users[0],
                          post_count: postResult[0].post_count,
                          comment_count: commentResult[0].comment_count,
                          follower_count: followerResult[0].follower_count,
                          following_count: followingResult[0].following_count,
                          is_admin: isAdminUser(users[0].username),
                          is_following: false,
                        });
                      }
                    });
                });
            });
        });
    }
  );
});

app.get("/api/users/:username/comments", (req, res) => {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 10));
  const offset = (page - 1) * limit;

  db.query(
    "SELECT id FROM users WHERE username = ?",
    [req.params.username],
    (err, users) => {
      if (err) return res.status(500).json({ error: err.message });
      if (users.length === 0)
        return res.status(404).json({ error: "사용자를 찾을 수 없습니다" });
      const userId = users[0].id;

      db.query(
        "SELECT COUNT(*) AS total FROM comments WHERE user_id = ?",
        [userId],
        (err, countResult) => {
          if (err) return res.status(500).json({ error: err.message });
          const total = countResult[0].total;

          db.query(
            `SELECT c.id, c.content, c.created_at, c.post_id, p.title AS post_title
             FROM comments c
             LEFT JOIN posts p ON c.post_id = p.id
             WHERE c.user_id = ?
             ORDER BY c.created_at DESC
             LIMIT ? OFFSET ?`,
            [userId, limit, offset],
            (err, comments) => {
              if (err) return res.status(500).json({ error: err.message });
              res.json({
                comments,
                total,
                page,
                totalPages: Math.ceil(total / limit) || 1,
                username: req.params.username,
              });
            }
          );
        }
      );
    }
  );
});

app.put("/api/auth/password", authenticate, requireAuth, (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword)
    return res.status(400).json({ error: "현재 비밀번호와 새 비밀번호를 입력하세요" });
  if (newPassword.length < 4)
    return res.status(400).json({ error: "새 비밀번호는 4자 이상 입력하세요" });

  db.query(
    "SELECT password_hash FROM users WHERE id = ?",
    [req.user.id],
    (err, users) => {
      if (err) return res.status(500).json({ error: err.message });
      if (users.length === 0 || !users[0].password_hash)
        return res.status(400).json({ error: "비밀번호가 설정되지 않은 계정입니다" });

      bcrypt.compare(currentPassword, users[0].password_hash, (err, match) => {
        if (err) return res.status(500).json({ error: err.message });
        if (!match)
          return res.status(403).json({ error: "현재 비밀번호가 일치하지 않습니다" });

        bcrypt.hash(newPassword, 10, (err, hash) => {
          if (err) return res.status(500).json({ error: err.message });
          db.query("UPDATE users SET password_hash = ? WHERE id = ?", [hash, req.user.id], (err) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ message: "비밀번호가 변경되었습니다" });
          });
        });
      });
    }
  );
});

app.post("/api/posts/:id/comments", authenticate, requireAuth, (req, res) => {
  const { content } = req.body;
  if (!content || !content.trim())
    return res.status(400).json({ error: "댓글 내용을 입력하세요" });

  db.query(
    "INSERT INTO comments (post_id, user_id, content) VALUES (?, ?, ?)",
    [req.params.id, req.user.id, content.trim()],
    (err, result) => {
      if (err) return res.status(500).json({ error: err.message });
      const commentId = result.insertId;
      db.query("SELECT user_id FROM posts WHERE id = ?", [req.params.id], (err, posts) => {
        if (!err && posts.length > 0 && posts[0].user_id !== req.user.id) {
          const notifMsg = `${req.user.username}님이 회원님의 게시글에 댓글을 남겼습니다.`;
          db.query(
            "INSERT INTO notifications (user_id, type, message, related_user_id, related_post_id, related_comment_id) VALUES (?, 'comment', ?, ?, ?, ?)",
            [posts[0].user_id, notifMsg, req.user.id, req.params.id, commentId],
            (err2) => {
              if (!err2 && io) io.to(`user:${posts[0].user_id}`).emit("new-notification", { id: result.insertId, type: "comment", message: notifMsg });
            }
          );
        }
      });
      res.status(201).json({ id: commentId });
    }
  );
});

app.delete("/api/comments/:id", authenticate, (req, res) => {
  db.query(
    `SELECT c.id, c.user_id, u.username FROM comments c LEFT JOIN users u ON c.user_id = u.id WHERE c.id = ?`,
    [req.params.id],
    (err, comments) => {
      if (err) return res.status(500).json({ error: err.message });
      if (comments.length === 0)
        return res.status(404).json({ error: "댓글을 찾을 수 없습니다" });
      const comment = comments[0];
      if (!canModifyComment(comment, req.user))
        return res.status(403).json({ error: "작성자만 삭제할 수 있습니다" });
      db.query("DELETE FROM comments WHERE id = ?", [req.params.id], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: "댓글 삭제 완료" });
      });
    }
  );
});

app.post("/api/users/:username/follow", authenticate, requireAuth, (req, res) => {
  if (req.user.username === req.params.username)
    return res.status(400).json({ error: "자신을 팔로우할 수 없습니다" });
  db.query("SELECT id FROM users WHERE username = ?", [req.params.username], (err, users) => {
    if (err) return res.status(500).json({ error: err.message });
    if (users.length === 0)
      return res.status(404).json({ error: "사용자를 찾을 수 없습니다" });
    const targetId = users[0].id;
    db.query("SELECT id FROM follows WHERE follower_id = ? AND following_id = ?", [req.user.id, targetId], (err, follows) => {
      if (err) return res.status(500).json({ error: err.message });
      if (follows.length > 0) {
        db.query("DELETE FROM follows WHERE follower_id = ? AND following_id = ?", [req.user.id, targetId], (err) => {
          if (err) return res.status(500).json({ error: err.message });
          res.json({ following: false });
        });
      } else {
        db.query("INSERT INTO follows (follower_id, following_id) VALUES (?, ?)", [req.user.id, targetId], (err) => {
          if (err) return res.status(500).json({ error: err.message });
          res.json({ following: true });
        });
      }
    });
  });
});

app.delete("/api/users/:username", authenticate, requireAuth, (req, res) => {
  if (isAdminUser(req.user.username))
    return res.status(403).json({ error: "관리자 계정은 탈퇴할 수 없습니다" });
  if (req.user.username !== req.params.username)
    return res.status(403).json({ error: "본인 계정만 탈퇴할 수 있습니다" });

  db.query("DELETE FROM users WHERE id = ?", [req.user.id], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: "탈퇴 완료" });
  });
});

app.post("/api/chat/rooms/:username", authenticate, requireAuth, (req, res) => {
  db.query("SELECT id FROM users WHERE username = ?", [req.params.username], (err, users) => {
    if (err) return res.status(500).json({ error: err.message });
    if (users.length === 0) return res.status(404).json({ error: "사용자를 찾을 수 없습니다" });
    const otherId = users[0].id;
    if (req.user.id === otherId) return res.status(400).json({ error: "자기 자신과 채팅할 수 없습니다" });

    db.query(
      `SELECT r.id FROM chat_rooms r
       INNER JOIN chat_room_members m1 ON r.id = m1.room_id AND m1.user_id = ?
       INNER JOIN chat_room_members m2 ON r.id = m2.room_id AND m2.user_id = ?
       LIMIT 1`,
      [req.user.id, otherId],
      (err, rooms) => {
        if (err) return res.status(500).json({ error: err.message });
        if (rooms.length > 0) return res.json({ roomId: rooms[0].id });

        db.query("INSERT INTO chat_rooms () VALUES ()", (err, result) => {
          if (err) return res.status(500).json({ error: err.message });
          const roomId = result.insertId;
          db.query("INSERT INTO chat_room_members (room_id, user_id) VALUES (?,?), (?,?)",
            [roomId, req.user.id, roomId, otherId], (err) => {
              if (err) return res.status(500).json({ error: err.message });
              res.json({ roomId });
            });
        });
      }
    );
  });
});

app.get("/api/chat/rooms", authenticate, requireAuth, (req, res) => {
  db.query(
    `SELECT r.id AS room_id, r.created_at,
       (SELECT content FROM chat_messages WHERE room_id = r.id ORDER BY created_at DESC LIMIT 1) AS last_message,
       (SELECT created_at FROM chat_messages WHERE room_id = r.id ORDER BY created_at DESC LIMIT 1) AS last_message_at,
       (SELECT COUNT(*) FROM chat_messages WHERE room_id = r.id) AS message_count,
       (SELECT u.username FROM chat_room_members m JOIN users u ON m.user_id = u.id WHERE m.room_id = r.id AND m.user_id != ?) AS other_username
     FROM chat_rooms r
     INNER JOIN chat_room_members m ON r.id = m.room_id AND m.user_id = ?
     ORDER BY last_message_at DESC`,
    [req.user.id, req.user.id],
    (err, rooms) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json(rooms);
    }
  );
});

app.get("/api/chat/rooms/:roomId/messages", authenticate, requireAuth, (req, res) => {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 50));
  const offset = (page - 1) * limit;

  db.query(
    "SELECT id FROM chat_room_members WHERE room_id = ? AND user_id = ?",
    [req.params.roomId, req.user.id],
    (err, members) => {
      if (err) return res.status(500).json({ error: err.message });
      if (members.length === 0) return res.status(403).json({ error: "채팅방 멤버가 아닙니다" });

      db.query(
        "SELECT COUNT(*) AS total FROM chat_messages WHERE room_id = ?",
        [req.params.roomId], (err, countResult) => {
          if (err) return res.status(500).json({ error: err.message });
          const total = countResult[0].total;

          db.query(
            `SELECT m.id, m.content, m.created_at, m.user_id, u.username
             FROM chat_messages m LEFT JOIN users u ON m.user_id = u.id
             WHERE m.room_id = ?
             ORDER BY m.created_at DESC
             LIMIT ? OFFSET ?`,
            [req.params.roomId, limit, offset],
            (err, messages) => {
              if (err) return res.status(500).json({ error: err.message });
              res.json({ messages, total, page, totalPages: Math.ceil(total / limit) || 1 });
            }
          );
        }
      );
    }
  );
});

app.post("/api/chat/rooms/:roomId/messages", authenticate, requireAuth, (req, res) => {
  const { content } = req.body;
  if (!content || !content.trim())
    return res.status(400).json({ error: "메시지를 입력하세요" });

  db.query(
    "SELECT id FROM chat_room_members WHERE room_id = ? AND user_id = ?",
    [req.params.roomId, req.user.id],
    (err, members) => {
      if (err) return res.status(500).json({ error: err.message });
      if (members.length === 0) return res.status(403).json({ error: "채팅방 멤버가 아닙니다" });

      db.query(
        "INSERT INTO chat_messages (room_id, user_id, content) VALUES (?, ?, ?)",
        [req.params.roomId, req.user.id, content.trim()],
        (err, result) => {
          if (err) return res.status(500).json({ error: err.message });
          const newMsg = { id: result.insertId, content: content.trim(), user_id: req.user.id, username: req.user.username, created_at: new Date() };
          io.to(`room:${req.params.roomId}`).emit("new-message", newMsg);
          db.query(
            "SELECT user_id FROM chat_room_members WHERE room_id = ? AND user_id != ?",
            [req.params.roomId, req.user.id],
            (err, others) => {
              if (!err && others.length > 0) {
                const otherId = others[0].user_id;
                const notifMsg = `${req.user.username}님이 메시지를 보냈습니다.`;
                db.query(
                  "INSERT INTO notifications (user_id, type, message, related_user_id, related_room_id) VALUES (?, 'chat', ?, ?, ?)",
                  [otherId, notifMsg, req.user.id, req.params.roomId],
                  (err2) => {
                    if (!err2 && io) io.to(`user:${otherId}`).emit("new-notification", { type: "chat", message: notifMsg, related_room_id: parseInt(req.params.roomId) });
                  }
                );
              }
            }
          );
          res.status(201).json(newMsg);
        }
      );
    }
  );
});

app.get("/api/notifications", authenticate, requireAuth, (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = 20;
  const offset = (page - 1) * limit;
  db.query(
    "SELECT COUNT(*) AS total FROM notifications WHERE user_id = ?",
    [req.user.id], (err, countResult) => {
      if (err) return res.status(500).json({ error: err.message });
      const total = countResult[0].total;
      db.query(
        "SELECT id, type, message, related_user_id, related_post_id, related_comment_id, related_room_id, is_read, created_at FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT ? OFFSET ?",
        [req.user.id, limit, offset],
        (err, notifs) => {
          if (err) return res.status(500).json({ error: err.message });
          res.json({ notifications: notifs, total, page, totalPages: Math.ceil(total / limit) || 1 });
        }
      );
    }
  );
});

app.get("/api/notifications/unread-count", authenticate, requireAuth, (req, res) => {
  db.query("SELECT COUNT(*) AS cnt FROM notifications WHERE user_id = ? AND is_read = 0", [req.user.id], (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ count: result[0].cnt });
  });
});

app.post("/api/notifications/read", authenticate, requireAuth, (req, res) => {
  const { id } = req.body;
  if (!id) return res.status(400).json({ error: "알림 ID가 필요합니다" });
  db.query("UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?", [id, req.user.id], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
});

app.post("/api/notifications/read-all", authenticate, requireAuth, (req, res) => {
  db.query("UPDATE notifications SET is_read = 1 WHERE user_id = ?", [req.user.id], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
});

io.use((socket, next) => {
  const token = socket.handshake.query.token;
  if (!token) return next(new Error("인증 토큰이 없습니다"));
  try {
    socket.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    next(new Error("인증 실패"));
  }
});

io.on("connection", (socket) => {
  socket.join(`user:${socket.user.id}`);
  socket.on("join-room", (roomId) => {
    db.query(
      "SELECT id FROM chat_room_members WHERE room_id = ? AND user_id = ?",
      [roomId, socket.user.id],
      (err, members) => {
        if (!err && members.length > 0) {
          socket.join(`room:${roomId}`);
        }
      }
    );
  });

  socket.on("leave-room", (roomId) => {
    socket.leave(`room:${roomId}`);
  });
});

app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ error: "서버 오류가 발생했습니다." });
});

server.listen(port, "0.0.0.0", () => {
  console.log(`서버 실행 중: http://0.0.0.0:${port}`);
  console.log(`관리자 계정: ${ADMIN_USERNAME}`);
});
