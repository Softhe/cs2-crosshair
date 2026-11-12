import { ArrowUpRight, X } from "lucide-react";
import { write } from "../storage";
import type { RefObject } from "react";
export type DialogsProps = {
  modal: "help" | null;
  setModal: (value: "help" | null) => void;
  rating: number;
  setRating: (value: number) => void;
  note: string;
  setNote: (value: string) => void;
};

export function Dialogs({
  dialogRef,
  modal,
  setModal,
  rating,
  setRating,
  note,
  setNote,
}: DialogsProps & { dialogRef: RefObject<HTMLDialogElement | null> }) {
  return (
    <dialog
      aria-labelledby="studio-dialog-title"
      ref={dialogRef}
      onCancel={() => setModal(null)}
      onClick={(e) => {
        if (e.target === e.currentTarget) setModal(null);
      }}
      className="modal"
    >
      <div className="modal-header">
        <h2 id="studio-dialog-title">
          Using the studio
        </h2>
        <button
          className="icon-button"
          aria-label="Close dialog"
          onClick={() => setModal(null)}
        >
          <X size={20} />
        </button>
      </div>

      {modal === "help" && (
        <div className="modal-content help-content">
          <h3>From the studio to CS2</h3>
          <ol>
            <li>Choose a style and adjust its settings.</li>
            <li>Copy the CS2 share code.</li>
            <li>
              In CS2, open Settings → Crosshair / Scopes → Share or Import.
              Paste and import.
            </li>
          </ol>
          <h3>Configs and aliases</h3>
          <p>
            Place the downloaded .cfg file in{" "}
            <code>Counter-Strike Global Offensive/game/csgo/cfg</code>. Without
            an alias, type <code>exec crosshair.cfg</code> in the CS2 console.
            An alias such as <code>team_green</code> under Advanced export names
            the download <code>crosshair_team_green.cfg</code>. Add the copied
            autoexec shortcut to <code>autoexec.cfg</code>, then type{" "}
            <code>team_green</code> in the console.
          </p>
          <h3>Preview accuracy</h3>
          <p>
            The preview uses real game backgrounds and draws the crosshair
            at the resolution it was made for, where every unit is one game
            pixel. If you play at another resolution, turn on Match my in-game
            size under Preview options to see how CS2 rounds and stretches it
            on your monitor; the browser cannot detect your game resolution, so
            you choose it. A crosshair too large for the preview is shown
            smaller to fit. Static Cross with a nonnegative gap matches
            measured game captures; other styles are approximate. GPU
            sharpening and game post-processing can change colors and edges.
            Dynamic motion, recoil, quadrant geometry and scope rendering are
            browser approximations. The animation exercises the configured
            spread limit; it does not model weapon inaccuracy, spread or the
            game's 64-pixel baseline. Verify the final crosshair in CS2.
          </p>
          <h3>Give yourself a note</h3>
          <p>Feedback stays on this device.</p>
          <div className="rating">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                aria-label={`Rate ease of use ${n} out of 5`}
                aria-pressed={rating === n}
                className={n === rating ? "active" : ""}
                key={n}
                onClick={() => {
                  setRating(n);
                  write("rating", n);
                }}
              >
                {n}
              </button>
            ))}
          </div>
          <textarea
            aria-label="Local feedback note"
            className="import-area"
            placeholder="A note for next time…"
            maxLength={1000}
            value={note}
            onChange={(e) => {
              setNote(e.target.value);
              write("feedback-note", e.target.value);
            }}
          />
          <a
            className="issue-link"
            href={`https://github.com/Softhe/cs2-crosshair/issues/new?title=${encodeURIComponent("Crosshair studio feedback")}&body=${encodeURIComponent("Feedback about the new crosshair studio.\n\nDescribe the issue here. No settings or local data have been attached.")}`}
            target="_blank"
            rel="noreferrer"
          >
            Open an issue draft
            <ArrowUpRight size={15} />
          </a>
          <p className="section-note">
            The issue draft contains no crosshair, alias, library or feedback
            data. Review it before submitting.
          </p>
        </div>
      )}
    </dialog>
  );
}
