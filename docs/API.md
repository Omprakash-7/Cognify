# Cognify API Documentation (Phases 1–4)

This document specifies the REST and Server-Sent Events (SSE) API implemented in Cognify across Phases 1 through 4.

## General Conventions
- **Base URL**: `/api`
- **Data Format**: JSON (`application/json`)
- **Authentication**: JWT stored in `cognify_token` HTTP-only cookie (`SameSite=Lax`, `Secure` in production).
- **Multi-Tenancy**: Tenant (`institute_id`) and user role are strictly derived from the verified JWT. Cross-institute or non-member access returns `404 Not Found`.
- **Error Response Format**:
  ```json
  {
    "error": {
      "code": "ERROR_CODE",
      "message": "Human readable explanation"
    }
  }
  ```

---

## 1. Authentication & Users

### `POST /api/auth/login`
- **Roles**: Public
- **Request Body**:
  ```json
  {
    "email": "user@example.com",
    "password": "Password123!"
  }
  ```
- **Response `200`**: Sets HTTP-only cookie `cognify_token`.
  ```json
  {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "fullName": "User Name",
      "role": "admin" | "teacher" | "student",
      "instituteId": "uuid"
    }
  }
  ```
- **Error Codes**: `400 INVALID_JSON`, `401 INVALID_CREDENTIALS`, `429 RATE_LIMIT_EXCEEDED` (max 5 fails / 15m).

### `POST /api/auth/logout`
- **Roles**: Authenticated
- **Response `200`**: Clears `cognify_token` cookie.
  ```json
  { "success": true }
  ```

### `GET /api/auth/me`
- **Roles**: Authenticated
- **Response `200`**: Current user profile from DB.
- **Error Codes**: `401 UNAUTHORIZED`.

### `POST /api/users`
- **Roles**: Admin
- **Request Body**:
  ```json
  {
    "email": "teacher@example.com",
    "password": "Password123!",
    "fullName": "Teacher Name",
    "role": "teacher" | "student"
  }
  ```
- **Response `201`**: User created.
- **Error Codes**: `403 FORBIDDEN`, `409 EMAIL_EXISTS`, `422 VALIDATION_ERROR`.

### `GET /api/users?role=`
- **Roles**: Admin, Teacher (scoped to caller's institute)
- **Response `200`**:
  ```json
  {
    "users": [
      { "id": "uuid", "email": "...", "fullName": "...", "role": "..." }
    ]
  }
  ```

---

## 2. Batches & Members

### `GET /api/batches`
- **Roles**: Authenticated
  - Admin: all batches in institute
  - Teacher / Student: batches where caller is a member
- **Response `200`**: `{ "batches": [...] }`

### `POST /api/batches`
- **Roles**: Admin, Teacher
- **Request Body**:
  ```json
  {
    "name": "Physics Batch A",
    "subject": "Physics"
  }
  ```
- **Response `201`**: Batch created (caller automatically enrolled as teacher).

### `GET /api/batches/[id]`
- **Roles**: Member of batch, or Admin in same institute
- **Response `200`**: Batch details with member list.
- **Error Codes**: `404 NOT_FOUND` (non-member or cross-institute).

### `POST /api/batches/[id]/members`
- **Roles**: Admin (can add teachers or students), Teacher in batch (students only)
- **Request Body**:
  ```json
  {
    "userId": "uuid",
    "role": "student" | "teacher"
  }
  ```
- **Response `201`**: `{ "success": true }`

### `DELETE /api/batches/[id]/members/[userId]`
- **Roles**: Admin, Teacher in batch
- **Rules**: Teachers can only remove students; cannot remove the last teacher in a batch.

---

## 3. Documents & Uploads

### `POST /api/batches/[id]/documents`
- **Roles**: Admin, Teacher in batch
- **Request Body**:
  ```json
  {
    "fileName": "lecture1.pdf",
    "fileType": "pdf" | "pptx" | "docx" | "txt",
    "sizeBytes": 1048576,
    "title": "Lecture 1: Kinematics"
  }
  ```
- **Response `201`**:
  ```json
  {
    "document": { "id": "uuid", "status": "pending_upload", ... },
    "uploadUrl": "https://storage.../signed-upload-url"
  }
  ```
- **Error Codes**: `400 INVALID_TYPE`, `413 PAYLOAD_TOO_LARGE` (>25MB), `404 NOT_FOUND`.

### `POST /api/documents/[id]/complete`
- **Roles**: Admin, Teacher in batch
- **Response `200`**: Validates file uploaded in storage, updates document status to `queued`, and enqueues `process_document` job for background worker.

### `GET /api/batches/[id]/documents`
- **Roles**: Batch member or Admin
- **Query Params**: `?limit=50&offset=0`
- **Response `200`**: `{ "documents": [...] }`

### `GET /api/documents/[id]`
- **Roles**: Batch member or Admin
- **Response `200`**: Document metadata and processing status.

### `GET /api/documents/[id]/file`
- **Roles**: Batch member or Admin
- **Response `200`**: Generates a temporary signed download URL (default expiry 300s).
  ```json
  { "signedUrl": "https://storage.../signed-download-url" }
  ```

### `POST /api/documents/[id]/generate`
- **Roles**: Admin, Teacher in batch
- **Request Body**:
  ```json
  {
    "types": ["summary", "notes", "key_points", "quiz", "flashcards"]
  }
  ```
- **Response `200`**: Enqueues generation jobs for the worker.
  ```json
  {
    "ok": true,
    "queued": [
      { "id": "uuid", "jobType": "generate_notes" },
      { "id": "uuid", "jobType": "generate_quiz" },
      { "id": "uuid", "jobType": "generate_flashcards" }
    ]
  }
  ```

### `POST /api/documents/[id]/reprocess`
- **Roles**: Admin, Teacher in batch
- **Response `200`**: Resets document status to `processing`, marks existing `generated_items` as `is_stale = true`, and enqueues new `process_document` job.

### `DELETE /api/documents/[id]`
- **Roles**: Admin, Teacher in batch
- **Response `200`**: Deletes document record, associated chunks, jobs, and storage file.

---

## 4. Cited Chat (Server-Sent Events)

### `POST /api/batches/[id]/chat`
- **Roles**: Batch member or Admin
- **Request Body**:
  ```json
  {
    "question": "What is Newton's Second Law according to classical mechanics?"
  }
  ```
- **Rate Limit**: Default `30` queries per hour per user (`429 RATE_LIMIT_EXCEEDED`).
- **Response Headers**:
  ```
  Content-Type: text/event-stream; charset=utf-8
  Cache-Control: no-cache, no-transform
  Connection: keep-alive
  ```
- **SSE Stream Protocol**:
  1. `meta`: Emitted first with retrieved sources
     ```
     event: meta
     data: {"citations":[{"n":1,"documentId":"uuid","title":"Laws of Motion","page":1,"fileType":"pdf","snippet":"Newton's Second Law states that..."}]}
     ```
  2. `token`: Emitted repeatedly as text chunks stream from Gemini
     ```
     event: token
     data: {"token":"Force equals mass times acceleration [1]."}
     ```
  3. `replace` *(conditional)*: Emitted if the response lacked valid `[n]` citations or was ungrounded
     ```
     event: replace
     data: {"text":"I couldn't find this in your batch's study material. You can raise a doubt ticket for your teacher."}
     ```
  4. `done`: Emitted at stream completion
     ```
     event: done
     data: {"messageId":"uuid","grounded":true}
     ```

### `GET /api/batches/[id]/chat/history`
- **Roles**: Batch member or Admin
- **Query Params**: `?limit=50&offset=0`
- **Isolation Rule**: Strictly returns ONLY the authenticated caller's own messages. Other students/teachers cannot view peer chat sessions.
- **Response `200`**:
  ```json
  {
    "messages": [
      {
        "id": "uuid",
        "role": "user" | "assistant",
        "content": "...",
        "citations": [...],
        "createdAt": "2026-11-20T22:00:00Z"
      }
    ],
    "pagination": { "total": 12, "limit": 50, "offset": 0 }
  }
  ```
