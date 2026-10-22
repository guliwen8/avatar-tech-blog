/** Keeps a manual generation response active while waiting for the provider.
 * Only complete results are sent; cancellation never triggers a paid retry. */
export function editorialStream(
  generate: (signal: AbortSignal) => Promise<unknown>,
  signal?: AbortSignal,
  heartbeatMs = 10000,
): ReadableStream<Uint8Array> {
  const ac = new AbortController();
  let stop = () => {};
  return new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();
      let closed = false;
      const send = (event: unknown) => {
        if (!closed)
          controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
      };
      const abort = () => ac.abort();
      const timer = setInterval(() => send({ type: "progress" }), heartbeatMs);
      stop = () => {
        closed = true;
        clearInterval(timer);
        signal?.removeEventListener("abort", abort);
        ac.abort();
      };
      signal?.addEventListener("abort", abort, { once: true });
      if (signal?.aborted) ac.abort();
      send({ type: "progress" });
      Promise.resolve()
        .then(() => generate(ac.signal))
        .then(
          (result) => send({ type: "result", result }),
          (error) =>
            send({
              type: "error",
              error:
                error instanceof Error
                  ? error.message
                  : "生成失败，请保留原稿后重试",
            }),
        )
        .finally(() => {
          if (!closed) controller.close();
          stop();
        });
    },
    cancel() {
      stop();
    },
  });
}
