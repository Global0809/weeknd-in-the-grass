"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowUpRight,
  ArrowDown,
  X,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  Info,
  List,
  Check,
  Share2,
  ExternalLink,
  Leaf,
} from "lucide-react";
import { ERAS } from "../src/eras.js";

const formatTime = (value) =>
  `${Math.floor((value || 0) / 60)}:${String(Math.floor((value || 0) % 60)).padStart(2, "0")}`;
const formatDate = (value) =>
  value
    ? new Intl.DateTimeFormat("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        timeZone: "UTC",
      }).format(new Date(`${value}T12:00:00Z`))
    : "";

export default function MeadowExperience() {
  const host = useRef(null),
    engine = useRef(null),
    audio = useRef(null),
    audioRequest = useRef(0);
  const detailDialog = useRef(null),
    indexDialog = useRef(null),
    selectedRef = useRef(null),
    detailCard = useRef(null);
  const actions = useRef({}),
    hoveredRef = useRef(null),
    buttonsRef = useRef([]),
    lastFocus = useRef(null),
    copyRequest = useRef(0),
    copyTimer = useRef(0),
    detailBackdropPress = useRef(null),
    railGrab = useRef(0);
  const [ready, setReady] = useState(false),
    [fallback, setFallback] = useState(false);
  const [selected, setSelected] = useState(null),
    [indexOpen, setIndexOpen] = useState(false);
  const [active, setActive] = useState(null),
    [trackIndex, setTrackIndex] = useState(0);
  const [playing, setPlaying] = useState(false),
    [muted, setMuted] = useState(false);
  const [time, setTime] = useState(0),
    [duration, setDuration] = useState(0);
  const [audioError, setAudioError] = useState(false),
    [copiedEra, setCopiedEra] = useState(null);
  const [cardImages, setCardImages] = useState([]),
    [quality, setQuality] = useState("auto");
  const [progress, setProgress] = useState(0),
    [hovered, setHovered] = useState(null);
  const [status, setStatus] = useState("Growing the meadow");
  const [liveInspection, setLiveInspection] = useState(false);

  const resetCopyFeedback = useCallback(() => {
    copyRequest.current++;
    window.clearTimeout(copyTimer.current);
    copyTimer.current = 0;
    setCopiedEra(null);
  }, []);

  const closeDetails = useCallback(() => {
    resetCopyFeedback();
    detailBackdropPress.current = null;
    setSelected(null);
    selectedRef.current = null;
    engine.current?.setSelected?.(null);
    if (window.location.hash)
      history.replaceState(
        null,
        "",
        window.location.pathname + window.location.search,
      );
  }, [resetCopyFeedback]);

  const showDetails = useCallback(
    (index) => {
      if (selectedRef.current !== index) resetCopyFeedback();
      detailBackdropPress.current = null;
      if (
        selectedRef.current === null &&
        !document.activeElement?.closest("dialog")
      )
        lastFocus.current =
          document.activeElement?.tagName === "BODY"
            ? buttonsRef.current[index]
            : document.activeElement;
      setIndexOpen(false);
      setSelected(index);
      selectedRef.current = index;
      engine.current?.setSelected?.(index);
      history.replaceState(null, "", `#${ERAS[index].id}`);
    },
    [resetCopyFeedback],
  );

  useEffect(
    () => () => {
      copyRequest.current++;
      window.clearTimeout(copyTimer.current);
      detailBackdropPress.current = null;
    },
    [],
  );

  const playTrack = useCallback(
    async (eraIndex, nextTrack = 0, toggle = true) => {
      const player = audio.current;
      if (!player) return;
      const request = ++audioRequest.current;
      const track = ERAS[eraIndex].tracks?.[nextTrack];
      const same =
        player.dataset.era === String(eraIndex) &&
        player.dataset.track === String(nextTrack);
      const retry =
        same && (player.dataset.failed === "true" || Boolean(player.error));
      if (same && toggle && !retry && !player.paused) {
        player.pause();
        return;
      }
      setActive(eraIndex);
      setTrackIndex(nextTrack);
      setAudioError(false);
      engine.current?.setPlaying?.(eraIndex);
      if (!track?.preview) {
        player.pause();
        setPlaying(false);
        setAudioError(true);
        return;
      }
      if (!same || retry) {
        player.pause();
        player.src = track.preview;
        player.dataset.era = String(eraIndex);
        player.dataset.track = String(nextTrack);
        player.dataset.failed = "false";
        if (retry) player.load();
        setTime(0);
        setDuration(0);
      }
      try {
        await player.play();
      } catch (error) {
        if (error?.name !== "AbortError" && request === audioRequest.current) {
          player.dataset.failed = "true";
          setAudioError(true);
          setPlaying(false);
        }
      }
    },
    [],
  );
  const selectEra = useCallback(
    (index) => {
      const player = audio.current;
      const currentTrack =
        player?.dataset.era === String(index)
          ? Number(player.dataset.track) || 0
          : 0;
      return playTrack(index, currentTrack);
    },
    [playTrack],
  );
  actions.current = { playTrack, selectEra, showDetails, closeDetails };

  useEffect(() => {
    const player = new Audio();
    player.preload = "none";
    player.volume = 0.65;
    audio.current = player;
    const onPlay = () => {
      player.dataset.failed = "false";
      setAudioError(false);
      setPlaying(true);
      engine.current?.setAudioState?.(true);
    };
    const onPause = () => {
      setPlaying(false);
      engine.current?.setAudioState?.(false);
    };
    const onTime = () => setTime(player.currentTime);
    const onDuration = () =>
      setDuration(Number.isFinite(player.duration) ? player.duration : 0);
    const onError = () => {
      player.dataset.failed = "true";
      setAudioError(true);
      setPlaying(false);
    };
    const events = {
      play: onPlay,
      pause: onPause,
      timeupdate: onTime,
      durationchange: onDuration,
      ended: onPause,
      error: onError,
    };
    Object.entries(events).forEach(([name, handler]) =>
      player.addEventListener(name, handler),
    );
    return () => {
      Object.entries(events).forEach(([name, handler]) =>
        player.removeEventListener(name, handler),
      );
      player.pause();
      player.removeAttribute("src");
      player.load();
      audio.current = null;
    };
  }, []);

  useEffect(() => {
    let cancelled = false,
      scene,
      cursor;
    const motion = matchMedia("(prefers-reduced-motion: reduce)");
    const start = async () => {
      try {
        const [module, cursorModule] = await Promise.all([
          import("../src/scene.js"),
          import("../src/cursor.js"),
          document.fonts.ready,
        ]);
        if (cancelled) return;
        cursor = cursorModule.createReferenceCursor({
          getCardHover: () => hoveredRef.current !== null,
        });
        scene = module.createMeadow({
          container: host.current,
          eras: ERAS,
          reducedMotion: motion.matches,
          cardButtons: buttonsRef.current,
          onReady: (images) => {
            if (!cancelled) {
              engine.current?.setSelected?.(selectedRef.current);
              engine.current?.setDetailElement?.(
                selectedRef.current !== null ? detailCard.current : null,
              );
              setCardImages(images || []);
              setReady(true);
              setStatus("The meadow is ready. Select a card to listen.");
            }
          },
          onSelect: (index) => actions.current.selectEra(index),
          onDetail: (index) => actions.current.showDetails(index),
          onHover: (index) => {
            hoveredRef.current = index;
            setHovered(index);
          },
          onProgress: (value) => setProgress(value),
          onInspectionChange: (value) => {
            if (!cancelled) setLiveInspection(value);
          },
          onArtwork: (index, dataURL) => {
            if (!cancelled)
              setCardImages((previous) => {
                const next = previous.slice();
                next[index] = dataURL;
                return next;
              });
          },
          onError: () => {
            if (!cancelled) {
              hoveredRef.current = null;
              setHovered(null);
              engine.current?.dispose();
              engine.current = null;
              setLiveInspection(false);
              setFallback(true);
              setReady(true);
              setStatus("Album collection ready.");
            }
          },
        });
        engine.current = scene;
      } catch (error) {
        console.error("The meadow could not start", error);
        if (!cancelled) {
          hoveredRef.current = null;
          setHovered(null);
          setLiveInspection(false);
          setFallback(true);
          setReady(true);
          setStatus("Album collection ready.");
        }
      }
    };
    start();
    const updateMotion = () => scene?.setReducedMotion?.(motion.matches);
    motion.addEventListener("change", updateMotion);
    return () => {
      cancelled = true;
      motion.removeEventListener("change", updateMotion);
      scene?.dispose();
      cursor?.dispose();
      engine.current = null;
    };
  }, []);

  useEffect(() => {
    if (!ready) return;
    const syncEraFromHash = () => {
      let id = "";
      try {
        id = decodeURIComponent(location.hash.slice(1));
      } catch {}
      const index = ERAS.findIndex((era) => era.id === id);
      if (index >= 0) {
        if (selectedRef.current !== index) showDetails(index);
      } else if (selectedRef.current !== null) closeDetails();
    };
    syncEraFromHash();
    window.addEventListener("hashchange", syncEraFromHash);
    return () => window.removeEventListener("hashchange", syncEraFromHash);
  }, [ready, showDetails, closeDetails]);

  useEffect(() => {
    const dialog = detailDialog.current;
    if (selected !== null && dialog && !dialog.open) dialog.showModal();
    if (selected !== null && dialog) {
      dialog.scrollTop = 0;
      const content = dialog.querySelector(".detail-content");
      if (content) content.scrollTop = 0;
    }
    engine.current?.setDetailElement?.(
      selected !== null ? detailCard.current : null,
    );
    if (selected === null && dialog?.open) dialog.close();
    if (selected === null && ready) {
      const target =
        lastFocus.current?.isConnected && !lastFocus.current.closest("dialog")
          ? lastFocus.current
          : document.querySelector(".eras-button");
      target?.focus({ preventScroll: true });
    }
  }, [selected]);
  useEffect(() => {
    const dialog = indexDialog.current;
    if (indexOpen && !dialog?.open) dialog?.showModal();
    if (!indexOpen && dialog?.open) dialog.close();
    engine.current?.setPaused?.(indexOpen);
  }, [indexOpen]);
  useEffect(() => {
    engine.current?.setPlaying?.(active);
    engine.current?.setAudioState?.(playing);
  }, [active, playing]);

  const shareEra = async (index) => {
    if (selectedRef.current !== index) return;
    const request = ++copyRequest.current;
    window.clearTimeout(copyTimer.current);
    copyTimer.current = 0;
    setCopiedEra(null);
    const url = `${location.origin}${location.pathname}#${ERAS[index].id}`;
    const isCurrent = () =>
      request === copyRequest.current && selectedRef.current === index;
    try {
      await navigator.clipboard.writeText(url);
      if (!isCurrent()) return;
      setCopiedEra(ERAS[index].id);
      copyTimer.current = window.setTimeout(() => {
        if (isCurrent()) {
          setCopiedEra(null);
          copyTimer.current = 0;
        }
      }, 2200);
    } catch {
      if (!isCurrent()) return;
      setStatus("The address bar now contains this era’s link.");
    }
  };
  const changeQuality = () => {
    const next =
      quality === "auto"
        ? "balanced"
        : quality === "balanced"
          ? "high"
          : "auto";
    setQuality(next);
    engine.current?.setQuality?.(next);
  };
  const currentEra = active === null ? null : ERAS[active],
    currentTrack = currentEra?.tracks?.[trackIndex];
  const era = selected === null ? null : ERAS[selected];
  const copied = era && copiedEra === era.id;
  const openIndex = () => {
    lastFocus.current = document.activeElement;
    setIndexOpen(true);
  };

  const player = currentEra ? (
    <section className="music-player" aria-label="Music preview player">
      <input
        className="player-seek"
        type="range"
        min="0"
        max={duration || 1}
        step=".1"
        value={duration ? Math.min(time, duration) : 0}
        disabled={!duration}
        aria-label="Seek within preview"
        onChange={(event) => {
          if (audio.current && duration) {
            audio.current.currentTime = Number(event.target.value);
            setTime(Number(event.target.value));
          }
        }}
        style={{ "--played": `${duration ? (time / duration) * 100 : 0}%` }}
      />
      <button
        className="player-title"
        onClick={() => showDetails(active)}
        aria-label={`Details for ${currentEra.title}`}
      >
        <img src={currentEra.artwork} alt="" width="38" height="38" />
        <span>
          <strong>{currentTrack?.title || currentEra.title}</strong>
          <small>
            {currentEra.title} <span className="preview-mark">/ PREVIEW</span>
          </small>
        </span>
      </button>
      <div className="playback-controls">
        <button
          className="icon-button secondary-player-control"
          aria-label="Previous era"
          onClick={() =>
            playTrack((active - 1 + ERAS.length) % ERAS.length, 0, false)
          }
        >
          <SkipBack size={15} fill="currentColor" />
        </button>
        <button
          className="icon-button play-button"
          aria-label={
            audioError
              ? "Retry preview"
              : playing
                ? "Pause preview"
                : "Play preview"
          }
          onClick={() => playTrack(active, trackIndex)}
        >
          {playing ? (
            <Pause size={19} fill="currentColor" />
          ) : (
            <Play size={19} fill="currentColor" />
          )}
        </button>
        <button
          className="icon-button secondary-player-control"
          aria-label="Next era"
          onClick={() => playTrack((active + 1) % ERAS.length, 0, false)}
        >
          <SkipForward size={15} fill="currentColor" />
        </button>
        <button
          className="icon-button mobile-mute-control"
          aria-label={muted ? "Unmute preview" : "Mute preview"}
          onClick={() => {
            setMuted(!muted);
            if (audio.current) audio.current.muted = !muted;
          }}
        >
          {muted ? <VolumeX size={14} /> : <Volume2 size={14} />}
        </button>
      </div>
      <div className="player-end">
        <span className="player-time">
          {formatTime(time)}{" "}
          <span>/ {duration ? formatTime(duration) : "--:--"}</span>
        </span>
        <button
          className="icon-button"
          aria-label={muted ? "Unmute preview" : "Mute preview"}
          onClick={() => {
            const value = !muted;
            setMuted(value);
            if (audio.current) audio.current.muted = value;
          }}
        >
          {muted ? <VolumeX size={16} /> : <Volume2 size={16} />}
        </button>
        <button
          className="text-button player-details"
          onClick={() => showDetails(active)}
        >
          <Info size={13} />
          <span>THE ERA</span>
        </button>
      </div>
      {audioError ? (
        <p className="audio-error">
          Preview unavailable.{" "}
          <a
            href={currentTrack?.stream || currentEra.stream}
            target="_blank"
            rel="noopener noreferrer"
          >
            Listen on Apple Music <ArrowUpRight size={12} />
          </a>
        </p>
      ) : null}
    </section>
  ) : null;

  return (
    <main
      className={`experience ${ready ? "is-ready" : "is-loading"} ${selected !== null ? "has-details" : ""} ${liveInspection ? "has-live-inspection" : ""} ${fallback ? "is-fallback" : ""} ${active !== null ? "has-player" : ""}`}
    >
      <div
        className="meadow-host"
        ref={host}
        id="meadow-field"
        aria-hidden="true"
      />
      <div className="field-vignette" aria-hidden="true" />
      <header className="site-header">
        <button className="frame-button eras-button" onClick={openIndex}>
          <ArrowLeft size={15} />
          <span>THE ERAS</span>
        </button>
        <div className="site-title">
          <h1>The Weeknd</h1>
          <p>A JOURNEY THROUGH THE ERAS. FROM DUSK TO DAWN.</p>
        </div>
        <a
          className="xo-signature"
          href="https://www.theweeknd.com/"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Visit The Weeknd’s official website"
        >
          <img src={import.meta.env.BASE_URL + "artist/xo-logo.png"} alt="XO" width="36" height="36" />
          <ArrowUpRight size={10} />
        </a>
      </header>
      <div className="loading-screen" aria-hidden={ready}>
        <span className="loading-wordmark">The Weeknd</span>
        <span className="loading-caption">A WORLD TAKING ROOT</span>
        <span className="loading-line">
          <i />
        </span>
      </div>
      <div
        className="canvas-card-controls"
        aria-label="Explore The Weeknd’s eras"
      >
        {ERAS.map((item, index) => (
          <button
            key={item.id}
            ref={(node) => {
              buttonsRef.current[index] = node;
            }}
            className="canvas-card-control"
            aria-label={`${item.title.replace(/,$/, "")}, ${item.year}. Enter to listen. I for era details.`}
            onFocus={() => engine.current?.focusCard?.(index)}
            onBlur={() => engine.current?.setHovered?.(null)}
            onClick={() => selectEra(index)}
            onKeyDown={(event) => {
              if (event.key.toLowerCase() === "i") {
                event.preventDefault();
                showDetails(index);
              }
            }}
          >
            <span>{item.title}</span>
          </button>
        ))}
      </div>
      {fallback ? (
        <div className="fallback-collection" aria-label="Album collection">
          {ERAS.map((item, index) => (
            <article className="fallback-card" key={item.id}>
              <button onClick={() => selectEra(index)}>
                <img src={item.artwork} alt={`${item.title} cover`} />
                <span className="fallback-name">{item.title}</span>
                <small>
                  {item.year} / {item.kind}
                </small>
              </button>
              <button
                className="fallback-detail"
                onClick={() => showDetails(index)}
              >
                EXPLORE THE ERA <ArrowUpRight size={12} />
              </button>
            </article>
          ))}
        </div>
      ) : null}
      <footer className="field-footer">
        <div className="explore-hint">
          <span className="desktop-hint">
            {hovered !== null
              ? "CLICK TO LISTEN · RIGHT-CLICK TO EXPLORE"
              : "MOVE THROUGH THE GRASS"}
          </span>
          <span className="mobile-hint">TAP TO LISTEN · HOLD FOR DETAILS</span>
        </div>
        <button className="browse-button frame-button" onClick={openIndex}>
          BROWSE ALL {ERAS.length} ERAS <List size={12} />
        </button>
        <div className="footer-corners">
          <span className="concept-credit">A CREATIVE CONCEPT</span>
          <button
            className="quality-button"
            onClick={changeQuality}
            title="Switch rendering quality"
            aria-label={`Rendering quality: ${quality}. Click to change.`}
          >
            <Leaf size={11} />
            {quality === "auto" ? "AUTO" : quality === "high" ? "HIGH" : "LITE"}
          </button>
        </div>
        {!fallback ? (
          <button
            className="scroll-cue"
            onClick={() => engine.current?.scrollBy?.(0.78)}
            aria-label="Explore more eras"
          >
            <ArrowDown size={18} />
          </button>
        ) : null}
      </footer>
      {!fallback ? (
        <div
          className="scroll-rail"
          role="scrollbar"
          aria-controls="meadow-field"
          aria-orientation="vertical"
          aria-label="Meadow position"
          aria-valuemin="0"
          aria-valuemax="100"
          aria-valuenow={Math.round(progress * 100)}
          tabIndex={0}
          onKeyDown={(event) => {
            if (["ArrowDown", "PageDown"].includes(event.key)) {
              event.preventDefault();
              engine.current?.scrollBy?.(0.65);
            }
            if (["ArrowUp", "PageUp"].includes(event.key)) {
              event.preventDefault();
              engine.current?.scrollBy?.(-0.65);
            }
            if (event.key === "Home") engine.current?.scrollToProgress?.(0);
            if (event.key === "End") engine.current?.scrollToProgress?.(1);
          }}
          onPointerDown={(event) => {
            event.currentTarget.setPointerCapture(event.pointerId);
            const thumbTop = progress * window.innerHeight * 0.76;
            railGrab.current =
              event.target.tagName === "I"
                ? event.clientY - thumbTop
                : window.innerHeight * 0.12;
            engine.current?.scrollToProgress?.(
              (event.clientY - railGrab.current) / (window.innerHeight * 0.76),
            );
          }}
          onPointerMove={(event) => {
            if (event.currentTarget.hasPointerCapture(event.pointerId))
              engine.current?.scrollToProgress?.(
                (event.clientY - railGrab.current) /
                  (window.innerHeight * 0.76),
              );
          }}
        >
          <i style={{ transform: `translateY(${progress * 76}vh)` }} />
        </div>
      ) : null}
      {selected === null && !indexOpen ? player : null}

      <dialog
        className="era-dialog"
        ref={detailDialog}
        onPointerDown={(event) => {
          detailBackdropPress.current = null;
          if (
            event.button === 0 &&
            !event.target.closest(
              ".detail-content,.detail-header,.detail-art,.music-player",
            )
          )
            detailBackdropPress.current = {
              id: event.pointerId,
              x: event.clientX,
              y: event.clientY,
            };
        }}
        onPointerMove={(event) => {
          const press = detailBackdropPress.current;
          if (
            press?.id === event.pointerId &&
            Math.hypot(event.clientX - press.x, event.clientY - press.y) > 6
          )
            detailBackdropPress.current = null;
        }}
        onPointerUp={(event) => {
          const press = detailBackdropPress.current;
          detailBackdropPress.current = null;
          if (
            press?.id === event.pointerId &&
            Math.hypot(event.clientX - press.x, event.clientY - press.y) <= 6 &&
            !event.target.closest(
              ".detail-content,.detail-header,.detail-art,.music-player",
            )
          )
            closeDetails();
        }}
        onPointerCancel={() => {
          detailBackdropPress.current = null;
        }}
        onLostPointerCapture={() => {
          detailBackdropPress.current = null;
        }}
        onScrollCapture={() => {
          detailBackdropPress.current = null;
        }}
        onCancel={(event) => {
          event.preventDefault();
          closeDetails();
        }}
        onClose={() => {
          if (selectedRef.current !== null) closeDetails();
        }}
        aria-labelledby="era-detail-title"
      >
        {era ? (
          <>
            <div className="detail-header">
              <button className="frame-button" onClick={closeDetails}>
                <ArrowLeft size={15} />
                BACK TO THE MEADOW
              </button>
              <span className="dialog-artist">The Weeknd</span>
              <button
                autoFocus
                className="icon-button close-detail"
                onClick={closeDetails}
                aria-label="Close era details"
              >
                <X size={20} />
              </button>
            </div>
            <div className="detail-layout">
              <div className="detail-art-wrap">
                <button
                  ref={detailCard}
                  onPointerMove={(event) => {
                    const r = event.currentTarget.getBoundingClientRect();
                    engine.current?.setDetailPointer?.(
                      (event.clientX - r.left) / r.width,
                      1 - (event.clientY - r.top) / r.height,
                    );
                  }}
                  onPointerLeave={() =>
                    engine.current?.setDetailPointer?.(0.5, 0.5)
                  }
                  className={`detail-art ${playing && active === selected ? "is-playing" : ""}`}
                  onClick={() =>
                    playTrack(selected, active === selected ? trackIndex : 0)
                  }
                  aria-label={
                    playing && active === selected
                      ? `Pause ${currentTrack?.title || era.title}`
                      : `Listen to ${era.title}`
                  }
                >
                  <img
                    src={cardImages[selected] || era.artwork}
                    alt={`${era.title} era card`}
                  />
                  <span className="detail-play">
                    {playing && active === selected ? (
                      <Pause size={18} fill="currentColor" />
                    ) : (
                      <Play size={18} fill="currentColor" />
                    )}
                  </span>
                </button>
                <span className="detail-art-caption">PRESS CARD TO LISTEN</span>
              </div>
              <section className="detail-content">
                <div className="detail-title-row">
                  <h2 id="era-detail-title">{era.title}</h2>
                  <span className="era-year">{era.year}</span>
                </div>
                <p className="era-description">{era.description}</p>
                <dl className="era-facts">
                  <div>
                    <dt>RELEASED</dt>
                    <dd>{formatDate(era.date) || era.year}</dd>
                  </div>
                  <div>
                    <dt>THE ERA</dt>
                    <dd>{era.kind || "ALBUM"}</dd>
                  </div>
                  <div>
                    <dt>SOUND</dt>
                    <dd className="tag-list">
                      {era.tags.map((tag) => (
                        <span key={tag}>{tag}</span>
                      ))}
                    </dd>
                  </div>
                </dl>
                <div
                  className="track-list"
                  aria-label={`${era.title} selected tracks`}
                >
                  {era.tracks?.map((track, index) => (
                    <button
                      key={track.title}
                      className={`track-row ${active === selected && trackIndex === index ? "is-active" : ""}`}
                      onClick={() => playTrack(selected, index)}
                    >
                      <span className="track-number">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <span className="track-name">{track.title}</span>
                      <span className="track-preview">PREVIEW</span>
                      {active === selected &&
                      trackIndex === index &&
                      playing ? (
                        <Pause size={12} fill="currentColor" />
                      ) : (
                        <Play size={12} fill="currentColor" />
                      )}
                    </button>
                  ))}
                </div>
                <div className="detail-actions">
                  <a
                    className="frame-button listen-full"
                    href={era.stream}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    LISTEN TO THE FULL ERA <ArrowUpRight size={13} />
                  </a>
                  <button
                    className="frame-button"
                    onClick={() => shareEra(selected)}
                  >
                    {copied ? <Check size={12} /> : <Share2 size={12} />}
                    {copied ? "COPIED" : "COPY LINK"}
                  </button>
                </div>
                <nav className="era-pagination" aria-label="Era navigation">
                  <button
                    onClick={() =>
                      showDetails((selected - 1 + ERAS.length) % ERAS.length)
                    }
                  >
                    <ArrowLeft size={12} />
                    {ERAS[(selected - 1 + ERAS.length) % ERAS.length].title}
                  </button>
                  <button
                    onClick={() => showDetails((selected + 1) % ERAS.length)}
                  >
                    {ERAS[(selected + 1) % ERAS.length].title}
                    <ArrowUpRight size={12} />
                  </button>
                </nav>
              </section>
            </div>
            {player}
          </>
        ) : null}
      </dialog>

      <dialog
        className="index-dialog"
        ref={indexDialog}
        onCancel={(event) => {
          event.preventDefault();
          setIndexOpen(false);
        }}
        onClose={() => setIndexOpen(false)}
        aria-labelledby="era-index-title"
      >
        <div className="index-heading">
          <div>
            <h2 id="era-index-title">The eras</h2>
            <p>EVERY CHAPTER, IN ONE WORLD.</p>
          </div>
          <button
            autoFocus
            className="icon-button"
            aria-label="Close era index"
            onClick={() => setIndexOpen(false)}
          >
            <X size={22} />
          </button>
        </div>
        <div className="era-index-list">
          {ERAS.map((item, index) => (
            <button
              className="era-index-row"
              key={item.id}
              onClick={() => {
                setIndexOpen(false);
                engine.current?.focusCard?.(index);
                showDetails(index);
              }}
            >
              <span className="index-number">
                {String(index + 1).padStart(2, "0")}
              </span>
              <img
                src={item.artwork}
                alt=""
                width="52"
                height="52"
                loading="lazy"
              />
              <span className="index-era-title">{item.title}</span>
              <span className="index-era-kind">{item.kind}</span>
              <span className="index-era-year">{item.year}</span>
              <ArrowUpRight size={16} />
            </button>
          ))}
        </div>
        <div className="index-footnote">
          <span>A CREATIVE CONCEPT FOR THE WEEKND</span>
          <a
            href="https://www.theweeknd.com/"
            target="_blank"
            rel="noopener noreferrer"
          >
            OFFICIAL WEBSITE <ExternalLink size={11} />
          </a>
        </div>
      </dialog>
      <output className="sr-only" aria-live="polite">
        {audioError
          ? "The preview could not play. An official listening link is available."
          : playing && currentTrack
            ? `Playing ${currentTrack.title} from ${currentEra.title}`
            : status}
      </output>
    </main>
  );
}
