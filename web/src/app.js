let currentPostId = null;

function showList() {
  document.getElementById("view-list").classList.remove("hidden");
  document.getElementById("view-write").classList.add("hidden");
  document.getElementById("view-detail").classList.add("hidden");
  loadPosts();
}

function showWrite() {
  document.getElementById("view-list").classList.add("hidden");
  document.getElementById("view-write").classList.remove("hidden");
  document.getElementById("view-detail").classList.add("hidden");
}

function showDetail(id) {
  currentPostId = id;
  document.getElementById("view-list").classList.add("hidden");
  document.getElementById("view-write").classList.add("hidden");
  document.getElementById("view-detail").classList.remove("hidden");
  loadPost(id);
}

function formatDate(str) {
  const d = new Date(str);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function loadPosts() {
  const container = document.getElementById("posts-container");
  container.innerHTML = '<div class="loading">불러오는 중...</div>';

  fetch("/api/posts")
    .then((r) => r.json())
    .then((posts) => {
      document.getElementById("post-count").textContent = posts.length;
      if (posts.length === 0) {
        container.innerHTML =
          '<div class="empty">아직 게시글이 없습니다. 첫 글을 작성해보세요!</div>';
        return;
      }
      container.innerHTML = posts
        .map(
          (p) => `
        <div class="post-item" onclick="showDetail(${p.id})">
          <div>
            <div class="post-item-title">${escHtml(p.title)}</div>
            <div class="post-item-meta">
              <span>${escHtml(p.username || "익명")}</span>
              &nbsp;·&nbsp;${formatDate(p.created_at)}
            </div>
          </div>
          <div class="post-item-right">
            <div class="post-item-comments">💬 ${p.comment_count}</div>
          </div>
        </div>
      `,
        )
        .join("");
    })
    .catch(() => {
      container.innerHTML =
        '<div class="empty error-msg">게시글을 불러오지 못했습니다.</div>';
    });
}

function loadPost(id) {
  const detail = document.getElementById("post-detail");
  const comments = document.getElementById("comments-container");
  detail.innerHTML = '<div class="loading">불러오는 중...</div>';
  comments.innerHTML = "";

  fetch(`/api/posts/${id}`)
    .then((r) => r.json())
    .then((post) => {
      detail.innerHTML = `
        <div class="post-card">
          <div class="post-card-title">${escHtml(post.title)}</div>
          <div class="post-card-meta">
            <span>${escHtml(post.username || "익명")}</span>
            &nbsp;·&nbsp;${formatDate(post.created_at)}
          </div>
          <div class="post-card-content">${escHtml(post.content)}</div>
        </div>
      `;
      const cList = post.comments || [];
      document.getElementById("comment-count").textContent = cList.length;
      comments.innerHTML =
        cList.length === 0
          ? '<div class="empty">아직 댓글이 없습니다.</div>'
          : cList
              .map(
                (c) => `
          <div class="comment-item">
            <div class="comment-item-header">
              <span class="comment-username">${escHtml(c.username || "익명")}</span>
              <span class="comment-date">${formatDate(c.created_at)}</span>
            </div>
            <div class="comment-content">${escHtml(c.content)}</div>
          </div>
        `,
              )
              .join("");
    })
    .catch(() => {
      detail.innerHTML =
        '<div class="empty error-msg">게시글을 불러오지 못했습니다.</div>';
    });
}

function submitPost() {
  const username = document.getElementById("write-username").value.trim();
  const title = document.getElementById("write-title").value.trim();
  const content = document.getElementById("write-content").value.trim();

  if (!username || !title || !content) {
    alert("닉네임, 제목, 내용을 모두 입력해주세요.");
    return;
  }

  fetch("/api/posts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, title, content }),
  })
    .then((r) => r.json())
    .then((data) => {
      document.getElementById("write-username").value = "";
      document.getElementById("write-title").value = "";
      document.getElementById("write-content").value = "";
      showDetail(data.id);
    })
    .catch(() => alert("게시글 작성에 실패했습니다."));
}

function submitComment() {
  const username = document.getElementById("comment-username").value.trim();
  const content = document.getElementById("comment-content").value.trim();

  if (!username || !content) {
    alert("닉네임과 댓글 내용을 입력해주세요.");
    return;
  }

  fetch(`/api/posts/${currentPostId}/comments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, content }),
  })
    .then((r) => r.json())
    .then(() => {
      document.getElementById("comment-content").value = "";
      loadPost(currentPostId);
    })
    .catch(() => alert("댓글 작성에 실패했습니다."));
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

document.addEventListener("DOMContentLoaded", loadPosts);
