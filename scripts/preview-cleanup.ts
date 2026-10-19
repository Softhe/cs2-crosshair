export type PreviewCleanup = {
  sessions: readonly string[];
  states: readonly string[];
  owners: readonly string[];
  closeBrowser: () => unknown | Promise<unknown>;
  deleteSession: (id: string) => unknown | Promise<unknown>;
  deleteState: (id: string) => unknown | Promise<unknown>;
  deleteLibrary: (owner: string) => unknown | Promise<unknown>;
  closeStore: () => unknown | Promise<unknown>;
};

// Database errors may contain connection details, so report operations without their raw causes or identifiers.
export async function cleanupPreviewFixtures(cleanup: PreviewCleanup): Promise<Error[]> {
  const failures: Error[] = [];
  async function attempt(label: string, operation: () => unknown | Promise<unknown>) {
    try { await operation(); }
    catch { failures.push(new Error(`Preview cleanup failed: ${label}.`)); }
  }
  await attempt('browser close', cleanup.closeBrowser);
  for (const [index, id] of cleanup.sessions.entries())
    await attempt(`session ${index + 1} removal`, () => cleanup.deleteSession(id));
  for (const [index, id] of cleanup.states.entries())
    await attempt(`auth state ${index + 1} removal`, () => cleanup.deleteState(id));
  for (const [index, owner] of cleanup.owners.entries())
    await attempt(`fixture library ${index + 1} removal`, () => cleanup.deleteLibrary(owner));
  await attempt('store close', cleanup.closeStore);
  return failures;
}
