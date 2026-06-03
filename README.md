# BSSM 커뮤니티

Docker Compose 기반 Express + MySQL 커뮤니티 사이트 (포트폴리오 / 발표용)

---

## 주요 기능

| 기능 | 설명 |
|------|------|
| **회원 인증** | 회원가입 / 로그인 (JWT), 비밀번호 변경, 회원 탈퇴 |
| **게시판** | 카테고리별 게시판 (자유/질문/정보/잡담), Markdown 작성, 검색/정렬/페이징 |
| **댓글 / 좋아요** | 게시글 댓글, 좋아요 토글 |
| **관리자** | 공지사항 등록 (시드), 게시글 고정/삭제 |
| **팔로우** | 사용자 팔로우/언팔로우 |
| **1:1 채팅** | Socket.IO 실시간 채팅, 말풍선 UI |
| **알림** | 댓글/좋아요/채팅 알림, 읽음 처리, 실시간 푸시 |
| **Markdown** | 툴바 + marked + DOMPurify 렌더링, 이미지 업로드 |

## 기술 스택

```
Frontend     HTML + CSS + Vanilla JS (SPA, hash routing)
Backend      Express 5 + mysql2 + JWT + Socket.IO
Database     MySQL 8.0
Infra        Docker Compose
```

## 실행 방법

```bash
git clone <repo-url>
cd teamP

# 환경 변수 설정
cp .env.example .env
# 필요시 .env 수정 (ADMIN_PASSWORD, JWT_SECRET 등)

# 실행
docker compose up -d

# 접속
open http://localhost:3000

# 관리자 로그인
# username: admin (또는 .env의 ADMIN_USERNAME)
# password: admin123 (또는 .env의 ADMIN_PASSWORD)
```

## 포트

| 포트 | 용도 |
|------|------|
| `3000` | 웹 서버 (Express + Socket.IO) |
| `3307` | MySQL (호스트 → 컨테이너) |

## 프로젝트 구조

```
teamP/
├── .env               # 환경 변수 (gitignore)
├── docker-compose.yml # 서비스 정의
├── mysql/
│   ├── Dockerfile
│   ├── init.sql       # 초기 스키마
│   └── conf/my.cnf    # MySQL 설정
└── web/
    ├── Dockerfile
    ├── api/
    │   ├── server.js  # Express + Socket.IO 서버
    │   └── package.json
    └── src/
        ├── index.html # SPA 템플릿
        ├── app.js     # 클라이언트 로직
        └── style.css  # 스타일
```

## API 엔드포인트

### 인증
```
POST   /api/auth/signup
POST   /api/auth/login
GET    /api/auth/me
PUT    /api/auth/password
DELETE /api/auth/account
```

### 게시글
```
GET    /api/posts
GET    /api/posts/:id
POST   /api/posts
PUT    /api/posts/:id
DELETE /api/posts/:id
POST   /api/posts/:id/like
PUT    /api/posts/:id/pin       (admin only)
```

### 댓글
```
POST   /api/posts/:id/comments
DELETE /api/comments/:id
```

### 사용자
```
GET    /api/users/:username
GET    /api/users/:username/posts
GET    /api/users/:username/comments
POST   /api/users/:username/follow
```

### 채팅
```
POST   /api/chat/rooms/:username
GET    /api/chat/rooms
GET    /api/chat/rooms/:id/messages
POST   /api/chat/rooms/:id/messages
```

### 알림
```
GET    /api/notifications
GET    /api/notifications/unread-count
POST   /api/notifications/read
POST   /api/notifications/read-all
```

### 기타
```
GET    /api/categories
POST   /api/upload              (이미지 업로드)
```

## 주요 UX 특징

- **SPA + Hash 라우팅**: 뒤로가기/앞으로가기 지원
- **실시간 채팅**: Socket.IO WebSocket, 채팅방 내 알림 억제
- **실시간 알림**: Socket.IO user room, 뱃지 업데이트
- **커스텀 모달**: alert/confirm/prompt → dialog 모달 대체
- **토스트**: 성공/에러 메시지 하단 표시 (3초 자동 소멸)
- **반응형**: 600px 브레이크포인트 모바일 대응
- **Markdown 툴바**: B/I/링크/이미지/코드블록/리스트

