using UnityEngine;

namespace CharacterRig
{
    /// Swaps the active gun skin (recolored FBX variants from
    /// External/tools/gen_gun_skins.py) on the currently equipped gun.
    /// Skins are matched by prefab name; call Cycle()/SetSkin(index).
    [DisallowMultipleComponent]
    [RequireComponent(typeof(GunAttacher))]
    public class GunSkinSwapper : MonoBehaviour
    {
        [Tooltip("All skin variants (base FBX first). Cycled in order.")]
        [SerializeField] private GameObject[] skins;

        [Tooltip("Press this key to cycle skins (0 to disable).")]
        [SerializeField] private KeyCode cycleKey = KeyCode.G;

        private GunAttacher attacher;
        private int index = -1;

        public int Count => skins == null ? 0 : skins.Length;
        public GameObject Current => (index >= 0 && skins != null && index < skins.Length) ? skins[index] : null;

        private void Awake()
        {
            attacher = GetComponent<GunAttacher>();
        }

        private void Update()
        {
            if (cycleKey != KeyCode.None && Input.GetKeyDown(cycleKey)) Cycle();
        }

        public void SetSkins(GameObject[] variants)
        {
            skins = variants;
            index = -1;
        }

        public void Cycle()
        {
            if (skins == null || skins.Length == 0) return;
            index = (index + 1) % skins.Length;
            Apply();
        }

        public void SetSkin(int i)
        {
            if (skins == null || skins.Length == 0) return;
            index = Mathf.Clamp(i, 0, skins.Length - 1);
            Apply();
        }

        private void Apply()
        {
            if (index < 0 || Current == null) return;
            attacher.Equip(Current);   // re-equip keeps the muzzle transform consistent
        }
    }
}
