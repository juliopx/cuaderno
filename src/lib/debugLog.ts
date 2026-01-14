// Debug logging utilities based on URL parameters
// Usage: ?disklog=true&synclog=true

const params = new URLSearchParams(window.location.search);

export const DEBUG_FLAGS = {
  diskLog: params.get('disklog') === 'true',
  syncLog: params.get('synclog') === 'true',
};

export const diskLog = (...args: any[]) => {
  if (DEBUG_FLAGS.diskLog) {
    console.log(...args);
  }
};

export const syncLog = (...args: any[]) => {
  if (DEBUG_FLAGS.syncLog) {
    console.log(...args);
  }
};
