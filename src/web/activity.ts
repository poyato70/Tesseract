/**
 * Contador global de execuções em andamento (POST/PATCH/DELETE e consultas
 * com corpo). A barra superior mostra o tesseract girando enquanto > 0.
 */
type Listener = (n: number) => void;
let pending = 0;
const listeners = new Set<Listener>();

export function subscribeActivity(fn: Listener) {
  listeners.add(fn);
  fn(pending);
  return () => void listeners.delete(fn);
}

export async function track<T>(work: Promise<T>): Promise<T> {
  pending++;
  listeners.forEach((l) => l(pending));
  try {
    return await work;
  } finally {
    pending--;
    listeners.forEach((l) => l(pending));
  }
}
