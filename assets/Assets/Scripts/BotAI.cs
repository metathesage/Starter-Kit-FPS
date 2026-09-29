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
    float lastShot;
    float strafeTimer;
    int strafeDir = 1;
    float firstSeen = -999f;
    float repathAt;
    Renderer[] rends;
    Color teamColor;

    IEnumerator Start()
    {
        hp = GetComponent<Health>();
        hp.OnDeath += OnDead;
        rends = GetComponentsInChildren<Renderer>();
        teamColor = new Color(Random.Range(0.7f, 1f), Random.Range(0.1f, 0.35f), Random.Range(0.2f, 0.45f));
        foreach (var r in rends) if (r && r.material) r.material.color = teamColor;
        yield return null;
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

    bool CanSeePlayer()
    {
        if (!player) return false;
        Vector3 eye = transform.position + Vector3.up * 1.55f;
        Vector3 tgt = player.position + Vector3.up * 1.55f;
        Vector3 dir = tgt - eye;
        if (Physics.Raycast(eye, dir.normalized, out RaycastHit hit, dir.magnitude + 0.1f, ~0, QueryTriggerInteraction.Ignore))
            return hit.transform.root.CompareTag("Player");
        return true;
    }

    void Fire()
    {
        lastShot = Time.time;
        Vector3 muzzle = transform.position + Vector3.up * 1.4f + transform.forward * 0.4f;
        var body = GetComponent<BotBody>();
        if (body)
        {
            muzzle = body.MuzzlePosition;
            body.PlayShoot();
        }
        SoundManager.EnemyShot(muzzle, (int)(body ? body.archetype : BotBody.Archetype.Grunt));
        Vector3 dir = ((player.position + Vector3.up * 1.35f) - muzzle).normalized;
        dir = Quaternion.Euler(Random.Range(-2.2f, 2.2f), Random.Range(-2.2f, 2.2f), 0f) * dir;
        if (Physics.Raycast(muzzle, dir, out RaycastHit hit, 80f, ~0, QueryTriggerInteraction.Ignore))
        {
            var h = hit.collider.GetComponentInParent<Health>();
            if (h && h.isPlayer) h.TakeDamage(bulletDamage, hit.point);
            else if (hit.collider) SoundManager.Impact(hit.point);
        }
        else SoundManager.Whizz(player.position);
        OnFired?.Invoke();
    }

    void OnDead(Health _)
    {
        if (agent) agent.isStopped = true;
        var body = GetComponent<BotBody>();
        if (body) body.PlayDeath();
        else foreach (var r in rends) if (r) r.material.color = Color.gray;
        SoundManager.BotDeath(transform.position);
        ArenaDirector.ScheduleBotRespawn(this);
    }

    public void RespawnAt(Vector3 p)
    {
        if (agent) { agent.Warp(p); agent.isStopped = false; }
        else transform.position = p;
        hp.Revive(p);
        state = State.Patrol;
        var body = GetComponent<BotBody>();
        if (body) body.ResetBody();
        else foreach (var r in rends) if (r) r.material.color = teamColor;
        PickPatrol();
    }

    public void SetPlayer(Transform p) => player = p;
    public event System.Action OnFired;
}
