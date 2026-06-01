const express = require("express");
const mysql = require("mysql2");
const path = require("path");
const cors = require("cors");

const app = express();
const port = 3000;

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
  }
});

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
      (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id) AS comment_count
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
      res.json({
        posts,
        total,
        page,
        totalPages: Math.ceil(total / limit) || 1,
      });
    });
  });
});

app.get("/api/posts/:id", (req, res) => {
  const postSql = `
    SELECT p.id, p.title, p.content, p.created_at, u.username
    FROM posts p LEFT JOIN users u ON p.user_id = u.id
    WHERE p.id = ?
  `;
  const commentSql = `
    SELECT c.id, c.content, c.created_at, u.username
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

app.post("/api/posts", (req, res) => {
  const { title, content, username } = req.body;
  if (!title || !title.trim())
    return res.status(400).json({ error: "제목을 입력하세요" });
  if (!content || !content.trim())
    return res.status(400).json({ error: "내용을 입력하세요" });
  if (!username || !username.trim())
    return res.status(400).json({ error: "닉네임을 입력하세요" });

  findOrCreateUser(username, (err, userId) => {
    if (err) return res.status(500).json({ error: err.message });
    db.query(
      "INSERT INTO posts (user_id, title, content) VALUES (?, ?, ?)",
      [userId, title.trim(), content.trim()],
      (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        res.status(201).json({ id: result.insertId });
      }
    );
  });
});

app.put("/api/posts/:id", (req, res) => {
  const { title, content, username } = req.body;
  if (!title || !title.trim())
    return res.status(400).json({ error: "제목을 입력하세요" });
  if (!content || !content.trim())
    return res.status(400).json({ error: "내용을 입력하세요" });
  if (!username || !username.trim())
    return res.status(400).json({ error: "닉네임을 입력하세요" });

  db.query(
    `SELECT p.id, u.username FROM posts p LEFT JOIN users u ON p.user_id = u.id WHERE p.id = ?`,
    [req.params.id],
    (err, posts) => {
      if (err) return res.status(500).json({ error: err.message });
      if (posts.length === 0)
        return res.status(404).json({ error: "게시글을 찾을 수 없습니다" });
      if (posts[0].username !== username.trim())
        return res
          .status(403)
          .json({ error: "작성자만 수정할 수 있습니다" });

      db.query(
        "UPDATE posts SET title = ?, content = ? WHERE id = ?",
        [title.trim(), content.trim(), req.params.id],
        (err) => {
          if (err) return res.status(500).json({ error: err.message });
          res.json({ message: "수정 완료" });
        }
      );
    }
  );
});

app.delete("/api/posts/:id", (req, res) => {
  const { username } = req.body;
  if (!username || !username.trim())
    return res.status(400).json({ error: "닉네임을 입력하세요" });

  db.query(
    `SELECT p.id, u.username FROM posts p LEFT JOIN users u ON p.user_id = u.id WHERE p.id = ?`,
    [req.params.id],
    (err, posts) => {
      if (err) return res.status(500).json({ error: err.message });
      if (posts.length === 0)
        return res.status(404).json({ error: "게시글을 찾을 수 없습니다" });
      if (posts[0].username !== username.trim())
        return res
          .status(403)
          .json({ error: "작성자만 삭제할 수 있습니다" });

      db.query("DELETE FROM posts WHERE id = ?", [req.params.id], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: "삭제 완료" });
      });
    }
  );
});

app.post("/api/posts/:id/comments", (req, res) => {
  const { content, username } = req.body;
  if (!content || !content.trim())
    return res.status(400).json({ error: "댓글 내용을 입력하세요" });
  if (!username || !username.trim())
    return res.status(400).json({ error: "닉네임을 입력하세요" });

  findOrCreateUser(username, (err, userId) => {
    if (err) return res.status(500).json({ error: err.message });
    db.query(
      "INSERT INTO comments (post_id, user_id, content) VALUES (?, ?, ?)",
      [req.params.id, userId, content.trim()],
      (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        res.status(201).json({ id: result.insertId });
      }
    );
  });
});

app.delete("/api/comments/:id", (req, res) => {
  const { username } = req.body;
  if (!username || !username.trim())
    return res.status(400).json({ error: "닉네임을 입력하세요" });

  db.query(
    `SELECT c.id, u.username FROM comments c LEFT JOIN users u ON c.user_id = u.id WHERE c.id = ?`,
    [req.params.id],
    (err, comments) => {
      if (err) return res.status(500).json({ error: err.message });
      if (comments.length === 0)
        return res.status(404).json({ error: "댓글을 찾을 수 없습니다" });
      if (comments[0].username !== username.trim())
        return res
          .status(403)
          .json({ error: "작성자만 삭제할 수 있습니다" });

      db.query("DELETE FROM comments WHERE id = ?", [req.params.id], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: "댓글 삭제 완료" });
      });
    }
  );
});

app.use((err, req, res, next) => {
  console.error("Unhandled error:", err);
  res.status(500).json({ error: "서버 오류가 발생했습니다." });
});

app.listen(port, "0.0.0.0", () => {
  console.log(`서버 실행 중: http://0.0.0.0:${port}`);
});
