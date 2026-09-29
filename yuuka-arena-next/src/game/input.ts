// Input manager: tracks keyboard/mouse state and pointer lock.
export class InputManager {
  keys = new Set<string>()
  mouseDeltaX = 0
  mouseDeltaY = 0
  mouseDown = false
  locked = false
  private el: HTMLElement

  constructor(el: HTMLElement) {
    this.el = el

    window.addEventListener('keydown', this.onKeyDown)
    window.addEventListener('keyup', this.onKeyUp)
    window.addEventListener('mousemove', this.onMouseMove)
    window.addEventListener('mousedown', this.onMouseDown)
    window.addEventListener('mouseup', this.onMouseUp)
    document.addEventListener('pointerlockchange', this.onLockChange)
  }

  private onKeyDown = (e: KeyboardEvent) => {
    this.keys.add(e.code)
  }

  private onKeyUp = (e: KeyboardEvent) => {
    this.keys.delete(e.code)
  }

  private onMouseMove = (e: MouseEvent) => {
    if (!this.locked) return
    this.mouseDeltaX += e.movementX
    this.mouseDeltaY += e.movementY
  }

  private onMouseDown = (e: MouseEvent) => {
    if (e.button === 0) this.mouseDown = true
    if (!this.locked) this.requestLock()
  }

  private onMouseUp = (e: MouseEvent) => {
    if (e.button === 0) this.mouseDown = false
  }

  private onLockChange = () => {
    this.locked = document.pointerLockElement === this.el
  }

  requestLock = () => {
    this.el.requestPointerLock()
  }

  isDown(code: string): boolean {
    return this.keys.has(code)
  }

  // Consume accumulated mouse deltas (called once per frame).
  consumeMouse() {
    const dx = this.mouseDeltaX
    const dy = this.mouseDeltaY
    this.mouseDeltaX = 0
    this.mouseDeltaY = 0
    return { dx, dy }
  }

  dispose() {
    window.removeEventListener('keydown', this.onKeyDown)
    window.removeEventListener('keyup', this.onKeyUp)
    window.removeEventListener('mousemove', this.onMouseMove)
    window.removeEventListener('mousedown', this.onMouseDown)
    window.removeEventListener('mouseup', this.onMouseUp)
    document.removeEventListener('pointerlockchange', this.onLockChange)
  }
}