/**
 * Debounce & throttle helpers
 */

/**
 * Delay calling fn until wait ms after the last call
 * @param {Function} fn
 * @param {number} [wait=300]
 * @param {{ leading?: boolean, trailing?: boolean }} [options]
 * @returns {Function & { cancel: () => void, flush: () => void }}
 */
export function debounce(fn, wait = 300, options = {}) {
  const leading = options.leading === true;
  const trailing = options.trailing !== false;

  let timer = null;
  let lastArgs = null;
  let lastThis = null;
  let result;

  const invoke = () => {
    const args = lastArgs;
    const ctx = lastThis;
    lastArgs = lastThis = null;
    result = fn.apply(ctx, args);
    return result;
  };

  function debounced(...args) {
    lastArgs = args;
    lastThis = this;

    const callNow = leading && !timer;

    if (timer) clearTimeout(timer);

    timer = setTimeout(() => {
      timer = null;
      if (trailing && lastArgs) invoke();
    }, wait);

    if (callNow) invoke();
    return result;
  }

  debounced.cancel = () => {
    if (timer) clearTimeout(timer);
    timer = null;
    lastArgs = lastThis = null;
  };

  debounced.flush = () => {
    if (timer && lastArgs) {
      clearTimeout(timer);
      timer = null;
      return invoke();
    }
    return result;
  };

  return debounced;
}

/**
 * Call fn at most once per wait ms
 * @param {Function} fn
 * @param {number} [wait=300]
 * @returns {Function & { cancel: () => void }}
 */
export function throttle(fn, wait = 300) {
  let last = 0;
  let timer = null;
  let lastArgs = null;
  let lastThis = null;

  function throttled(...args) {
    const now = Date.now();
    const remaining = wait - (now - last);

    lastArgs = args;
    lastThis = this;

    if (remaining <= 0 || remaining > wait) {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      last = now;
      fn.apply(lastThis, lastArgs);
      lastArgs = lastThis = null;
    } else if (!timer) {
      timer = setTimeout(() => {
        last = Date.now();
        timer = null;
        fn.apply(lastThis, lastArgs);
        lastArgs = lastThis = null;
      }, remaining);
    }
  }

  throttled.cancel = () => {
    if (timer) clearTimeout(timer);
    timer = null;
    lastArgs = lastThis = null;
  };

  return throttled;
}

/**
 * Next animation frame (scroll / resize UI)
 */
export function rafThrottle(fn) {
  let locked = false;
  let lastArgs = null;
  let lastThis = null;

  function wrapped(...args) {
    lastArgs = args;
    lastThis = this;
    if (locked) return;
    locked = true;
    requestAnimationFrame(() => {
      locked = false;
      fn.apply(lastThis, lastArgs);
    });
  }

  return wrapped;
}

export default {
  debounce,
  throttle,
  rafThrottle,
};