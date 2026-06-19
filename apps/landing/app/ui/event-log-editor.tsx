"use client";

import { useMemo, useState } from "react";
import type { GameEvent } from "@ll-score/contracts";
import { activeGameEvents } from "@ll-score/count-controls";

const eventTypes = [
  "GameStarted",
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
  "PitcherChanged",
  "GameFinalized"
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

function eventStatus(event: GameEvent, activeIds: Set<string>): string {
  if (activeIds.has(event.eventId)) return "active";
  if (event.eventType === "EventReversed" || event.eventType === "EventCorrected") {
    return "audit";
  }
  return "superseded";
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
  const allEvents = useMemo(
    () => [...events].sort((left, right) => right.eventOrder - left.eventOrder),
    [events]
  );
  const [selectedEventId, setSelectedEventId] = useState("");
  const [eventType, setEventType] =
    useState<EditableEventType>("ScorekeeperCommentRecorded");
  const [eventTime, setEventTime] = useState(localDateTime());
  const [payload, setPayload] = useState('{\n  "comment": ""\n}');
  const [runnerMovements, setRunnerMovements] = useState("[]");
  const [correctionNote, setCorrectionNote] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const selectedEvent = events.find((item) => item.eventId === selectedEventId);
  const selectedEventEditable = selectedEvent
    ? eventTypes.includes(selectedEvent.eventType as EditableEventType)
    : true;
  const selectedEventReversible = selectedEvent
    ? selectedEvent.eventType !== "EventReversed" &&
      selectedEvent.eventType !== "EventCorrected"
    : false;

  function selectEvent(eventId: string) {
    setSelectedEventId(eventId);
    setShowAddForm(false);
    const event = events.find((item) => item.eventId === eventId);
    if (!event) {
      return;
    }
    if (eventTypes.includes(event.eventType as EditableEventType)) {
      setEventType(event.eventType as EditableEventType);
    }
    setEventTime(localDateTime(event.eventTimeUtc));
    setPayload(JSON.stringify(event.payload, null, 2));
    setRunnerMovements(JSON.stringify(event.runnerMovements, null, 2));
    setCorrectionNote("");
    setMessage("");
  }

  function startNew() {
    setSelectedEventId("");
    setShowAddForm(true);
    setEventType("ScorekeeperCommentRecorded");
    setEventTime(localDateTime());
    setPayload('{\n  "comment": ""\n}');
    setRunnerMovements("[]");
    setCorrectionNote("");
    setMessage("");
  }

  function closeForm() {
    setSelectedEventId("");
    setShowAddForm(false);
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
      if (method === "POST") closeForm();
    } catch (reason) {
      setMessage(String(reason));
    } finally {
      setBusy(false);
    }
  }

  async function reverse() {
    if (!selectedEventId) return;
    await reverseEvent(selectedEventId);
  }

  async function reverseEvent(eventId: string) {
    const event = events.find((item) => item.eventId === eventId);
    if (
      !event ||
      event.eventType === "EventReversed" ||
      event.eventType === "EventCorrected"
    ) {
      return;
    }
    const confirmed = window.confirm(
      `Delete Event ${event.eventOrder}? This records a reversal so the audit trail is preserved.`
    );
    if (!confirmed) return;
    setBusy(true);
    setMessage("");
    try {
      const response = await fetch(`/api/games/${gameId}/events`, {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          eventId,
          correctionNote
        })
      });
      if (!response.ok) throw new Error(await response.text());
      await onRecorded();
      closeForm();
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
        <div>
          <p className="eyebrow">Recorded events</p>
          <h3>Manage Event Log</h3>
        </div>
        <button
          className="ghost-button"
          disabled={disabled || busy}
          onClick={showAddForm && !selectedEventId ? closeForm : startNew}
        >
          {showAddForm && !selectedEventId ? "Collapse Add Event" : "Add Event"}
        </button>
      </div>

      <div className="event-row-list">
        {allEvents.length === 0 ? (
          <p className="empty">No recorded events yet.</p>
        ) : (
          allEvents.map((event) => {
            const status = eventStatus(event, activeIds);
            const canDelete =
              event.eventType !== "EventReversed" &&
              event.eventType !== "EventCorrected";
            return (
              <article
                className={`event-row ${selectedEventId === event.eventId ? "selected" : ""}`}
                key={event.eventId}
              >
                <div>
                  <strong>{eventLabel(event)}</strong>
                  <span>{event.eventTimeUtc}</span>
                  <small>{status}</small>
                </div>
                <div className="event-row-actions">
                  <button
                    className="event-icon-button"
                    aria-label={`Edit ${eventLabel(event)}`}
                    title="Edit event"
                    disabled={disabled || busy}
                    onClick={() => selectEvent(event.eventId)}
                  >
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M4 16.5V20h3.5L18.8 8.7l-3.5-3.5L4 16.5Zm17.7-10.6a1 1 0 0 0 0-1.4l-2.2-2.2a1 1 0 0 0-1.4 0l-1.7 1.7 3.5 3.5 1.8-1.6Z" />
                    </svg>
                  </button>
                  <button
                    className="event-icon-button delete"
                    aria-label={`Delete ${eventLabel(event)}`}
                    title="Delete event"
                    disabled={disabled || busy || !canDelete}
                    onClick={() => void reverseEvent(event.eventId)}
                  >
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M7 21c-.6 0-1.1-.2-1.5-.6S5 19.6 5 19V7H4V5h5V4h6v1h5v2h-1v12c0 .6-.2 1.1-.6 1.4s-.8.6-1.4.6H7Zm2-4h2V9H9v8Zm4 0h2V9h-2v8Z" />
                    </svg>
                  </button>
                </div>
              </article>
            );
          })
        )}
      </div>

      {showAddForm || selectedEventId ? (
        <div className="event-editor-form">
          <div className="event-editor-fields">
            <label>Action
              <select
                value={eventType}
                disabled={disabled || busy || !selectedEventEditable}
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
            {selectedEvent && !selectedEventEditable
              ? `${selectedEvent.eventType.replace(/([A-Z])/g, " $1").trim()} is shown for audit visibility. It can be reversed, but its structural details are not editable here.`
              : "Saving an edit appends a correction and preserves the original audit record. Deleting records a reversal and excludes the event from active replay."}
          </p>
          <div className="event-editor-actions">
            <span>{message}</span>
            <button
              className="ghost-button"
              disabled={busy}
              onClick={closeForm}
            >
              Close
            </button>
            {selectedEventId ? (
              <>
                <button
                  className="undo-button"
                  disabled={disabled || busy || !selectedEventReversible}
                  onClick={() => void reverse()}
                >
                  Delete Event
                </button>
                <button
                  disabled={disabled || busy || !selectedEventEditable}
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
        </div>
      ) : (
        <p className="event-editor-help">
          Add event is collapsed. Use the edit icon on a row to correct an event,
          or the delete icon to record a reversal.
        </p>
      )}
    </section>
  );
}
