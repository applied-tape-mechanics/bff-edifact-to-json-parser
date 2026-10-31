/**
 * Fastify Server, OpenAPI docs and Web UI for Brainfuck EDIFACT to JSON Parser.
 */

import { readFileSync } from 'node:fs';
import fastifySwagger from '@fastify/swagger';
import fastifySwaggerUi from '@fastify/swagger-ui';
import Fastify, { type FastifyInstance } from 'fastify';
import { EdifactEngine } from './engine.ts';

export const APP_ID = 'bff-edifact-to-json-parser';
export const VERSION = '1.0.0';

export interface AppOptions {
  disableBackend?: boolean;
  engine?: EdifactEngine;
  logger?: boolean;
}

interface ParseBody {
  edifact?: string;
  message?: string;
}

const errorSchema = {
  type: 'object',
  properties: { detail: { type: 'string' } },
} as const;

export async function buildApp(options: AppOptions = {}): Promise<FastifyInstance> {
  const disableBackend = options.disableBackend ?? false;
  const engine = options.engine ?? new EdifactEngine();
  const indexHtml = readFileSync(new URL('./index.html', import.meta.url), 'utf-8');

  const app = Fastify({ logger: options.logger ?? false });

  app.addContentTypeParser('*', { parseAs: 'buffer' }, (_req, body, done) => {
    done(null, (body as Buffer).toString('utf-8'));
  });

  app.setErrorHandler((error: Error & { statusCode?: number }, _req, reply) => {
    const status = error.statusCode && error.statusCode >= 400 ? error.statusCode : 500;
    const detail = status === 400 && /json/i.test(error.message) ? `Invalid JSON body: ${error.message}` : error.message;
    void reply.status(status).send({ detail });
  });

  if (!disableBackend) {
    await app.register(fastifySwagger, {
      openapi: {
        info: {
          title: 'Brainfuck EDIFACT to JSON Parser (bff-edifact-to-json-parser)',
          description: 'Microservice parsing UN/EDIFACT streams to JSON via Brainfuck state machine.',
          version: VERSION,
        },
      },
    });
    await app.register(fastifySwaggerUi, { routePrefix: '/docs' });
    app.get('/openapi.json', { schema: { hide: true } }, async () => app.swagger());
  }

  const guard = () => {
    if (disableBackend) {
      throw Object.assign(new Error('Backend API processing is disabled (DISABLE_BACKEND=true).'), {
        statusCode: 503,
      });
    }
  };

  app.get(
    '/health',
    {
      schema: {
        summary: 'Health status',
        response: {
          200: {
            type: 'object',
            properties: {
              status: { type: 'string' },
              app: { type: 'string' },
              engine: { type: 'string' },
              version: { type: 'string' },
              backend_enabled: { type: 'boolean' },
            },
          },
        },
      },
    },
    async () => ({
      status: 'ok',
      app: APP_ID,
      engine: 'brainfuck',
      version: VERSION,
      backend_enabled: !disableBackend,
    }),
  );

  app.get(
    '/bf',
    {
      schema: {
        summary: 'Brainfuck state machine metadata',
      },
    },
    async () => ({
      title: 'UN/EDIFACT to JSON Parser',
      description: 'Brainfuck state machine streaming parser for UN/EDIFACT standard syntax',
      instruction_count: engine.code.length,
      code: engine.code,
    }),
  );

  app.get(
    '/bf/code',
    {
      schema: {
        summary: 'Raw Brainfuck source code',
        produces: ['text/plain'],
      },
    },
    async (_req, reply) => reply.type('text/plain; charset=utf-8').send(engine.code),
  );

  app.post(
    '/parse',
    {
      schema: {
        summary: 'Parse UN/EDIFACT string into structured JSON',
        response: {
          200: {
            type: 'object',
            properties: {
              segments: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    name: { type: 'string' },
                    elements: {
                      type: 'array',
                      items: {
                        type: 'array',
                        items: { type: 'string' },
                      },
                    },
                  },
                },
              },
              raw_edifact: { type: 'string' },
              segment_count: { type: 'integer' },
              character_count: { type: 'integer' },
            },
          },
          400: errorSchema,
          422: errorSchema,
          503: errorSchema,
        },
      },
    },
    async (req, reply) => {
      guard();
      let edifactText = '';
      if (typeof req.body === 'string') {
        edifactText = req.body;
      } else if (req.body && typeof req.body === 'object') {
        const b = req.body as ParseBody;
        edifactText = b.edifact || b.message || '';
      }

      if (!edifactText) {
        return {
          segments: [],
          raw_edifact: '',
          segment_count: 0,
          character_count: 0,
        };
      }

      try {
        return engine.parse(edifactText);
      } catch (exc) {
        return reply.status(422).send({ detail: `EDIFACT parsing failed: ${exc instanceof Error ? exc.message : String(exc)}` });
      }
    },
  );

  app.get('/', { schema: { hide: true } }, async (_req, reply) =>
    reply.type('text/html; charset=utf-8').send(indexHtml.replace('__BF_CODE__', () => JSON.stringify(engine.code))),
  );

  return app;
}
