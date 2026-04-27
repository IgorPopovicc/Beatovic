let cachedHandlerPromise;

async function loadHandler() {
  if (!cachedHandlerPromise) {
    cachedHandlerPromise = import('../dist/Beatovic/server/server.mjs').then((mod) => {
      const handler = mod.reqHandler ?? mod.default;
      if (typeof handler !== 'function') {
        throw new Error('SSR request handler was not found in dist/Beatovic/server/server.mjs');
      }
      return handler;
    });
  }

  return cachedHandlerPromise;
}

export default async function handler(req, res) {
  const ssrHandler = await loadHandler();
  return ssrHandler(req, res);
}
