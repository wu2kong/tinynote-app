export async function listen(_event: string, _handler: (event: { payload: unknown }) => void) {
  return () => {};
}

export async function emit(_event: string, _payload?: unknown) {
  // noop
}
