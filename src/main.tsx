import { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { Crosshair, Copy, Download, Upload } from "lucide-react";
import { studioStart, commands, safeAlias, type Settings } from "./model";
import { encode } from "./codec";
import { downloadConfig } from "./config-export";
import { copyText } from "./clipboard";
import { read, write, validateLibrary, type Saved } from "./storage";
import { useLibrarySync } from "./library-sync";
import { usePreferenceSync } from "./preference-sync";
import { backupFile, BACKUP_MAX_BYTES, mergeBackup, parseBackup } from "./library-backup";
import { LibraryView } from "./LibraryView";
import { download, initial, message } from "./startup";
import { useUndo } from "./useUndo";
import { useToast } from "./useToast";
import { usePreviewState } from "./usePreviewState";
import { useFavorites } from "./useFavorites";
import { useImport } from "./useImport";
import { Header, type View } from "./components/Header";
import { ImportBar } from "./components/ImportBar";
import { MapPreview } from "./components/MapPreview";
import { SaveFavorite } from "./components/SaveFavorite";
import { SettingsList } from "./components/SettingsList";
import { Dialogs } from "./components/Dialogs";
import { Toast } from "./components/Toast";

import "./style.css";
import "./theme.css";
import "./layout.css";
import "./steam-account.css";
import "@fontsource/inter/latin-400.css";
import "@fontsource/inter/latin-500.css";
import "@fontsource/inter/latin-600.css";
import "@fontsource/jetbrains-mono/latin-400.css";

const viewFromUrl = (): View =>
  new URLSearchParams(location.search).get("view") === "library" ? "library" : "editor";

function App() {
  const [start] = useState(initial);
  const [s, setSettings] = useState(start.settings);
  const undoHistory = useUndo(s);
  const [alias, setAlias] = useState(() => read<string>("alias", ""));
  let aliasError = "";
  try {
    safeAlias(alias);
  } catch (e) {
    aliasError = message(e);
  }
  const code = encode(s);

  const { toast, toastTone, notify, setToast } = useToast(() => {
    const steamFailed = new URLSearchParams(location.search).get("steam") === "failed";
    return {
      text: steamFailed
        ? "Steam sign-in was not completed. Try again using the Steam button in the header."
        : (start.error ?? start.note ?? ""),
      tone: start.error || steamFailed ? "error" : start.note ? "warning" : "info",
    };
  });
  const preview = usePreviewState(s.cl_crosshair_screen_height, notify);

  const [modal, setModal] = useState<"help" | "preview" | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const modalTrigger = useRef<HTMLElement | null>(null);
  function openModal(kind: "help" | "preview", trigger: HTMLElement) {
    modalTrigger.current = trigger;
    setModal(kind);
  }
  useEffect(() => {
    if (!modal) return;
    const trigger = modalTrigger.current ?? document.activeElement;
    dialogRef.current?.showModal();
    return () => {
      dialogRef.current?.close();
      if (trigger instanceof HTMLElement && trigger.isConnected) trigger.focus();
    };
  }, [modal]);

  const [guestLibrary, setGuestLibrary] = useState<Saved[]>(() => {
    try {
      return validateLibrary(read("library", []));
    } catch {
      return [];
    }
  });
  const sync = useLibrarySync(guestLibrary, setGuestLibrary);
  const { library, setLibrary } = sync;
  const preferenceSync = usePreferenceSync(
    sync.user?.steamId ?? null,
    preview.gameViewPreference,
    preview.setGameViewPreference,
  );

  const [view, setViewState] = useState<View>(viewFromUrl);
  function setView(next: View) {
    if (next === view) return;
    setViewState(next);
    const url = new URL(location.href);
    if (next === "library") url.searchParams.set("view", "library");
    else url.searchParams.delete("view");
    history.pushState(null, "", url.pathname + url.search + url.hash);
  }
  useEffect(() => {
    const onPop = () => setViewState(viewFromUrl());
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  function change(key: string, value: number) {
    // Grouped by setting, so dragging a slider is one undo step rather than one per pixel.
    undoHistory.push(s, key);
    setSettings((prev) => ({ ...prev, [key]: value }));
  }
  function load(settings: Settings) {
    undoHistory.push(s);
    setSettings({ ...settings });
  }
  function reset() {
    load({ ...studioStart });
    notify("Crosshair reset to the studio defaults.", "success");
  }
  function goBack() {
    undoHistory.goBack(setSettings);
  }

  const favorites = useFavorites({
    s, alias, aliasError, setAlias, sync, notify, load, openEditor: () => setView("editor"),
  });
  const imports = useImport({
    s,
    code,
    apply: (settings) => {
      load(settings);
      favorites.setEditingId(null);
      favorites.remember(settings);
    },
    setModal,
    notify,
  });

  const [rating, setRating] = useState(() => read<number>("rating", 0));
  const [note, setNote] = useState(() => read<string>("feedback-note", ""));
  const backupInput = useRef<HTMLInputElement>(null);
  const cfgInput = useRef<HTMLInputElement>(null);

  const [draftSaved, setDraftSaved] = useState(true);
  const draftWasSaved = useRef(true);
  useEffect(() => {
    const saved = write("draft", s);
    setDraftSaved(saved);
    const failedNow = !saved && draftWasSaved.current;
    draftWasSaved.current = saved;
    if (failedNow) notify("Browser storage is unavailable. Export a config to keep your changes.", "error");
  }, [s]);
  useEffect(() => {
    write("alias", alias);
  }, [alias]);
  useEffect(() => {
    document.documentElement.dataset.theme = "cs2";
    document
      .querySelector("meta[name=theme-color]")
      ?.setAttribute("content", getComputedStyle(document.documentElement).getPropertyValue("--back").trim());
  }, []);

  async function copy(text: string, label: string) {
    if (await copyText(text)) notify(`${label} copied.`, "success");
    else notify("Clipboard access failed. Select and copy the text manually.", "error");
  }
  function exportCfg() {
    if (aliasError) {
      const panel = document.querySelector<HTMLDetailsElement>(".export-advanced");
      if (panel) panel.open = true;
      document.getElementById("alias")?.focus();
      notify(aliasError, "error");
      return;
    }
    download(downloadConfig(s, alias), alias.trim() ? `crosshair_${alias.trim()}.cfg` : "crosshair.cfg");
    notify("Config downloaded.", "success");
  }
  function shareLink() {
    const url = new URL("/", location.origin);
    url.searchParams.set("code", code);
    url.searchParams.set("settings", JSON.stringify(s));
    return url.toString();
  }
  async function restoreBackup(file: File) {
    try {
      if (file.size > BACKUP_MAX_BYTES) throw Error("Backup is too large.");
      const entries = parseBackup(await file.text());
      if (setLibrary((prev) => mergeBackup(prev, entries)))
        notify("Backup merged. Existing entries were retained within library limits.", "success");
      else notify("Backup could not be saved. Free browser storage and try again.", "error");
    } catch (error) {
      notify(message(error), "error");
    }
  }

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (view !== "editor" || modal || !(event.ctrlKey || event.metaKey)) return;
      if (event.key === "Enter") {
        event.preventDefault();
        void copy(commands(s), "Console commands");
      } else if (event.key.toLowerCase() === "z" && !event.shiftKey && !event.altKey) {
        // Text fields keep their own undo; sliders, selects and the page undo the crosshair.
        const target = event.target;
        const typing =
          target instanceof HTMLTextAreaElement ||
          (target instanceof HTMLInputElement && !["range", "checkbox", "color"].includes(target.type)) ||
          (target instanceof HTMLElement && target.isContentEditable);
        if (typing || !undoHistory.canUndo) return;
        event.preventDefault();
        goBack();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  });

  const validPath =
    location.pathname === "/" ||
    location.pathname === "/custom" ||
    (/^\/(CS[A-Za-z0-9]{44}|CSGO(-[A-Za-z0-9]{5}){5})$/.test(location.pathname) && !start.error);
  useEffect(() => {
    const url = new URL(location.href);
    const legacyPath = url.pathname === "/custom";
    const failedSignIn = url.searchParams.getAll("steam").includes("failed");
    if (!legacyPath && !failedSignIn) return;
    if (legacyPath) url.pathname = "/";
    url.searchParams.delete("steam", "failed");
    history.replaceState(history.state, "", url.pathname + url.search + url.hash);
  }, []);
  if (!validPath)
    return (
      <main className="not-found">
        <Crosshair size={52} />
        <h1>Crosshair not found</h1>
        <p>This link does not point to a crosshair.</p>
        <a href="/">Open the studio</a>
      </main>
    );

  return (
    <>
      <Header
        view={view}
        setView={setView}
        favorites={library.filter((item) => item.favorite).length}
        onGuide={(trigger) => openModal("help", trigger)}
        sync={sync}
      />
      {view === "editor" && (
        <main
          aria-label="Crosshair editor"
          className={`workspace combined-transfer ${preview.previewExpanded ? "preview-expanded" : ""}`}
        >
          <h1 className="sr-only">Crosshair editor</h1>
          <ImportBar
            code={code}
            importText={imports.importText}
            importDraft={imports.importDraft}
            importError={imports.importError}
            legacyHeight={imports.legacyHeight}
            s={s}
            clipboardRequest={imports.clipboardRequest}
            cfgInput={cfgInput}
            setImportText={imports.setImportText}
            setImportError={imports.setImportError}
            setLegacyHeight={imports.setLegacyHeight}
            setModal={setModal}
            pasteCode={imports.pasteCode}
            doImport={imports.doImport}
            load={load}
            remember={favorites.remember}
            notify={notify}
            copy={copy}
            setToast={setToast}
            alias={alias}
            aliasError={aliasError}
            setAlias={setAlias}
            shareLink={shareLink}
            exportCfg={exportCfg}
          />
          <MapPreview
            s={s}
            map={preview.map}
            setMap={preview.setMap}
            zoom={preview.zoom}
            setZoom={preview.setZoom}
            effectiveHeight={preview.effectiveHeight}
            stretch={preview.stretch}
            gameView={preview.gameViewPreference}
            setGameView={preview.setGameViewPreference}
            gameViewSync={preferenceSync}
            display={preview.display}
            dynamic={preview.dynamic}
            previewMode={preview.previewMode}
            setPreviewMode={preview.setPreviewMode}
            phase={preview.phase}
            fit={preview.fit}
            inspectSplit={preview.inspectSplit}
            fullscreen={preview.fullscreen}
            modal={modal}
            previewStatus={preview.previewStatus}
            mapRef={preview.mapRef}
            setPreviewStatus={preview.setPreviewStatus}
            toggleFullscreen={preview.toggleFullscreen}
            goBack={goBack}
            reset={reset}
            previewExpanded={preview.previewExpanded}
            setPreviewExpanded={preview.setPreviewExpanded}
            setDynamic={preview.setDynamic}
            setFit={preview.setFit}
            canUndo={undoHistory.canUndo}
            onInspect={(button) => openModal("preview", button)}
            setModal={setModal}
          />
          <SettingsList s={s} set={change} load={load} draftSaved={draftSaved} />
          <SaveFavorite f={favorites} />
        </main>
      )}
      {view === "library" && (
        <LibraryView
          library={library}
          setLibrary={setLibrary}
          onLoad={favorites.editSaved}
          onCopy={(text, label) => void copy(text, label)}
          onBackup={() => download(backupFile(library), "delli-crosshair-library.json", "application/json")}
          onRestore={() => backupInput.current?.click()}
          notify={notify}
          user={sync.user}
          status={sync.status}
          syncing={sync.syncing}
          error={sync.error ?? ""}
          available={sync.available}
          hasGuestFavorites={sync.hasGuestFavorites}
          onMerge={sync.mergeGuest}
          onRetry={() => {
            void sync.retry().then((ok) => {
              if (ok) notify("Library is up to date.", "success");
            });
          }}
          onSignOut={() => void sync.signOut()}
          signIn={sync.signIn}
        />
      )}
      <footer className="site-footer">
        <p className="privacy-note">
          <span className="live-dot" />
          {sync.user
            ? "Drafts and other preferences stay on this device. Saved crosshairs and your in-game size setting sync to your Steam account."
            : "Drafts and preferences stay on this device. Sign in with Steam to sync saved crosshairs."}
        </p>
        <div className="footer-meta">
          <span>delli.cc</span>
          <span>Independent tool. Not affiliated with Valve.</span>
        </div>
      </footer>
      {view === "editor" && (
        <div className="mobile-actions">
          <button onClick={() => void copy(code, "Share code")}>
            <Copy size={15} />
            Copy code
          </button>
          <button onClick={exportCfg}>
            <Download size={15} />
            .cfg
          </button>
          <button
            onClick={() => {
              document.getElementById("import-text")?.focus();
              document.querySelector(".inline-import")?.scrollIntoView({ block: "start" });
            }}
          >
            <Upload size={15} />
            Import
          </button>
        </div>
      )}
      <Toast text={toast} tone={toastTone} onDismiss={() => setToast("")} />
      <Dialogs
        previewMode={preview.previewMode}
        dialogRef={dialogRef}
        modal={modal}
        setModal={setModal}
        setDynamic={preview.setDynamic}
        targetHeight={preview.targetHeight}
        setTargetHeight={preview.setTargetHeight}
        display={preview.display}
        displayHeight={preview.displayHeight}
        setDisplayHeight={preview.setDisplayHeight}
        displayHeightDraft={preview.displayHeightDraft}
        setDisplayHeightDraft={preview.setDisplayHeightDraft}
        fit={preview.fit}
        setFit={preview.setFit}
        phase={preview.phase}
        setPhase={preview.setPhase}
        inspectSplit={preview.inspectSplit}
        setInspectSplit={preview.setInspectSplit}
        previewStatus={preview.previewStatus}
        effectiveHeight={preview.effectiveHeight}
        matchingGame={preview.gameViewPreference.enabled}
        s={s}
        rating={rating}
        setRating={setRating}
        note={note}
        setNote={setNote}
        dynamic={preview.dynamic}
      />
      <input
        ref={backupInput}
        className="sr-only"
        type="file"
        accept=".json,application/json"
        aria-label="Library backup file"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void restoreBackup(file);
        }}
      />
      <input
        ref={cfgInput}
        className="sr-only"
        type="file"
        accept=".cfg,.txt,.vcfg"
        aria-label="Crosshair config file"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (file) void imports.importFile(file);
        }}
      />
    </>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
