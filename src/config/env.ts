import { parseEnvironment } from './schema';

// O build usa o mesmo parser e fixa DEV=false para qualquer `vite build`.
export const env = parseEnvironment(import.meta.env, import.meta.env.DEV);
