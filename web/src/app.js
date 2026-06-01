let currentPostId = null;
let currentPage = 1;
let currentSearch = "";

function showList() {
  document.getElementById("view-list").classList.remove("hidden");
  document.getElementById("view-write").classList.add("hidden");
  document.getElementById("view-detail").classList.add("hidden");
  document.getElementById("view-edit").classList.add("hidden");
  loadPosts();
}

function showWrite() {
  document.getElementById("view-list").classList.add("hidden");
  document.getElementById("view-write").classList.remove("hidden");
  document.getElementById("view-detail").classList.add("hidden");
  document.getElementById("view-edit").classList.add("hidden");
}

function showDetail(id) {
  currentPostId = id;
  document.getElementById("view-list").classList.add("hidden");
  document.getElementById("view-write").classList.add("hidden");
  document.getElementById("view-detail").classList.remove("hidden");
  document.getElementById("view-edit").classList.add("hidden");
  loadPost(id);
}

function showEdit(id) {
  currentPostId = id;
  document.getElementById("view-list").classList.add("hidden");
  document.getElementById("view-write").classList.add("hidden");
  document.getElementById("view-detail").classList.add("hidden");
  document.getElementById("view-edit").classList.remove("hidden");

  fetch(`/api/posts/${id}`)
    .then((r) => r.json())
    .then((post) => {
      document.getElementById("edit-title").value = post.title;
      document.getElementById("edit-content").value = post.content;
      document.getElementById("edit-username").value = "";
    })
    .catch(() => alert("게시글을 불러오지 못했습니다."));
}

function formatDate(str) {
  const d = new Date(str);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function highlightText(text, query) {
  if (!query) return escHtml(text);
  const escaped = escHtml(text);
  const q = escHtml(query);
  const regex = new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi");
  return escaped.replace(regex, "<span class=\"highlight\">$1</span>");
}

function loadPosts(page) {
  const container = document.getElementById("posts-container");
  const pagination = document.getElementById("pagination");
  container.innerHTML = '<div class="loading">불러오는 중...</div>';
  pagination.innerHTML = "";

  const p = page || currentPage;
  const search = document.getElementById("search-input").value.trim();
  currentSearch = search;
  currentPage = p;

  let url = `/api/posts?page=${p}&limit=10`;
  if (search) url += `&search=${encodeURIComponent(search)}`;

  fetch(url)
    .then((r) => r.json())
    .then((data) => {
      document.getElementById("post-count").textContent = data.total;
      if (data.posts.length === 0) {
        container.innerHTML =
          '<div class="empty">게시글이 없습니다.</div>';
        return;
      }
      container.innerHTML = data.posts
        .map(
          (post) => `
        <div class="post-item" onclick="showDetail(${post.id})">
          <div>
            <div class="post-item-title">${highlightText(post.title, search)}</div>
            <div class="post-item-meta">
              <span>${escHtml(post.username || "익명")}</span>
              &nbsp;·&nbsp;${formatDate(post.created_at)}
            </div>
          </div>
          <div class="post-item-right">
            <div class="post-item-comments">${post.comment_count}</div>
          </div>
        </div>
      `
        )
        .join("");

      renderPagination(data);
    })
    .catch(() => {
      container.innerHTML =
        '<div class="empty error-msg">게시글을 불러오지 못했습니다.</div>';
    });
}

function renderPagination(data) {
  const pagination = document.getElementById("pagination");
  const { page, totalPages } = data;

  if (totalPages <= 1) {
    pagination.innerHTML = "";
    return;
  }

  let html = "";
  html += `<button class="page-btn" onclick="goToPage(${page - 1})" ${page <= 1 ? "disabled" : ""}>←</button>`;

  const start = Math.max(1, page - 2);
  const end = Math.min(totalPages, page + 2);

  if (start > 1) {
    html += `<button class="page-btn" onclick="goToPage(1)">1</button>`;
    if (start > 2) html += `<span class="page-btn" style="cursor:default">…</span>`;
  }

  for (let i = start; i <= end; i++) {
    html += `<button class="page-btn${i === page ? " active" : ""}" onclick="goToPage(${i})">${i}</button>`;
  }

  if (end < totalPages) {
    if (end < totalPages - 1) html += `<span class="page-btn" style="cursor:default">…</span>`;
    html += `<button class="page-btn" onclick="goToPage(${totalPages})">${totalPages}</button>`;
  }

  html += `<button class="page-btn" onclick="goToPage(${page + 1})" ${page >= totalPages ? "disabled" : ""}>→</button>`;

  pagination.innerHTML = html;
}

function goToPage(page) {
  currentPage = page;
  loadPosts(page);
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function searchPosts() {
  currentPage = 1;
  loadPosts(1);
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
      if (cList.length === 0) {
        comments.innerHTML = '<div class="empty">아직 댓글이 없습니다.</div>';
      } else {
        comments.innerHTML = cList
          .map(
            (c) => `
          <div class="comment-item">
            <div class="comment-item-body">
              <div class="comment-item-header">
                <span class="comment-username">${escHtml(c.username || "익명")}</span>
                <span class="comment-date">${formatDate(c.created_at)}</span>
              </div>
              <div class="comment-content">${escHtml(c.content)}</div>
            </div>
            <button class="comment-delete-btn" onclick="deleteComment(${c.id})" title="삭제">✕</button>
          </div>
        `
          )
          .join("");
      }
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
    .then((r) => {
      if (!r.ok) return r.json().then((e) => Promise.reject(e.error));
      return r.json();
    })
    .then((data) => {
      document.getElementById("write-username").value = "";
      document.getElementById("write-title").value = "";
      document.getElementById("write-content").value = "";
      showDetail(data.id);
    })
    .catch((err) => alert(typeof err === "string" ? err : "게시글 작성에 실패했습니다."));
}

function updatePost() {
  const username = document.getElementById("edit-username").value.trim();
  const title = document.getElementById("edit-title").value.trim();
  const content = document.getElementById("edit-content").value.trim();

  if (!username || !title || !content) {
    alert("닉네임, 제목, 내용을 모두 입력해주세요.");
    return;
  }

  fetch(`/api/posts/${currentPostId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, title, content }),
  })
    .then((r) => {
      if (!r.ok) return r.json().then((e) => Promise.reject(e.error));
      return r.json();
    })
    .then(() => showDetail(currentPostId))
    .catch((err) => alert(typeof err === "string" ? err : "게시글 수정에 실패했습니다."));
}

function deletePost() {
  const username = prompt("게시글을 삭제하려면 작성자 닉네임을 입력하세요:");
  if (!username || !username.trim()) return;

  fetch(`/api/posts/${currentPostId}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: username.trim() }),
  })
    .then((r) => {
      if (!r.ok) return r.json().then((e) => Promise.reject(e.error));
      return r.json();
    })
    .then(() => showList())
    .catch((err) => alert(typeof err === "string" ? err : "게시글 삭제에 실패했습니다."));
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
    .then((r) => {
      if (!r.ok) return r.json().then((e) => Promise.reject(e.error));
      return r.json();
    })
    .then(() => {
      document.getElementById("comment-content").value = "";
      loadPost(currentPostId);
    })
    .catch((err) => alert(typeof err === "string" ? err : "댓글 작성에 실패했습니다."));
}

function deleteComment(commentId) {
  const username = prompt("댓글을 삭제하려면 작성자 닉네임을 입력하세요:");
  if (!username || !username.trim()) return;

  fetch(`/api/comments/${commentId}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username: username.trim() }),
  })
    .then((r) => {
      if (!r.ok) return r.json().then((e) => Promise.reject(e.error));
      return r.json();
    })
    .then(() => loadPost(currentPostId))
    .catch((err) => alert(typeof err === "string" ? err : "댓글 삭제에 실패했습니다."));
}

document.addEventListener("DOMContentLoaded", () => loadPosts(1));
