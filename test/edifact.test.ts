import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, describe, it } from 'node:test';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.ts';
import { buildParser } from '../src/compiler.ts';
import { EdifactEngine } from '../src/engine.ts';

const engine = new EdifactEngine();

describe('EDIFACT Brainfuck Engine', () => {
  it('single segment simple', () => {
    const input = "BGM+380+1285264'";
    const res = engine.parse(input);
    assert.equal(res.segment_count, 1);
    const seg = res.segments[0];
    assert.equal(seg.name, 'BGM');
    assert.deepEqual(seg.elements, [['380'], ['1285264']]);
  });

  it('multi-segment parsing', () => {
    const input = "BGM+380+1234'DTM+137:20261001:102'UNT+2+1'";
    const res = engine.parse(input);
    assert.equal(res.segment_count, 3);

    const [bgm, dtm, unt] = res.segments;
    assert.equal(bgm.name, 'BGM');
    assert.deepEqual(bgm.elements, [['380'], ['1234']]);

    assert.equal(dtm.name, 'DTM');
    assert.deepEqual(dtm.elements, [['137', '20261001', '102']]);

    assert.equal(unt.name, 'UNT');
    assert.deepEqual(unt.elements, [['2'], ['1']]);
  });

  it('composite elements', () => {
    const input = "UNH+1+ORDERS:D:96A:UN'";
    const res = engine.parse(input);
    assert.equal(res.segment_count, 1);
    const unh = res.segments[0];
    assert.equal(unh.name, 'UNH');
    assert.deepEqual(unh.elements, [['1'], ['ORDERS', 'D', '96A', 'UN']]);
  });

  it('escape character plus (?+)', () => {
    const input = "BGM+380?+TEST+1234'";
    const res = engine.parse(input);
    assert.equal(res.segment_count, 1);
    assert.deepEqual(res.segments[0].elements, [['380+TEST'], ['1234']]);
  });

  it('escape character colon (?:)', () => {
    const input = "DTM+137:2026?:10:102'";
    const res = engine.parse(input);
    assert.equal(res.segment_count, 1);
    assert.deepEqual(res.segments[0].elements, [['137', '2026:10', '102']]);
  });

  it('whitespace and newlines ignored', () => {
    const input = "BGM+380+1234'\r\nDTM+137:20261001:102'\nUNT+2+1'\r\n";
    const res = engine.parse(input);
    assert.equal(res.segment_count, 3);
    assert.equal(res.segments[0].name, 'BGM');
    assert.equal(res.segments[1].name, 'DTM');
    assert.equal(res.segments[2].name, 'UNT');
  });

  it('empty input', () => {
    const res = engine.parse('');
    assert.equal(res.segment_count, 0);
    assert.deepEqual(res.segments, []);
  });
});

describe('compiler', () => {
  it('regenerates bf/edifact_parser.bf exactly', () => {
    const onDisk = readFileSync(new URL('../bf/edifact_parser.bf', import.meta.url), 'utf-8').replace(
      /[^><+\-.,[\]]/g,
      '',
    );
    const compiled = buildParser().replace(/[^><+\-.,[\]]/g, '');
    assert.equal(compiled, onDisk);
  });
});

describe('HTTP API', () => {
  let app: FastifyInstance;
  before(async () => {
    app = await buildApp({ engine });
  });
  after(async () => {
    await app.close();
  });

  const json = (r: { json: () => unknown }) => r.json() as Record<string, any>;

  it('GET /health', async () => {
    const res = await app.inject('/health');
    assert.equal(res.statusCode, 200);
    const data = json(res);
    assert.equal(data.status, 'ok');
    assert.equal(data.app, 'bff-edifact-to-json-parser');
    assert.equal(data.engine, 'brainfuck');
  });

  it('GET / serves web UI', async () => {
    const res = await app.inject('/');
    assert.equal(res.statusCode, 200);
    assert.match(res.headers['content-type'] as string, /text\/html/);
    assert.ok(res.body.includes('EDIFACT to JSON Parser'));
  });

  it('POST /parse JSON payload', async () => {
    const payload = { edifact: "BGM+380+1234'DTM+137:20261001:102'UNT+2+1'" };
    const res = await app.inject({ method: 'POST', url: '/parse', payload });
    assert.equal(res.statusCode, 200);
    const data = json(res);
    assert.equal(data.segment_count, 3);
    assert.equal(data.segments[0].name, 'BGM');
  });

  it('POST /parse text/plain payload', async () => {
    const textData = "BGM+380+1234'UNT+1+1'";
    const res = await app.inject({
      method: 'POST',
      url: '/parse',
      payload: textData,
      headers: { 'content-type': 'text/plain' },
    });
    assert.equal(res.statusCode, 200);
    const data = json(res);
    assert.equal(data.segment_count, 2);
    assert.equal(data.segments[0].name, 'BGM');
    assert.equal(data.segments[1].name, 'UNT');
  });

  it('POST /parse empty', async () => {
    const res = await app.inject({ method: 'POST', url: '/parse', payload: { edifact: '' } });
    assert.equal(res.statusCode, 200);
    assert.equal(json(res).segment_count, 0);
  });

  it('GET /bf and /bf/code', async () => {
    const info = json(await app.inject('/bf'));
    assert.ok(info.instruction_count > 1000);
    const raw = await app.inject('/bf/code');
    assert.equal(raw.statusCode, 200);
    assert.ok(raw.body.length > 1000);
  });
});
