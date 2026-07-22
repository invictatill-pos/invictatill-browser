'use strict';

const MAX_UPDATE_ERROR_LENGTH = 500;

function cleanText(value, fallback) {
  const text = String(value || '').replace(/\s+/g, ' ').trim();
  return (text || fallback).slice(0, MAX_UPDATE_ERROR_LENGTH);
}

function friendlyUpdateError(error) {
  const raw = cleanText(error && (error.message || error.stack) || error, 'Update check failed');
  if (/latest\.yml/i.test(raw) && /(404|not found|does not exist|cannot find)/i.test(raw)) {
    return 'Update feed is incomplete: latest.yml is missing from the latest public release.';
  }
  if (/(ENOTFOUND|EAI_AGAIN|ERR_INTERNET_DISCONNECTED|ERR_NETWORK_CHANGED|net::|timed?\s*out|ECONNRESET)/i.test(raw)) {
    return 'Could not reach the update service. Check your internet connection and try again.';
  }
  if (/(checksum|sha512|signature|publisher)/i.test(raw)) {
    return 'The downloaded update failed integrity or publisher verification and was not installed.';
  }
  if (/404/.test(raw)) {
    return 'The update service is missing required release files.';
  }
  return raw;
}

function createUpdateController(options) {
  const settings = options && typeof options === 'object' ? options : {};
  const updater = settings.updater || null;
  const currentVersion = cleanText(settings.currentVersion, '0.0.0');
  const send = typeof settings.send === 'function' ? settings.send : function () {};
  const now = typeof settings.now === 'function' ? settings.now : function () { return new Date().toISOString(); };
  const schedule = typeof settings.schedule === 'function' ? settings.schedule : setTimeout;
  const disabledReason = settings.disabledReason ? cleanText(settings.disabledReason, 'Updates are unavailable') : null;

  let configured = false;
  let interactiveCheck = false;
  let checkPromise = null;
  let timer = null;
  let state = {
    status: disabledReason || !updater ? 'disabled' : 'idle',
    currentVersion,
    version: currentVersion,
    percent: null,
    error: disabledReason || (!updater ? 'Update service is unavailable in this build.' : null),
    checkedAt: null,
    interactive: false,
  };

  function snapshot(extra) {
    return { ...state, ...(extra || {}) };
  }

  function setState(patch) {
    state = { ...state, ...patch };
    return snapshot();
  }

  function dispatch(channel, extra) {
    const payload = snapshot(extra);
    send(channel, payload);
    return payload;
  }

  function recordError(error) {
    const message = friendlyUpdateError(error);
    setState({
      status: 'error',
      error: message,
      percent: null,
      checkedAt: now(),
      interactive: interactiveCheck,
    });
    return dispatch('update-error');
  }

  function configure() {
    if (configured) return snapshot();
    configured = true;
    if (!updater || disabledReason) return snapshot();

    updater.autoDownload = true;
    updater.autoInstallOnAppQuit = true;
    updater.allowPrerelease = false;
    updater.allowDowngrade = false;

    updater.on('checking-for-update', function () {
      setState({
        status: 'checking',
        error: null,
        percent: null,
        interactive: interactiveCheck,
      });
      dispatch('update-checking');
    });

    updater.on('update-not-available', function (info) {
      setState({
        status: 'current',
        version: info && info.version ? cleanText(info.version, currentVersion) : currentVersion,
        error: null,
        percent: null,
        checkedAt: now(),
        interactive: interactiveCheck,
      });
      dispatch('update-not-available');
    });

    updater.on('update-available', function (info) {
      setState({
        status: 'downloading',
        version: info && info.version ? cleanText(info.version, currentVersion) : null,
        error: null,
        percent: 0,
        checkedAt: now(),
        interactive: interactiveCheck,
      });
      dispatch('update-available', {
        releaseDate: info && info.releaseDate ? info.releaseDate : null,
        releaseNotes: info && info.releaseNotes ? info.releaseNotes : null,
      });
    });

    updater.on('download-progress', function (progress) {
      const rawPercent = Number(progress && progress.percent);
      const percent = Number.isFinite(rawPercent) ? Math.min(100, Math.max(0, Math.round(rawPercent))) : 0;
      setState({
        status: 'downloading',
        error: null,
        percent,
        interactive: interactiveCheck,
      });
      dispatch('update-progress', {
        speed: Math.round(Number(progress && progress.bytesPerSecond || 0) / 1024),
        transferred: Math.round(Number(progress && progress.transferred || 0) / (1024 * 1024)),
        total: Math.round(Number(progress && progress.total || 0) / (1024 * 1024)),
      });
    });

    updater.on('update-downloaded', function (info) {
      setState({
        status: 'downloaded',
        version: info && info.version ? cleanText(info.version, state.version || currentVersion) : state.version,
        error: null,
        percent: 100,
        checkedAt: now(),
        interactive: interactiveCheck,
      });
      dispatch('update-downloaded', {
        releaseNotes: info && info.releaseNotes ? info.releaseNotes : null,
      });
    });

    updater.on('error', recordError);
    return snapshot();
  }

  async function check(interactive) {
    configure();
    if (!updater || disabledReason) return { success: false, ...snapshot() };
    if (state.status === 'downloaded') return { success: true, ...snapshot() };
    if (checkPromise) return checkPromise;

    interactiveCheck = interactive !== false;
    setState({
      status: 'checking',
      error: null,
      percent: null,
      interactive: interactiveCheck,
    });
    dispatch('update-checking');

    checkPromise = Promise.resolve()
      .then(function () { return updater.checkForUpdates(); })
      .then(function () {
        if (state.status === 'checking') {
          setState({ status: 'current', version: currentVersion, checkedAt: now() });
          dispatch('update-not-available');
        }
        return { success: state.status !== 'error', ...snapshot() };
      })
      .catch(function (error) {
        const message = friendlyUpdateError(error);
        if (state.status !== 'error' || state.error !== message) recordError(error);
        return { success: false, ...snapshot() };
      })
      .finally(function () {
        checkPromise = null;
        interactiveCheck = false;
      });

    return checkPromise;
  }

  function scheduleAutomaticCheck(delayMs) {
    configure();
    if (!updater || disabledReason || timer) return false;
    timer = schedule(function () {
      timer = null;
      check(false).catch(function () {});
    }, Math.max(0, Number(delayMs) || 0));
    if (timer && typeof timer.unref === 'function') timer.unref();
    return true;
  }

  function install() {
    configure();
    if (!updater || state.status !== 'downloaded') {
      return { success: false, ...snapshot(), error: 'No downloaded update is ready to install.' };
    }
    try {
      setState({ status: 'installing', error: null, interactive: true });
      dispatch('update-installing');
      updater.quitAndInstall(false, true);
      return { success: true, ...snapshot() };
    } catch (error) {
      recordError(error);
      return { success: false, ...snapshot() };
    }
  }

  return {
    configure,
    check,
    getState: function () { return snapshot(); },
    install,
    scheduleAutomaticCheck,
  };
}

module.exports = {
  createUpdateController,
  friendlyUpdateError,
};
