import { useEffect, useRef, useState } from 'react';
import { CREW_DOMAIN, GOOGLE_CLIENT_ID } from '../config';
import { formatTime } from '../lib/schedule';

const CHOICES = [
  {
    mode: 'auto',
    label: 'Follow the schedule',
    detail: 'Tracking turns on and off by itself on run nights.',
  },
  {
    mode: 'paused',
    label: 'Pause tracking',
    detail: 'Hides the vehicle and tells people Santa is taking a short break.',
  },
  {
    mode: 'live',
    label: 'Track now',
    detail: 'Shows the vehicle right away, for a rehearsal or an early start.',
  },
  {
    mode: 'off',
    label: 'Turn tracking off',
    detail: 'Hides the vehicle, even during a scheduled run.',
  },
];

const PUBLIC_NOW = {
  live: 'People can see the vehicle on the map right now.',
  paused: 'The vehicle is hidden. People see "Santa is taking a short break."',
  off: 'The vehicle is hidden.',
  done: 'Santa is back at the firehouse. The vehicle is hidden for the rest of the night.',
};

function loadGoogle() {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts?.id) return resolve();
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

/** The crew's switch, at /crew. Nothing here works without a crew Google sign-in. */
export default function Crew() {
  const button = useRef(null);
  const token = useRef(null);
  const unsent = useRef(null); // a change that was refused because the sign-in had expired
  const [state, setState] = useState(null); // { mode, until, publicStatus, changedBy, changedAt, you }
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(
    GOOGLE_CLIENT_ID ? null : "Crew sign-in isn't set up yet."
  );

  const send = async (mode) => {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch('/api/crew', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token.current}`,
        },
        body: JSON.stringify(mode ? { mode } : {}),
      });
      const data = await response.json().catch(() => ({}));
      if (response.ok) {
        setState(data);
      } else {
        setMessage(data.error || "That didn't work. Try again.");
        // Sign-in lasts an hour; after that Google has to vouch for you again.
        if (response.status === 401 || response.status === 403) {
          if (response.status === 401) unsent.current = mode || null;
          setState(null);
        }
      }
    } catch {
      setMessage("Couldn't reach the tracker. Check your signal and try again.");
    }
    setBusy(false);
  };

  const signedIn = Boolean(state);
  useEffect(() => {
    if (!GOOGLE_CLIENT_ID || signedIn) return undefined;
    let cancelled = false;
    loadGoogle()
      .then(() => {
        if (cancelled || !button.current) return;
        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          hd: CREW_DOMAIN,
          callback: (response) => {
            token.current = response.credential;
            const mode = unsent.current;
            unsent.current = null;
            send(mode);
          },
        });
        window.google.accounts.id.renderButton(button.current, {
          theme: 'filled_black',
          size: 'large',
          text: 'signin_with',
          shape: 'rectangular',
        });
      })
      .catch(() => {
        if (!cancelled) setMessage("Couldn't load Google sign-in. Check your signal and reload.");
      });
    return () => {
      cancelled = true;
    };
    // `send` only reads refs and setters, so it is safe to leave out.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signedIn]);

  return (
    <div className="crew">
      <main className="crew-panel">
        <h1 className="status-title">Santa Run crew switch</h1>

        {!state ? (
          <>
            <p>Sign in with your {CREW_DOMAIN} account to turn tracking on or off.</p>
            <div ref={button} />
          </>
        ) : (
          <>
            <p className="crew-now">{PUBLIC_NOW[state.publicStatus]}</p>
            {state.until && (
              <p className="fine">
                Set by {state.changedBy || 'the crew'} at {formatTime(new Date(state.changedAt))}.
                It goes back to following the schedule at {formatTime(new Date(state.until))}.
              </p>
            )}
            <div className="crew-choices">
              {CHOICES.map((choice) => (
                <button
                  key={choice.mode}
                  type="button"
                  className="crew-choice"
                  aria-pressed={state.mode === choice.mode}
                  disabled={busy}
                  onClick={() => send(choice.mode)}
                >
                  <strong>{choice.label}</strong>
                  <span>{choice.detail}</span>
                </button>
              ))}
            </div>
            <p className="fine">
              Signed in as {state.you}. A change reaches everyone's phone within about half a
              minute. <a href="/">Open the public page</a>
            </p>
          </>
        )}

        {message && (
          <p className="note" role="alert">
            {message}
          </p>
        )}
      </main>
    </div>
  );
}
