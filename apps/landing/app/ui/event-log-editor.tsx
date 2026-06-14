"use client";

import { useMemo, useState } from "react";
import type { GameEvent } from "@ll-score/contracts";
import { activeGameEvents } from "@ll-score/count-controls";

const eventTypes = [
  "HalfInningStarted",
  "PlateAppearanceStarted",
  "PitchRecorded",
  "ScorekeeperCommentRecorded",
  "BallPutInPlay",
  "FieldingActionRecorded",
  "RunnerMoved",
  "RunnerOut",
  "OutCountAdjusted",
  "RunScored",
  "PitcherChanged"
] as const;
type EditableEventType = (typeof eventTypes)[number];

function localDateTime(utc?: string): string {
  const date = utc ? new Date(utc) : new Date();
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 19);
}

function eventLabel(event: GameEvent): string {
  return `Event ${event.eventOrder}: ${event.eventType.replace(
    /([A-Z])/g,
    " $1"
  ).trim()}`;
}

export function EventLogEditor({
  gameId,
  events,
  disabled,
  onRecorded
}: {
  gameId: string;
  events: GameEvent[];
  disabled: boolean;
  onRecorded: () => Promise<void>;
}) {
  const activeIds = useMemo(
    () => new Set(activeGameEvents(events).map((event) => event.eventId)),
    [events]
  );
  const editableEvents = events.filter(
    (event) =>
      eventTypes.includes(event.eventType as EditableEventType) &&
      activeIds.has(event.eventId)
  );
  const [selectedEventId, setSelectedEventId] = useState("");
  const [eventType, setEventType] =
    useState<EditableEventType>("ScorekeeperCommentRecorded");
  const [eventTime, setEventTime] = useState(localDateTime());
  const [payload, setPayload] = useState('{\n  "comment": ""\n}');
  const [runnerMovements, setRunnerMovements] = useState("[]");
  const [correctionNote, setCorrectionNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  function selectEvent(eventId: string) {
    setSelectedEventId(eventId);
    const event = events.find((item) => item.eventId === eventId);
    if (!event || !eventTypes.includes(event.eventType as EditableEventType)) {
      return;
    }
    setEventType(event.eventType as EditableEventType);
    setEventTime(localDateTime(event.eventTimeUtc));
    setPayload(JSON.stringify(event.payload, null, 2));
    setRunnerMovements(JSON.stringify(event.runnerMovements, null, 2));
    setCorrectionNote("");
    setMessage("");
  }

  function startNew() {
    setSelectedEventId("");
    setEventType("ScorekeeperCommentRecorded");
    setEventTime(localDateTime());
    setPayload('{\n  "comment": ""\n}');
    setRunnerMovements("[]");
    setCorrectionNote("");
    setMessage("");
  }

  async function submit(method: "POST" | "PUT") {
    setBusy(true);
    setMessage("");
    try {
      let parsedPayload: unknown;
      let parsedMovements: unknown;
      try {
        parsedPayload = JSON.parse(payload);
        parsedMovements = JSON.parse(runnerMovements);
      } catch {
        throw new Error("Payload and runner movements must contain valid JSON.");
      }
      const response = await fetch(`/api/games/${gameId}/events`, {
        method,
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          eventType,
          eventTimeUtc: new Date(eventTime).toISOString(),
          payload: parsedPayload,
          runnerMovements: parsedMovements,
          correctsEventId: method === "PUT" ? selectedEventId : undefined,
          correctionNote
        })
      });
      if (!response.ok) throw new Error(await response.text());
      await onRecorded();
      setMessage(method === "PUT" ? "Correction recorded." : "Event added.");
      if (method === "POST") startNew();
    } catch (reason) {
      setMessage(String(reason));
    } finally {
      setBusy(false);
    }
  }

  async function reverse() {
    if (!selectedEventId) return;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(`/api/games/${gameId}/events`, {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          eventId: selectedEventId,
          correctionNote
        })
      });
      if (!response.ok) throw new Error(await response.text());
      await onRecorded();
      startNew();
      setMessage("Event reversed.");
    } catch (reason) {
      setMessage(String(reason));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="event-log-editor">
      <div className="event-editor-top">
        <label>Existing active event
          <select
            value={selectedEventId}
            disabled={disabled || busy}
            onChange={(event) => selectEvent(event.target.value)}
          >
            <option value="">Add a new event</option>
            {[...editableEvents].reverse().map((event) => (
              <option key={event.eventId} value={event.eventId}>
                {eventLabel(event)}
              </option>
            ))}
          </select>
        </label>
        <button className="ghost-button" disabled={busy} onClick={startNew}>
          New Event
        </button>
      </div>
      <div className="event-editor-fields">
        <label>Action
          <select
            value={eventType}
            disabled={disabled || busy}
            onChange={(event) =>
              setEventType(event.target.value as EditableEventType)
            }
          >
            {eventTypes.map((type) => (
              <option key={type} value={type}>
                {type.replace(/([A-Z])/g, " $1").trim()}
              </option>
            ))}
          </select>
        </label>
        <label>Event time
          <input
            type="datetime-local"
            step="1"
            value={eventTime}
            disabled={disabled || busy}
            onChange={(event) => setEventTime(event.target.value)}
          />
        </label>
        <label>Correction note
          <input
            value={correctionNote}
            disabled={disabled || busy}
            maxLength={160}
            placeholder="Why was this added or changed?"
            onChange={(event) => setCorrectionNote(event.target.value)}
          />
        </label>
      </div>
      <div className="event-json-fields">
        <label>Action details (JSON object)
          <textarea
            value={payload}
            disabled={disabled || busy}
            spellCheck={false}
            onChange={(event) => setPayload(event.target.value)}
          />
        </label>
        <label>Runner movements (JSON array)
          <textarea
            value={runnerMovements}
            disabled={disabled || busy}
            spellCheck={false}
            onChange={(event) => setRunnerMovements(event.target.value)}
          />
        </label>
      </div>
      <p className="event-editor-help">
        Saving an edit appends a correction and preserves the original audit
        record. Reversing excludes the selected event from active replay.
      </p>
      <div className="event-editor-actions">
        <span>{message}</span>
        {selectedEventId ? (
          <>
            <button
              className="undo-button"
              disabled={disabled || busy}
              onClick={() => void reverse()}
            >
              Reverse Event
            </button>
            <button
              disabled={disabled || busy}
              onClick={() => void submit("PUT")}
            >
              Save Correction
            </button>
          </>
        ) : (
          <button
            disabled={disabled || busy}
            onClick={() => void submit("POST")}
          >
            Add Event
          </button>
        )}
      </div>
    </section>
  );
}
