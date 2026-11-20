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

---

## 5. Item Review & Content Management

### `GET /api/documents/[id]/items`
- **Roles**: Batch member or Admin
- **Visibility**:
  - Teachers / Admins: sees all items (draft, approved, rejected, stale).
  - Students: approved and non-stale items only (`correctIndex` stripped for quizzes).
- **Response `200`**: `{ "items": [...] }`

### `GET /api/batches/[id]/items?type=`
- **Roles**: Batch member or Admin
- **Query Params**: `?type=summary|notes|key_points|quiz|flashcards`
- **Visibility**: Same student vs teacher rules.
- **Response `200`**: `{ "items": [...] }`

### `GET /api/items/[id]`
- **Roles**: Batch member or Admin
- **Visibility**: Students can only view approved, non-stale items (`correctIndex` stripped).
- **Response `200`**: `{ "item": { ... } }`

### `PATCH /api/items/[id]`
- **Roles**: Admin, Teacher in batch
- **Request Body**: `{ "title": "New Title", "content": { ... } }` (validated against item type Zod schema).
- **Response `200`**: `{ "item": { ... } }`

### `POST /api/items/[id]/approve`
- **Roles**: Admin, Teacher in batch
- **Response `200`**: Updates item `status='approved'`, records `reviewed_by` and `reviewed_at`.

### `POST /api/items/[id]/reject`
- **Roles**: Admin, Teacher in batch
- **Response `200`**: Updates item `status='rejected'`, records `reviewed_by` and `reviewed_at`.

### `DELETE /api/items/[id]`
- **Roles**: Admin, Teacher in batch
- **Rules**: Only draft items can be deleted (returns 400 if item is approved/rejected).
- **Response `200`**: `{ "ok": true }`

---

## 6. Student Quizzes & Progress API

### `GET /api/quizzes/[id]`
- **Roles**: Batch member or Admin
- **Rules**: Approved quizzes only for students. Questions return WITHOUT `correctIndex` or `explanation` to prevent cheating.
- **Response `200`**:
  ```json
  {
    "quiz": {
      "id": "uuid",
      "title": "Laws of Motion Quiz",
      "questions": [
        {
          "question": "What is Newton's Second Law?",
          "options": ["F = ma", "E = mc^2", "V = IR", "P = IV"],
          "difficulty": "easy",
          "sourcePage": 1
        }
      ]
    }
  }
  ```

### `POST /api/quizzes/[id]/attempt`
- **Roles**: Student, Teacher, Admin in batch
- **Request Body**:
  ```json
  {
    "answers": [0, 1, null, 2]
  }
  ```
- **Rules**: Server-side scoring verifies answers against `correctIndex`. Persists attempt to `quiz_attempts`.
- **Response `200`**:
  ```json
  {
    "attemptId": "uuid",
    "score": 3,
    "total": 4,
    "results": [
      {
        "correct": true,
        "correctIndex": 0,
        "explanation": "F = ma relates force and acceleration.",
        "sourcePage": 1
      }
    ]
  }
  ```

### `GET /api/me/attempts`
- **Roles**: Authenticated caller
- **Response `200`**: List of caller's own quiz attempts with scores and timestamps.

### `GET /api/me/progress`
- **Roles**: Authenticated caller
- **Response `200`**:
  ```json
  {
    "progress": [
      {
        "quizId": "uuid",
        "quizTitle": "Laws of Motion Quiz",
        "bestScore": 4,
        "lastScore": 3,
        "totalQuestions": 4,
        "attemptsCount": 2
      }
    ]
  }
  ```

---

## 7. Doubt Tickets & Analytics

### `POST /api/batches/[id]/tickets`
- **Roles**: Any member of the batch (teacher or student), or Admin
- **Request Body**:
  ```json
  {
    "question": "How do I calculate terminal velocity?"
  }
  ```
- **Response `201`**:
  ```json
  {
    "ticket": {
      "id": "uuid",
      "institute_id": "uuid",
      "batch_id": "uuid",
      "student_id": "uuid",
      "question": "How do I calculate terminal velocity?",
      "status": "open",
      "created_at": "timestamp"
    }
  }
  ```

### `GET /api/tickets`
- **Roles**: Authenticated caller
  - Students see only their own tickets.
  - Teachers see tickets for batches they belong to.
  - Admins see all tickets in the institute.
- **Query Params**:
  - `status`: `open` | `answered` | `closed` (optional)
  - `batchId`: filter by batch (optional)
  - `limit`, `offset`: pagination (default 50, max 100)
- **Response `200`**:
  ```json
  {
    "tickets": [
      {
        "id": "uuid",
        "institute_id": "uuid",
        "batch_id": "uuid",
        "student_id": "uuid",
        "question": "...",
        "status": "open",
        "answer": null,
        "answered_by": null,
        "created_at": "timestamp",
        "answered_at": null,
        "batch_name": "Physics Batch A",
        "student_name": "Student One",
        "student_email": "student@test.local",
        "answered_by_name": null
      }
    ]
  }
  ```

### `POST /api/tickets/[id]/answer`
- **Roles**: Teacher in that ticket's batch, or Admin
- **Request Body**:
  ```json
  {
    "answer": "Terminal velocity is reached when drag force equals weight: v_t = sqrt(2mg / (rho * A * Cd))."
  }
  ```
- **Response `200`**:
  ```json
  {
    "ticket": {
      "id": "uuid",
      "status": "answered",
      "answer": "...",
      "answered_by": "uuid",
      "answered_at": "timestamp"
    }
  }
  ```

### `POST /api/tickets/[id]/close`
- **Roles**: Ticket owner (student who created it), Teacher in that batch, or Admin
- **Response `200`**:
  ```json
  {
    "ticket": {
      "id": "uuid",
      "status": "closed"
    }
  }
  ```

### `GET /api/batches/[id]/analytics`
- **Roles**: Teacher in that batch, or Admin
- **Response `200`**:
  ```json
  {
    "batchId": "uuid",
    "batchName": "Physics 101",
    "members": {
      "total": 25,
      "students": 23,
      "teachers": 2
    },
    "documents": {
      "total": 5,
      "byStatus": {
        "ready": 4,
        "processing": 0,
        "failed": 1
      }
    },
    "items": {
      "total": 12,
      "byType": {
        "summary": 2,
        "notes": 3,
        "key_points": 2,
        "quiz": 3,
        "flashcards": 2
      },
      "byStatus": {
        "draft": 2,
        "approved": 10,
        "rejected": 0
      }
    },
    "quizzes": {
      "totalAttempts": 45,
      "averageScorePct": 78.5,
      "attemptsPerQuiz": [
        {
          "quiz_id": "uuid",
          "title": "Laws of Motion Quiz",
          "attempts_count": 25,
          "avg_score_pct": 82.0
        }
      ],
      "hardestQuestions": [
        {
          "quizId": "uuid",
          "quizTitle": "Laws of Motion Quiz",
          "questionIndex": 2,
          "question": "Which law explains rocket propulsion?",
          "attemptsCount": 25,
          "correctCount": 5,
          "correctPercentage": 20
        }
      ]
    },
    "studentProgress": [
      {
        "user_id": "uuid",
        "name": "Student One",
        "email": "student1@test.local",
        "attempts_count": 3,
        "avg_score_pct": 85.0
      }
    ],
    "chatActivity": [
      { "date": "2026-11-20", "count": 14 }
    ],
    "unansweredQuestions": [
      {
        "message_id": "uuid",
        "user_id": "uuid",
        "assistant_response": "I couldn't find this...",
        "preceding_question": "What is Hawking radiation?",
        "created_at": "timestamp"
      }
    ],
    "openTicketsCount": 2
  }
  ```

### `GET /api/analytics/institute`
- **Roles**: Institute Admin only
- **Response `200`**:
  ```json
  {
    "batches": [
      {
        "batchId": "uuid",
        "batchName": "Physics 101",
        "memberCount": 25,
        "studentCount": 23,
        "teacherCount": 2,
        "documentCount": 5,
        "itemCount": 12,
        "quizAttemptCount": 45,
        "chatMessageCount": 120,
        "ticketCount": 6,
        "openTicketCount": 2
      }
    ],
    "instituteTotals": {
      "batchCount": 1,
      "memberCount": 25,
      "studentCount": 23,
      "teacherCount": 2,
      "documentCount": 5,
      "itemCount": 12,
      "quizAttemptCount": 45,
      "chatMessageCount": 120,
      "ticketCount": 6,
      "openTicketCount": 2
    }
  }
  ```

