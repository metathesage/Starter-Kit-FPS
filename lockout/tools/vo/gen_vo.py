"""Narrator VO: Piper (en_US amy) + a holographic-AI treatment (chorus shimmer, presence, short bloom), encoded to mp3.
python3 gen_vo.py /path/to/en_US-amy-medium.onnx ../../audio/vo"""
import sys, os, json, wave, subprocess, numpy as np
from scipy.signal import butter, lfilter, fftconvolve
from piper import PiperVoice
import imageio_ffmpeg

MODEL, OUT = sys.argv[1], sys.argv[2]
os.makedirs(OUT, exist_ok=True)
EXO = {"HAWKMOON": "Hawkmoon", "LAST WORD": "Last Word", "FELWINTER'S LIE": "Felwinter's Lie", "GJALLARHORN": "Gjallarhorn", "THORN": "Thorn", "ACE OF SPADES": "Ace of Spades", "IZANAGI'S BURDEN": "Izanagi's Burden", "CHAPERONE": "Chaperone", "VEX MYTHOCLAST": "Vex Mythoclast", "OUTBREAK": "Outbreak Perfected"}
L = {
    "NOVA BOMB READY": "Nova bomb ready.", "NOVA BOMB CHARGING": "Nova bomb charging. Get clear.", "NOVA BOMB INTERRUPTED": "Nova bomb interrupted.",
    "OVERSHIELD": "Overshield.", "ACTIVE CAMO": "Active camo.", "DAMAGE BOOST": "Damage boost.",
    "YOU ARE THE KILL LEADER": "You are the kill leader.", "STREAK REWARD: GRENADES": "Streak reward. Grenades.", "STREAK REWARD: DAMAGE BOOST": "Streak reward. Damage boost.", "STREAK REWARD: OVERSHIELD": "Streak reward. Overshield.",
    "TEAMS TIED": "Teams tied.", "RED TEAM TAKES THE LEAD": "Red team takes the lead.", "BLUE TEAM TAKES THE LEAD": "Blue team takes the lead.", "SPARTANS TAKE THE LEAD": "Spartans take the lead.", "WARLOCKS TAKE THE LEAD": "Warlocks take the lead.",
    "1 KILL TO WIN": "One kill to win.", "2 KILLS TO WIN": "Two kills to win.", "3 KILLS TO WIN": "Three kills to win.", "1 CAPTURE TO WIN": "One capture to win.", "10 SECONDS TO WIN": "Ten seconds to win.", "GO": "Go.",
    "KILLING SPREE": "Killing spree.", "KILLING FRENZY": "Killing frenzy.", "RUNNING RIOT": "Running riot.", "RAMPAGE": "Rampage.", "DOUBLE KILL": "Double kill.", "TRIPLE KILL": "Triple kill.", "OVERKILL": "Overkill.",
    "FIRST BLOOD": "First blood.", "HEADSHOT": "Headshot.", "PERFECT": "Perfect.", "ASSASSINATION": "Assassination.", "BEATDOWN": "Beatdown.", "GRENADE KILL": "Grenade kill.", "HAMMER TIME": "Hammer time.", "REVENGE": "Revenge.",
    "ROCKET KILL": "Rocket kill.", "SNIPER KILL": "Sniper kill.", "SWORD KILL": "Sword kill.", "SPREE ENDED": "Spree ended.", "NOVA BOMB": "Nova bomb.", "NOVA BREAKER": "Nova breaker.", "FLAG CAPTURE": "Flag captured.", "FLAG RETURN": "Flag returned.",
    "CARRIER KILL": "Carrier down.", "BALL CARRIER KILL": "Ball carrier down.",
    "@start1": "Systems online. Operator, you're live.", "@start2": "Link is stable. Make them remember you.", "@start3": "Weapons hot. Give them a show.",
    "@win1": "Objective complete. Nicely done, operator.", "@win2": "That's the match. I'd say they never saw you coming.", "@lose1": "We lost that one. Regroup, and go again.", "@lose2": "Not our day. Shake it off. I've already got the next one queued.",
    "@hub1": "Welcome back to the Sanctum, operator.", "@hub2": "Quiet in here. I like it. Take your time.", "@levelup": "Level up. New rewards are ready.", "@shield": "Shield critical.", "@exotic": "Exotic weapon secured.",
}
for k, v in EXO.items(): L[f"EXOTIC ACQUIRED {k}"] = f"Exotic acquired. {v}."
voice = PiperVoice.load(MODEL)
ff = imageio_ffmpeg.get_ffmpeg_exe()
sos_hp = butter(2, 130 / 11025, 'high', output='ba')

def synth(text):
    import io
    b = io.BytesIO()
    with wave.open(b, 'wb') as w:
        voice.synthesize_wav(text, w)
    b.seek(0)
    with wave.open(b) as w:
        d = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float32) / 32768
    return d

def fx(x, sr=22050):
    x = lfilter(*sos_hp, x)
    # chorus shimmer: two LFO-modulated delayed copies, "hologram" doubling
    n = len(x); t = np.arange(n) / sr; out = x.copy()
    for rate, depth, base, gain in ((0.9, 0.0016, 0.011, 0.30), (0.55, 0.0021, 0.019, 0.20)):
        d = (base + depth * np.sin(2 * np.pi * rate * t)) * sr
        idx = np.clip(np.arange(n) - d, 0, n - 1); i0 = np.floor(idx).astype(int); fr = idx - i0
        out += gain * ((1 - fr) * x[i0] + fr * x[np.minimum(i0 + 1, n - 1)])
    # presence + air
    bp = butter(2, [2600 / 11025, 7800 / 11025], 'band', output='ba'); out += 0.35 * lfilter(*bp, out)
    # short bright bloom
    ir = np.random.default_rng(7).standard_normal(int(0.5 * sr)) * np.exp(-np.arange(int(0.5 * sr)) / (0.11 * sr)); ir[:int(0.012 * sr)] *= np.linspace(0, 1, int(0.012 * sr))
    hpir = lfilter(*butter(2, 500 / 11025, 'high', output='ba'), ir)
    tail = int(0.5 * sr); wet = np.zeros(n + tail); c = fftconvolve(out, hpir)[:n + tail]; wet[:len(c)] = c * 0.05
    res = np.concatenate([out, np.zeros(tail)]) + wet
    res = np.tanh(res * 1.5) / 1.5
    # trim silence, fade, normalise
    a = np.abs(res); nz = np.where(a > 0.01)[0]
    if len(nz): res = res[max(0, nz[0] - int(0.02 * sr)): nz[-1] + int(0.06 * sr)]
    res *= 0.92 / max(1e-6, np.abs(res).max())
    f = int(0.01 * sr); res[:f] *= np.linspace(0, 1, f); res[-f * 6:] *= np.linspace(1, 0, f * 6)
    return res

man = {}
for k, text in L.items():
    name = 'vo_' + ''.join(c.lower() if c.isalnum() else '_' for c in k).strip('_')
    wavp = f'/tmp/vo/{name}.wav'
    y = fx(synth(text))
    import soundfile as sf
    sf.write(wavp, y, 22050)
    subprocess.run([ff, '-y', '-loglevel', 'error', '-i', wavp, '-ac', '1', '-b:a', '56k', f'{OUT}/{name}.mp3'], check=True)
    man[k] = name + '.mp3'
json.dump(man, open(f'{OUT}/manifest.json', 'w'), indent=0)
print(len(man), 'lines')
