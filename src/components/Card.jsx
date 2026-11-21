import { useEffect, useRef, useState } from 'react';
import { DONATE_URL, INSTAGRAM_URL } from '../config';
import { ROUTES_FINAL, formatDuration, formatLongDay, formatTime } from '../lib/schedule';

function headline({ phase, run, next, now, santa, roadName }) {
  switch (phase) {
    case 'live':
      if (!santa) return ['Santa is getting ready to roll', 'He appears on the map as soon as the engine pulls out.'];
      return [roadName ? `Santa is on ${roadName}` : 'Santa is out on the route', null];
    case 'paused':
      return ['Santa is taking a short break', "He'll be back on the route soon."];
    case 'hold':
      return ["Santa isn't on the road right now", 'Check back in a little while.'];
    case 'done':
      return [
        "That's all for tonight",
        next ? `Santa rides again ${formatLongDay(next.startAt)}.` : 'Thanks for coming out. See you next December.',
      ];
    case 'over':
      return ["Santa's back at the North Pole", 'Thanks for coming out. See you next December.'];
    default: {
      const untilStart = run.startAt - now;
      if (untilStart < 12 * 3600000) {
        return [
          `Santa leaves the firehouse at ${formatTime(run.startAt)}`,
          `That's in ${formatDuration(untilStart)}. This page follows him on its own.`,
        ];
      }
      return [
        `Santa rides ${formatLongDay(run.startAt)}`,
        `He leaves the firehouse at ${formatTime(run.startAt)}. Follow him here live.`,
      ];
    }
  }
}

const Boot = () => (
  <svg className="boot" viewBox="0 0 24 24" aria-hidden="true">
    <path d="M7 2.500h8.500v10.300l4.700 2.300a2.500 2.500 0 0 1 1.400 2.200V19H5.500L7 13z" />
    <path className="boot-sole" d="M4.800 19.800h17v1.700h-17z" />
    <path className="boot-band" d="M7 4.800h8.500v2.200H7z" />
  </svg>
);

function where(night) {
  const road = night.road ? (night.road.near ? `${night.road.name} near ${night.road.near}` : night.road.name) : null;
  if (night.state === 'passed') return road ? `He came by on ${road}. Hope you got a wave!` : 'Hope you got a wave!';
  const place = road || 'The closest spot on the route';
  return night.distance ? `${place}, ${night.distance}` : place;
}

const WHEN = {
  passed: () => 'Santa has passed',
  here: () => 'Almost here. Head outside!',
  close: (night) => night.when.replace(/^a/, 'A'),
  planned: (night) => night.when.replace(/^b/, 'B'),
};

/** The card over the bottom of the map: where Santa is, and when he reaches you. */
export default function Card({
  cardRef,
  phase,
  run,
  next,
  now,
  santa,
  roadName,
  staleFor,
  hasPin,
  nights, // from describeNights, each with a `road` once it has been looked up
  viewRunId,
  onViewNight,
  asking, // null | 'locating' | 'picking'
  note,
  onAsk,
  onMove,
  onRemove,
  onCancel,
}) {
  const [open, setOpen] = useState(false);
  const [shared, setShared] = useState(false);
  const swipe = useRef(null);
  const [title, detail] = headline({ phase, run, next, now, santa, roadName });
  const passed = nights.some((night) => night.tonight && night.state === 'passed');
  const askForDonation = phase === 'done' || phase === 'over' || passed;
  // The flyer greets people before and after the run; it steps aside once they have a pin.
  const showArt = ['before', 'done', 'over'].includes(phase) && !asking && !hasPin;

  // Get out of the way of the map while someone is placing a pin.
  useEffect(() => {
    if (asking === 'picking') setOpen(false);
  }, [asking]);

  const share = async () => {
    const url = window.location.origin + window.location.pathname;
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Reva Fire & Rescue Santa Run', text: 'Follow Santa on the fire engine', url });
      } catch {
        // Closed the share sheet; nothing to do.
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setShared(true);
      setTimeout(() => setShared(false), 2500);
    } catch {
      window.prompt('Copy this link', url);
    }
  };

  // A swipe up or down on the top of the card opens or closes it.
  const onTouchStart = (event) => {
    swipe.current = event.touches[0].clientY;
  };
  const onTouchEnd = (event) => {
    if (swipe.current == null) return;
    const moved = event.changedTouches[0].clientY - swipe.current;
    swipe.current = null;
    if (moved < -40) setOpen(true);
    if (moved > 40) setOpen(false);
  };

  return (
    <main ref={cardRef} className={`card${open ? ' is-open' : ''}`}>
      <div className="card-top" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        <button
          type="button"
          className="card-handle"
          aria-expanded={open}
          aria-controls="card-more"
          onClick={() => setOpen((value) => !value)}
        >
          <span className="visually-hidden">{open ? 'Show less' : 'Show more'}</span>
        </button>

        {!askForDonation && (
          <a className="boot-link" href={DONATE_URL} target="_blank" rel="noopener noreferrer">
            <Boot /> Fill the boot
          </a>
        )}

        {showArt && (
          <img
            className={`card-art${phase === 'before' ? '' : ' card-art-wide'}`}
            src="/flyer-header.jpg"
            width="1000"
            height="478"
            alt="Santa waving from the top of a Reva Volunteer Fire and Rescue engine"
          />
        )}

        <div className="status" aria-live="polite">
          <h1 className="status-title">{title}</h1>
          {detail && <p>{detail}</p>}
          {phase === 'live' && santa && staleFor > 90000 && (
            <p className="fine">Last seen {formatDuration(staleFor)} ago. Waiting for a signal.</p>
          )}
        </div>
      </div>

      {asking === 'picking' ? (
        <div className="ask">
          <p className="ask-prompt">Tap the map where you'll watch for Santa.</p>
          {note && <p className="fine">{note}</p>}
          <button type="button" className="btn" onClick={onCancel}>
            Cancel
          </button>
        </div>
      ) : hasPin ? (
        nights.length > 0 && (
          <ul className="nights">
            {nights.map((night) => (
              <li key={night.id}>
                <button
                  type="button"
                  className={`night night-${night.state}`}
                  aria-pressed={night.id === viewRunId}
                  onClick={() => onViewNight(night.id)}
                >
                  <span className="night-day">{night.tonight ? 'Tonight' : night.day}</span>
                  <span className="night-when">{WHEN[night.state](night)}</span>
                  <span className="night-where">{where(night)}</span>
                </button>
              </li>
            ))}
          </ul>
        )
      ) : (
        phase !== 'over' && (
          <button type="button" className="btn btn-primary" disabled={asking === 'locating'} onClick={onAsk}>
            {asking === 'locating' ? 'Finding you…' : 'When will he reach me?'}
          </button>
        )
      )}

      {askForDonation && (
        <div className="boot-ask">
          <p>Santa rides with your volunteers. Help keep the engines rolling.</p>
          <a className="btn btn-primary" href={DONATE_URL} target="_blank" rel="noopener noreferrer">
            <Boot /> Fill the boot
          </a>
        </div>
      )}

      <div className="card-more" id="card-more">
        {hasPin && !asking && (
          <div className="row">
            <button type="button" className="btn" onClick={onMove}>
              Move my pin
            </button>
            <button type="button" className="btn" onClick={onRemove}>
              Remove my pin
            </button>
          </div>
        )}
        <div className="row">
          <button type="button" className="btn" onClick={share}>
            {shared ? 'Link copied' : 'Share this page'}
          </button>
        </div>
        <p className="fine">
          {['live', 'paused', 'before', 'hold'].includes(phase)
            ? 'Listen for sirens and music, then come out to the road. Times are estimates, and weather can slow Santa down.'
            : 'Your volunteers at Reva Fire & Rescue wish you a merry Christmas.'}
          {!ROUTES_FINAL && ' Routes and times may still change.'}
          {hasPin && ' Your pin stays on your phone.'}
        </p>
        <p className="fine">
          <a href={INSTAGRAM_URL} target="_blank" rel="noopener noreferrer">
            Reva Fire &amp; Rescue on Instagram
          </a>
        </p>
      </div>
    </main>
  );
}
