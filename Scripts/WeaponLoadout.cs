using UnityEngine;

/// <summary>
/// Holds the full 10-gun roster and switches on 1-0, Q/E, LB/RB.
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
            Weapon.Make(Weapon.Kind.Pistol, cameraTransform),
            Weapon.Make(Weapon.Kind.Rifle, cameraTransform),
            Weapon.Make(Weapon.Kind.Carbine, cameraTransform),
            Weapon.Make(Weapon.Kind.SMG, cameraTransform),
            Weapon.Make(Weapon.Kind.Shotgun, cameraTransform),
            Weapon.Make(Weapon.Kind.HandCannon, cameraTransform),
            Weapon.Make(Weapon.Kind.Sniper, cameraTransform),
            Weapon.Make(Weapon.Kind.Bow, cameraTransform),
            Weapon.Make(Weapon.Kind.Launcher, cameraTransform),
            Weapon.Make(Weapon.Kind.Swarm, cameraTransform),
        };
        Select(1);
    }

    void Update()
    {
        if (weapons == null || weapons.Length == 0) return;
        if (OptionsMenu.IsOpen) return;
        if (GameInput.WeaponSlotPressed > 0) Select(GameInput.WeaponSlotPressed - 1);   // 1..0
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

    /// <summary>Map pickup: hand the player a FULL-AMMO power weapon and wield it.</summary>
    public void GrantPowerWeapon(Weapon.Kind kind)
    {
        if (weapons == null || weapons.Length == 0) return;
        for (int i = 0; i < weapons.Length; i++)
        {
            if (weapons[i] && weapons[i].kind == kind)
            {
                weapons[i].currentAmmo = weapons[i].magSize;      // fresh drop
                weapons[i].reserveAmmo = Mathf.Max(weapons[i].reserveAmmo, weapons[i].magSize * 2);
                Select(i);
                return;
            }
        }
        // roster doesn't own it — shouldn't happen with the full 10, but stay safe
        var w = Weapon.Make(kind, Camera.main ? Camera.main.transform : transform);
        if (!w) return;
        var grown = new Weapon[weapons.Length + 1];
        weapons.CopyTo(grown, 0);
        grown[weapons.Length] = w;
        weapons = grown;
        Select(weapons.Length - 1);
    }
}
