// Original procedural audio (WebAudio). No recorded or commissioned music is included.
// Audio starts only after a user gesture and pauses when the page is hidden.
type Mood = 'indoor' | 'village' | 'yard' | 'cellar' | 'battle' | 'boss' | 'title';

const SCALES: Record<Mood, { notes: number[]; tempo: number; wave: OscillatorType }> = {
  title: { notes: [57, 60, 64, 62, 60, 55, 57, 0], tempo: 300, wave: 'triangle' },
  indoor: { notes: [60, 64, 67, 64, 62, 65, 64, 0], tempo: 340, wave: 'triangle' },
  village: { notes: [62, 66, 69, 66, 64, 67, 66, 62], tempo: 300, wave: 'triangle' },
  yard: { notes: [55, 58, 62, 58, 57, 60, 58, 0], tempo: 280, wave: 'square' },
  cellar: { notes: [45, 48, 51, 0, 44, 47, 50, 0], tempo: 420, wave: 'sine' },
  battle: { notes: [57, 57, 60, 62, 57, 64, 62, 60], tempo: 180, wave: 'square' },
  boss: { notes: [45, 46, 45, 52, 45, 46, 49, 48], tempo: 170, wave: 'sawtooth' },
};

const midi = (n: number) => 440 * Math.pow(2, (n - 69) / 12);

export class Audio {
  private ctx: AudioContext | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private timer: number | null = null;
  private step = 0;
  private mood: Mood = 'title';
  music = true;
  sfx = true;

  /** Call from a user gesture. */
  unlock() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended' && !document.hidden) void this.ctx.resume();
      return;
    }
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    this.ctx = new Ctor();
    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = 0.05;
    this.musicGain.connect(this.ctx.destination);
    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.value = 0.12;
    this.sfxGain.connect(this.ctx.destination);
    this.restart();
  }

  setMood(m: Mood) {
    if (m === this.mood) return;
    this.mood = m;
    this.step = 0;
    this.restart();
  }

  setEnabled(music: boolean, sfx: boolean) {
    this.music = music;
    this.sfx = sfx;
    this.restart();
  }

  pause() {
    if (this.timer) window.clearInterval(this.timer);
    this.timer = null;
    void this.ctx?.suspend();
  }

  resume() {
    if (!this.ctx) return;
    void this.ctx.resume();
    this.restart();
  }

  private restart() {
    if (this.timer) window.clearInterval(this.timer);
    this.timer = null;
    if (!this.ctx || !this.music || document.hidden) return;
    const sc = SCALES[this.mood];
    this.timer = window.setInterval(() => {
      const n = sc.notes[this.step % sc.notes.length];
      this.step += 1;
      if (n) this.tone(n, sc.tempo / 1000 * 0.9, sc.wave, this.musicGain!);
      if (this.step % 4 === 1) this.tone(sc.notes[0] - 12, sc.tempo / 1000 * 1.8, 'sine', this.musicGain!);
    }, sc.tempo);
  }

  private tone(note: number, dur: number, wave: OscillatorType, out: GainNode, freqOverride?: number) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = wave;
    o.frequency.value = freqOverride ?? midi(note);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(1, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(out);
    o.start(t);
    o.stop(t + dur + 0.02);
  }

  play(name: string) {
    if (!this.ctx || !this.sfx || document.hidden) return;
    const out = this.sfxGain!;
    switch (name) {
      case 'blip': this.tone(76, 0.06, 'square', out); break;
      case 'hit': this.tone(40, 0.12, 'sawtooth', out); this.tone(35, 0.1, 'square', out); break;
      case 'heal': this.tone(72, 0.1, 'sine', out); setTimeout(() => this.tone(79, 0.14, 'sine', out), 80); break;
      case 'coin': this.tone(83, 0.06, 'square', out); setTimeout(() => this.tone(88, 0.1, 'square', out), 60); break;
      case 'craft': this.tone(52, 0.06, 'square', out); setTimeout(() => this.tone(64, 0.08, 'square', out), 70); setTimeout(() => this.tone(71, 0.12, 'triangle', out), 140); break;
      case 'reward': [72, 76, 79, 84].forEach((n, i) => setTimeout(() => this.tone(n, 0.12, 'triangle', out), i * 90)); break;
      case 'door': this.tone(48, 0.12, 'triangle', out); break;
      default: this.tone(70, 0.05, 'square', out);
    }
  }
}
