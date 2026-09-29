# Dead Girl Walking

A browser survival FPS set across a procedural downtown. Scavenge side streets, rebuild boarded storefronts, collect drops, and survive waves of rigged skeletons as Kasumi.

## Run locally

From this folder, run `npm start` and open <http://localhost:8093>. The game includes its own Three.js runtime, models, weapons, and audio. It does not depend on or write to the neighboring Horde project.

## Controls

- Keyboard and mouse: WASD move, mouse aim, left click fire, R reload, E rebuild or melee, Shift sprint, Space jump, 1/2/3 change weapons, Esc pause.
- Xbox controller: left stick move, right stick aim, RT or RB fire, X reload, B rebuild or melee, A jump, LB sprint, D-pad select weapons, Y cycle weapons, Start pause.

## Squad lobbies

Choose **Create Squad Link**, then copy the invite. Lobbies support up to four players and show connected operatives in the city. Invite links work across the internet after deploying this Node server to a public host; when running locally, the copied link uses the computer's LAN address and works for players on the same network. Lobby membership is temporary and resets when the server restarts.

The repository includes a Render Blueprint at `render.yaml` for a one-service public deployment. Connect this folder to a Git repository and deploy it; the generated public site URL can then be shared with the `?lobby=CODE` invite suffix.
