using UnityEngine;
using UnityEngine.AI;
using System.Collections;

/// <summary>
/// Patrol → chase (LOS) → strafe+shoot → retreat. Hitscan fallback so bots always hurt.
/// </summary>
[RequireComponent(typeof(Health))]
public class BotAI : MonoBehaviour
{
    public enum State { Patrol, Chase, Shoot, Retreat }
    public State state = State.Patrol;

    public float sightRange = 48f;
    public float shootRange = 30f;
    public float reactionTime = 0.28f;
    public float shootInterval = 0.38f;
    public float retreatHealth = 28f;
    public int bulletDamage = 11;
    public Transform player;

    NavMeshAgent agent;
    Health hp;
    WaifuBotBody wbody;
    float lastShot;
    float strafeTimer;
    int strafeDir = 1;
    float firstSeen = -999f;
    float repathAt;

    [Header("Grenades")]
    public int grenades = 2;
    public float nadeReadyAt;
    public float nadeCooldown = 7f;

    IEnumerator Start()
    {
        hp = GetComponent<Health>();
        hp.OnDeath += OnDead;
        yield return null;   // WaifuBotBody builds its GLB first, so we don't tint her materials
        wbody = GetComponent<WaifuBotBody>();
        if (!GetComponent<NavMeshAgent>()) agent = gameObject.AddComponent<NavMeshAgent>();
        else agent = GetComponent<NavMeshAgent>();
        agent.speed = 5.4f;
        agent.angularSpeed = 720f;
        agent.acceleration = 18f;
        agent.stoppingDistance = 0.4f;
        agent.obstacleAvoidanceType = ObstacleAvoidanceType.MedQualityObstacleAvoidance;
        PickPatrol();
    }

    void Update()
    {
        // the squad holds position while the Spartan trains at the Shrine Range
        if (RangeMaster.BotsFrozen) { if (agent && agent.isOnNavMesh && !agent.isStopped) agent.isStopped = true; return; }
        if (!player) player = ArenaDirector.Player;
        if (!hp || hp.IsDead || !agent || !agent.isOnNavMesh) return;
        if (!player) return;
        if (wbody) wbody.aimTarget = player;   // eye-traces track whoever she's hunting

        // RUMBLE PIT: re-roll who we hunt every couple of seconds
        if (RumblePit.Active && Time.time > retargetAt)
        {
            retargetAt = Time.time + 2f + Random.value * 2f;
            var pick = RumblePit.PickTargetFor(this, ArenaDirector.Player);
            if (pick && pick != transform) player = pick;
        }

        float dist = Vector3.Distance(transform.position, player.position);
        bool see = CanSeePlayer();
        if (hp.health < retreatHealth) state = State.Retreat;

        switch (state)
        {
            case State.Patrol:
                if (see && dist < sightRange) { firstSeen = Time.time; state = State.Chase; }
                else if (Time.time > repathAt) PickPatrol();
                break;
            case State.Chase:
                if (!see || dist > sightRange * 1.45f) state = State.Patrol;
                else if (dist < shootRange) { state = State.Shoot; strafeDir = Random.value > 0.5f ? 1 : -1; SoundManager.BotAlert(transform.position); }
                else if (Time.time > repathAt) { agent.SetDestination(player.position); repathAt = Time.time + 0.25f; }
                break;
            case State.Shoot:
                if (!see || dist > shootRange * 1.35f) state = State.Chase;
                else
                {
                    Strafe();
                    Vector3 to = player.position - transform.position; to.y = 0f;
                    if (to.sqrMagnitude > 0.01f) transform.rotation = Quaternion.Slerp(transform.rotation, Quaternion.LookRotation(to), 8f * Time.deltaTime);
                    if (Time.time > lastShot + shootInterval && Time.time > firstSeen + reactionTime)
                        Fire();
                    MaybeThrowGrenade(dist);
                }
                break;
            case State.Retreat:
                if (hp.health >= retreatHealth + 12f && dist > 28f) state = State.Patrol;
                else if (Time.time > repathAt)
                {
                    Vector3 away = (transform.position - player.position).normalized * 14f + transform.position;
                    if (NavMesh.SamplePosition(away, out NavMeshHit hit, 14f, NavMesh.AllAreas))
                        agent.SetDestination(hit.position);
                    repathAt = Time.time + 0.4f;
                }
                break;
        }
    }

    /// <summary>The waifus fight back with frags: mid-range, when the target is cornered
    /// or bunched with allies, with a random gate so squads don't nade in unison.</summary>
    void MaybeThrowGrenade(float dist)
    {
        if (grenades <= 0 || Time.time < nadeReadyAt) return;
        if (dist < 7f || dist > 21f) return;
        if (Random.value > 0.55f) return;

        Vector3 tgt = player.position - Vector3.up * 0.4f + player.forward * 1.5f;   // lead the runner
        // don't cook a teammate (FFA: everyone is fair game)
        if (!RumblePit.Active)
        {
            foreach (var c in Physics.OverlapSphere(tgt, 4.5f, ~0, QueryTriggerInteraction.Ignore))
            {
                var f = c.GetComponentInParent<Health>();
                if (f && f != hp && f != player.GetComponent<Health>()) return;
            }
        }

        grenades--;
        nadeReadyAt = Time.time + nadeCooldown + Random.value * 3f;
        Vector3 muzzle = wbody ? wbody.MuzzlePosition : transform.position + Vector3.up * 1.5f;
        Grenade.Throw(muzzle, (tgt - muzzle).normalized, hp);
        if (wbody) wbody.PlayShoot();
    }

    void PickPatrol()
    {
        repathAt = Time.time + 1.5f;
        Vector3 hill = ArenaDirector.HillPos;
        Vector3 rnd = hill + new Vector3((Random.value - 0.5f) * 50f, 0f, (Random.value - 0.5f) * 50f);
        if (NavMesh.SamplePosition(rnd, out NavMeshHit hit, 24f, NavMesh.AllAreas) && agent && agent.isOnNavMesh)
            agent.SetDestination(hit.position);
    }

    void Strafe()
    {
        strafeTimer += Time.deltaTime;
        if (strafeTimer > 1.1f + Random.value)
        {
            strafeDir *= -1;
            strafeTimer = 0f;
        }
        Vector3 side = Vector3.Cross(Vector3.up, (player.position - transform.position).normalized) * strafeDir;
        Vector3 to = transform.position + side * 3.2f;
        if (Time.time > repathAt && NavMesh.SamplePosition(to, out NavMeshHit hit, 6f, NavMesh.AllAreas))
        {
            agent.SetDestination(hit.position);
            repathAt = Time.time + 0.2f;
        }
    }

    float retargetAt;

    bool CanSeePlayer()
    {
        if (!player) return false;
        Vector3 eye = transform.position + Vector3.up * 1.55f;
        Vector3 tgt = player.position + Vector3.up * 1.55f;
        Vector3 dir = tgt - eye;
        if (Physics.Raycast(eye, dir.normalized, out RaycastHit hit, dir.magnitude + 0.1f, ~0, QueryTriggerInteraction.Ignore))
            return hit.transform.root == player.root;   // LOS vs whoever we're hunting
        return true;
    }

    void Fire()
    {
        lastShot = Time.time;
        var wbody = GetComponent<WaifuBotBody>();
        Vector3 muzzle = wbody ? wbody.MuzzlePosition
            : transform.position + Vector3.up * 1.4f + transform.forward * 0.4f;
        if (wbody) wbody.PlayShoot();
        SoundManager.EnemyShot(muzzle, wbody ? wbody.Voice : 0);
        Vector3 dir = ((player.position + Vector3.up * 1.35f) - muzzle).normalized;
        dir = Quaternion.Euler(Random.Range(-2.2f, 2.2f), Random.Range(-2.2f, 2.2f), 0f) * dir;
        if (Physics.Raycast(muzzle, dir, out RaycastHit hit, 80f, ~0, QueryTriggerInteraction.Ignore))
        {
            var h = hit.collider.GetComponentInParent<Health>();
            if (h && !h.IsDead)
            {
                // RUMBLE PIT: everyone is a valid target — waifus gun down waifus too
                if (RumblePit.Active || h.isPlayer)
                    h.TakeDamage(bulletDamage, hit.point, GetComponent<Health>());
            }
            else if (hit.collider) SoundManager.Impact(hit.point);
        }
        else SoundManager.Whizz(player.position);
        OnFired?.Invoke();
    }

    void OnDead(Health _)
    {
        if (agent) agent.isStopped = true;
        var wbody = GetComponent<WaifuBotBody>();
        if (wbody) wbody.PlayDeath();
        SoundManager.BotDeath(transform.position);
        ArenaDirector.ScheduleBotRespawn(this);
    }

    public void RespawnAt(Vector3 p)
    {
        if (agent) { agent.Warp(p); agent.isStopped = false; }
        else transform.position = p;
        hp.Revive(p);
        state = State.Patrol;
        grenades = 2;
        nadeReadyAt = 0f;
        var wbody = GetComponent<WaifuBotBody>();
        if (wbody) wbody.ResetBody();
        PickPatrol();
    }

    public void SetPlayer(Transform p) => player = p;
    public event System.Action OnFired;
}
