import { setupWorker } from 'msw/browser';
import { createDB } from './db';
import { defaultSeed } from './seed';
import { createHandlers } from './handlers';

export const worker = setupWorker(...createHandlers(createDB(defaultSeed)));
