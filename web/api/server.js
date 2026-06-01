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
  }
});

function runMigration() {
  const dbName = process.env.DB_NAME || "study";
  const migrations = [
    { table: "posts", col: "password_hash" },
    { table: "comments", col: "password_hash" },
  ];
  function run(i) {
    if (i >= migrations.length) return;
    const { table, col } = migrations[i];
    db.query(
      `SELECT COUNT(*) AS cnt FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
      [dbName, table, col],
      (err, result) => {
        if (err) {
          console.error(`마이그레이션 확인 실패 (${table}.${col}):`, err.message);
          return run(i + 1);
        }
        if (result[0].cnt === 0) {
          db.query(`ALTER TABLE ${table} ADD COLUMN ${col} VARCHAR(255) DEFAULT NULL`, (err) => {
            if (err) console.error(`마이그레이션 실패 (${table}.${col}):`, err.message);
            else console.log(`마이그레이션 완료: ${table}.${col} 컬럼 추가`);
            run(i + 1);
          });
        } else {
          run(i + 1);
        }
      }
    );
  }
  run(0);
}

function seedAdmin() {
  db.query("SELECT id FROM users WHERE username = ?", [ADMIN_USERNAME], (err, users) => {
    if (err) return console.error("admin 시드 확인 실패:", err.message);
    if (users.length > 0) return;
    bcrypt.hash(ADMIN_PASSWORD, 10, (err, hash) => {
      if (err) return console.error("admin 시드 해싱 실패:", err.message);
      db.query("INSERT INTO users (username, password_hash) VALUES (?, ?)", [ADMIN_USERNAME, hash], (err) => {
        if (err) console.error("admin 시드 실패:", err.message);
        else console.log(`admin 계정 생성 완료 (username: ${ADMIN_USERNAME})`);
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
  const token = header.slice(7);
  try {
    req.user = jwt.verify(token, JWT_SECRET);
  } catch {
    req.user = null;
  }
  next();
}

function findOrCreateUser(username, callback) {
  if (!username || !username.trim())
    return callback(new Error("닉네임이 필요합니다"));
  const name = username.trim();
  db.query("SELECT id FROM users WHERE username = ?", [name], (err, users) => {
    if (err) return callback(err);
    if (users.length > 0) return callback(null, users[0].id);
    db.query("INSERT INTO users (username) VALUES (?)", [name], (err, result) => {
      if (err) return callback(err);
      callback(null, result.insertId);
    });
  });
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

      const finishSignup = (userId) => {
        const isAdmin = isAdminUser(name);
        const token = jwt.sign({ id: userId, username: name, isAdmin }, JWT_SECRET, { expiresIn: "7d" });
        res.status(201).json({ token, user: { id: userId, username: name, isAdmin } });
      };

      if (users.length > 0) {
        db.query("UPDATE users SET password_hash = ? WHERE id = ?", [hash, users[0].id], (err) => {
          if (err) return res.status(500).json({ error: err.message });
          finishSignup(users[0].id);
        });
      } else {
        db.query("INSERT INTO users (username, password_hash) VALUES (?, ?)", [name, hash], (err, result) => {
          if (err) return res.status(500).json({ error: err.message });
          finishSignup(result.insertId);
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
        const token = jwt.sign(
          { id: user.id, username: user.username, isAdmin },
          JWT_SECRET,
          { expiresIn: "7d" }
        );
        res.json({ token, user: { id: user.id, username: user.username, isAdmin } });
      });
    }
  );
});

app.get("/api/auth/me", authenticate, (req, res) => {
  if (!req.user) return res.json({ user: null });
  res.json({ user: req.user });
});

app.get("/api/posts", (req, res) => {
  const search = req.query.search || "";
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(50, Math.max(1, parseInt(req.query.limit) || 10));
  const offset = (page - 1) * limit;

  let where = "";
  const params = [];
  if (search) {
    where = "WHERE p.title LIKE ?";
    params.push(`%${search}%`);
  }

  const countSql = `SELECT COUNT(*) AS total FROM posts p ${where}`;
  const dataSql = `
    SELECT p.id, p.title, p.created_at, u.username,
      (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id) AS comment_count,
      CASE WHEN u.password_hash IS NOT NULL THEN 1 ELSE 0 END AS is_member,
      CASE WHEN p.password_hash IS NOT NULL THEN 1 ELSE 0 END AS has_password
    FROM posts p
    LEFT JOIN users u ON p.user_id = u.id
    ${where}
    ORDER BY p.created_at DESC
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

app.get("/api/posts/:id", (req, res) => {
  const postSql = `
    SELECT p.id, p.title, p.content, p.created_at, p.user_id, u.username,
      CASE WHEN u.password_hash IS NOT NULL THEN 1 ELSE 0 END AS is_member,
      CASE WHEN p.password_hash IS NOT NULL THEN 1 ELSE 0 END AS has_password
    FROM posts p LEFT JOIN users u ON p.user_id = u.id
    WHERE p.id = ?
  `;
  const commentSql = `
    SELECT c.id, c.content, c.created_at, c.user_id, u.username,
      CASE WHEN u.password_hash IS NOT NULL THEN 1 ELSE 0 END AS is_member,
      CASE WHEN c.password_hash IS NOT NULL THEN 1 ELSE 0 END AS has_password
    FROM comments c LEFT JOIN users u ON c.user_id = u.id
    WHERE c.post_id = ?
    ORDER BY c.created_at ASC
  `;
  db.query(postSql, [req.params.id], (err, posts) => {
    if (err) return res.status(500).json({ error: err.message });
    if (posts.length === 0)
      return res.status(404).json({ error: "게시글을 찾을 수 없습니다" });
    db.query(commentSql, [req.params.id], (err, comments) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ ...posts[0], comments });
    });
  });
});

app.post("/api/posts", authenticate, (req, res) => {
  const { title, content, username, password } = req.body;
  if (!title || !title.trim())
    return res.status(400).json({ error: "제목을 입력하세요" });
  if (!content || !content.trim())
    return res.status(400).json({ error: "내용을 입력하세요" });

  const doInsert = (userId, passwordHash) => {
    db.query(
      "INSERT INTO posts (user_id, title, content, password_hash) VALUES (?, ?, ?, ?)",
      [userId, title.trim(), content.trim(), passwordHash || null],
      (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        res.status(201).json({ id: result.insertId });
      }
    );
  };

  if (req.user) {
    doInsert(req.user.id, null);
  } else {
    if (!username || !username.trim())
      return res.status(400).json({ error: "닉네임을 입력하세요" });
    if (!password)
      return res.status(400).json({ error: "게스트는 비밀번호를 입력해야 합니다" });

    findOrCreateUser(username, (err, userId) => {
      if (err) return res.status(500).json({ error: err.message });
      bcrypt.hash(password, 10, (err, hash) => {
        if (err) return res.status(500).json({ error: err.message });
        doInsert(userId, hash);
      });
    });
  }
});

app.put("/api/posts/:id", authenticate, (req, res) => {
  const { title, content, username, password } = req.body;
  if (!title || !title.trim())
    return res.status(400).json({ error: "제목을 입력하세요" });
  if (!content || !content.trim())
    return res.status(400).json({ error: "내용을 입력하세요" });

  db.query(
    `SELECT p.id, p.user_id, p.password_hash, u.username FROM posts p LEFT JOIN users u ON p.user_id = u.id WHERE p.id = ?`,
    [req.params.id],
    (err, posts) => {
      if (err) return res.status(500).json({ error: err.message });
      if (posts.length === 0)
        return res.status(404).json({ error: "게시글을 찾을 수 없습니다" });

      const post = posts[0];
      if (canModifyPost(post, req.user)) {
        return db.query("UPDATE posts SET title = ?, content = ? WHERE id = ?", [title.trim(), content.trim(), req.params.id], (err) => {
          if (err) return res.status(500).json({ error: err.message });
          res.json({ message: "수정 완료" });
        });
      }

      if (post.password_hash && password) {
        return bcrypt.compare(password, post.password_hash, (err, match) => {
          if (err) return res.status(500).json({ error: err.message });
          if (!match) return res.status(403).json({ error: "비밀번호가 일치하지 않습니다" });
          db.query("UPDATE posts SET title = ?, content = ? WHERE id = ?", [title.trim(), content.trim(), req.params.id], (err) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ message: "수정 완료" });
          });
        });
      }

      if (!req.user && (!username || !username.trim()))
        return res.status(400).json({ error: "닉네임을 입력하세요" });

      res.status(403).json({ error: "작성자만 수정할 수 있습니다" });
    }
  );
});

app.delete("/api/posts/:id", authenticate, (req, res) => {
  const { username, password } = req.body;

  db.query(
    `SELECT p.id, p.user_id, p.password_hash, u.username FROM posts p LEFT JOIN users u ON p.user_id = u.id WHERE p.id = ?`,
    [req.params.id],
    (err, posts) => {
      if (err) return res.status(500).json({ error: err.message });
      if (posts.length === 0)
        return res.status(404).json({ error: "게시글을 찾을 수 없습니다" });

      const post = posts[0];
      if (canModifyPost(post, req.user)) {
        return db.query("DELETE FROM posts WHERE id = ?", [req.params.id], (err) => {
          if (err) return res.status(500).json({ error: err.message });
          res.json({ message: "삭제 완료" });
        });
      }

      if (post.password_hash && password) {
        return bcrypt.compare(password, post.password_hash, (err, match) => {
          if (err) return res.status(500).json({ error: err.message });
          if (!match) return res.status(403).json({ error: "비밀번호가 일치하지 않습니다" });
          db.query("DELETE FROM posts WHERE id = ?", [req.params.id], (err) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ message: "삭제 완료" });
          });
        });
      }

      res.status(403).json({ error: "작성자만 삭제할 수 있습니다" });
    }
  );
});

app.post("/api/posts/:id/comments", authenticate, (req, res) => {
  const { content, username, password } = req.body;
  if (!content || !content.trim())
    return res.status(400).json({ error: "댓글 내용을 입력하세요" });

  const doInsert = (userId, passwordHash) => {
    db.query(
      "INSERT INTO comments (post_id, user_id, content, password_hash) VALUES (?, ?, ?, ?)",
      [req.params.id, userId, content.trim(), passwordHash || null],
      (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        res.status(201).json({ id: result.insertId });
      }
    );
  };

  if (req.user) {
    doInsert(req.user.id, null);
  } else {
    if (!username || !username.trim())
      return res.status(400).json({ error: "닉네임을 입력하세요" });
    if (!password)
      return res.status(400).json({ error: "게스트는 비밀번호를 입력해야 합니다" });

    findOrCreateUser(username, (err, userId) => {
      if (err) return res.status(500).json({ error: err.message });
      bcrypt.hash(password, 10, (err, hash) => {
        if (err) return res.status(500).json({ error: err.message });
        doInsert(userId, hash);
      });
    });
  }
});

app.delete("/api/comments/:id", authenticate, (req, res) => {
  const { username, password } = req.body;

  db.query(
    `SELECT c.id, c.user_id, c.password_hash, u.username FROM comments c LEFT JOIN users u ON c.user_id = u.id WHERE c.id = ?`,
    [req.params.id],
    (err, comments) => {
      if (err) return res.status(500).json({ error: err.message });
      if (comments.length === 0)
        return res.status(404).json({ error: "댓글을 찾을 수 없습니다" });

      const comment = comments[0];
      if (canModifyComment(comment, req.user)) {
        return db.query("DELETE FROM comments WHERE id = ?", [req.params.id], (err) => {
          if (err) return res.status(500).json({ error: err.message });
          res.json({ message: "댓글 삭제 완료" });
        });
      }

      if (comment.password_hash && password) {
        return bcrypt.compare(password, comment.password_hash, (err, match) => {
          if (err) return res.status(500).json({ error: err.message });
          if (!match) return res.status(403).json({ error: "비밀번호가 일치하지 않습니다" });
          db.query("DELETE FROM comments WHERE id = ?", [req.params.id], (err) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ message: "댓글 삭제 완료" });
          });
        });
      }

      res.status(403).json({ error: "작성자만 삭제할 수 있습니다" });
    }
  );
});

app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ error: "서버 오류가 발생했습니다." });
});

app.listen(port, "0.0.0.0", () => {
  console.log(`서버 실행 중: http://0.0.0.0:${port}`);
  console.log(`관리자 계정: ${ADMIN_USERNAME}`);
});
