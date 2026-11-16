'use strict';

const MAX_FOCUS_HISTORY = 500;

function cleanText(value, maxLength) {
  return String(value || '').replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

function readNumber(value) {
  if (typeof value !== 'number' && (typeof value !== 'string' || !value.trim())) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function dayKey(timestamp) {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function createFocusController(options) {
  const settings = options && typeof options === 'object' ? options : {};
  const now = typeof settings.now === 'function' ? settings.now : Date.now;
  const schedule = typeof settings.schedule === 'function' ? settings.schedule : setTimeout;
  const unschedule = typeof settings.unschedule === 'function' ? settings.unschedule : clearTimeout;
  const loadState = typeof settings.loadState === 'function' ? settings.loadState : function () { return null; };
  const saveState = typeof settings.saveState === 'function' ? settings.saveState : function () {};
  const loadHistory = typeof settings.loadHistory === 'function' ? settings.loadHistory : function () { return []; };
  const saveHistory = typeof settings.saveHistory === 'function' ? settings.saveHistory : function () {};
  const send = typeof settings.send === 'function' ? settings.send : function () {};
  const notify = typeof settings.notify === 'function' ? settings.notify : function () {};

  let configured = false;
  let timer = null;
  let history = [];
  let state = {
    status: 'idle',
    mode: 'focus',
    durationMinutes: 25,
    startedAt: null,
    endsAt: null,
    remainingMs: 25 * 60 * 1000,
    intention: '',
    workspaceId: 'default',
    lastCompletedAt: null,
  };

  function clearTimer() {
    if (timer !== null) unschedule(timer);
    timer = null;
  }

  function sanitizeHistory(raw) {
    if (!Array.isArray(raw)) return [];
    return raw.filter((entry) => entry && readNumber(entry.completedAt) !== null)
      .map((entry) => ({
        completedAt: Number(entry.completedAt),
        durationMinutes: Math.max(1, Math.min(180, Number(entry.durationMinutes) || 1)),
        intention: cleanText(entry.intention, 240),
        workspaceId: cleanText(entry.workspaceId || 'default', 100),
      }))
      .slice(-MAX_FOCUS_HISTORY);
  }

  function sanitizeState(raw) {
    if (!raw || typeof raw !== 'object') return state;
    const endsAt = readNumber(raw.endsAt);
    const status = raw.status === 'paused' || (raw.status === 'active' && endsAt !== null)
      ? raw.status : 'idle';
    const mode = raw.mode === 'break' ? 'break' : 'focus';
    const durationMinutes = Math.max(1, Math.min(180, Number(raw.durationMinutes) || (mode === 'break' ? 5 : 25)));
    const durationMs = durationMinutes * 60 * 1000;
    return {
      status,
      mode,
      durationMinutes,
      startedAt: status === 'idle' ? null : readNumber(raw.startedAt),
      endsAt: status === 'active' ? endsAt : null,
      remainingMs: status === 'idle' ? durationMs : Math.max(0, Math.min(durationMs, readNumber(raw.remainingMs) ?? durationMs)),
      intention: cleanText(raw.intention, 240),
      workspaceId: cleanText(raw.workspaceId || 'default', 100),
      lastCompletedAt: readNumber(raw.lastCompletedAt),
    };
  }

  function stats() {
    const today = dayKey(now());
    const completedToday = history.filter((entry) => dayKey(entry.completedAt) === today);
    return {
      sessionsToday: completedToday.length,
      minutesToday: completedToday.reduce((sum, entry) => sum + entry.durationMinutes, 0),
      totalSessions: history.length,
    };
  }

  function remainingMs() {
    if (state.status === 'active') return Math.max(0, state.endsAt - now());
    if (state.status === 'paused') return Math.max(0, state.remainingMs);
    return state.durationMinutes * 60 * 1000;
  }

  function snapshot(extra) {
    const durationMs = state.durationMinutes * 60 * 1000;
    const remaining = remainingMs();
    return {
      ...state,
      remainingSeconds: Math.ceil(remaining / 1000),
      progressPercent: state.status === 'idle' ? 0 : Math.min(100, Math.max(0, ((durationMs - remaining) / durationMs) * 100)),
      stats: stats(),
      ...(extra || {}),
    };
  }

  function persist() {
    saveState({ ...state });
    saveHistory(history.slice(-MAX_FOCUS_HISTORY));
  }

  function emit(extra) {
    const payload = snapshot(extra);
    send('focus-state', payload);
    return payload;
  }

  function scheduleCompletion() {
    clearTimer();
    if (state.status !== 'active') return;
    timer = schedule(function () {
      if (state.status !== 'active') return;
      if (remainingMs() > 0) scheduleCompletion();
      else complete();
    }, remainingMs());
    if (timer && typeof timer.unref === 'function') timer.unref();
  }

  function complete() {
    if (state.status !== 'active' && state.status !== 'paused') return snapshot();
    clearTimer();
    const completed = { ...state };
    const completedAt = now();
    if (completed.mode === 'focus') {
      history.push({
        completedAt,
        durationMinutes: completed.durationMinutes,
        intention: completed.intention,
        workspaceId: completed.workspaceId,
      });
      history = history.slice(-MAX_FOCUS_HISTORY);
    }
    state = {
      ...state,
      status: 'idle',
      startedAt: null,
      endsAt: null,
      remainingMs: state.durationMinutes * 60 * 1000,
      lastCompletedAt: completedAt,
    };
    persist();
    const payload = emit({ completedMode: completed.mode, completedIntention: completed.intention });
    notify(completed.mode, completed.intention);
    return payload;
  }

  function configure() {
    if (configured) return snapshot();
    configured = true;
    history = sanitizeHistory(loadHistory());
    state = sanitizeState(loadState());
    if (state.status === 'active') {
      if (remainingMs() === 0) return complete();
      scheduleCompletion();
    }
    persist();
    return snapshot();
  }

  function start(input) {
    const request = input && typeof input === 'object' ? input : {};
    const mode = request.mode === 'break' ? 'break' : 'focus';
    const defaultDuration = mode === 'break' ? 5 : 25;
    const durationMinutes = request.durationMinutes == null ? defaultDuration : readNumber(request.durationMinutes);
    if (!Number.isFinite(durationMinutes) || durationMinutes < 1 || durationMinutes > 180) {
      throw new RangeError('Focus duration must be between 1 and 180 minutes');
    }
    getState();
    const durationMs = Math.round(durationMinutes * 60 * 1000);
    const startedAt = now();
    state = {
      status: 'active',
      mode,
      durationMinutes,
      startedAt,
      endsAt: startedAt + durationMs,
      remainingMs: durationMs,
      intention: cleanText(request.intention, 240),
      workspaceId: cleanText(request.workspaceId || 'default', 100),
      lastCompletedAt: state.lastCompletedAt,
    };
    persist();
    scheduleCompletion();
    return emit();
  }

  function pause() {
    configure();
    if (state.status !== 'active') return snapshot();
    const remaining = remainingMs();
    if (remaining === 0) return complete();
    state = { ...state, status: 'paused', remainingMs: remaining, endsAt: null };
    clearTimer();
    persist();
    return emit();
  }

  function resume() {
    configure();
    if (state.status !== 'paused') return snapshot();
    if (state.remainingMs === 0) return complete();
    state = { ...state, status: 'active', endsAt: now() + state.remainingMs };
    persist();
    scheduleCompletion();
    return emit();
  }

  function cancel() {
    configure();
    if (state.status === 'active' && remainingMs() === 0) return complete();
    clearTimer();
    state = {
      ...state,
      status: 'idle',
      startedAt: null,
      endsAt: null,
      remainingMs: state.durationMinutes * 60 * 1000,
    };
    persist();
    return emit({ canceled: true });
  }

  function getState() {
    configure();
    if (state.status === 'active' && remainingMs() === 0) return complete();
    return snapshot();
  }

  function dispose() {
    clearTimer();
    if (configured) persist();
  }

  return { cancel, complete, configure, dispose, getState, pause, resume, start };
}

module.exports = { createFocusController, dayKey };
