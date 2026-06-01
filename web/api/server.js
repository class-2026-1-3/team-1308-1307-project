const express = require("express");
const mysql = require("mysql2");
const path = require("path");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const app = express();
const port = 3000;
const JWT_SECRET = process.env.JWT_SECRET || "teamP-community-secret-key-2026";
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || "admin";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";

app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "../src")));

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
  }
});

function runMigration() {
  const dbName = process.env.DB_NAME || "study";
  const migrations = [
    "CREATE TABLE IF NOT EXISTS categories (id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(50) NOT NULL, slug VARCHAR(50) NOT NULL UNIQUE)",
    "CREATE TABLE IF NOT EXISTS post_likes (id INT AUTO_INCREMENT PRIMARY KEY, post_id INT NOT NULL, user_id INT NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, UNIQUE KEY unique_like (post_id, user_id), FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE, FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE)",
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

app.get("/api/users/:username", (req, res) => {
  db.query(
    "SELECT id, username, created_at FROM users WHERE username = ?",
    [req.params.username],
    (err, users) => {
      if (err) return res.status(500).json({ error: err.message });
      if (users.length === 0)
        return res.status(404).json({ error: "사용자를 찾을 수 없습니다" });
      db.query(
        "SELECT COUNT(*) AS post_count FROM posts WHERE user_id = ?",
        [users[0].id], (err, postResult) => {
          if (err) return res.status(500).json({ error: err.message });
          db.query(
            "SELECT COUNT(*) AS comment_count FROM comments WHERE user_id = ?",
            [users[0].id], (err, commentResult) => {
              if (err) return res.status(500).json({ error: err.message });
              res.json({
                ...users[0],
                post_count: postResult[0].post_count,
                comment_count: commentResult[0].comment_count,
                is_admin: isAdminUser(users[0].username),
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
      res.status(201).json({ id: result.insertId });
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

app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ error: "서버 오류가 발생했습니다." });
});

app.listen(port, "0.0.0.0", () => {
  console.log(`서버 실행 중: http://0.0.0.0:${port}`);
  console.log(`관리자 계정: ${ADMIN_USERNAME}`);
});
