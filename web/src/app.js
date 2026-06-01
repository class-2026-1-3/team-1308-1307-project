let currentPostId = null;
let currentPage = 1;
let currentSearch = "";
let currentUser = null;

function getToken() {
  return localStorage.getItem("token");
}

function setToken(token) {
  if (token) {
    localStorage.setItem("token", token);
  } else {
    localStorage.removeItem("token");
  }
}

function apiHeaders() {
  const headers = { "Content-Type": "application/json" };
  const token = getToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return headers;
}

function authFetch(url, options) {
  return fetch(url, { ...options, headers: { ...apiHeaders(), ...options?.headers } });
}

function updateHeader() {
  const user = currentUser;
  const usernameEl = document.getElementById("header-username");
  const loginBtn = document.getElementById("btn-login");
  const logoutBtn = document.getElementById("btn-logout");

  if (user) {
    usernameEl.textContent = user.username;
    usernameEl.classList.remove("hidden");
    loginBtn.classList.add("hidden");
    logoutBtn.classList.remove("hidden");
  } else {
    usernameEl.classList.add("hidden");
    loginBtn.classList.remove("hidden");
    logoutBtn.classList.add("hidden");
  }
}

function updateFormUsername() {
  const writeGroup = document.getElementById("write-username-group");
  const writePassGroup = document.getElementById("write-password-group");
  const writeInput = document.getElementById("write-username");
  const editGroup = document.getElementById("edit-username-group");
  const editPassGroup = document.getElementById("edit-password-group");
  const editInput = document.getElementById("edit-username");
  const commentInput = document.getElementById("comment-username");
  const commentPass = document.getElementById("comment-password");

  if (currentUser) {
    writeGroup.classList.add("hidden");
    writePassGroup.classList.add("hidden");
    writeInput.value = currentUser.username;
    editGroup.classList.add("hidden");
    editPassGroup.classList.add("hidden");
    editInput.value = currentUser.username;
    commentInput.value = currentUser.username;
    commentInput.disabled = true;
    commentPass.classList.add("hidden");
  } else {
    writeGroup.classList.remove("hidden");
    writePassGroup.classList.remove("hidden");
    editGroup.classList.remove("hidden");
    commentInput.disabled = false;
    commentPass.classList.remove("hidden");
  }
}

function showAuthModal() {
  document.getElementById("auth-modal").classList.remove("hidden");
  document.getElementById("login-error").classList.add("hidden");
  document.getElementById("signup-error").classList.add("hidden");
  switchAuthTab("login");
}

function hideAuthModal() {
  document.getElementById("auth-modal").classList.add("hidden");
}

function switchAuthTab(tab) {
  const login = document.getElementById("auth-login");
  const signup = document.getElementById("auth-signup");
  const tabLogin = document.getElementById("tab-login");
  const tabSignup = document.getElementById("tab-signup");

  if (tab === "login") {
    login.classList.remove("hidden");
    signup.classList.add("hidden");
    tabLogin.classList.add("active");
    tabSignup.classList.remove("active");
  } else {
    login.classList.add("hidden");
    signup.classList.remove("hidden");
    tabLogin.classList.remove("active");
    tabSignup.classList.add("active");
  }
}

function login() {
  const username = document.getElementById("login-username").value.trim();
  const password = document.getElementById("login-password").value.trim();
  const errorEl = document.getElementById("login-error");

  if (!username || !password) {
    errorEl.textContent = "닉네임과 비밀번호를 입력하세요";
    errorEl.classList.remove("hidden");
    return;
  }

  errorEl.classList.add("hidden");

  fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  })
    .then((r) => {
      if (!r.ok) return r.json().then((e) => Promise.reject(e.error));
      return r.json();
    })
    .then((data) => {
      setToken(data.token);
      currentUser = data.user;
      updateHeader();
      updateFormUsername();
      hideAuthModal();
      document.getElementById("login-username").value = "";
      document.getElementById("login-password").value = "";
    })
    .catch((err) => {
      errorEl.textContent = typeof err === "string" ? err : "로그인에 실패했습니다";
      errorEl.classList.remove("hidden");
    });
}

function signup() {
  const username = document.getElementById("signup-username").value.trim();
  const password = document.getElementById("signup-password").value;
  const confirm = document.getElementById("signup-password-confirm").value;
  const errorEl = document.getElementById("signup-error");

  if (!username || !password || !confirm) {
    errorEl.textContent = "모든 항목을 입력하세요";
    errorEl.classList.remove("hidden");
    return;
  }

  if (password.length < 4) {
    errorEl.textContent = "비밀번호는 4자 이상 입력하세요";
    errorEl.classList.remove("hidden");
    return;
  }

  if (password !== confirm) {
    errorEl.textContent = "비밀번호가 일치하지 않습니다";
    errorEl.classList.remove("hidden");
    return;
  }

  errorEl.classList.add("hidden");

  fetch("/api/auth/signup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  })
    .then((r) => {
      if (!r.ok) return r.json().then((e) => Promise.reject(e.error));
      return r.json();
    })
    .then((data) => {
      setToken(data.token);
      currentUser = data.user;
      updateHeader();
      updateFormUsername();
      hideAuthModal();
      document.getElementById("signup-username").value = "";
      document.getElementById("signup-password").value = "";
      document.getElementById("signup-password-confirm").value = "";
    })
    .catch((err) => {
      errorEl.textContent = typeof err === "string" ? err : "회원가입에 실패했습니다";
      errorEl.classList.remove("hidden");
    });
}

function logout() {
  currentUser = null;
  setToken(null);
  updateHeader();
  updateFormUsername();
}

function restoreSession() {
  const token = getToken();
  if (!token) {
    updateHeader();
    updateFormUsername();
    return;
  }
  fetch("/api/auth/me", { headers: { Authorization: `Bearer ${token}` } })
    .then((r) => r.json())
    .then((data) => {
      if (data.user) {
        currentUser = data.user;
      } else {
        setToken(null);
      }
      updateHeader();
      updateFormUsername();
    })
    .catch(() => {
      setToken(null);
      updateHeader();
      updateFormUsername();
    });
}

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
  updateFormUsername();
  document.getElementById("write-password").value = "";
  document.getElementById("write-title").value = "";
  document.getElementById("write-content").value = "";
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
      document.getElementById("edit-password").value = "";
      updateFormUsername();
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
  return escaped.replace(regex, '<span class="highlight">$1</span>');
}

function memberBadge(isMember) {
  return isMember ? '<span class="member-badge">회원</span>' : "";
}

function adminBadge(isAdmin) {
  return isAdmin ? '<span class="admin-badge">관리자</span>' : "";
}

function isCurrentUserAdmin() {
  return currentUser && currentUser.isAdmin;
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
        container.innerHTML = '<div class="empty">게시글이 없습니다.</div>';
        return;
      }
      container.innerHTML = data.posts
        .map(
          (post) => `
        <div class="post-item" onclick="showDetail(${post.id})">
          <div>
            <div class="post-item-title">${highlightText(post.title, search)}</div>
            <div class="post-item-meta">
              ${memberBadge(post.is_member)}<span>${escHtml(post.username || "익명")}</span>
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
      container.innerHTML = '<div class="empty error-msg">게시글을 불러오지 못했습니다.</div>';
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
    if (start > 2) html += '<span class="page-btn" style="cursor:default">…</span>';
  }

  for (let i = start; i <= end; i++) {
    html += `<button class="page-btn${i === page ? " active" : ""}" onclick="goToPage(${i})">${i}</button>`;
  }

  if (end < totalPages) {
    if (end < totalPages - 1) html += '<span class="page-btn" style="cursor:default">…</span>';
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
            ${adminBadge(post.is_member && post.username && post.username === (currentUser?.isAdmin ? post.username : null))}
            ${memberBadge(post.is_member)}<span>${escHtml(post.username || "익명")}</span>
            &nbsp;·&nbsp;${formatDate(post.created_at)}
            ${post.has_password ? '<span class="lock-badge">🔒</span>' : ""}
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
                <span class="comment-username">${memberBadge(c.is_member)}${escHtml(c.username || "익명")}</span>
                <span class="comment-date">${formatDate(c.created_at)}${c.has_password ? ' 🔒' : ""}</span>
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
      detail.innerHTML = '<div class="empty error-msg">게시글을 불러오지 못했습니다.</div>';
    });
}

function submitPost() {
  const username = currentUser ? currentUser.username : document.getElementById("write-username").value.trim();
  const password = currentUser ? null : document.getElementById("write-password").value;
  const title = document.getElementById("write-title").value.trim();
  const content = document.getElementById("write-content").value.trim();

  if (!title || !content) {
    alert("제목과 내용을 입력해주세요.");
    return;
  }
  if (!username) {
    alert("닉네임을 입력해주세요.");
    return;
  }
  if (!currentUser && !password) {
    alert("게스트는 비밀번호를 입력해야 합니다.");
    return;
  }

  const body = currentUser
    ? { title, content }
    : { username, password, title, content };

  authFetch("/api/posts", {
    method: "POST",
    body: JSON.stringify(body),
  })
    .then((r) => {
      if (!r.ok) return r.json().then((e) => Promise.reject(e.error));
      return r.json();
    })
    .then((data) => {
      document.getElementById("write-title").value = "";
      document.getElementById("write-content").value = "";
      showDetail(data.id);
    })
    .catch((err) => alert(typeof err === "string" ? err : "게시글 작성에 실패했습니다."));
}

function updatePost() {
  const username = currentUser ? currentUser.username : document.getElementById("edit-username").value.trim();
  const password = currentUser ? null : document.getElementById("edit-password").value;
  const title = document.getElementById("edit-title").value.trim();
  const content = document.getElementById("edit-content").value.trim();

  if (!title || !content) {
    alert("제목과 내용을 입력해주세요.");
    return;
  }
  if (!currentUser && !username) {
    alert("닉네임을 입력해주세요.");
    return;
  }

  const body = currentUser
    ? { title, content }
    : { username, title, content };
  if (!currentUser && password) body.password = password;

  authFetch(`/api/posts/${currentPostId}`, {
    method: "PUT",
    body: JSON.stringify(body),
  })
    .then((r) => {
      if (!r.ok) return r.json().then((e) => Promise.reject(e.error));
      return r.json();
    })
    .then(() => showDetail(currentPostId))
    .catch((err) => alert(typeof err === "string" ? err : "게시글 수정에 실패했습니다."));
}

function deletePost() {
  let username = currentUser ? currentUser.username : null;
  let password = null;

  if (isCurrentUserAdmin()) {
    if (!confirm("관리자 권한으로 이 게시글을 삭제하시겠습니까?")) return;
  } else if (currentUser) {
    if (!confirm("이 게시글을 삭제하시겠습니까?")) return;
  } else {
    username = prompt("게시글을 삭제하려면 작성자 닉네임을 입력하세요:");
    if (!username || !username.trim()) return;
    password = prompt("게시글 작성 시 설정한 비밀번호를 입력하세요:");
    if (!password) return;
  }

  const body = { username: username.trim() };
  if (password) body.password = password;

  authFetch(`/api/posts/${currentPostId}`, {
    method: "DELETE",
    body: JSON.stringify(body),
  })
    .then((r) => {
      if (!r.ok) return r.json().then((e) => Promise.reject(e.error));
      return r.json();
    })
    .then(() => showList())
    .catch((err) => alert(typeof err === "string" ? err : "게시글 삭제에 실패했습니다."));
}

function submitComment() {
  const username = currentUser ? currentUser.username : document.getElementById("comment-username").value.trim();
  const password = currentUser ? null : document.getElementById("comment-password").value;
  const content = document.getElementById("comment-content").value.trim();

  if (!content) {
    alert("댓글 내용을 입력해주세요.");
    return;
  }
  if (!username) {
    alert("닉네임을 입력해주세요.");
    return;
  }
  if (!currentUser && !password) {
    alert("게스트는 비밀번호를 입력해야 합니다.");
    return;
  }

  const body = currentUser
    ? { content }
    : { username, password, content };

  authFetch(`/api/posts/${currentPostId}/comments`, {
    method: "POST",
    body: JSON.stringify(body),
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
  let username = currentUser ? currentUser.username : null;
  let password = null;

  if (isCurrentUserAdmin()) {
    if (!confirm("관리자 권한으로 이 댓글을 삭제하시겠습니까?")) return;
  } else if (currentUser) {
    if (!confirm("이 댓글을 삭제하시겠습니까?")) return;
  } else {
    username = prompt("댓글을 삭제하려면 작성자 닉네임을 입력하세요:");
    if (!username || !username.trim()) return;
    password = prompt("댓글 작성 시 설정한 비밀번호를 입력하세요:");
    if (!password) return;
  }

  const body = { username: username.trim() };
  if (password) body.password = password;

  authFetch(`/api/comments/${commentId}`, {
    method: "DELETE",
    body: JSON.stringify(body),
  })
    .then((r) => {
      if (!r.ok) return r.json().then((e) => Promise.reject(e.error));
      return r.json();
    })
    .then(() => loadPost(currentPostId))
    .catch((err) => alert(typeof err === "string" ? err : "댓글 삭제에 실패했습니다."));
}

document.addEventListener("DOMContentLoaded", () => {
  restoreSession();
  loadPosts(1);
});
