using System;
using System.Collections;
using System.Collections.Generic;
using CharacterRig;
using UnityEngine;
using UnityEngine.SceneManagement;

namespace Laststand
{
    public class Health : MonoBehaviour
    {
        public float maxHp = 100f;
        public float hp = 100f;
        public event Action<float> OnDamaged;
        public event Action OnDeath;
        public bool IsDead => hp <= 0f;

        private void Awake() { hp = maxHp; }

        public void TakeDamage(float amount)
        {
            if (IsDead) return;
            hp = Mathf.Max(0f, hp - amount);
            OnDamaged?.Invoke(amount);
            if (hp <= 0f) OnDeath?.Invoke();
        }
    }

    /// Simple chase-and-attack NPC. Humanoid enemies use shared X_ mocap attack
    /// states when available; everything else just lunges.
    [RequireComponent(typeof(Health))]
    public class EnemyAgent : MonoBehaviour
    {
        [SerializeField] private float moveSpeed = 2.4f;
        [SerializeField] private float attackRange = 1.7f;
        [SerializeField] private float attackInterval = 2.2f;
        [SerializeField] private float attackDamage = 10f;
        [SerializeField] private string[] attackStates =
        {
            "X_sofia_Punch", "X_sofia_Kick", "X_sofia_Angry", "X_sofia_Taunt",
            "X_swat_Punch", "X_swat_Attack"
        };

        private CharacterAnimDriver driver;
        private Animator animator;
        private CharacterController cc;
        private Health health;
        private Transform player;
        private LaststandGame game;
        private float attackTimer;
        private string chosenAttack;
        private bool dead;

        private void Awake()
        {
            health = GetComponent<Health>();
            driver = GetComponent<CharacterAnimDriver>();
            animator = GetComponentInChildren<Animator>();
            cc = GetComponent<CharacterController>();
        }

        private void Start()
        {
            player = GameObject.FindGameObjectWithTag("Player")?.transform;
            game = FindObjectOfType<LaststandGame>();
            health.OnDeath += Die;
            float a = UnityEngine.Random.Range(0.5f, 2f);
            attackTimer = a;
            if (animator != null)
                foreach (var s in attackStates)
                    if (animator.HasState(0, Animator.StringToHash(s)))
                    {
                        chosenAttack = s;
                        break;
                    }
        }

        private void Update()
        {
            if (dead || player == null) return;
            Vector3 to = player.position - transform.position;
            to.y = 0f;
            float dist = to.magnitude;

            attackTimer -= Time.deltaTime;
            if (dist <= attackRange)
            {
                if (driver != null) driver.SetSpeed(0f);
                if (attackTimer <= 0f)
                {
                    attackTimer = attackInterval;
                    if (chosenAttack != null && animator != null)
                        animator.Play(chosenAttack, 0, 0f);
                    var ph = player.GetComponentInParent<Health>();
                    ph?.TakeDamage(attackDamage);
                }
            }
            else
            {
                Vector3 dir = to.normalized;
                if (cc != null)
                {
                    Vector3 vel = dir * moveSpeed;
                    vel.y = -9.81f;
                    cc.Move(vel * Time.deltaTime);
                }
                else
                    transform.position += dir * (moveSpeed * Time.deltaTime);
                transform.rotation = Quaternion.Slerp(transform.rotation,
                    Quaternion.LookRotation(dir), 8f * Time.deltaTime);
                if (driver != null) driver.SetSpeed(moveSpeed);
            }
        }

        private void Die()
        {
            dead = true;
            if (cc != null) cc.enabled = false;
            if (driver != null) driver.Die();
            game?.NotifyEnemyDeath();
            Destroy(gameObject, 6f);
        }
    }

    /// Fires projectiles from the equipped gun's muzzle on left click.
    public class PlayerShooter : MonoBehaviour
    {
        [SerializeField] private float fireCooldown = 0.16f;
        [SerializeField] private float damage = 34f;

        private GunAttacher attacher;
        private CharacterAnimDriver driver;
        private float cooldown;

        private void Awake()
        {
            attacher = GetComponentInParent<GunAttacher>();
            driver = GetComponentInParent<CharacterAnimDriver>();
        }

        private void Update()
        {
            cooldown -= Time.deltaTime;
            if (Input.GetMouseButton(0) && cooldown <= 0f && attacher != null && attacher.Muzzle != null)
            {
                cooldown = fireCooldown;
                var bullet = Bullet.Spawn(attacher.Muzzle.position, attacher.Muzzle.forward, damage);
                bullet.transform.localScale = Vector3.one * 0.12f;
                MuzzleFlash.Spawn(attacher.Muzzle);
            }
        }
    }

    public class Bullet : MonoBehaviour
    {
        [SerializeField] private float speed = 55f;
        [SerializeField] private float damage = 34f;
        private float life = 2.5f;
        private static Material mat;

        public static Bullet Spawn(Vector3 pos, Vector3 dir, float damage)
        {
            var go = GameObject.CreatePrimitive(PrimitiveType.Sphere);
            go.name = "Bullet";
            go.transform.position = pos + dir * 0.1f;
            go.transform.localScale = Vector3.one * 0.1f;
            var col = go.GetComponent<Collider>();
            col.isTrigger = true;
            go.AddComponent<Rigidbody>().isKinematic = true;
            var b = go.AddComponent<Bullet>();
            b.damage = damage;
            go.transform.forward = dir;
            if (mat == null)
            {
                mat = new Material(Shader.Find("Standard"))
                {
                    color = new Color(1f, 0.9f, 0.3f),
                    enableInstancing = true
                };
                mat.SetColor("_EmissionColor", new Color(1f, 0.8f, 0.2f));
                mat.globalIlluminationFlags = MaterialGlobalIlluminationFlags.BakedEmissive;
                mat.EnableKeyword("_EMISSION");
            }
            go.GetComponent<Renderer>().sharedMaterial = mat;
            return b;
        }

        private void Update()
        {
            transform.Translate(Vector3.forward * (speed * Time.deltaTime), Space.World);
            life -= Time.deltaTime;
            if (life <= 0f) Destroy(gameObject);
        }

        private void OnTriggerEnter(Collider other)
        {
            var h = other.GetComponentInParent<Health>();
            if (h != null && !h.IsDead)
            {
                h.TakeDamage(damage);
                Destroy(gameObject);
            }
        }
    }

    /// Waves of spawned enemies, HUD, death/restart. Lives on an empty GO.
    public class LaststandGame : MonoBehaviour
    {
        [SerializeField] private GameObject[] enemyPrefabs;
        [SerializeField] private Transform player;
        [SerializeField] private int baseWaveSize = 4;
        [SerializeField] private float spawnRadius = 32f;
        [SerializeField] private float spawnInterval = 0.9f;
        [SerializeField] private float waveBreak = 4f;

        private Health playerHealth;
        private int wave;
        private int toSpawn, alive;
        private bool gameOver;
        private GUIStyle hudStyle, bigStyle;

        public void Configure(GameObject[] prefabs, Transform playerTf)
        {
            enemyPrefabs = prefabs;
            player = playerTf;
        }

        public void NotifyEnemyDeath()
        {
            alive--;
            if (wave > 0 && toSpawn == 0 && alive <= 0)
                StartCoroutine(NextWave(waveBreak));
        }

        private void Start()
        {
            playerHealth = player.GetComponentInParent<Health>();
            if (playerHealth == null) playerHealth = player.gameObject.AddComponent<Health>();
            playerHealth.maxHp = 100f;
            playerHealth.hp = 100f;
            playerHealth.OnDeath += () => gameOver = true;
            StartCoroutine(NextWave(1.5f));
        }

        private IEnumerator NextWave(float delay)
        {
            yield return new WaitForSeconds(delay);
            if (gameOver) yield break;
            wave++;
            toSpawn = baseWaveSize + (wave - 1) * 2;
            alive = 0;
            while (toSpawn > 0)
            {
                SpawnOne();
                toSpawn--;
                yield return new WaitForSeconds(spawnInterval);
            }
        }

        private void SpawnOne()
        {
            if (enemyPrefabs == null || enemyPrefabs.Length == 0) return;
            var prefab = enemyPrefabs[UnityEngine.Random.Range(0, enemyPrefabs.Length)];
            float a = UnityEngine.Random.Range(0f, Mathf.PI * 2f);
            Vector3 pos = player.position + new Vector3(Mathf.Cos(a), 0f, Mathf.Sin(a)) * spawnRadius;
            var go = Instantiate(prefab, pos, Quaternion.identity);
            if (go.GetComponent<Health>() == null)
                go.AddComponent<Health>().maxHp = 100f;
            if (go.GetComponent<EnemyAgent>() == null)
                go.AddComponent<EnemyAgent>();
            go.tag = "Enemy";
            var eHealth = go.GetComponent<Health>();
            eHealth.hp = eHealth.maxHp;
            alive++;
        }

        private void OnGUI()
        {
            if (hudStyle == null)
            {
                hudStyle = new GUIStyle(GUI.skin.label)
                { fontSize = 22, fontStyle = FontStyle.Bold };
                hudStyle.normal.textColor = Color.white;
                bigStyle = new GUIStyle(hudStyle) { fontSize = 46, alignment = TextAnchor.MiddleCenter };
            }
            GUI.Label(new Rect(16, 12, 400, 30), $"WAVE {wave}", hudStyle);
            GUI.Label(new Rect(16, 40, 400, 30),
                $"Enemies: {Mathf.Max(0, alive + toSpawn)}", hudStyle);
            if (playerHealth != null)
                GUI.Label(new Rect(16, 68, 400, 30),
                    $"HP {playerHealth.hp:0}", hudStyle);
            if (gameOver)
            {
                GUI.Label(new Rect(0, Screen.height * 0.4f, Screen.width, 60),
                    "YOU DIED  -  press R to retry", bigStyle);
                GUI.Label(new Rect(0, Screen.height * 0.4f + 60, Screen.width, 40),
                    $"reached wave {wave}", hudStyle);
                if (Input.GetKeyDown(KeyCode.R))
                {
                    Time.timeScale = 1f;
                    SceneManager.LoadScene(SceneManager.GetActiveScene().name);
                }
            }
        }
    }
}
