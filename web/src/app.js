let currentPostId = null;
let currentPage = 1;
let currentSearch = "";
let currentSort = "latest";
let currentCategory = "";
let currentUser = null;
let currentProfileUsername = "";
let dialogResolve = null;

function getToken() {
  return localStorage.getItem("token");
}

function setToken(token) {
  if (token) localStorage.setItem("token", token);
  else localStorage.removeItem("token");
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
  const userArea = document.getElementById("header-user");
  const usernameEl = document.getElementById("header-username");
  const loginBtn = document.getElementById("btn-login");
  const logoutBtn = document.getElementById("btn-logout");
  if (currentUser) {
    usernameEl.textContent = currentUser.username;
    userArea.classList.remove("hidden");
    loginBtn.classList.add("hidden");
  } else {
    userArea.classList.add("hidden");
    loginBtn.classList.remove("hidden");
  }
  const detailView = document.getElementById("view-detail");
  if (detailView && !detailView.classList.contains("hidden")) {
    toggleCommentForm();
  }
}

function updateFormUsername() {
  // no-op: guest fields removed
}

function toggleCommentForm() {
  const prompt = document.getElementById("comment-login-prompt");
  const form = document.getElementById("comment-form");
  if (!currentUser) {
    prompt.classList.remove("hidden");
    form.classList.add("hidden");
  } else {
    prompt.classList.add("hidden");
    form.classList.remove("hidden");
  }
}

function showAlertModal(msg) {
  return new Promise(resolve => {
    document.getElementById("dialog-error").classList.add("hidden");
    document.getElementById("dialog-message").textContent = msg;
    document.getElementById("dialog-input-wrap").classList.add("hidden");
    document.getElementById("dialog-password-wrap").classList.add("hidden");
    document.getElementById("dialog-cancel-btn").classList.add("hidden");
    document.getElementById("dialog-confirm-btn").textContent = "확인";
    document.getElementById("dialog-modal").classList.remove("hidden");
    dialogResolve = resolve;
    document.getElementById("dialog-confirm-btn").onclick = () => {
      document.getElementById("dialog-modal").classList.add("hidden");
      if (dialogResolve) { dialogResolve(); dialogResolve = null; }
    };
    document.getElementById("dialog-modal").onclick = (e) => {
      if (e.target === document.getElementById("dialog-modal")) {
        document.getElementById("dialog-modal").classList.add("hidden");
        if (dialogResolve) { dialogResolve(); dialogResolve = null; }
      }
    };
  });
}

function showConfirmModal(msg) {
  return new Promise(resolve => {
    document.getElementById("dialog-error").classList.add("hidden");
    document.getElementById("dialog-message").textContent = msg;
    document.getElementById("dialog-input-wrap").classList.add("hidden");
    document.getElementById("dialog-password-wrap").classList.add("hidden");
    document.getElementById("dialog-cancel-btn").classList.remove("hidden");
    document.getElementById("dialog-cancel-btn").textContent = "취소";
    document.getElementById("dialog-confirm-btn").textContent = "확인";
    document.getElementById("dialog-modal").classList.remove("hidden");
    dialogResolve = resolve;
    document.getElementById("dialog-confirm-btn").onclick = () => {
      document.getElementById("dialog-modal").classList.add("hidden");
      if (dialogResolve) { dialogResolve(true); dialogResolve = null; }
    };
    document.getElementById("dialog-cancel-btn").onclick = () => {
      document.getElementById("dialog-modal").classList.add("hidden");
      if (dialogResolve) { dialogResolve(false); dialogResolve = null; }
    };
    document.getElementById("dialog-modal").onclick = (e) => {
      if (e.target === document.getElementById("dialog-modal")) {
        document.getElementById("dialog-modal").classList.add("hidden");
        if (dialogResolve) { dialogResolve(false); dialogResolve = null; }
      }
    };
  });
}

function showPromptModal(msg, placeholder, isPassword = false) {
  return new Promise(resolve => {
    document.getElementById("dialog-error").classList.add("hidden");
    document.getElementById("dialog-message").textContent = msg;
    document.getElementById("dialog-cancel-btn").classList.remove("hidden");
    document.getElementById("dialog-cancel-btn").textContent = "취소";
    document.getElementById("dialog-confirm-btn").textContent = "확인";

    const inputWrap = document.getElementById("dialog-input-wrap");
    const pwWrap = document.getElementById("dialog-password-wrap");
    const input = document.getElementById("dialog-input");
    const pwInput = document.getElementById("dialog-password-input");

    inputWrap.classList.toggle("hidden", isPassword);
    pwWrap.classList.toggle("hidden", !isPassword);

    if (isPassword) {
      pwInput.value = "";
      pwInput.placeholder = placeholder || "";
      setTimeout(() => pwInput.focus(), 50);
    } else {
      input.value = "";
      input.placeholder = placeholder || "";
      setTimeout(() => input.focus(), 50);
    }

    document.getElementById("dialog-modal").classList.remove("hidden");
    dialogResolve = resolve;

    const getValue = () => {
      const val = isPassword ? pwInput.value.trim() : input.value.trim();
      const errEl = document.getElementById("dialog-error");
      if (!val) {
        errEl.textContent = "값을 입력하세요";
        errEl.classList.remove("hidden");
        return null;
      }
      errEl.classList.add("hidden");
      return val;
    };

    const doConfirm = () => {
      const val = getValue();
      if (val !== null) {
        document.getElementById("dialog-modal").classList.add("hidden");
        if (dialogResolve) { dialogResolve(val); dialogResolve = null; }
      }
    };

    const doCancel = () => {
      document.getElementById("dialog-modal").classList.add("hidden");
      if (dialogResolve) { dialogResolve(null); dialogResolve = null; }
    };

    document.getElementById("dialog-confirm-btn").onclick = doConfirm;
    document.getElementById("dialog-cancel-btn").onclick = doCancel;

    const keyHandler = (e) => {
      if (e.key === "Enter") doConfirm();
      if (e.key === "Escape") doCancel();
    };

    if (isPassword) pwInput.onkeydown = keyHandler;
    else input.onkeydown = keyHandler;

    document.getElementById("dialog-modal").onclick = (e) => {
      if (e.target === document.getElementById("dialog-modal")) doCancel();
    };
  });
}

function showAuthModal(tab) {
  document.getElementById("auth-modal").classList.remove("hidden");
  document.getElementById("login-error").classList.add("hidden");
  document.getElementById("signup-error").classList.add("hidden");
  switchAuthTab(tab || "login");
}

function hideAuthModal() {
  document.getElementById("auth-modal").classList.add("hidden");
}

function switchAuthTab(tab) {
  const login = document.getElementById("auth-login");
  const signup = document.getElementById("auth-signup");
  document.getElementById("tab-login").classList.toggle("active", tab === "login");
  document.getElementById("tab-signup").classList.toggle("active", tab === "signup");
  login.classList.toggle("hidden", tab !== "login");
  signup.classList.toggle("hidden", tab !== "signup");
}

function login() {
  const username = document.getElementById("login-username").value.trim();
  const password = document.getElementById("login-password").value.trim();
  const errorEl = document.getElementById("login-error");
  if (!username || !password) {
    errorEl.textContent = "닉네임과 비밀번호를 입력하세요";
    errorEl.classList.remove("hidden"); return;
  }
  errorEl.classList.add("hidden");
  fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username, password }) })
    .then(r => { if (!r.ok) return r.json().then(e => Promise.reject(e.error)); return r.json(); })
    .then(data => { setToken(data.token); currentUser = data.user; updateHeader(); updateFormUsername(); hideAuthModal(); })
    .catch(err => { errorEl.textContent = typeof err === "string" ? err : "로그인에 실패했습니다"; errorEl.classList.remove("hidden"); });
}

function signup() {
  const username = document.getElementById("signup-username").value.trim();
  const password = document.getElementById("signup-password").value;
  const confirm = document.getElementById("signup-password-confirm").value;
  const errorEl = document.getElementById("signup-error");
  if (!username || !password || !confirm) { errorEl.textContent = "모든 항목을 입력하세요"; errorEl.classList.remove("hidden"); return; }
  if (password.length < 4) { errorEl.textContent = "비밀번호는 4자 이상 입력하세요"; errorEl.classList.remove("hidden"); return; }
  if (password !== confirm) { errorEl.textContent = "비밀번호가 일치하지 않습니다"; errorEl.classList.remove("hidden"); return; }
  errorEl.classList.add("hidden");
  fetch("/api/auth/signup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username, password }) })
    .then(r => { if (!r.ok) return r.json().then(e => Promise.reject(e.error)); return r.json(); })
    .then(data => { setToken(data.token); currentUser = data.user; updateHeader(); updateFormUsername(); hideAuthModal(); })
    .catch(err => { errorEl.textContent = typeof err === "string" ? err : "회원가입에 실패했습니다"; errorEl.classList.remove("hidden"); });
}

function logout() {
  currentUser = null; setToken(null); updateHeader(); updateFormUsername();
}

function restoreSession() {
  const token = getToken();
  if (!token) { updateHeader(); updateFormUsername(); return; }
  fetch("/api/auth/me", { headers: { Authorization: `Bearer ${token}` } })
    .then(r => r.json()).then(data => {
      if (data.user) currentUser = data.user; else setToken(null);
      updateHeader(); updateFormUsername();
    }).catch(() => { setToken(null); updateHeader(); updateFormUsername(); });
}

function loadCategories(selectId) {
  fetch("/api/categories").then(r => r.json()).then(cats => {
    const sel = document.getElementById(selectId);
    if (!sel) return;
    sel.innerHTML = '<option value="">카테고리 선택</option>';
    cats.forEach(c => { sel.innerHTML += `<option value="${c.id}">${c.name}</option>`; });
  }).catch(() => {});
}

function renderCategoryTabs() {
  const container = document.getElementById("category-tabs");
  container.innerHTML = `<button class="cat-tab${currentCategory === "" ? " active" : ""}" onclick="setCategory('')">전체</button>`;
  fetch("/api/categories").then(r => r.json()).then(cats => {
    cats.forEach(c => {
      container.innerHTML += `<button class="cat-tab${currentCategory === c.slug ? " active" : ""}" onclick="setCategory('${c.slug}')">${c.name}</button>`;
    });
  }).catch(() => {});
}

function setCategory(slug) {
  currentCategory = slug;
  currentPage = 1;
  renderCategoryTabs();
  loadPosts(1);
}

function setSort(sort) {
  currentSort = sort;
  document.getElementById("sort-latest").classList.toggle("active", sort === "latest");
  document.getElementById("sort-popular").classList.toggle("active", sort === "popular");
  currentPage = 1;
  loadPosts(1);
}

function showList() {
  hideAllViews();
  document.getElementById("view-list").classList.remove("hidden");
  renderCategoryTabs();
  loadPosts();
}

function showWrite() {
  if (!currentUser) { showAuthModal("signup"); return; }
  hideAllViews();
  document.getElementById("view-write").classList.remove("hidden");
  document.getElementById("write-title").value = "";
  document.getElementById("write-content").value = "";
  loadCategories("write-category");
}

function showDetail(id) {
  currentPostId = id;
  hideAllViews();
  document.getElementById("view-detail").classList.remove("hidden");
  toggleCommentForm();
  loadPost(id);
}

function showEdit(id) {
  currentPostId = id;
  hideAllViews();
  document.getElementById("view-edit").classList.remove("hidden");
  fetch(`/api/posts/${id}`).then(r => r.json()).then(post => {
    document.getElementById("edit-title").value = post.title;
    document.getElementById("edit-content").value = post.content;
    loadCategories("edit-category");
    const sel = document.getElementById("edit-category");
    fetch("/api/categories").then(r => r.json()).then(cats => {
      const match = cats.find(c => c.slug === post.category_slug);
      if (match) sel.value = match.id;
    }).catch(() => {});
  }).catch(() => showAlertModal("게시글을 불러오지 못했습니다."));
}

function showProfile(username) {
  currentProfileUsername = username;
  hideAllViews();
  document.getElementById("view-profile").classList.remove("hidden");
  loadProfile(username);
}

function hideAllViews() {
  ["view-list", "view-write", "view-detail", "view-edit", "view-profile"].forEach(id => {
    document.getElementById(id).classList.add("hidden");
  });
}

function formatDate(str) {
  const d = new Date(str);
  const pad = n => String(n).padStart(2, "0");
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function escHtml(str) {
  return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function highlightText(text, query) {
  if (!query) return escHtml(text);
  const escaped = escHtml(text);
  const q = escHtml(query);
  const regex = new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})`, "gi");
  return escaped.replace(regex, '<span class="highlight">$1</span>');
}

function memberBadge(isMember) { return isMember ? '<span class="member-badge">회원</span>' : ""; }

function isCurrentUserAdmin() { return currentUser && currentUser.isAdmin; }

function loadPosts(page) {
  const container = document.getElementById("posts-container");
  const pagination = document.getElementById("pagination");
  container.innerHTML = '<div class="loading">불러오는 중...</div>';
  pagination.innerHTML = "";

  const p = page || currentPage;
  const search = document.getElementById("search-input").value.trim();
  currentSearch = search;
  currentPage = p;

  let url = `/api/posts?page=${p}&limit=10&sort=${currentSort}`;
  if (search) url += `&search=${encodeURIComponent(search)}`;
  if (currentCategory) url += `&category=${currentCategory}`;

  fetch(url).then(r => r.json()).then(data => {
    document.getElementById("post-count").textContent = data.total;
    if (data.posts.length === 0) {
      container.innerHTML = '<div class="empty">게시글이 없습니다.</div>';
      return;
    }
    container.innerHTML = data.posts.map(post => `
      <div class="post-item" onclick="showDetail(${post.id})">
        <div>
          <div class="post-item-title">
            ${post.is_pinned ? '<span class="pin-badge">📌</span> ' : ""}
            ${highlightText(post.title, search)}
          </div>
          <div class="post-item-meta">
            ${memberBadge(post.is_member)}
            <span onclick="event.stopPropagation();showProfile('${escHtml(post.username)}')" class="username-link">${escHtml(post.username || "익명")}</span>
            ${post.category_name ? `<span class="category-label">${post.category_name}</span>` : ""}
            &nbsp;·&nbsp;${formatDate(post.created_at)}
            &nbsp;·&nbsp;조회 ${post.views}
            &nbsp;·&nbsp;👍 ${post.like_count}
          </div>
        </div>
        <div class="post-item-right">
          <div class="post-item-comments">${post.comment_count}</div>
        </div>
      </div>
    `).join("");
    renderPagination(data);
  }).catch(() => { container.innerHTML = '<div class="empty error-msg">게시글을 불러오지 못했습니다.</div>'; });
}

function renderPagination(data) {
  const pagination = document.getElementById("pagination");
  const { page, totalPages } = data;
  if (totalPages <= 1) { pagination.innerHTML = ""; return; }
  let html = `<button class="page-btn" onclick="goToPage(${page - 1})" ${page <= 1 ? "disabled" : ""}>←</button>`;
  const start = Math.max(1, page - 2);
  const end = Math.min(totalPages, page + 2);
  if (start > 1) {
    html += `<button class="page-btn" onclick="goToPage(1)">1</button>`;
    if (start > 2) html += '<span class="page-btn" style="cursor:default">…</span>';
  }
  for (let i = start; i <= end; i++)
    html += `<button class="page-btn${i === page ? " active" : ""}" onclick="goToPage(${i})">${i}</button>`;
  if (end < totalPages) {
    if (end < totalPages - 1) html += '<span class="page-btn" style="cursor:default">…</span>';
    html += `<button class="page-btn" onclick="goToPage(${totalPages})">${totalPages}</button>`;
  }
  html += `<button class="page-btn" onclick="goToPage(${page + 1})" ${page >= totalPages ? "disabled" : ""}>→</button>`;
  pagination.innerHTML = html;
}

function goToPage(page) { currentPage = page; loadPosts(page); window.scrollTo({ top: 0, behavior: "smooth" }); }

function searchPosts() { currentPage = 1; loadPosts(1); }

function loadPost(id) {
  const detail = document.getElementById("post-detail");
  const comments = document.getElementById("comments-container");
  detail.innerHTML = '<div class="loading">불러오는 중...</div>';
  comments.innerHTML = "";

  fetch(`/api/posts/${id}`).then(r => r.json()).then(post => {
    detail.innerHTML = `
      <div class="post-card">
        <div class="post-card-title">${post.is_pinned ? '<span class="pin-badge">📌</span> ' : ""}${escHtml(post.title)}</div>
        <div class="post-card-meta">
          ${memberBadge(post.is_member)}
          <span onclick="showProfile('${escHtml(post.username)}')" class="username-link">${escHtml(post.username || "익명")}</span>
          ${post.category_name ? `<span class="category-label">${post.category_name}</span>` : ""}
          &nbsp;·&nbsp;${formatDate(post.created_at)}
          &nbsp;·&nbsp;조회 ${post.views}
        </div>
        <div class="post-card-content">${escHtml(post.content)}</div>
      </div>
    `;

    const cList = post.comments || [];
    document.getElementById("comment-count").textContent = cList.length;
    comments.innerHTML = cList.length === 0
      ? '<div class="empty">아직 댓글이 없습니다.</div>'
      : cList.map(c => `
        <div class="comment-item">
          <div class="comment-item-body">
            <div class="comment-item-header">
              <span class="comment-username">${memberBadge(c.is_member)}<span onclick="showProfile('${escHtml(c.username)}')" class="username-link">${escHtml(c.username || "익명")}</span></span>
              <span class="comment-date">${formatDate(c.created_at)}</span>
            </div>
            <div class="comment-content">${escHtml(c.content)}</div>
          </div>
          <button class="comment-delete-btn" onclick="deleteComment(${c.id})" title="삭제">✕</button>
        </div>
      `).join("");

    document.getElementById("like-count").textContent = post.like_count || 0;
    const likeIcon = document.getElementById("like-icon");
    likeIcon.textContent = post.hasLiked ? "♥" : "♡";
    likeIcon.style.color = post.hasLiked ? "var(--red)" : "var(--text2)";
    document.getElementById("btn-like").classList.toggle("liked", post.hasLiked);

    const pinBtn = document.getElementById("btn-pin");
    if (isCurrentUserAdmin()) {
      pinBtn.classList.remove("hidden");
      pinBtn.textContent = post.is_pinned ? "📌 고정 해제" : "📌 고정";
    } else {
      pinBtn.classList.add("hidden");
    }
  }).catch(() => { detail.innerHTML = '<div class="empty error-msg">게시글을 불러오지 못했습니다.</div>'; });
}

function toggleLike() {
  if (!currentUser) { showAlertModal("로그인이 필요합니다"); return; }
  authFetch(`/api/posts/${currentPostId}/like`, { method: "POST" })
    .then(r => { if (!r.ok) return r.json().then(e => Promise.reject(e.error)); return r.json(); })
    .then(data => {
      document.getElementById("like-count").textContent = data.likeCount;
      const icon = document.getElementById("like-icon");
      icon.textContent = data.liked ? "♥" : "♡";
      icon.style.color = data.liked ? "var(--red)" : "var(--text2)";
      document.getElementById("btn-like").classList.toggle("liked", data.liked);
    }).catch(err => showAlertModal(typeof err === "string" ? err : "요청 실패"));
}

function togglePin() {
  authFetch(`/api/posts/${currentPostId}/pin`, { method: "PUT" })
    .then(r => { if (!r.ok) return r.json().then(e => Promise.reject(e.error)); return r.json(); })
    .then(data => {
      const btn = document.getElementById("btn-pin");
      btn.textContent = data.is_pinned ? "📌 고정 해제" : "📌 고정";
      loadPost(currentPostId);
    }).catch(err => showAlertModal(typeof err === "string" ? err : "요청 실패"));
}

function submitPost() {
  const category_id = document.getElementById("write-category").value;
  const title = document.getElementById("write-title").value.trim();
  const content = document.getElementById("write-content").value.trim();

  if (!title || !content) { showAlertModal("제목과 내용을 입력해주세요."); return; }

  authFetch("/api/posts", { method: "POST", body: JSON.stringify({ title, content, category_id: category_id || undefined }) })
    .then(r => { if (!r.ok) return r.json().then(e => Promise.reject(e.error)); return r.json(); })
    .then(data => { showDetail(data.id); })
    .catch(err => showAlertModal(typeof err === "string" ? err : "게시글 작성에 실패했습니다."));
}

function updatePost() {
  const category_id = document.getElementById("edit-category").value;
  const title = document.getElementById("edit-title").value.trim();
  const content = document.getElementById("edit-content").value.trim();

  if (!title || !content) { showAlertModal("제목과 내용을 입력해주세요."); return; }

  authFetch(`/api/posts/${currentPostId}`, { method: "PUT", body: JSON.stringify({ title, content, category_id: category_id || undefined }) })
    .then(r => { if (!r.ok) return r.json().then(e => Promise.reject(e.error)); return r.json(); })
    .then(() => showDetail(currentPostId))
    .catch(err => showAlertModal(typeof err === "string" ? err : "게시글 수정에 실패했습니다."));
}

async function deletePost() {
  if (isCurrentUserAdmin()) {
    const ok = await showConfirmModal("관리자 권한으로 이 게시글을 삭제하시겠습니까?");
    if (!ok) return;
  } else {
    const ok = await showConfirmModal("이 게시글을 삭제하시겠습니까?");
    if (!ok) return;
  }

  try {
    const r = await authFetch(`/api/posts/${currentPostId}`, { method: "DELETE" });
    if (!r.ok) {
      const e = await r.json();
      throw e.error;
    }
    await r.json();
    showList();
  } catch (err) {
    showAlertModal(typeof err === "string" ? err : "게시글 삭제에 실패했습니다.");
  }
}

function submitComment() {
  if (!currentUser) { showAuthModal("signup"); return; }
  const content = document.getElementById("comment-content").value.trim();
  if (!content) { showAlertModal("댓글 내용을 입력해주세요."); return; }

  authFetch(`/api/posts/${currentPostId}/comments`, { method: "POST", body: JSON.stringify({ content }) })
    .then(r => { if (!r.ok) return r.json().then(e => Promise.reject(e.error)); return r.json(); })
    .then(() => { document.getElementById("comment-content").value = ""; loadPost(currentPostId); })
    .catch(err => showAlertModal(typeof err === "string" ? err : "댓글 작성에 실패했습니다."));
}

async function deleteComment(commentId) {
  if (isCurrentUserAdmin()) {
    const ok = await showConfirmModal("관리자 권한으로 이 댓글을 삭제하시겠습니까?");
    if (!ok) return;
  } else {
    const ok = await showConfirmModal("이 댓글을 삭제하시겠습니까?");
    if (!ok) return;
  }

  try {
    const r = await authFetch(`/api/comments/${commentId}`, { method: "DELETE" });
    if (!r.ok) {
      const e = await r.json();
      throw e.error;
    }
    await r.json();
    loadPost(currentPostId);
  } catch (err) {
    showAlertModal(typeof err === "string" ? err : "댓글 삭제에 실패했습니다.");
  }
}

function showMyPage() {
  if (currentUser) showProfile(currentUser.username);
}

function switchProfileTab(tab) {
  document.getElementById("profile-posts").classList.toggle("hidden", tab !== "posts");
  document.getElementById("profile-comments").classList.toggle("hidden", tab !== "comments");
  document.getElementById("profile-settings").classList.toggle("hidden", tab !== "settings");
  document.getElementById("profile-pagination").classList.toggle("hidden", tab !== "posts" && tab !== "comments");
  document.getElementById("ptab-posts").classList.toggle("active", tab === "posts");
  document.getElementById("ptab-comments").classList.toggle("active", tab === "comments");
  document.getElementById("ptab-settings").classList.toggle("active", tab === "settings");

  if (tab === "comments") loadProfileComments(currentProfileUsername, 1);
  if (tab === "posts") loadProfilePosts(currentProfileUsername, 1);
  if (tab === "settings") loadSettingsInfo(currentProfileUsername);
}

function loadProfile(username) {
  currentProfileUsername = username;
  const header = document.getElementById("profile-header");
  const pagination = document.getElementById("profile-pagination");
  pagination.innerHTML = "";

  document.getElementById("profile-posts").innerHTML = '<div class="loading">불러오는 중...</div>';
  document.getElementById("profile-comments").innerHTML = "";

  const isMyPage = currentUser && currentUser.username === username;

  fetch(`/api/users/${encodeURIComponent(username)}`).then(r => r.json()).then(user => {
    header.innerHTML = `
      <div class="profile-card">
        <div class="profile-avatar">${escHtml(user.username.charAt(0).toUpperCase())}</div>
        <div class="profile-info">
          <div class="profile-name">
            ${escHtml(user.username)}
            ${user.is_admin ? '<span class="admin-badge">관리자</span>' : ""}
          </div>
          <div class="profile-stats">
            <span>가입: ${formatDate(user.created_at)}</span>
            <span>글 ${user.post_count}개</span>
            <span>댓글 ${user.comment_count}개</span>
          </div>
        </div>
      </div>
    `;

    const tabContainer = document.querySelector(".profile-tabs");
    if (tabContainer) {
      if (isMyPage) {
        tabContainer.classList.remove("hidden");
      } else {
        tabContainer.classList.add("hidden");
      }
    }

    switchProfileTab("posts");
    loadProfilePosts(username, 1);
  }).catch(() => { header.innerHTML = '<div class="empty error-msg">사용자를 찾을 수 없습니다.</div>'; });
}

function loadProfilePosts(username, page) {
  const container = document.getElementById("profile-posts");
  const pagination = document.getElementById("profile-pagination");
  container.innerHTML = '<div class="loading">불러오는 중...</div>';

  fetch(`/api/users/${encodeURIComponent(username)}/posts?page=${page}`).then(r => r.json()).then(data => {
    if (data.posts.length === 0) {
      container.innerHTML = '<div class="empty">작성한 글이 없습니다.</div>';
      return;
    }
    container.innerHTML = data.posts.map(post => `
      <div class="post-item" onclick="showDetail(${post.id})">
        <div>
          <div class="post-item-title">${escHtml(post.title)}</div>
          <div class="post-item-meta">
            ${post.category_name ? `<span class="category-label">${post.category_name}</span>` : ""}
            &nbsp;·&nbsp;${formatDate(post.created_at)}
            &nbsp;·&nbsp;조회 ${post.views}
            &nbsp;·&nbsp;👍 ${post.like_count}
          </div>
        </div>
        <div class="post-item-right">
          <div class="post-item-comments">${post.comment_count}</div>
        </div>
      </div>
    `).join("");
    renderProfilePagination(data, "posts");
  }).catch(() => { container.innerHTML = '<div class="empty error-msg">불러오지 못했습니다.</div>'; });
}

function loadProfileComments(username, page) {
  const container = document.getElementById("profile-comments");
  const pagination = document.getElementById("profile-pagination");
  container.innerHTML = '<div class="loading">불러오는 중...</div>';

  fetch(`/api/users/${encodeURIComponent(username)}/comments?page=${page}`).then(r => r.json()).then(data => {
    if (data.comments.length === 0) {
      container.innerHTML = '<div class="empty">작성한 댓글이 없습니다.</div>';
      return;
    }
    container.innerHTML = data.comments.map(c => `
      <div class="my-comment-item">
        <div class="my-comment-body">
          <div class="my-comment-content">${escHtml(c.content)}</div>
          <div class="my-comment-meta">
            <span class="my-comment-post" onclick="showDetail(${c.post_id})">${escHtml(c.post_title || "(삭제된 글)")}</span>
            &nbsp;·&nbsp;${formatDate(c.created_at)}
          </div>
        </div>
      </div>
    `).join("");
    renderProfilePagination(data, "comments");
  }).catch(() => { container.innerHTML = '<div class="empty error-msg">불러오지 못했습니다.</div>'; });
}

function renderProfilePagination(data, tab) {
  const pagination = document.getElementById("profile-pagination");
  if (data.totalPages <= 1) { pagination.innerHTML = ""; return; }
  let html = "";
  for (let i = 1; i <= data.totalPages; i++) {
    html += `<button class="page-btn${i === data.page ? ' active' : ''}" onclick="profilePageGo(${i}, '${tab}')">${i}</button>`;
  }
  pagination.innerHTML = html;
}

function profilePageGo(page, tab) {
  if (tab === "comments") loadProfileComments(currentProfileUsername, page);
  else loadProfilePosts(currentProfileUsername, page);
  window.scrollTo({ top: document.getElementById("profile-header").offsetTop - 80, behavior: "smooth" });
}

function changePassword() {
  const currentPassword = document.getElementById("pw-current").value;
  const newPassword = document.getElementById("pw-new").value;
  const confirm = document.getElementById("pw-confirm").value;
  const errorEl = document.getElementById("pw-error");
  const successEl = document.getElementById("pw-success");
  errorEl.classList.add("hidden");
  successEl.classList.add("hidden");

  if (!currentPassword || !newPassword || !confirm) {
    errorEl.textContent = "모든 항목을 입력하세요"; errorEl.classList.remove("hidden"); return;
  }
  if (newPassword.length < 4) {
    errorEl.textContent = "새 비밀번호는 4자 이상 입력하세요"; errorEl.classList.remove("hidden"); return;
  }
  if (newPassword !== confirm) {
    errorEl.textContent = "새 비밀번호가 일치하지 않습니다"; errorEl.classList.remove("hidden"); return;
  }

  authFetch("/api/auth/password", {
    method: "PUT",
    body: JSON.stringify({ currentPassword, newPassword }),
  })
    .then(r => { if (!r.ok) return r.json().then(e => Promise.reject(e.error)); return r.json(); })
    .then(data => {
      successEl.textContent = data.message; successEl.classList.remove("hidden");
      document.getElementById("pw-current").value = "";
      document.getElementById("pw-new").value = "";
      document.getElementById("pw-confirm").value = "";
    })
    .catch(err => {
      errorEl.textContent = typeof err === "string" ? err : "비밀번호 변경에 실패했습니다";
      errorEl.classList.remove("hidden");
    });
}

function loadSettingsInfo(username) {
  fetch(`/api/users/${encodeURIComponent(username)}`).then(r => r.json()).then(user => {
    document.getElementById("settings-userinfo").innerHTML = `
      <div class="settings-info-row"><span class="settings-info-label">닉네임</span><span class="settings-info-value">${escHtml(user.username)} ${user.is_admin ? '<span class="admin-badge">관리자</span>' : ""}</span></div>
      <div class="settings-info-row"><span class="settings-info-label">가입일</span><span class="settings-info-value">${formatDate(user.created_at)}</span></div>
      <div class="settings-info-row"><span class="settings-info-label">작성 글</span><span class="settings-info-value">${user.post_count}개</span></div>
      <div class="settings-info-row"><span class="settings-info-label">작성 댓글</span><span class="settings-info-value">${user.comment_count}개</span></div>
    `;
  }).catch(() => {});
}

async function deleteAccount() {
  if (!currentUser) return;
  if (currentUser.isAdmin) {
    showAlertModal("관리자 계정은 탈퇴할 수 없습니다.");
    return;
  }
  const confirm1 = await showPromptModal("회원탈퇴를 진행하려면 '탈퇴합니다'를 입력하세요:", "");
  if (confirm1 !== "탈퇴합니다") return;
  const confirm2 = await showPromptModal("정말 탈퇴하시겠습니까? 모든 데이터가 삭제됩니다. 비밀번호를 입력하세요:", "비밀번호 입력", true);
  if (!confirm2) return;

  try {
    const loginR = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: currentUser.username, password: confirm2 }),
    });
    if (!loginR.ok) throw "비밀번호가 일치하지 않습니다";
    const delR = await authFetch(`/api/users/${encodeURIComponent(currentUser.username)}`, { method: "DELETE" });
    if (!delR.ok) {
      const e = await delR.json();
      throw e.error;
    }
    await delR.json();
    logout();
    showList();
    showAlertModal("탈퇴가 완료되었습니다.");
  } catch (err) {
    if (typeof err === "string") {
      if (err === "비밀번호가 일치하지 않습니다") {
        document.getElementById("delete-error").textContent = err;
        document.getElementById("delete-error").classList.remove("hidden");
      } else {
        showAlertModal(typeof err === "string" ? err : "탈퇴 처리 중 오류가 발생했습니다.");
      }
    } else {
      showAlertModal("탈퇴 처리 중 오류가 발생했습니다.");
    }
  }
}

document.addEventListener("DOMContentLoaded", () => {
  restoreSession();
  showList();
});
