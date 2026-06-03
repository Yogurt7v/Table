import { setupServer } from 'msw/node';
import { createDB } from './db';
import { defaultSeed } from './seed';
import { createHandlers } from './handlers';

export const db = createDB(defaultSeed);
export const server = setupServer(...createHandlers(db));
