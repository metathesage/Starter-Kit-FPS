using UnityEngine;

namespace CharacterRig
{
    /// Rides alongside WeaponSocket: instantiates a gun prefab into the hand and
    /// optionally exposes a muzzle Transform for VFX/muzzle-flash parenting.
    [DisallowMultipleComponent]
    [RequireComponent(typeof(WeaponSocket))]
    public class GunAttacher : MonoBehaviour
    {
        [Tooltip("Gun FBX/prefab asset (rigged meshes from Assets/Weapons).")]
        [SerializeField] private GameObject gunPrefab;

        [Tooltip("Local muzzle point inside the gun (leave null to auto-use the gun bounds center-front).")]
        [SerializeField] private Vector3 muzzleLocal = new Vector3(0f, 0f, 0.2f);

        private GameObject instance;
        private Transform muzzle;
        private WeaponSocket socket;

        public Transform Muzzle => muzzle;
        public GameObject Gun => instance;

        private void Awake()
        {
            socket = GetComponent<WeaponSocket>();
        }

        private void Start()
        {
            if (gunPrefab != null) Equip(gunPrefab);
        }

        public void Equip(GameObject prefab)
        {
            Unequip();
            if (prefab == null) return;
            instance = Instantiate(prefab, transform);
            instance.name = prefab.name;
            socket.Attach(instance.transform);
            muzzle = new GameObject("Muzzle", typeof(Transform)).transform;
            muzzle.SetParent(instance.transform, false);
            muzzle.localPosition = muzzleLocal;
            // WeaponSocket.LateUpdate parents+positions the gun on the hand bone.
        }

        public void Unequip()
        {
            if (instance != null) Destroy(instance);
            if (muzzle != null) Destroy(muzzle.gameObject);
            instance = null;
            muzzle = null;
        }
    }
}
