# Smart Krishi Market — Backend

Express.js + PostgreSQL REST API for the Smart Krishi Market platform.

## Stack
- Node.js + Express
- PostgreSQL (`pg`)
- JWT auth (`jsonwebtoken`) + bcrypt
- Multer for file uploads
- MVC architecture
- Helmet, CORS, rate limiting, morgan logging

## Folder layout

```
backend/
├── src/
│   ├── config/         # db + env config
│   ├── controllers/    # route handlers
│   ├── middleware/     # auth, role, error, upload
│   ├── models/         # PostgreSQL queries
│   ├── routes/         # Express routers
│   ├── utils/          # JWT helpers, migration runner
│   ├── app.js          # Express app
│   └── server.js       # entrypoint
├── uploads/            # uploaded crop images
├── .env.example
├── package.json
└── README.md
```

The SQL schema lives in `../database/schema.sql` (owned by the database team).
A copy is used by `npm run migrate` to bootstrap a fresh DB.

## Setup

```bash
cd backend
cp .env.example .env       # then edit values
npm install
npm run migrate            # creates tables
npm run dev                # starts on PORT (default 5000)
```

## Environment variables

See `.env.example`. Required: `JWT_SECRET`, plus either `DATABASE_URL` or the
discrete `DB_*` variables.

## API Routes

All routes are prefixed with `/api`.

### Auth (`/api/auth`)
| Method | Path        | Auth | Description                              |
|--------|-------------|------|------------------------------------------|
| POST   | `/register` | —    | Register a farmer or buyer               |
| POST   | `/login`    | —    | Login, returns JWT                       |
| GET    | `/me`       | JWT  | Get current user                         |

### Buyers
| Method | Path                  | Auth | Description                                              |
|--------|-----------------------|------|----------------------------------------------------------|
| GET    | `/api/buyers`         | —    | List registered buyers (`?state=&district=&limit=&offset=`) |
| POST   | `/api/buyer/search`   | —    | Search active crop listings: `{ crop?, location?, maxPrice? }` |

### Crops (`/api/crops`)
| Method | Path        | Auth          | Description                                  |
|--------|-------------|---------------|----------------------------------------------|
| GET    | `/`         | —             | List crops (filter via `?crop=&state=`)      |
| GET    | `/:id`      | —             | Get single crop listing                      |
| POST   | `/`         | JWT, farmer   | Create listing (`multipart/form-data` image) |
| PUT    | `/:id`      | JWT, owner    | Update listing                               |
| DELETE | `/:id`      | JWT, owner    | Delete listing                               |
| GET    | `/mine/list`| JWT, farmer   | List my own crops                            |

### Predictions (`/api/predict`)
| Method | Path  | Auth | Description                                  |
|--------|-------|------|----------------------------------------------|
| POST   | `/`   | JWT  | Forward to ML service, return prediction     |

### Market prices (`/api/market-prices`)
| Method | Path  | Auth | Description                                          |
|--------|-------|------|------------------------------------------------------|
| GET    | `/`   | —    | Latest mandi prices; filters: `crop`, `state`, `limit` |

### Health
| Method | Path        | Description    |
|--------|-------------|----------------|
| GET    | `/api/health` | Health check |

## Roles
- `farmer` — can create/update/delete own crop listings
- `buyer` — can browse listings and contact farmers
- `admin` — reserved for management endpoints

## Notes
- Backend only writes inside `/backend`. It never modifies `frontend/`, `ml-service/`, or `database/`.
- Image uploads are stored in `uploads/` and served from `/uploads/<filename>`.
