using UnityEngine;

namespace CharacterRig
{
    [DisallowMultipleComponent]
    [RequireComponent(typeof(CharacterAnimDriver))]
    public class WeaponSocket : MonoBehaviour
    {
        [Tooltip("Optional: a gun Transform already placed in the scene. If null, call Attach() at runtime.")]
        [SerializeField] private Transform gun;

        [SerializeField] private Vector3 positionOffset = new Vector3(0f, 0f, 0.08f);
        [SerializeField] private Vector3 rotationOffsetEuler = new Vector3(90f, 0f, 180f);
        [SerializeField] private HumanBodyBones socket = HumanBodyBones.RightHand;

        private Animator animator;
        private CharacterAnimDriver driver;
        private Transform cachedBone;

        private void Awake()
        {
            animator = GetComponentInChildren<Animator>();
            driver = GetComponent<CharacterAnimDriver>();
        }

        private void LateUpdate()
        {
            if (gun == null || animator == null) return;

            if (cachedBone == null)
            {
                cachedBone = animator.GetBoneTransform(socket);
                if (cachedBone == null)
                {
                    Debug.LogWarning($"{name}: avatar bone '{socket}' not found; weapon not attached.", this);
                    enabled = false;
                    return;
                }
            }

            if (gun.parent != cachedBone)
                gun.SetParent(cachedBone, false);

            gun.localPosition = positionOffset;
            gun.localRotation = Quaternion.Euler(rotationOffsetEuler);
            gun.gameObject.SetActive(driver != null && driver.isArmed);
        }

        public void Attach(Transform weapon, Vector3? posOffset = null, Vector3? rotOffsetEuler = null)
        {
            gun = weapon;
            if (posOffset.HasValue) positionOffset = posOffset.Value;
            if (rotOffsetEuler.HasValue) rotationOffsetEuler = rotOffsetEuler.Value;
            cachedBone = null;
            enabled = true;
        }
    }
}
