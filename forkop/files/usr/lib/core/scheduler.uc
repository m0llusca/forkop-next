// Elapsed-time scheduling is independent of NTP and wall-clock jumps.
function now() { return clock(true)[0]; }
return {now};
