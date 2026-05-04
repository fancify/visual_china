export class FakeAudioParam {
  constructor(value = 0) {
    this.value = value;
    this.events = [];
  }

  setValueAtTime(value, time) {
    this.value = value;
    this.events.push({ type: "set", value, time });
  }

  linearRampToValueAtTime(value, time) {
    this.value = value;
    this.events.push({ type: "ramp", value, time });
  }

  cancelScheduledValues(time) {
    this.events.push({ type: "cancel", time });
  }
}

export class FakeGainNode {
  constructor() {
    this.gain = new FakeAudioParam(1);
    this.connections = [];
  }

  connect(node) {
    this.connections.push(node);
    return node;
  }

  disconnect() {
    this.connections.length = 0;
  }
}

export class FakeBufferSourceNode {
  constructor() {
    this.buffer = null;
    this.loop = false;
    this.playbackRate = new FakeAudioParam(1);
    this.connections = [];
    this.started = [];
    this.disconnected = false;
    this.onended = null;
  }

  connect(node) {
    this.connections.push(node);
    return node;
  }

  start(when = 0) {
    this.started.push(when);
  }

  disconnect() {
    this.disconnected = true;
    this.connections.length = 0;
  }
}

export class FakeAudioContext {
  constructor() {
    this.currentTime = 0;
    this.state = "running";
    this.destination = { connections: [] };
    this.createdGains = [];
    this.createdSources = [];
    this.resumeCalls = 0;
  }

  createGain() {
    const node = new FakeGainNode();
    this.createdGains.push(node);
    return node;
  }

  createBufferSource() {
    const node = new FakeBufferSourceNode();
    this.createdSources.push(node);
    return node;
  }

  async decodeAudioData(arrayBuffer) {
    return {
      byteLength: arrayBuffer.byteLength
    };
  }

  async resume() {
    this.state = "running";
    this.resumeCalls += 1;
  }
}

export function createRuntime(bufferIds = []) {
  const context = new FakeAudioContext();
  const masterGain = context.createGain();
  masterGain.connect(context.destination);
  const buffers = new Map(bufferIds.map((id) => [id, { id }]));
  return {
    runtime: {
      context,
      masterGain,
      buffers,
      unlocked: true
    },
    context
  };
}

export function gainEventsForTrack(context, trackId) {
  const gainNode = context.createdGains.find((node) => node.__trackId === trackId);
  return gainNode?.gain.events ?? [];
}

export function createdTrackIds(context) {
  return context.createdSources.map((source) => source.__trackId);
}
