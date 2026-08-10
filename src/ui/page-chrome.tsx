import { SquareCode } from "lucide-react";

import {
  AlchemicalMark,
  DoubleBarInvertedCross,
} from "./alchemical-mark";
import {
  HERO_TAGLINE,
  SUPPORTED_GAME_VERSION_LABEL,
} from "./copy";
import "./page-chrome.css";

export function Topbar() {
  return (
    <header className="topbar">
      <div className="topbar-mark" aria-hidden="true">
        <svg viewBox="0 0 64 82">
          <path
            className="crown-body"
            d="M5 7c12 0 20 10 27 30C39 17 47 7 59 7l2 58c-15 12-43 13-58 0L5 7Z"
          />
          <path
            className="crown-eye"
            d="M12 49c11-13 29-13 40 0-11 13-29 13-40 0Z"
          />
          <ellipse className="crown-pupil" cx="32" cy="49" rx="4" ry="10" />
        </svg>
      </div>
      <span>Unofficial fan-made save tool</span>
      <a
        className="topbar-source"
        href="https://github.com/yzhang2907/cotl-save-editor"
        target="_blank"
        rel="noreferrer"
      >
        <SquareCode aria-hidden="true" size={16} strokeWidth={2.5} />
        Source code
      </a>
    </header>
  );
}

export function Hero() {
  return (
    <header className="hero">
      <div className="hero-copy">
        <p className="eyebrow">
          <DoubleBarInvertedCross />
          Cult of the Lamb
          <DoubleBarInvertedCross />
        </p>
        <h1>
          <span>Save</span> Editor
        </h1>
        <p className="hook">{HERO_TAGLINE}</p>
      </div>

      <div className="save-emblem" aria-hidden="true">
        <AlchemicalMark
          className="alchemy-mark-one"
          kind="black-sulfur"
        />
        <AlchemicalMark className="alchemy-mark-two" kind="salt" />
        <AlchemicalMark className="alchemy-mark-three" kind="sulfur" />
        <svg
          className="save-disk-art"
          viewBox="0 0 280 260"
          role="presentation"
        >
          <path className="disk-body" d="M48 25h137l45 44v165H48V25Z" />
          <path className="disk-corner" d="M185 26v43h43" />
          <path className="disk-label" d="M77 25h103v76H77V25Z" />
          <path className="disk-shutter" d="M135 42h29v42h-29V42Z" />
          <path className="disk-panel" d="M75 137h128v97H75v-97Z" />
          <path
            className="disk-eye"
            d="M96 181c22-25 64-25 86 0-22 25-64 25-86 0Z"
          />
          <ellipse className="disk-pupil" cx="139" cy="181" rx="7" ry="15" />
          <circle className="disk-screw" cx="65" cy="119" r="5" />
          <path className="disk-scratch" d="m190 112 15-8m-10 16 14-1" />
        </svg>
      </div>
    </header>
  );
}

export function PageFooter() {
  return (
    <footer>
      <span>Not affiliated with Massive Monster or Devolver Digital</span>
      <span>{SUPPORTED_GAME_VERSION_LABEL}</span>
      <span>Back up thy save.</span>
    </footer>
  );
}
