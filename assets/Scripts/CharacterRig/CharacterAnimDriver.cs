using UnityEngine;

namespace CharacterRig
{
    [DisallowMultipleComponent]
    public class CharacterAnimDriver : MonoBehaviour
    {
        [SerializeField] private Animator animator;
        [SerializeField] private string weaponLayerName = "Weapon Aim";
        [SerializeField] private string emoteLayerName = "Emote";

        public bool isArmed = true;

        private int weaponLayerIndex = -1;
        private int emoteLayerIndex = -1;

        public Animator Animator => animator;

        private void Awake()
        {
            if (animator == null)
                animator = GetComponentInChildren<Animator>();

            if (animator != null)
            {
                animator.cullingMode = AnimatorCullingMode.AlwaysAnimate;
                weaponLayerIndex = animator.GetLayerIndex(weaponLayerName);
                emoteLayerIndex = animator.GetLayerIndex(emoteLayerName);
            }
            else
            {
                Debug.LogWarning($"{name}: no Animator found on children, CharacterAnimDriver disabled.", this);
                enabled = false;
            }
        }

        private void Update()
        {
            if (weaponLayerIndex >= 0)
                animator.SetLayerWeight(weaponLayerIndex, isArmed ? 1f : 0f);
        }

        public void SetSpeed(float metresPerSecond)
        {
            animator.SetFloat("Speed", Mathf.Max(0f, metresPerSecond));
        }

        public void SetGrounded(bool grounded)
        {
            animator.SetBool("Grounded", grounded);
        }

        public void SetCrouch(bool crouch)
        {
            animator.SetBool("Crouch", crouch);
        }

        public void SetAimPitch(float pitch)
        {
            animator.SetFloat("AimPitch", Mathf.Clamp(pitch, -1f, 1f));
        }

        public void Jump() => animator.SetTrigger("Jump");

        public void Slide() => animator.SetTrigger("Slide");

        public void Shoot() => animator.SetTrigger("Shoot");

        public void Reload() => animator.SetTrigger("Reload");

        /// Play a one-shot mocap/extra state by name (Mesh2Motion clips are named "X_...").
        public void PlayState(string stateName) => animator.Play(stateName, 0, 0f);

        public void Dance(bool on)
        {
            animator.SetBool("EmoteActive", on);
            if (emoteLayerIndex >= 0)
                animator.SetLayerWeight(emoteLayerIndex, on ? 1f : 0f);
        }

        public void Die()
        {
            isArmed = false;
            animator.SetBool("Dead", true);
        }
    }
}
