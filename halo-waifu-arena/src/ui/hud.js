/**
 * WAIFU ARENA // Modern Cyber-Halo & Destiny 2 HUD Engine
 *
 * Implements dynamic expanding bloom reticle, hitmarkers,
 * floating critical damage numbers, shield/health bars,
 * 9-slot weapon inventory, KOTH objective bar, and killfeed.
 */

export class HUD {
  constructor() {
    this.container = document.getElementById('hud');
    this.reticleRing = document.getElementById('reticle-ring');
    this.reticleDot = document.getElementById('reticle-dot');
    this.hitmarker = document.getElementById('hitmarker');
    this.shieldBar = document.getElementById('shield-bar');
    this.healthBar = document.getElementById('health-bar');
    this.ammoMag = document.getElementById('ammo-mag');
    this.ammoRes = document.getElementById('ammo-res');
    this.weaponTitle = document.getElementById('weapon-title');
    this.weaponType = document.getElementById('weapon-type');
    this.kothStatus = document.getElementById('koth-status');
    this.killfeedContainer = document.getElementById('killfeed');
    this.damageFlash = document.getElementById('damage-flash');
    this.shieldFlash = document.getElementById('shield-flash');
    this.damageNumbersContainer = document.getElementById('dmg-numbers');

    this.activeSlotIdx = 0;
  }

  updateVitals(shield, maxShield, health, maxHealth) {
    if (this.shieldBar) {
      const sPct = Math.max(0, Math.min(100, (shield / maxShield) * 100));
      this.shieldBar.style.width = `${sPct}%`;
      this.shieldBar.style.boxShadow = sPct < 25
        ? '0 0 14px rgba(239, 68, 68, 0.9)'
        : '0 0 8px rgba(56, 189, 248, 0.7)';
    }

    if (this.healthBar) {
      const hPct = Math.max(0, Math.min(100, (health / maxHealth) * 100));
      this.healthBar.style.width = `${hPct}%`;
    }
  }

  updateWeapon(def, ammo, reserve, slotIndex) {
    if (this.weaponTitle) this.weaponTitle.innerText = def.name.toUpperCase();
    if (this.weaponType) this.weaponType.innerText = def.archetype || def.type;

    if (this.ammoMag) {
      this.ammoMag.innerText = def.isMelee ? '∞' : ammo;
    }
    if (this.ammoRes) {
      this.ammoRes.innerText = def.isMelee ? '[ENERGY]' : `/ ${reserve}`;
    }

    // Highlight active pip in 9-slot inventory
    const pips = document.querySelectorAll('.w-pip');
    pips.forEach((pip, idx) => {
      pip.classList.toggle('active', idx === slotIndex);
    });
    this.activeSlotIdx = slotIndex;
  }

  updateSpread(spreadDeg, isADS) {
    if (!this.reticleRing) return;
    if (isADS) {
      this.reticleRing.style.transform = 'translate(-50%, -50%) scale(0.55)';
      this.reticleRing.style.borderColor = 'rgba(0, 243, 255, 0.95)';
      this.reticleRing.style.boxShadow = '0 0 10px rgba(0, 243, 255, 0.6)';
    } else {
      // Scale reticle ring smoothly with spread degrees
      const scale = Math.max(16, Math.min(75, spreadDeg * 14.0));
      this.reticleRing.style.width = `${scale}px`;
      this.reticleRing.style.height = `${scale}px`;
      this.reticleRing.style.borderColor = 'rgba(255, 255, 255, 0.65)';
      this.reticleRing.style.transform = 'translate(-50%, -50%) scale(1)';
      this.reticleRing.style.boxShadow = 'none';
    }
  }

  flashHitmarker(isCrit = false) {
    if (!this.hitmarker) return;
    this.hitmarker.classList.toggle('crit', isCrit);
    this.hitmarker.style.opacity = '1';
    this.hitmarker.style.transform = isCrit ? 'translate(-50%, -50%) scale(1.35)' : 'translate(-50%, -50%) scale(1.1)';

    setTimeout(() => {
      if (this.hitmarker) {
        this.hitmarker.style.opacity = '0';
        this.hitmarker.style.transform = 'translate(-50%, -50%) scale(0.85)';
      }
    }, 95);
  }

  spawnDamageNumber(x, y, amount, isCrit = false) {
    if (!this.damageNumbersContainer) return;
    const val = isNaN(amount) || amount <= 0 ? 25 : Math.round(amount);
    const el = document.createElement('div');
    el.className = `dmg-num ${isCrit ? 'crit' : ''}`;
    el.innerText = `${val}${isCrit ? ' ✦ CRIT' : ''}`;

    const screenX = Math.max(40, Math.min(window.innerWidth - 40, x));
    const screenY = Math.max(40, Math.min(window.innerHeight - 40, y));
    const offsetX = (Math.random() - 0.5) * 18;
    const offsetY = (Math.random() - 0.5) * 10;

    el.style.left = `${Math.round(screenX + offsetX)}px`;
    el.style.top = `${Math.round(screenY + offsetY)}px`;
    el.style.opacity = '1';
    el.style.transform = 'translate(-50%, -50%) scale(0.85)';

    this.damageNumbersContainer.appendChild(el);

    requestAnimationFrame(() => {
      el.style.transform = `translate(-50%, -140%) scale(${isCrit ? 1.3 : 1.05})`;
      setTimeout(() => {
        el.style.opacity = '0';
      }, 260);
    });

    setTimeout(() => {
      if (el.parentNode) el.parentNode.removeChild(el);
    }, 650);
  }

  flashShieldDamage() {
    if (!this.shieldFlash) return;
    this.shieldFlash.style.boxShadow = 'inset 0 0 70px rgba(56, 189, 248, 0.65)';
    setTimeout(() => {
      if (this.shieldFlash) this.shieldFlash.style.boxShadow = 'inset 0 0 70px rgba(56, 189, 248, 0)';
    }, 120);
  }

  flashHealthDamage() {
    if (!this.damageFlash) return;
    this.damageFlash.style.boxShadow = 'inset 0 0 90px rgba(239, 68, 68, 0.85)';
    setTimeout(() => {
      if (this.damageFlash) this.damageFlash.style.boxShadow = 'inset 0 0 90px rgba(239, 68, 68, 0)';
    }, 130);
  }

  addFeedMessage(killer, victim, weaponName, isHeadshot = false) {
    if (!this.killfeedContainer) return;
    const item = document.createElement('div');
    item.className = 'kf-item';
    item.innerHTML = `<span class="kf-killer">${killer}</span> <span class="kf-icon">[${weaponName}]</span> <span class="kf-victim">${victim}</span>${isHeadshot ? ' <span class="kf-crit">🎯 PRECISION</span>' : ''}`;

    this.killfeedContainer.appendChild(item);
    setTimeout(() => {
      item.style.opacity = '0';
      setTimeout(() => {
        if (item.parentNode) item.parentNode.removeChild(item);
      }, 400);
    }, 3800);
  }

  updateKoth(statusText, blueScore, redScore) {
    if (this.kothStatus) {
      this.kothStatus.innerHTML = `
        <span class="dot-indicator" style="background:#00f3ff; box-shadow:0 0 8px #00f3ff;"></span>
        <span>${statusText}</span>
        <span style="color:#64748b; margin: 0 4px;">|</span>
        <span style="color:#38bdf8;">YOU ${blueScore}</span>
        <span style="color:#64748b; margin: 0 4px;">-</span>
        <span style="color:#f43f5e;">HOSTILES ${redScore}</span>
      `;
    }
  updateTDM(ctScore, tScore, targetScore = 30, timerSec = null) {
    if (!this.kothStatus) return;
    const timeStr = timerSec !== null ? `${Math.floor(timerSec / 60)}:${Math.floor(timerSec % 60).toString().padStart(2, '0')}` : 'LIVE';
    this.kothStatus.innerHTML = `
      <span style="color:#38bdf8; font-weight:800; background:rgba(56,189,248,0.18); padding:3px 10px; border-radius:3px; border:1px solid rgba(56,189,248,0.4);">CT ${ctScore}</span>
      <span style="color:#94a3b8; font-size:12px; font-weight:700; margin:0 6px;">/ ${targetScore}</span>
      <span style="color:#f8fafc; font-weight:800; font-size:13px; background:rgba(0,0,0,0.6); padding:2px 10px; border-radius:3px; letter-spacing:1px; border:1px solid rgba(255,255,255,0.15);">${timeStr}</span>
      <span style="color:#94a3b8; font-size:12px; font-weight:700; margin:0 6px;">${targetScore} \\</span>
      <span style="color:#f43f5e; font-weight:800; background:rgba(244,63,94,0.18); padding:3px 10px; border-radius:3px; border:1px solid rgba(244,63,94,0.4);">T ${tScore}</span>
    `;
  }

  updateCSMatch(matchState, ctAlive, tAlive, totalCT = 5, totalT = 5) {
    if (!this.kothStatus) return;

    // Time format 01:45
    const mins = Math.floor(Math.max(0, matchState.roundTimer) / 60);
    const secs = Math.floor(Math.max(0, matchState.roundTimer) % 60).toString().padStart(2, '0');
    const timeStr = matchState.state === 'FREEZE' 
      ? `BUY ${Math.ceil(matchState.freezeTimer)}s` 
      : `${mins}:${secs}`;

    // Alive dots for CT
    let ctDots = '';
    for (let i = 0; i < totalCT; i++) {
      ctDots += (i < ctAlive) 
        ? '<span style="color:#38bdf8; font-size:12px; margin:0 1px;">●</span>' 
        : '<span style="color:#475569; font-size:11px; margin:0 1px;">✕</span>';
    }

    // Alive dots for T
    let tDots = '';
    for (let i = 0; i < totalT; i++) {
      tDots += (i < tAlive) 
        ? '<span style="color:#f43f5e; font-size:12px; margin:0 1px;">●</span>' 
        : '<span style="color:#475569; font-size:11px; margin:0 1px;">✕</span>';
    }

    this.kothStatus.innerHTML = `
      <span style="color:#38bdf8; font-weight:800; background:rgba(56,189,248,0.15); padding:2px 8px; border-radius:2px; border:1px solid rgba(56,189,248,0.3);">CT ${matchState.ctScore}</span>
      <span style="margin: 0 4px;">${ctDots}</span>
      <span style="color:#f8fafc; font-weight:800; font-size:14px; background:rgba(0,0,0,0.5); padding:2px 10px; border-radius:2px; letter-spacing:1px; border:1px solid rgba(255,255,255,0.15);">${timeStr}</span>
      <span style="margin: 0 4px;">${tDots}</span>
      <span style="color:#f43f5e; font-weight:800; background:rgba(244,63,94,0.15); padding:2px 8px; border-radius:2px; border:1px solid rgba(244,63,94,0.3);">T ${matchState.tScore}</span>
      <span style="color:#94a3b8; font-size:10px; margin-left:6px;">R${matchState.round}/${matchState.maxRounds}</span>
    `;
  }

  showRoundBanner(title, subtitle, isCT = true) {
    let banner = document.getElementById('round-banner');
    if (!banner) {
      banner = document.createElement('div');
      banner.id = 'round-banner';
      banner.style.cssText = `
        position: absolute; top: 22%; left: 50%; transform: translate(-50%, -50%);
        display: flex; flex-direction: column; align-items: center; justify-content: center;
        text-align: center; pointer-events: none; z-index: 100;
        background: rgba(6, 10, 24, 0.88); backdrop-filter: blur(16px);
        padding: 24px 56px; border-radius: 4px;
        box-shadow: 0 10px 50px rgba(0,0,0,0.8);
        transition: opacity 0.3s ease, transform 0.3s ease;
      `;
      document.body.appendChild(banner);
    }

    const color = isCT ? '#38bdf8' : '#f43f5e';
    const borderColor = isCT ? 'rgba(56,189,248,0.8)' : 'rgba(244,63,94,0.8)';
    banner.style.border = `2px solid ${borderColor}`;
    banner.style.borderTop = `4px solid ${color}`;
    banner.style.boxShadow = `0 0 40px ${isCT ? 'rgba(56,189,248,0.35)' : 'rgba(244,63,94,0.35)'}`;

    banner.innerHTML = `
      <div style="font-family:'Share Tech Mono', monospace; font-size:12px; letter-spacing:3px; color:${color}; margin-bottom:6px;">// ROUND COMPLETE</div>
      <div style="font-size:32px; font-weight:900; color:#ffffff; letter-spacing:2px; text-transform:uppercase; text-shadow:0 0 20px ${color}; margin-bottom:6px;">${title}</div>
      <div style="font-family:'Share Tech Mono', monospace; font-size:13px; color:#cbd5e1; letter-spacing:1px;">${subtitle}</div>
    `;

    banner.style.display = 'flex';
    banner.style.opacity = '1';
    banner.style.transform = 'translate(-50%, -50%) scale(1)';
  }

  hideRoundBanner() {
    const banner = document.getElementById('round-banner');
    if (banner) {
      banner.style.opacity = '0';
      banner.style.transform = 'translate(-50%, -50%) scale(0.95)';
      setTimeout(() => { banner.style.display = 'none'; }, 300);
    }
  }
}

function THREE_MathUtils_clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}
