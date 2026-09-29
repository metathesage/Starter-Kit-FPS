using UnityEngine;

/// <summary>
/// Holds MA5K / M90 / SRS99 and switches on 1-2-3, Q/E, LB/RB.
/// </summary>
public class WeaponLoadout : MonoBehaviour
{
    public Weapon[] weapons;
    public int index;

    public Weapon Current => (weapons != null && index >= 0 && index < weapons.Length) ? weapons[index] : null;

    public void Build(Transform cameraTransform)
    {
        weapons = new[]
        {
            Weapon.Make(Weapon.Kind.Rifle, cameraTransform),
            Weapon.Make(Weapon.Kind.Pistol, cameraTransform),
            Weapon.Make(Weapon.Kind.Shotgun, cameraTransform),
            Weapon.Make(Weapon.Kind.SMG, cameraTransform),
            Weapon.Make(Weapon.Kind.Sniper, cameraTransform)
        };
        Select(0);
    }

    void Update()
    {
        if (weapons == null || weapons.Length == 0) return;
        if (OptionsMenu.IsOpen) return;
        if (GameInput.WeaponSlotPressed > 0) Select(GameInput.WeaponSlotPressed - 1);
        if (GameInput.WeaponNextPressed) Select(index + 1);
        if (GameInput.WeaponPrevPressed) Select(index - 1);
    }

    public void Select(int i)
    {
        if (weapons == null || weapons.Length == 0) return;
        index = (i % weapons.Length + weapons.Length) % weapons.Length;
        for (int n = 0; n < weapons.Length; n++)
            if (weapons[n]) weapons[n].gameObject.SetActive(n == index);
        WaifuCompanion.OnWeapon(Current ? Current.weaponName : "");
    }
}
