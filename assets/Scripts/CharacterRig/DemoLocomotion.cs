using UnityEngine;

namespace CharacterRig
{
    /// Demo-only controller so the animation set can be tested immediately.
    /// WASD move, Shift sprint, C crouch, Space jump, Ctrl slide,
    /// Left mouse shoot, R reload, E dance toggle, Y toggle weapon visibility.
    [RequireComponent(typeof(CharacterAnimDriver))]
    public class DemoLocomotion : MonoBehaviour
    {
        [Header("Speeds (m/s) - must match blend tree thresholds")]
        [SerializeField] private float walkSpeed = 1.5f;
        [SerializeField] private float jogSpeed = 3.2f;
        [SerializeField] private float sprintSpeed = 5.5f;
        [SerializeField] private float crouchSpeed = 1.8f;

        [SerializeField] private float turnSmooth = 12f;
        [SerializeField] private float jumpHeight = 1.2f;
        [SerializeField] private float gravity = -20f;

        private CharacterAnimDriver driver;
        private GunAttacher attacher;
        private CharacterController cc;
        private Transform cameraTf;
        private Vector3 velocity;
        private float slideCooldown;

        private void Awake()
        {
            driver = GetComponent<CharacterAnimDriver>();
            attacher = GetComponentInParent<GunAttacher>();
            cc = GetComponentInParent<CharacterController>();
            if (cc == null)
            {
                cc = gameObject.AddComponent<CharacterController>();
                cc.center = new Vector3(0, 1f, 0);
                cc.height = 1.8f;
                cc.radius = 0.3f;
            }
            if (Camera.main != null) cameraTf = Camera.main.transform;
        }

        private void Update()
        {
            if (Input.GetKeyDown(KeyCode.E)) driver.Dance(!driver.Animator.GetBool("EmoteActive"));
            if (Input.GetKeyDown(KeyCode.Y)) driver.isArmed = !driver.isArmed;
            if (Input.GetMouseButtonDown(0))
            {
                driver.Shoot();
                if (attacher != null) MuzzleFlash.Spawn(attacher.Muzzle);
            }
            if (Input.GetKeyDown(KeyCode.R)) driver.Reload();

            if (driver.Animator.GetBool("EmoteActive"))
            {
                driver.SetSpeed(0f);
                return;
            }

            Vector2 input = new Vector2(Input.GetAxisRaw("Horizontal"), Input.GetAxisRaw("Vertical"));
            Vector3 dir = new Vector3(input.x, 0f, input.y);

            bool crouch = Input.GetKey(KeyCode.C);
            bool sprint = Input.GetKey(KeyCode.LeftShift) || Input.GetKey(KeyCode.RightShift);

            Vector3 wish = Vector3.zero;
            float targetSpeed = 0f;
            if (dir.sqrMagnitude > 0.01f)
            {
                wish = dir.normalized;
                if (cameraTf != null)
                {
                    Vector3 fwd = cameraTf.forward; fwd.y = 0;
                    Vector3 right = cameraTf.right; right.y = 0;
                    wish = (wish.y * fwd.normalized + wish.x * right.normalized).normalized;
                }
                targetSpeed = crouch ? crouchSpeed : (sprint ? sprintSpeed : (input.sqrMagnitude > 1.5f ? sprintSpeed : (sprint ? sprintSpeed : walkSpeed)));
                if (!crouch && !sprint && input.magnitude < 0.9f) targetSpeed = walkSpeed;
                Quaternion look = Quaternion.LookRotation(wish);
                transform.rotation = Quaternion.Slerp(transform.rotation, look, turnSmooth * Time.deltaTime);
            }

            bool grounded = cc.isGrounded;
            velocity.y = grounded && velocity.y < 0f ? -2f : velocity.y + gravity * Time.deltaTime;

            if (grounded && Input.GetKeyDown(KeyCode.Space))
            {
                velocity.y = Mathf.Sqrt(jumpHeight * -2f * gravity);
                driver.Jump();
            }

            slideCooldown -= Time.deltaTime;
            if (grounded && Input.GetKeyDown(KeyCode.LeftControl) && slideCooldown <= 0f && targetSpeed > 0f)
            {
                driver.Slide();
                slideCooldown = 1.2f;
                velocity += wish * 4f;
            }

            cc.Move((wish * targetSpeed + velocity) * Time.deltaTime);

            float actualPlanarSpeed = new Vector3(cc.velocity.x, 0f, cc.velocity.z).magnitude;
            driver.SetSpeed(actualPlanarSpeed);
            driver.SetGrounded(grounded);
            driver.SetCrouch(crouch);

            if (cameraTf != null && Input.GetMouseButton(1))
            {
                float pitch = cameraTf.eulerAngles.x - Input.GetAxis("Mouse Y") * 2f;
                pitch = Mathf.Clamp(pitch, -60f, 60f);
                cameraTf.rotation = Quaternion.Euler(pitch, cameraTf.eulerAngles.y, 0f);
                driver.SetAimPitch(pitch / 60f);
            }
        }
    }
}
