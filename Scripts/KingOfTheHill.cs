using UnityEngine;

/// <summary>
/// Capture radius. Player alone captures; bots contest or flip. First to winScore.
/// </summary>
public class KingOfTheHill : MonoBehaviour
{
    public float captureRadius = 11f;
    public float scoreRate = 3.2f;
    public float winScore = 100f;
    public Transform playerTransform;
    public Transform[] botTransforms;

    public enum Owner { Neutral, Player, Bots, Contested }
    public Owner currentOwner = Owner.Neutral;
    public float progress = 0.5f;
    public float playerScore;
    public float botScore;

    public static KingOfTheHill Instance { get; private set; }

    void Awake() => Instance = this;

    void Update()
    {
        // match clock stops while the Spartan trains at the Shrine Range,
        // or while a Rumble Pit is running (FFA replaces the hill)
        if (RangeMaster.Instance && RangeMaster.Instance.InRange) return;
        if (RumblePit.Active) return;
        if (!playerTransform) playerTransform = ArenaDirector.Player;
        if (botTransforms == null || botTransforms.Length == 0)
            botTransforms = ArenaDirector.Bots;

        bool playerIn = playerTransform && Vector3.Distance(playerTransform.position, transform.position) < captureRadius;
        int botsIn = 0;
        if (botTransforms != null)
        {
            foreach (var b in botTransforms)
            {
                if (!b) continue;
                var hp = b.GetComponent<Health>();
                if (hp && hp.IsDead) continue;
                if (Vector3.Distance(b.position, transform.position) < captureRadius) botsIn++;
            }
        }

        float prev = progress;
        if (playerIn && botsIn == 0)
        {
            progress = Mathf.Clamp01(progress + Time.deltaTime * 0.22f);
            currentOwner = progress >= 1f ? Owner.Player : Owner.Neutral;
            if (progress >= 1f && prev < 1f) SoundManager.HillCapture();
        }
        else if (!playerIn && botsIn > 0)
        {
            progress = Mathf.Clamp01(progress - Time.deltaTime * 0.16f);
            currentOwner = progress <= 0f ? Owner.Bots : Owner.Neutral;
        }
        else if (playerIn && botsIn > 0)
            currentOwner = Owner.Contested;
        else
            currentOwner = progress >= 1f ? Owner.Player : progress <= 0f ? Owner.Bots : Owner.Neutral;

        if (playerIn && botsIn == 0)
            playerScore += scoreRate * Time.deltaTime;
        if (!playerIn && botsIn > 0)
            botScore += scoreRate * Time.deltaTime;
        if (progress >= 1f && (playerIn || currentOwner == Owner.Player)) WaifuCompanion.OnHill();

        if (playerScore >= winScore) ArenaDirector.EndMatch(true);
        else if (botScore >= winScore) ArenaDirector.EndMatch(false);
    }

    void OnDrawGizmosSelected()
    {
        Gizmos.color = Color.cyan;
        Gizmos.DrawWireSphere(transform.position, captureRadius);
    }
}
