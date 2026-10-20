import { test } from 'node:test';
import assert from 'node:assert/strict';
import { copyText } from '../src/clipboard.ts';

class FakeInput {
  selectionStart: number | null = 2;
  selectionEnd: number | null = 5;
  selectionDirection: string | null = 'forward';
  focusCalls: unknown[][] = [];
  selectionCalls: unknown[][] = [];
  focus(...args: unknown[]) { this.focusCalls.push(args); }
  setSelectionRange(...args: unknown[]) { this.selectionCalls.push(args); }
}
class FakeTextArea {}

function fakeSelection() {
  const clone = { cloned: true };
  const calls: string[] = [];
  const added: unknown[] = [];
  return {
    calls, added, clone,
    rangeCount: 1,
    getRangeAt: (_index: number) => ({ cloneRange: () => clone }),
    removeAllRanges: () => { calls.push('removeAll'); },
    addRange: (range: unknown) => { calls.push('add'); added.push(range); },
  };
}

function installDom(active: unknown, selection: unknown, execResult: boolean) {
  const globals = globalThis as unknown as Record<string, unknown>;
  const textarea = {
    value: '',
    attributes: {} as Record<string, string>,
    style: {} as Record<string, string>,
    focusCalls: [] as unknown[][],
    selected: false,
    removed: false,
    appended: false,
    setAttribute: (key: string, value: string) => { textarea.attributes[key] = value; },
    focus: (...args: unknown[]) => { textarea.focusCalls.push(args); },
    select: () => { textarea.selected = true; },
    remove: () => { textarea.removed = true; },
  };
  const scrolled: unknown[][] = [];
  globals.HTMLInputElement = FakeInput;
  globals.HTMLTextAreaElement = FakeTextArea;
  Object.defineProperty(globals, 'navigator', {configurable:true, writable:true, value:{}});
  globals.window = { scrollX: 11, scrollY: 22, scrollTo: (...args: unknown[]) => { scrolled.push(args); } };
  globals.document = {
    activeElement: active,
    createElement: () => textarea,
    getSelection: () => selection,
    execCommand: () => execResult,
    body: { append: (_element: unknown) => { textarea.appended = true; } },
  };
  return { textarea, scrolled };
}

function uninstallDom() {
  const globals = globalThis as unknown as Record<string, unknown>;
  delete globals.HTMLInputElement;
  delete globals.HTMLTextAreaElement;
  delete globals.navigator;
  delete globals.window;
  delete globals.document;
}

test('selection fallback preserves input selection, focus and scroll', async () => {
  const input = new FakeInput();
  const selection = fakeSelection();
  const { textarea, scrolled } = installDom(input, selection, true);
  try {
    assert.equal(await copyText('hello'), true);
    assert.equal(textarea.value, 'hello');
    assert.equal(textarea.appended, true);
    assert.equal(textarea.selected, true);
    assert.equal(textarea.removed, true);
    assert.deepEqual(input.selectionCalls, [[2, 5, 'forward']]);
    assert.deepEqual(input.focusCalls, [[{ preventScroll: true }]]);
    assert.deepEqual(scrolled, [[11, 22]]);
    assert.deepEqual(selection.calls, []);
  } finally {
    uninstallDom();
  }
});

test('selection fallback restores ranges when focus is outside inputs', async () => {
  const focusCalls: unknown[][] = [];
  const panel = { focus: (...args: unknown[]) => { focusCalls.push(args); } };
  const selection = fakeSelection();
  installDom(panel, selection, true);
  try {
    assert.equal(await copyText('crosshair'), true);
    assert.deepEqual(selection.calls, ['removeAll', 'add']);
    assert.deepEqual(selection.added, [selection.clone]);
    assert.deepEqual(focusCalls, [[{ preventScroll: true }]]);
  } finally {
    uninstallDom();
  }
});

test('selection fallback reports failure when the copy command fails', async () => {
  const input = new FakeInput();
  const selection = fakeSelection();
  installDom(input, selection, false);
  try {
    assert.equal(await copyText('hello'), false);
    assert.deepEqual(input.selectionCalls, [[2, 5, 'forward']]);
  } finally {
    uninstallDom();
  }
});

test('ClipboardItem writes that read back different text fall back to the selection path', async () => {
  const input = new FakeInput();
  const { textarea } = installDom(input, fakeSelection(), true);
  const globals = globalThis as unknown as Record<string, unknown>;
  let clipboardText = 'stale';
  Object.defineProperty(globals, 'navigator', {configurable:true, writable:true, value:{
    clipboard: { writeText: async () => {}, write: async () => {}, readText: async () => clipboardText },
    permissions: { query: async () => ({ state: 'granted' }) },
  }});
  globals.ClipboardItem = class { constructor(_items: unknown) {} };
  (globals.document as { execCommand: () => boolean }).execCommand = () => { clipboardText = 'hello'; return true; };
  try {
    assert.equal(await copyText('hello'), true);
    assert.equal(textarea.selected, true);
  } finally {
    delete globals.ClipboardItem;
    uninstallDom();
  }
});
