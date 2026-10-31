# Brainfuck EDIFACT to JSON Parser (`bf/edifact_parser.bf`)

## Overview
`edifact_parser.bf` is a pure Brainfuck streaming state machine that reads standard UN/EDIFACT streams from `stdin` and writes valid, structured JSON directly to `stdout`.

## Tape Memory Layout

| Cell | Name | Purpose |
|---|---|---|
| `c0` | `char` | Current input byte read via `,` |
| `c1` | `in_seg` | Flag: `1` if inside a segment body, `0` if outside |
| `c2` | `in_elem` | Flag: `1` if inside elements array `[["`, `0` if in tag name |
| `c3` | `first_seg`| Flag: `1` before first segment starts, `0` afterwards |
| `c4` | `esc_flag` | Flag: `1` if previous character was escape `?`, `0` otherwise |
| `c5` | `is_esc` | Temp comparison flag for `?` (ASCII 63) |
| `c6` | `is_plus` | Temp comparison flag for `+` (ASCII 43) |
| `c7` | `is_colon`| Temp comparison flag for `:` (ASCII 58) |
| `c8` | `is_quote`| Temp comparison flag for `'` (ASCII 39) |
| `c9` | `is_ws` | Temp comparison flag for whitespace (`\r` or `\n`) |
| `c10` | `scratch1`| Arithmetic scratch & conditional branch cell |
| `c11` | `scratch2`| Arithmetic scratch & copy buffer |
| `c12` | `scratch3`| Scratch flag for newline / conditional check |
| `c13` | `scratch4`| Scratch flag for carriage return |
| `c20` | `print_cell` | Dedicated printing scratchpad for constant strings |

## State Machine & Transitions

1. **Initial State**:
   - Tape initializes `first_seg` (`c3`) to `1`.
   - Emits `{"segments":[` to open the JSON root array.
2. **Escape Character (`?`)**:
   - Sets `esc_flag` (`c4 = 1`) and consumes the `?`.
   - The immediate next byte ignores delimiter checks and is printed literally.
3. **Whitespace (`\r`, `\n`)**:
   - Ignored / stripped from the stream.
4. **Segment Tag & First Character**:
   - If `in_seg == 0`:
     - If `first_seg == 1`: emits `{"name":"` and sets `first_seg = 0`.
     - Else: emits `,{"name":"`.
     - Sets `in_seg = 1`.
   - Character is output to `stdout`.
5. **Element Separator (`+`)**:
   - If `in_elem == 0`: emits `","elements":[["` and sets `in_elem = 1`.
   - If `in_elem == 1`: emits `"],["`.
6. **Component Separator (`:`)**:
   - Emits `","`.
7. **Segment Terminator (`'`)**:
   - If `in_elem == 1`: emits `"]]}"`, sets `in_elem = 0`, `in_seg = 0`.
   - If `in_elem == 0`: emits `","elements":[]}`, sets `in_seg = 0`.
8. **End of Stream (EOF / `\0`)**:
   - Closes root JSON object by emitting `]}`.

## Recompilation
To regenerate `bf/edifact_parser.bf`:
```bash
npm run compile:bf
```
