# Brainfuck UN/EDIFACT to JSON Parser (`bff-edifact-to-json-parser`)

> **[Applied Tape Mechanics](https://github.com/applied-tape-mechanics)** — *Empirical computation and discrete field dynamics on minimal linear substrates.*
> *Enterprise-grade cloud microservices—except the core business logic is pure Brainfuck. Best Friends Forever (`BFF`) with the most hostile programming language ever created.*

A streaming **UN/EDIFACT** standard syntax parser implemented as a pure Brainfuck state machine ([`bf/edifact_parser.bf`](bf/edifact_parser.bf)), served by a TypeScript [Fastify](https://fastify.dev) REST API with OpenAPI/Swagger documentation, an interactive Web UI, and Docker containerization.

---

## 📦 Repository Structure & File Reference

```text
bff-edifact-to-json-parser/
├── bf/
│   ├── edifact_parser.bf      # Compiled Brainfuck UN/EDIFACT streaming parser (3,816 ops)
│   └── README.md              # Tape memory layout & delimiter transition specification
├── src/
│   ├── server.ts              # HTTP server entry point (reads PORT & DISABLE_BACKEND)
│   ├── app.ts                 # Fastify application, OpenAPI/Swagger routes & HTML template injection
│   ├── engine.ts              # Brainfuck VM wrapper executing edifact_parser.bf and validating JSON
│   ├── compiler.ts            # Deterministic compiler that generates bf/edifact_parser.bf
│   └── index.html             # Interactive Web UI with Segment Breakdown Visualizer & Client JS VM fallback
├── test/
│   └── edifact.test.ts        # 14 automated tests (Brainfuck engine, compiler determinism & HTTP API)
├── Dockerfile                 # Multi-stage Node 24 container (base, test, and production stages)
├── docker-compose.yml         # Production service (port 8002 -> 8000), Brainfuck healthcheck sidecar & test runner
├── package.json               # Service metadata, scripts & pinned bff-interpreter dependency
├── tsconfig.json              # TypeScript configuration
└── LICENSE                    # MIT License
```

---

## ✨ Features

- **Pure Brainfuck Parsing State Machine (`bf/edifact_parser.bf`, `3,816` instructions)**:
  - Parses standard UN/EDIFACT streams directly into valid JSON with nested segments, data elements, and composite components.
  - Recognizes standard UN/EDIFACT delimiters: `'` (segment terminator), `+` (data element separator), `:` (component element separator), and `?` (release/escape character).
  - Automatically strips line breaks (`\r`, `\n`) while preserving escaped delimiters (`?+`, `?:`, `?'`, `??`).
- **Deterministic Compiler (`src/compiler.ts`)**:
  - Generates `bf/edifact_parser.bf` with verified relative pointer balancing.
- **Fastify REST API** (OpenAPI spec at `/openapi.json`, Swagger UI at `/docs`):
  - `POST /parse`: Accepts EDIFACT messages via JSON body (`{"edifact": "..."}`) or raw `text/plain` and returns structured JSON segments.
  - `GET /bf`: Metadata and instruction count for the Brainfuck state machine.
  - `GET /bf/code`: Raw Brainfuck source code.
  - `GET /health`: Health status endpoint.
  - `GET /`: Interactive Web UI with a visual Segment Breakdown table.
- **Zero-Submodule Runtime UI & Client-Side Fallback**:
  - Loads [`bff-ui`](https://github.com/applied-tape-mechanics/bff-ui) and [`bff-interpreter`](https://github.com/applied-tape-mechanics/bff-interpreter) at runtime from pinned GitHub releases via jsDelivr CDN (`@v1.0.0`).
  - Supports **OS 9** and **OS X** themes and runs 100% standalone in the browser via the JavaScript Brainfuck VM when hosted on GitHub Pages (`DISABLE_BACKEND=true`).

---

## 🧠 Brainfuck Tape Architecture (`bf/edifact_parser.bf`)

See [`bf/README.md`](bf/README.md) for the complete transition table.

| Cell | Identifier | Purpose |
| :---: | :--- | :--- |
| `c0` | `char` | Current input byte read from `stdin` via `,` |
| `c1` | `in_seg` | Flag: `1` if inside a segment body, `0` if outside |
| `c2` | `in_elem` | Flag: `1` if inside elements array `[["`, `0` if reading segment tag name |
| `c3` | `first_seg` | Flag: `1` before first segment starts, `0` afterwards |
| `c4` | `esc_flag` | Flag: `1` if previous character was release character `?`, `0` otherwise |
| `c5` | `is_esc` | Comparison flag for `?` (ASCII 63) |
| `c6` | `is_plus` | Comparison flag for `+` (ASCII 43) |
| `c7` | `is_colon` | Comparison flag for `:` (ASCII 58) |
| `c8` | `is_quote` | Comparison flag for `'` (ASCII 39) |
| `c9` | `is_ws` | Comparison flag for whitespace (`\r` or `\n`) |
| `c10..c13` | `scratch` | Arithmetic scratch & conditional branch registers |
| `c20` | `print_cell` | Dedicated delta-encoded ASCII character emitter for JSON syntax strings |

---

## 🐳 Docker Setup (Zero Host Dependencies)

A pre-built production image is published automatically to **GitHub Container Registry (`ghcr.io`)**:

```bash
# Run the microservice directly from GHCR on http://localhost:8002
docker run --rm -p 8002:8000 ghcr.io/applied-tape-mechanics/bff-edifact-to-json-parser:latest
```

### Using Docker Compose (Development, Testing & Production)

```bash
# Run the full 14-test suite (VM, compiler determinism & HTTP API) inside Docker
docker compose run --rm test

# Run TypeScript type checking inside Docker
docker compose run --rm test npm run typecheck

# Recompile bf/edifact_parser.bf inside Docker
docker compose run --rm test npm run compile:bf

# Pull and start pre-built release images (service + Brainfuck healthcheck sidecar) from GHCR
docker compose pull
docker compose up -d

# Or build locally from source and start in the background
docker compose up -d --build
```

Visit:
- **Interactive Web UI:** [http://localhost:8002](http://localhost:8002)
- **Swagger OpenAPI Docs:** [http://localhost:8002/docs](http://localhost:8002/docs)
- **Brainfuck Healthcheck Sidecar:** [http://localhost:8084](http://localhost:8084)

---

## 💻 Local Development (Node.js ≥ 22.18)

```bash
npm install
npm run dev          # watch mode on http://localhost:8000
npm test             # node:test
npm run typecheck    # tsc --noEmit
npm run compile:bf   # regenerate bf/edifact_parser.bf
```

---

## 📡 API Examples

### 1. Parse UN/EDIFACT Stream (`POST /parse`)
```bash
curl -X POST http://localhost:8002/parse \
  -H "Content-Type: text/plain" \
  -d "BGM+380+1285264'DTM+137:20261001:102'UNT+2+1'"
```

**Response:**
```json
{
  "segments": [
    {
      "name": "BGM",
      "elements": [["380"], ["1285264"]]
    },
    {
      "name": "DTM",
      "elements": [["137", "20261001", "102"]]
    },
    {
      "name": "UNT",
      "elements": [["2"], ["1"]]
    }
  ],
  "raw_edifact": "BGM+380+1285264'DTM+137:20261001:102'UNT+2+1'",
  "segment_count": 3,
  "character_count": 43
}
```

### 2. Inspect Brainfuck Code (`GET /bf` & `GET /bf/code`)
```bash
curl http://localhost:8002/bf
curl http://localhost:8002/bf/code
```
