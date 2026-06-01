const express = require("express");
const mysql = require("mysql2");
const path = require("path");

const app = express();
const port = 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, "../src")));

const db = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "13071308",
  database: process.env.DB_NAME || "study",
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

app.get("/api/posts", (req, res) => {
  const query = `
    SELECT p.id, p.title, p.content, p.created_at,
           u.username,
           (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id) AS comment_count
    FROM posts p
    LEFT JOIN users u ON p.user_id = u.id
    ORDER BY p.created_at DESC
  `;
  db.query(query, (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});

app.get("/api/posts/:id", (req, res) => {
  const postQuery = `
    SELECT p.id, p.title, p.content, p.created_at, u.username
    FROM posts p LEFT JOIN users u ON p.user_id = u.id
    WHERE p.id = ?
  `;
  const commentQuery = `
    SELECT c.id, c.content, c.created_at, u.username
    FROM comments c LEFT JOIN users u ON c.user_id = u.id
    WHERE c.post_id = ?
    ORDER BY c.created_at ASC
  `;
  db.query(postQuery, [req.params.id], (err, posts) => {
    if (err) return res.status(500).json({ error: err.message });
    if (posts.length === 0)
      return res.status(404).json({ error: "게시글 없음" });
    db.query(commentQuery, [req.params.id], (err, comments) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ ...posts[0], comments });
    });
  });
});

app.post("/api/posts", (req, res) => {
  const { title, content, username } = req.body;
  if (!title || !content || !username)
    return res.status(400).json({ error: "제목, 내용, 닉네임을 입력하세요" });

  db.query(
    "SELECT id FROM users WHERE username = ?",
    [username],
    (err, users) => {
      if (err) return res.status(500).json({ error: err.message });

      const insertPost = (userId) => {
        db.query(
          "INSERT INTO posts (user_id, title, content) VALUES (?, ?, ?)",
          [userId, title, content],
          (err, result) => {
            if (err) return res.status(500).json({ error: err.message });
            res
              .status(201)
              .json({ id: result.insertId, message: "게시글 작성 완료" });
          },
        );
      };

      if (users.length > 0) {
        insertPost(users[0].id);
      } else {
        db.query(
          "INSERT INTO users (username) VALUES (?)",
          [username],
          (err, result) => {
            if (err) return res.status(500).json({ error: err.message });
            insertPost(result.insertId);
          },
        );
      }
    },
  );
});

app.post("/api/posts/:id/comments", (req, res) => {
  const { content, username } = req.body;
  if (!content || !username)
    return res.status(400).json({ error: "내용과 닉네임을 입력하세요" });

  db.query(
    "SELECT id FROM users WHERE username = ?",
    [username],
    (err, users) => {
      if (err) return res.status(500).json({ error: err.message });

      const insertComment = (userId) => {
        db.query(
          "INSERT INTO comments (post_id, user_id, content) VALUES (?, ?, ?)",
          [req.params.id, userId, content],
          (err, result) => {
            if (err) return res.status(500).json({ error: err.message });
            res
              .status(201)
              .json({ id: result.insertId, message: "댓글 작성 완료" });
          },
        );
      };

      if (users.length > 0) {
        insertComment(users[0].id);
      } else {
        db.query(
          "INSERT INTO users (username) VALUES (?)",
          [username],
          (err, result) => {
            if (err) return res.status(500).json({ error: err.message });
            insertComment(result.insertId);
          },
        );
      }
    },
  );
});

app.listen(port, () => {
  console.log(`서버 실행 중: http://localhost:${port}`);
});
