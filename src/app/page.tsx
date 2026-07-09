"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./page.module.css";
import { playDrawSound, playMoveSound, playWinSound, primeAudio, startMusic, stopMusic, vibrate } from "./feedback";

type Player = "X" | "O";
type Cell = Player | null;
type Board = Cell[];
type Mode = "1p" | "2p" | null;
type Screen = "menu" | "game";

const WIN_LINES = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

const STORAGE_KEY = "ttt-save-v1";
const LEVEL_NAMES = ["Easy", "Medium", "Hard"];

const SPARKLES = [
  { top: "6%", left: "15%", size: 3, delay: 0.2, duration: 3.2 },
  { top: "14%", left: "42%", size: 2, delay: 1.1, duration: 2.8 },
  { top: "22%", left: "68%", size: 3, delay: 0.5, duration: 3.6 },
  { top: "9%", left: "85%", size: 2, delay: 2.0, duration: 3.0 },
  { top: "30%", left: "5%", size: 2, delay: 1.6, duration: 2.6 },
  { top: "35%", left: "92%", size: 3, delay: 0.8, duration: 3.4 },
  { top: "48%", left: "25%", size: 2, delay: 2.4, duration: 2.9 },
  { top: "52%", left: "75%", size: 3, delay: 0.3, duration: 3.1 },
  { top: "60%", left: "12%", size: 2, delay: 1.9, duration: 2.7 },
  { top: "65%", left: "88%", size: 3, delay: 1.2, duration: 3.5 },
  { top: "72%", left: "35%", size: 2, delay: 0.6, duration: 3.0 },
  { top: "78%", left: "60%", size: 3, delay: 2.2, duration: 2.8 },
  { top: "85%", left: "20%", size: 2, delay: 0.9, duration: 3.3 },
  { top: "88%", left: "80%", size: 3, delay: 1.5, duration: 2.6 },
  { top: "18%", left: "55%", size: 2, delay: 0.4, duration: 2.9 },
  { top: "5%", left: "60%", size: 3, delay: 1.8, duration: 3.4 },
  { top: "95%", left: "45%", size: 2, delay: 1.0, duration: 2.7 },
  { top: "25%", left: "20%", size: 3, delay: 2.5, duration: 3.1 },
  { top: "58%", left: "42%", size: 2, delay: 0.7, duration: 2.8 },
  { top: "10%", left: "30%", size: 2, delay: 1.4, duration: 3.3 },
  { top: "44%", left: "8%", size: 3, delay: 2.1, duration: 2.9 },
  { top: "68%", left: "55%", size: 2, delay: 0.1, duration: 3.0 },
  { top: "92%", left: "65%", size: 3, delay: 1.7, duration: 2.6 },
  { top: "40%", left: "50%", size: 2, delay: 2.7, duration: 3.2 },
] as const;

function loadSave(): { scores: { X: number; O: number; D: number }; unlocked: number; musicOn: boolean; sfxOn: boolean } {
  const fallback = { scores: { X: 0, O: 0, D: 0 }, unlocked: 1, musicOn: true, sfxOn: true };
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const data = JSON.parse(raw);
    return {
      scores: data.scores ?? fallback.scores,
      unlocked: data.unlocked ?? fallback.unlocked,
      musicOn: data.musicOn ?? fallback.musicOn,
      sfxOn: data.sfxOn ?? fallback.sfxOn,
    };
  } catch {
    return fallback;
  }
}

function getWinningLine(board: Board): number[] | null {
  for (const line of WIN_LINES) {
    const [a, b, c] = line;
    if (board[a] && board[a] === board[b] && board[a] === board[c]) return line;
  }
  return null;
}

function emptyIndices(board: Board): number[] {
  return board.reduce<number[]>((acc, v, i) => {
    if (!v) acc.push(i);
    return acc;
  }, []);
}

function findDecisiveMove(board: Board, player: Player): number | undefined {
  for (const idx of emptyIndices(board)) {
    const copy = board.slice();
    copy[idx] = player;
    if (getWinningLine(copy)) return idx;
  }
  return undefined;
}

function minimax(board: Board, depth: number, isMaximizing: boolean): number {
  const winLine = getWinningLine(board);
  if (winLine) {
    const winner = board[winLine[0]];
    return winner === "O" ? 10 - depth : depth - 10;
  }
  if (board.every((c) => c)) return 0;

  const empties = emptyIndices(board);
  if (isMaximizing) {
    let best = -Infinity;
    for (const idx of empties) {
      const copy = board.slice();
      copy[idx] = "O";
      best = Math.max(best, minimax(copy, depth + 1, false));
    }
    return best;
  }
  let best = Infinity;
  for (const idx of empties) {
    const copy = board.slice();
    copy[idx] = "X";
    best = Math.min(best, minimax(copy, depth + 1, true));
  }
  return best;
}

function findBestMove(board: Board): number | undefined {
  let bestScore = -Infinity;
  let bestMove: number | undefined;
  for (const idx of emptyIndices(board)) {
    const copy = board.slice();
    copy[idx] = "O";
    const score = minimax(copy, 0, false);
    if (score > bestScore) {
      bestScore = score;
      bestMove = idx;
    }
  }
  return bestMove;
}

function getAIMove(board: Board, level: number): number | undefined {
  const empties = emptyIndices(board);
  if (level === 1) {
    return empties[Math.floor(Math.random() * empties.length)];
  }
  if (level === 2) {
    const winMove = findDecisiveMove(board, "O");
    if (winMove !== undefined) return winMove;
    const blockMove = findDecisiveMove(board, "X");
    if (blockMove !== undefined) return blockMove;
    return empties[Math.floor(Math.random() * empties.length)];
  }
  return findBestMove(board);
}

export default function Home() {
  const [screen, setScreen] = useState<Screen>("menu");
  const [showDifficulty, setShowDifficulty] = useState(false);
  const [mode, setMode] = useState<Mode>(null);
  const [level, setLevel] = useState(1);
  const [activeLevel, setActiveLevel] = useState(1);
  const [unlocked, setUnlocked] = useState(() => loadSave().unlocked);
  const [scores, setScores] = useState(() => loadSave().scores);
  const [musicOn, setMusicOn] = useState(() => loadSave().musicOn);
  const [sfxOn, setSfxOn] = useState(() => loadSave().sfxOn);

  const [board, setBoard] = useState<Board>(Array(9).fill(null));
  const [current, setCurrent] = useState<Player>("X");
  const [over, setOver] = useState(false);
  const [winLine, setWinLine] = useState<number[] | null>(null);
  const [winner, setWinner] = useState<Player | null>(null);
  const [status, setStatus] = useState("");
  const [resultMessage, setResultMessage] = useState("");

  const mounted = useRef(false);

  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ scores, unlocked, musicOn, sfxOn }));
  }, [scores, unlocked, musicOn, sfxOn]);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);

  useEffect(() => {
    primeAudio();
    if (musicOn) startMusic();
    return () => stopMusic();
  }, [musicOn]);

  function endGame(result: Player | null, line: number[] | null) {
    setOver(true);
    setWinLine(line);
    setWinner(result);

    if (result) {
      setScores((prev) => ({ ...prev, [result]: prev[result] + 1 }));
      if (mode === "1p" && result === "X" && level === unlocked && unlocked < 3) {
        const nextLevel = unlocked + 1;
        setUnlocked(nextLevel);
        setLevel(nextLevel);
        setResultMessage(`Level ${nextLevel} unlocked 🎉`);
      } else {
        setResultMessage("");
      }
      if (sfxOn) playWinSound();
      vibrate(mode === "1p" && result === "O" ? 120 : [40, 30, 40, 30, 60]);
    } else {
      setScores((prev) => ({ ...prev, D: prev.D + 1 }));
      setResultMessage("");
      if (sfxOn) playDrawSound();
      vibrate(80);
    }
  }

  function getShout(): string {
    if (winner === null) return "DRAW!";
    if (mode === "1p") return winner === "X" ? "YOU WIN!" : "AI WINS!";
    return `${winner} WINS!`;
  }

  function makeMove(idx: number, player: Player, targetBoard: Board) {
    const nextBoard = targetBoard.slice();
    nextBoard[idx] = player;
    setBoard(nextBoard);
    if (sfxOn) playMoveSound(player);

    const line = getWinningLine(nextBoard);
    if (line) {
      endGame(player, line);
      return;
    }
    if (nextBoard.every((c) => c)) {
      endGame(null, null);
      return;
    }

    const next = player === "X" ? "O" : "X";
    setCurrent(next);
    setStatus(mode === "1p" && next === "O" ? "AI is thinking..." : `${next}'s turn`);
  }

  useEffect(() => {
    if (screen !== "game" || over || mode !== "1p" || current !== "O") return;
    const timer = setTimeout(() => {
      const move = getAIMove(board, level);
      if (move !== undefined) makeMove(move, "O", board);
    }, 350);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen, over, mode, current, board, level]);

  function handleCellClick(idx: number) {
    if (over || board[idx]) return;
    if (mode === "1p" && current === "O") return;
    vibrate(15);
    makeMove(idx, current, board);
  }

  function startGame(nextMode: Mode, nextLevel?: number) {
    const lvl = nextLevel ?? level;
    setMode(nextMode);
    if (nextLevel !== undefined) setLevel(nextLevel);
    setActiveLevel(lvl);
    setBoard(Array(9).fill(null));
    setCurrent("X");
    setOver(false);
    setWinLine(null);
    setWinner(null);
    setResultMessage("");
    setStatus("X's turn");
    setScreen("game");
  }

  function showMenu() {
    setScreen("menu");
    setShowDifficulty(false);
  }

  function resetScores() {
    setScores({ X: 0, O: 0, D: 0 });
  }

  const canClick = !over && !(mode === "1p" && current === "O");

  return (
    <div className={styles.page}>
      <div className={styles.bgDecor} aria-hidden="true">
        <div className={`${styles.ringWrap} ${styles.ringLeft}`}>
          <div className={styles.ringGlowPulse} />
          <div className={styles.ringOuter}>
            <svg className={styles.ringSvg} viewBox="0 0 400 400">
              <circle cx="200" cy="200" r="180" />
            </svg>
            <span className={styles.ringSpark} />
          </div>
          <div className={styles.ringInner}>
            <svg className={styles.ringSvg} viewBox="0 0 400 400">
              <circle cx="200" cy="200" r="130" />
            </svg>
          </div>
        </div>

        <div className={`${styles.ringWrap} ${styles.ringRight}`}>
          <div className={styles.ringGlowPulse} />
          <div className={styles.ringOuter}>
            <svg className={styles.ringSvg} viewBox="0 0 400 400">
              <circle cx="200" cy="200" r="180" />
            </svg>
            <span className={styles.ringSpark} />
          </div>
          <div className={styles.ringInner}>
            <svg className={styles.ringSvg} viewBox="0 0 400 400">
              <circle cx="200" cy="200" r="130" />
            </svg>
          </div>
        </div>

        <div className={styles.circuitFade} />

        <div className={`${styles.iconSlot} ${styles.slotGamepad}`}>
          <span className={`${styles.iconPulse} ${styles.pulsePurple}`} />
          <svg className={styles.icon} viewBox="0 0 64 40">
            <path d="M16 10h32a12 12 0 0 1 12 12v6a10 10 0 0 1-18 6l-4-5H26l-4 5a10 10 0 0 1-18-6v-6A12 12 0 0 1 16 10Z" />
            <path d="M21 18v9M16.5 22.5h9" />
            <circle cx="46" cy="19" r="2" />
            <circle cx="51" cy="24" r="2" />
            <circle cx="46" cy="29" r="2" />
            <circle cx="41" cy="24" r="2" />
          </svg>
        </div>

        <div className={`${styles.iconSlot} ${styles.slotDice}`}>
          <span className={`${styles.iconPulse} ${styles.pulsePink}`} />
          <svg className={styles.icon} viewBox="0 0 40 40">
            <rect x="4" y="4" width="32" height="32" rx="8" />
            <circle cx="14" cy="14" r="2.2" fill="currentColor" />
            <circle cx="26" cy="14" r="2.2" fill="currentColor" />
            <circle cx="20" cy="20" r="2.2" fill="currentColor" />
            <circle cx="14" cy="26" r="2.2" fill="currentColor" />
            <circle cx="26" cy="26" r="2.2" fill="currentColor" />
          </svg>
        </div>

        <div className={`${styles.iconSlot} ${styles.slotJoystick}`}>
          <span className={`${styles.iconPulse} ${styles.pulseBlue}`} />
          <svg className={styles.icon} viewBox="0 0 40 56">
            <ellipse cx="20" cy="48" rx="16" ry="6" />
            <rect x="17" y="16" width="6" height="30" rx="3" />
            <circle cx="20" cy="12" r="10" />
          </svg>
        </div>

        <div className={`${styles.iconSlot} ${styles.slotTrophy}`}>
          <span className={`${styles.iconPulse} ${styles.pulsePink}`} />
          <svg className={styles.icon} viewBox="0 0 40 48">
            <path d="M10 4h20v10a10 10 0 0 1-20 0V4Z" />
            <path d="M10 8H4a6 6 0 0 0 6 10" />
            <path d="M30 8h6a6 6 0 0 1-6 10" />
            <path d="M20 24v8" />
            <path d="M12 40h16l-2-6H14l-2 6Z" />
          </svg>
        </div>

        <div className={`${styles.iconSlot} ${styles.slotHeadset}`}>
          <span className={`${styles.iconPulse} ${styles.pulsePurple}`} />
          <svg className={styles.icon} viewBox="0 0 48 40">
            <path d="M8 22v-4a16 16 0 0 1 32 0v4" />
            <rect x="4" y="20" width="10" height="14" rx="4" />
            <rect x="34" y="20" width="10" height="14" rx="4" />
          </svg>
        </div>

        <div className={`${styles.iconSlot} ${styles.slotCrosshair}`}>
          <span className={`${styles.iconPulse} ${styles.pulseRed}`} />
          <svg className={styles.icon} viewBox="0 0 40 40">
            <circle cx="20" cy="20" r="16" />
            <circle cx="20" cy="20" r="8" />
            <path d="M20 2v8M20 30v8M2 20h8M30 20h8" />
          </svg>
        </div>

        <div className={`${styles.iconSlot} ${styles.slotStar}`}>
          <span className={`${styles.iconPulse} ${styles.pulseBlue}`} />
          <svg className={styles.icon} viewBox="0 0 40 40">
            <path d="M20 4l4.6 9.4L35 15l-7.5 7.3L29.4 33 20 27.8 10.6 33l1.9-10.7L5 15l10.4-1.6L20 4Z" />
          </svg>
        </div>

        <div className={`${styles.iconSlot} ${styles.slotPower}`}>
          <span className={`${styles.iconPulse} ${styles.pulsePurple}`} />
          <svg className={styles.icon} viewBox="0 0 28 40">
            <path d="M16 2 4 22h9l-3 16 15-22h-9l3-14Z" />
          </svg>
        </div>

        {SPARKLES.map((s, i) => (
          <span
            key={i}
            className={styles.sparkle}
            style={{
              top: s.top,
              left: s.left,
              width: s.size,
              height: s.size,
              animationDelay: `${s.delay}s`,
              animationDuration: `${s.duration}s`,
            }}
          />
        ))}
      </div>

      <div className={styles.app}>
        <h1 className={styles.title}>
          Tic<span className={styles.titleAccent}>_</span>Tac<span className={styles.titleAccent}>_</span>Toe
        </h1>

        <div className={styles.audioControls}>
          <button
            className={`${styles.audioBtn} ${musicOn ? "" : styles.audioOff}`}
            onClick={() => setMusicOn((v) => !v)}
            aria-label="Toggle music"
          >
            {musicOn ? "🎵" : "🎵🚫"}
          </button>
          <button
            className={`${styles.audioBtn} ${sfxOn ? "" : styles.audioOff}`}
            onClick={() => setSfxOn((v) => !v)}
            aria-label="Toggle sound effects"
          >
            {sfxOn ? "🔊" : "🔇"}
          </button>
        </div>

        {screen === "menu" && (
          <section className={styles.panel}>
            <h2 className={styles.modeHeading}>Choose a mode</h2>
            <div className={styles.modeButtons}>
              <button
                className={`${styles.btn} ${styles.primary}`}
                onClick={() => setShowDifficulty(true)}
              >
                1 Player (vs AI)
              </button>
              <button
                className={`${styles.btn} ${styles.primary}`}
                onClick={() => startGame("2p")}
              >
                2 Players
              </button>
            </div>

            {showDifficulty && (
              <div className={styles.difficultyWrap}>
                <h3 className={styles.diffHeading}>Difficulty</h3>
                <div className={styles.modeButtons}>
                  {[1, 2, 3].map((lvl) => {
                    const locked = lvl > unlocked;
                    return (
                      <button
                        key={lvl}
                        className={`${styles.btn} ${styles.diff} ${locked ? styles.locked : ""}`}
                        disabled={locked}
                        onClick={() => startGame("1p", lvl)}
                      >
                        Level {lvl} · {LEVEL_NAMES[lvl - 1]}
                        {locked ? " (locked)" : ""}
                      </button>
                    );
                  })}
                </div>
                <p className={styles.hint}>Win a level to unlock the next one.</p>
              </div>
            )}
          </section>
        )}

        {screen === "game" && (
          <section className={styles.panel}>
            <div className={styles.topbar}>
              <div className={styles.scoreboard}>
                <div className={`${styles.scoreCell} ${styles.x}`}>
                  <span className={styles.scoreLabel}>X</span>
                  <span className={styles.scoreValue}>{scores.X}</span>
                </div>
                <div className={styles.scoreCell}>
                  <span className={styles.scoreLabel}>Draws</span>
                  <span className={styles.scoreValue}>{scores.D}</span>
                </div>
                <div className={`${styles.scoreCell} ${styles.o}`}>
                  <span className={styles.scoreLabel}>{mode === "1p" ? "AI" : "O"}</span>
                  <span className={styles.scoreValue}>{scores.O}</span>
                </div>
              </div>
              {mode === "1p" && <div className={styles.badge}>Level {activeLevel}</div>}
            </div>

            <p className={styles.status}>{over ? "" : status}</p>

            <div className={styles.boardWrap}>
              <div className={`${styles.board} ${over ? styles.boardDim : ""}`}>
                {board.map((val, idx) => (
                  <div
                    key={idx}
                    className={`${styles.cell} ${val ? `${styles.taken} ${styles[val.toLowerCase()]}` : ""} ${
                      !val && !canClick ? styles.disabled : ""
                    } ${winLine?.includes(idx) ? styles.win : ""}`}
                    data-preview={!val && canClick ? current : undefined}
                    onClick={() => handleCellClick(idx)}
                  >
                    {val || ""}
                  </div>
                ))}
              </div>

              {over && (
                <div className={styles.resultOverlay}>
                  <div className={styles.resultCard}>
                    <span className={styles.resultShout}>{getShout()}</span>
                    {resultMessage && <span className={styles.resultSub}>{resultMessage}</span>}
                  </div>
                </div>
              )}
            </div>

            <div className={styles.controls}>
              <button
                className={`${styles.btn} ${styles.primary}`}
                onClick={() => startGame(mode, mode === "1p" ? level : undefined)}
              >
                Play Again
              </button>
              <button className={styles.btn} onClick={showMenu}>
                Change Mode
              </button>
              <button className={`${styles.btn} ${styles.subtle}`} onClick={resetScores}>
                Reset Scores
              </button>
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
