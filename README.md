# BSSM 커뮤니티

Docker Compose 기반 Express + MySQL 커뮤니티 사이트

모두가 즐길 수 있는 온라인 커뮤니티 사이트를 만들고 싶었다.

BSSM Community BY 김세영, 김리원

---

## 팀별 기여 분야

| 이름 | 역할 |
|------|------|
| **김세영** | 메인 개발 (서버/클라이언트 전반, API, DB 설계, 인프라) |
| **김리원** | 디자인 (UI/UX, 스타일링, 반응형, Markdown 툴바) |

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

## 어려웠던 점 및 해결 방법

### 1. Express 5 호환성 문제
Express 5 beta를 사용하면서 helmet, rate-limit 등 미들웨어와의 버전 충돌이 발생했다. Helmet CSP를 세밀하게 설정하고, CORS와의 정책 불일치를 수정하는 데 시간이 걸렸다.

### 2. 콜백 지옥 (Callback Hell)
코드 전체가 중첩 콜백 7~8레벨로 작성되어 있어 가독성과 에러 처리에 어려움이 있었다. `return res.status(...)` 패턴으로 조기 종료를 일관되게 적용했으나, async/await 리팩터링은 추후 과제로 남겼다.

### 3. 마이그레이션 시스템 자체 구현
초기 스키마 이후 컬럼 추가가 필요했는데, `information_schema.COLUMNS`를 조회해 컬럼 존재 여부를 확인하고 ALTER TABLE을 실행하는 자체 마이그레이션을 구현했다. 롤백이 없고 시작 시마다 실행된다는 한계가 있다.

### 4. Socket.IO 인증 처리
WebSocket 연결 시 JWT를 쿼리 파라미터로 전달해야 해서 보안 고민이 있었다. query보다는 `auth` 핸드셰이크를 사용하는 것이 더 안전하지만, 학습 단계에서는 쿼리 방식으로 충분했다.

### 5. SPA Hash 라우팅
직접 SPA 라우터를 구현하면서 뒤로가기/앞으로가기 지원과 무한 루프 방지(`updatingHash` 플래그)를 처리해야 했다. 라우터 라이브러리 없이 구현하다 보니 상태 직렬화와 URL 복원 로직이 복잡해졌다.

### 6. Docker DNS 장애
`docker-compose`에서 `db` 호스트를 찾지 못하는 문제가 발생해 `dns: [8.8.8.8, 8.8.4.4]`를 명시적으로 지정했다.

### 7. 관리자 구분 방식
DB에 역할(role) 컬럼 없이 `ADMIN_USERNAME` 환경변수와의 단순 비교로 관리자를 판별했다. 이 방식은 간단하지만 확장에 불리하고, username 변경 시 관리자 식별이 깨질 위험이 있다.

### 8. 실시간 채팅방 내 알림 억제
같은 채팅방에 있을 때 새 메시지 알림이 뜨는 UX 문제가 있었다. `connectNotifSocket()`에서 `currentRoomId`를 비교해 채팅 알림을 조건부로 무시하도록 처리했다.

### 9. 이미지 업로드 보안
multer의 확장자 필터만으로는 `.exe`를 `.png`로 위장한 파일을 막을 수 없어, MIME 타입 검증을 추가로 적용해야 하는 과제가 남았다.

### 10. 자동 저장(Draft) 기능
10초 간격으로 `localStorage`에 글을 저장하는 과정에서 용량 제한이나 여러 draft 지원 없이 단순하게 구현했다. 추후 개선이 필요하다.

