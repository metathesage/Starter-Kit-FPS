/**
 * WAIFU ARENA // High-Fidelity Audio Engine
 *
 * Implements layered weapon acoustics (transient + punch body + room tail),
 * authentic Halo shield dynamics (sizzle, break, rising recharge tone),
 * Destiny 2 crisp hitmarker & crit chimes, and 3D positional spatialization.
 */

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.sfxGain = null;
    this.reverbNode = null;
    this.initialized = false;
    this.muted = false;
  }

  init() {
    if (this.initialized) return;
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.85;

      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = 0.9;
      this.sfxGain.connect(this.masterGain);

      // Create a procedural synthetic impulse response for Haven's open metal arena
      this.reverbNode = this.ctx.createConvolver();
      this.reverbNode.buffer = this._createReverbBuffer(1.4, 2.5);

      const revGain = this.ctx.createGain();
      revGain.gain.value = 0.22;
      this.reverbNode.connect(revGain);
      revGain.connect(this.masterGain);

      this.masterGain.connect(this.ctx.destination);
      this.initialized = true;
    } catch (e) {
      console.warn('AudioContext init failed:', e);
    }
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  _createReverbBuffer(duration, decay) {
    const rate = this.ctx.sampleRate;
    const length = rate * duration;
    const impulse = this.ctx.createBuffer(2, length, rate);
    const left = impulse.getChannelData(0);
    const right = impulse.getChannelData(1);

    for (let i = 0; i < length; i++) {
      const t = i / length;
      const n = (Math.random() * 2 - 1) * Math.pow(1 - t, decay);
      left[i] = n;
      right[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, decay);
    }
    return impulse;
  }

  /**
   * Layered Gunshot Synthesizer
   */
  playGunshot(type = 'ace', isADS = false) {
    if (!this.initialized || this.muted) return;
    this.resume();

    const t0 = this.ctx.currentTime;

    // --- 1. Transient Spike (Crisp initial hammer strike & supersonic crack)
    const snapOsc = this.ctx.createOscillator();
    const snapGain = this.ctx.createGain();
    snapOsc.type = 'triangle';
    const snapFreq = (type === 'ak47') ? 1600 : (type === 'm4a1') ? 1900 : (type === 'smg') ? 2400 : (type === 'ace' || type === 'hawkmoon') ? 1400 : 1200;
    snapOsc.frequency.setValueAtTime(snapFreq, t0);
    snapOsc.frequency.exponentialRampToValueAtTime(75, t0 + 0.04);

    snapGain.gain.setValueAtTime(0.85, t0);
    snapGain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.04);

    snapOsc.connect(snapGain);
    snapGain.connect(this.sfxGain);
    snapOsc.start(t0);
    snapOsc.stop(t0 + 0.045);

    // --- 2. Body Punch (Heavy sub-bass thud + powder combustion distortion)
    const bodyOsc = this.ctx.createOscillator();
    const bodyGain = this.ctx.createGain();
    const bodyDist = this.ctx.createWaveShaper();
    bodyDist.curve = this._makeDistortionCurve(type === 'ak47' ? 24 : 18);

    bodyOsc.type = 'sawtooth';
    const startFreq = (type === 'ak47') ? 180 : (type === 'm4a1') ? 220 : (type === 'chaperone') ? 150 : (type === 'launcher') ? 90 : 250;
    bodyOsc.frequency.setValueAtTime(startFreq, t0);
    bodyOsc.frequency.exponentialRampToValueAtTime(32, t0 + 0.17);

    const bodyVol = (type === 'ak47' || type === 'chaperone' || type === 'launcher') ? 0.95 : 0.80;
    bodyGain.gain.setValueAtTime(bodyVol, t0);
    bodyGain.gain.exponentialRampToValueAtTime(0.001, t0 + (type === 'launcher' ? 0.35 : 0.19));

    bodyOsc.connect(bodyDist);
    bodyDist.connect(bodyGain);
    bodyGain.connect(this.sfxGain);
    bodyOsc.start(t0);
    bodyOsc.stop(t0 + 0.2);

    // Sub-bass 45Hz chest thump
    const subOsc = this.ctx.createOscillator();
    const subGain = this.ctx.createGain();
    subOsc.type = 'sine';
    subOsc.frequency.setValueAtTime(65, t0);
    subOsc.frequency.exponentialRampToValueAtTime(28, t0 + 0.14);
    subGain.gain.setValueAtTime(0.7, t0);
    subGain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.14);
    subOsc.connect(subGain);
    subGain.connect(this.sfxGain);
    subOsc.start(t0);
    subOsc.stop(t0 + 0.15);

    // --- 3. Metallic Mech Chamber / SIVA Digital Chirp
    if (type === 'outbreak') {
      const sivaOsc = this.ctx.createOscillator();
      const sivaGain = this.ctx.createGain();
      sivaOsc.type = 'sine';
      sivaOsc.frequency.setValueAtTime(3200, t0);
      sivaOsc.frequency.linearRampToValueAtTime(4800, t0 + 0.03);
      sivaGain.gain.setValueAtTime(0.35, t0);
      sivaGain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.08);
      sivaOsc.connect(sivaGain);
      sivaGain.connect(this.sfxGain);
      sivaOsc.start(t0);
      sivaOsc.stop(t0 + 0.09);
    } else if (type === 'hawkmoon') {
      const chimeOsc = this.ctx.createOscillator();
      const chimeGain = this.ctx.createGain();
      chimeOsc.type = 'sine';
      chimeOsc.frequency.setValueAtTime(1760, t0); // A6 chime
      chimeGain.gain.setValueAtTime(0.25, t0);
      chimeGain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.15);
      chimeOsc.connect(chimeGain);
      chimeGain.connect(this.sfxGain);
      chimeOsc.start(t0);
      chimeOsc.stop(t0 + 0.16);
    }

    // --- 4. Room Acoustic Tail & Reflection
    const noiseBuffer = this._createNoiseBuffer(0.28);
    const noiseSource = this.ctx.createBufferSource();
    noiseSource.buffer = noiseBuffer;

    const noiseFilter = this.ctx.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.setValueAtTime(800, t0);
    noiseFilter.Q.value = 1.2;

    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(0.4, t0);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.28);

    noiseSource.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(this.reverbNode);
    noiseSource.start(t0);
  }

  /**
   * 3D Positional Gunshot for Bot AI & Spatial Combat
   */
  playPositionalGunshot(type = 'outbreak', sourcePos = null, listenerPos = null) {
    if (!this.initialized || this.muted) return;
    this.resume();

    let dist = 1;
    let pan = 0;
    if (sourcePos && listenerPos) {
      const dx = sourcePos.x - listenerPos.x;
      const dz = sourcePos.z - listenerPos.z;
      dist = Math.hypot(dx, dz);
      pan = Math.max(-0.85, Math.min(0.85, dx / (dist + 1.0)));
    }

    const t0 = this.ctx.currentTime;
    const vol = Math.max(0.12, Math.min(0.85, 1.4 / (1.0 + dist * 0.045)));

    // Create localized stereo panner and gain
    let outNode = this.sfxGain;
    if (this.ctx.createStereoPanner) {
      const panner = this.ctx.createStereoPanner();
      panner.pan.setValueAtTime(pan, t0);
      const distGain = this.ctx.createGain();
      distGain.gain.setValueAtTime(vol, t0);
      distGain.connect(panner);
      panner.connect(this.sfxGain);
      outNode = distGain;
    }

    // 1. Transient snap
    const snapOsc = this.ctx.createOscillator();
    const snapGain = this.ctx.createGain();
    snapOsc.type = 'triangle';
    snapOsc.frequency.setValueAtTime(type === 'ace' ? 1200 : 1800, t0);
    snapOsc.frequency.exponentialRampToValueAtTime(100, t0 + 0.035);
    snapGain.gain.setValueAtTime(0.6 * vol, t0);
    snapGain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.035);
    snapOsc.connect(snapGain);
    snapGain.connect(outNode);
    snapOsc.start(t0);
    snapOsc.stop(t0 + 0.04);

    // 2. Punch
    const bodyOsc = this.ctx.createOscillator();
    const bodyGain = this.ctx.createGain();
    bodyOsc.type = 'sawtooth';
    bodyOsc.frequency.setValueAtTime(220, t0);
    bodyOsc.frequency.exponentialRampToValueAtTime(55, t0 + 0.08);
    bodyGain.gain.setValueAtTime(0.7 * vol, t0);
    bodyGain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.08);
    bodyOsc.connect(bodyGain);
    bodyGain.connect(outNode);
    bodyOsc.start(t0);
    bodyOsc.stop(t0 + 0.09);

    // 3. Reverb tail
    const noiseBuffer = this._createNoiseBuffer(0.2);
    const noiseSource = this.ctx.createBufferSource();
    noiseSource.buffer = noiseBuffer;
    const noiseFilter = this.ctx.createBiquadFilter();
    noiseFilter.type = 'bandpass';
    noiseFilter.frequency.setValueAtTime(900, t0);
    noiseFilter.Q.value = 1.0;
    const noiseGain = this.ctx.createGain();
    noiseGain.gain.setValueAtTime(0.3 * vol, t0);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.2);
    noiseSource.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(this.reverbNode);
    noiseSource.start(t0);
  }

  /**
   * Energy Sword / Lament Melee Slash
   */
  playMelee(isLament = false) {
    if (!this.initialized || this.muted) return;
    this.resume();
    const t0 = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = isLament ? 'sawtooth' : 'triangle';
    osc.frequency.setValueAtTime(isLament ? 120 : 640, t0);
    osc.frequency.exponentialRampToValueAtTime(isLament ? 380 : 180, t0 + 0.18);

    gain.gain.setValueAtTime(0.8, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.22);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t0);
    osc.stop(t0 + 0.25);
  }

  /**
   * Tactical Shooter Hitmarker Tick & Headshot Dink (CS2 / Destiny 2 Style)
   */
  playHitmarker(isCrit = false) {
    if (!this.initialized || this.muted) return;
    this.resume();
    const t0 = this.ctx.currentTime;

    if (isCrit) {
      // High-frequency metallic headshot dink chime + heavy helmet crack
      const dinkOsc = this.ctx.createOscillator();
      const dinkGain = this.ctx.createGain();
      dinkOsc.type = 'triangle';
      dinkOsc.frequency.setValueAtTime(3200, t0);
      dinkOsc.frequency.exponentialRampToValueAtTime(1400, t0 + 0.12);
      dinkGain.gain.setValueAtTime(0.85, t0);
      dinkGain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.12);
      dinkOsc.connect(dinkGain);
      dinkGain.connect(this.sfxGain);
      dinkOsc.start(t0);
      dinkOsc.stop(t0 + 0.13);

      const bellOsc = this.ctx.createOscillator();
      const bellGain = this.ctx.createGain();
      bellOsc.type = 'sine';
      bellOsc.frequency.setValueAtTime(2637, t0); // E7
      bellGain.gain.setValueAtTime(0.6, t0);
      bellGain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.18);
      bellOsc.connect(bellGain);
      bellGain.connect(this.sfxGain);
      bellOsc.start(t0);
      bellOsc.stop(t0 + 0.19);
    } else {
      // Tactile broadband mechanical snap / hit click (CS2 / CoD tick)
      const tickBuffer = this._createNoiseBuffer(0.025);
      const tickSource = this.ctx.createBufferSource();
      tickSource.buffer = tickBuffer;

      const tickFilter = this.ctx.createBiquadFilter();
      tickFilter.type = 'bandpass';
      tickFilter.frequency.setValueAtTime(2800, t0);
      tickFilter.Q.value = 3.5;

      const tickGain = this.ctx.createGain();
      tickGain.gain.setValueAtTime(0.75, t0);
      tickGain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.025);

      tickSource.connect(tickFilter);
      tickFilter.connect(tickGain);
      tickGain.connect(this.sfxGain);
      tickSource.start(t0);

      // Sub-transient pop
      const popOsc = this.ctx.createOscillator();
      const popGain = this.ctx.createGain();
      popOsc.type = 'triangle';
      popOsc.frequency.setValueAtTime(320, t0);
      popOsc.frequency.exponentialRampToValueAtTime(80, t0 + 0.035);
      popGain.gain.setValueAtTime(0.55, t0);
      popGain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.035);
      popOsc.connect(popGain);
      popGain.connect(this.sfxGain);
      popOsc.start(t0);
      popOsc.stop(t0 + 0.04);
    }
  }

  /**
   * Halo Shield Hit Sizzle
   */
  playShieldHit() {
    if (!this.initialized || this.muted) return;
    this.resume();
    const t0 = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(980, t0);
    osc.frequency.linearRampToValueAtTime(540, t0 + 0.08);

    gain.gain.setValueAtTime(0.45, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.09);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t0);
    osc.stop(t0 + 0.1);
  }

  /**
   * Halo Shield Pop / Shatter Zap
   */
  playShieldPop() {
    if (!this.initialized || this.muted) return;
    this.resume();
    const t0 = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(1800, t0);
    osc.frequency.exponentialRampToValueAtTime(80, t0 + 0.28);

    gain.gain.setValueAtTime(0.85, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.3);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t0);
    osc.stop(t0 + 0.32);
  }

  /**
   * Halo Shield Recharge Rising Tone
   */
  playShieldRecharge() {
    if (!this.initialized || this.muted) return;
    this.resume();
    const t0 = this.ctx.currentTime;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(320, t0);
    osc.frequency.exponentialRampToValueAtTime(960, t0 + 0.45);

    gain.gain.setValueAtTime(0.05, t0);
    gain.gain.linearRampToValueAtTime(0.35, t0 + 0.38);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.5);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t0);
    osc.stop(t0 + 0.52);
  }

  /**
   * Kill Confirmation Stinger
   */
  playKillStinger() {
    if (!this.initialized || this.muted) return;
    this.resume();
    const t0 = this.ctx.currentTime;

    [880, 1174, 1760].forEach((freq, i) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t0 + i * 0.05);

      gain.gain.setValueAtTime(0.4, t0 + i * 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + i * 0.05 + 0.35);

      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(t0 + i * 0.05);
      osc.stop(t0 + i * 0.05 + 0.38);
    });
  }

  /**
   * Reload Mechanical Clicks
   */
  playReload() {
    if (!this.initialized || this.muted) return;
    this.resume();
    const t0 = this.ctx.currentTime;

    [0.05, 0.45, 0.95].forEach((delay) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(1100, t0 + delay);
      osc.frequency.exponentialRampToValueAtTime(180, t0 + delay + 0.035);

      gain.gain.setValueAtTime(0.35, t0 + delay);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + delay + 0.04);

      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(t0 + delay);
      osc.stop(t0 + delay + 0.05);
    });
  }

  _createNoiseBuffer(duration) {
    const rate = this.ctx.sampleRate;
    const len = rate * duration;
    const buf = this.ctx.createBuffer(1, len, rate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buf;
  }

  _makeDistortionCurve(amount = 20) {
    const k = amount;
    const n_samples = 44100;
    const curve = new Float32Array(n_samples);
    const deg = Math.PI / 180;
    for (let i = 0; i < n_samples; ++i) {
      const x = (i * 2) / n_samples - 1;
      curve[i] = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x));
    }
    return curve;
  }

  /**
   * Counter-Strike Round Audio Fanfares & Tactical Cues
   */
  playRoundStart() {
    if (!this.initialized || this.muted) return;
    this.resume();
    const t0 = this.ctx.currentTime;
    // Dual brass trumpet cue: C4 -> G4
    [261.63, 392.00].forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, t0 + idx * 0.12);
      gain.gain.setValueAtTime(0, t0 + idx * 0.12);
      gain.gain.linearRampToValueAtTime(0.35, t0 + idx * 0.12 + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + idx * 0.12 + 0.45);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(t0 + idx * 0.12);
      osc.stop(t0 + idx * 0.12 + 0.5);
    });
  }

  playRoundWin(isCT = true) {
    if (!this.initialized || this.muted) return;
    this.resume();
    const t0 = this.ctx.currentTime;
    // Triumphant 3-chord fanfare: C4 -> E4 -> G4 -> C5
    const notes = isCT ? [523.25, 659.25, 783.99, 1046.50] : [440.00, 554.37, 659.25, 880.00];
    notes.forEach((freq, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t0 + idx * 0.1);
      gain.gain.setValueAtTime(0, t0 + idx * 0.1);
      gain.gain.linearRampToValueAtTime(0.4, t0 + idx * 0.1 + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + idx * 0.1 + 0.6);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(t0 + idx * 0.1);
      osc.stop(t0 + idx * 0.1 + 0.65);
    });
  }

  playRoundLoss() {
    if (!this.initialized || this.muted) return;
    this.resume();
    const t0 = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(110, t0);
    osc.frequency.exponentialRampToValueAtTime(55, t0 + 0.8);
    gain.gain.setValueAtTime(0.3, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.85);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(t0);
    osc.stop(t0 + 0.9);
  }

  playTimerBeep(isUrgent = false) {
    if (!this.initialized || this.muted) return;
    this.resume();
    const t0 = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(isUrgent ? 1200 : 880, t0);
    gain.gain.setValueAtTime(0.2, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.08);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t0);
    osc.stop(t0 + 0.09);
  }

  /**
   * Anime voice lines disabled per tactical shooter requirements.
   */
  playVoice(type = 'damage') {
    // Disabled: pure tactical weapon acoustics & combat audio
  }
}

