/**
 * EDIFACT to JSON Parsing Engine.
 * Executes the Brainfuck state machine and validates output.
 */

import { readFileSync } from 'node:fs';
import { BrainfuckVM, cleanCode, compile, type Program } from 'bff-interpreter';

export interface Segment {
  name: string;
  elements: string[][];
}

export interface EdifactParseResult {
  segments: Segment[];
  raw_edifact: string;
  segment_count: number;
  character_count: number;
}

const decoder = new TextDecoder();

export class EdifactEngine {
  readonly code: string;
  private readonly program: Program;

  constructor(bfPath: URL = new URL('../bf/edifact_parser.bf', import.meta.url)) {
    try {
      this.code = cleanCode(readFileSync(bfPath, 'utf-8'));
    } catch (err) {
      throw new Error(`Brainfuck parser not found at ${bfPath.pathname}`, { cause: err });
    }
    this.program = compile(this.code);
  }

  parse(edifactInput: string): EdifactParseResult {
    let cleaned = edifactInput.trim();
    if (!cleaned) {
      return {
        segments: [],
        raw_edifact: edifactInput,
        segment_count: 0,
        character_count: 0,
      };
    }

    if (!cleaned.endsWith("'")) {
      cleaned += "'";
    }

    const vm = new BrainfuckVM();
    const rawOutput = decoder.decode(vm.run(this.program, cleaned));

    let parsed: { segments?: Segment[] };
    try {
      parsed = JSON.parse(rawOutput);
    } catch (exc) {
      throw new Error(
        `Brainfuck parser emitted invalid JSON: ${exc instanceof Error ? exc.message : String(exc)}\nOutput: ${rawOutput.slice(0, 500)}`,
      );
    }

    const segments = parsed.segments || [];
    return {
      segments,
      raw_edifact: cleaned,
      segment_count: segments.length,
      character_count: cleaned.length,
    };
  }
}
