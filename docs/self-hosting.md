# Running Boligmaskinen yourself

Boligmaskinen is one container image with a PostGIS database beside it. It builds its own data
from open sources, so a new install needs no data to be copied in. This guide takes you from an
empty folder to the map, and through updates and backups.

## What it needs

| | |
|---|---|
| Software | Docker with Compose (Docker Engine 24 or newer, or Docker Desktop) |
| Machine | 64-bit Intel/AMD (amd64) or ARM (arm64, such as a Raspberry Pi 5 with a 64-bit OS); Docker picks the image for the machine |
| Memory | About 1 GB while the data is built (each night, for a few minutes); about 300 MB the rest of the time |
| Disk | About 3 GB in `./data`: the raw downloads, the builds and the data packs. Reading the OpenStreetMap extract takes 1 GB more for a few minutes |
| Network | About 1 GB of downloads the first time (OpenStreetMap is 500 MB of it), then a few hundred MB a night |
| Time | About ten minutes for the first build of all of Denmark |

The image is private for now: you need read access to `ghcr.io/slimcdk/boligmaskinen`
(`docker login ghcr.io`).

## Install

1. **Get the Compose file** into an empty folder: `compose.yaml` from the repository.

2. **Settings** go in an `.env` file next to it:

   ```sh
   echo "POSTGRES_PASSWORD=$(openssl rand -hex 16)" > .env
   ```

   Optional lines in `.env`:

   | Setting | Default | What it does |
   |---|---|---|
   | `REGION` | `denmark` | The area the data covers: `denmark`, `oestjylland`, `aarhus`, or municipality codes such as `751,706` |
   | `GRID_CELL_METRES` | `100` | The size of the grid's cells, from 10 to 1000 m |
   | `BOLIGMASKINEN_PORT` | `8080` | The port on this machine |
   | `BOLIGMASKINEN_TAG` | `master` | The image: `master` is the newest build that passed the tests; a release has its version, such as `v0.1.0` |
   | `BOLIGMASKINEN_UID`, `BOLIGMASKINEN_GID` | `1000` | The user the app runs as, which has to own `./data` |

3. **The data folder** must belong to the user the app runs as. On Linux, create it yourself, and
   put your own ids in `.env` if they are not 1000 (`id -u`, `id -g`):

   ```sh
   mkdir data
   echo "BOLIGMASKINEN_UID=$(id -u)" >> .env
   echo "BOLIGMASKINEN_GID=$(id -g)" >> .env
   ```

   A folder that Docker creates by itself belongs to root, and the data jobs then fail with
   "permission denied"; the app says so in its log at start.

4. **Start it:**

   ```sh
   docker compose up -d
   ```

   Open `http://localhost:8080`. The map is empty at first: the app sees that it has no data, and
   its jobs fetch every source and build the data pack. The data jobs (the gear at the bottom of the
   panel) show how far they are. When "Pack the data" is done, reload the page.

## Running it for others

- **TLS.** The app speaks plain HTTP. Put a reverse proxy in front of it (Caddy, Traefik, nginx)
  for HTTPS, and give it HSTS there. The app sends its other security headers itself.
- **Logins.** The app has no users or logins yet; everyone who can reach it sees and changes the
  same maps. On the internet, put it behind the proxy's authentication.
- **The ODbL.** An instance others use must offer the database made from OpenStreetMap (the data
  pack's layers) or the way it is made: the source of `pipeline/` and `backend/src/pipeline/`.
  See "Licences" in `README.md`.

## Updating

```sh
docker compose pull app
docker compose up -d app
```

- The app migrates its database at start; migrations only go forward.
- **What a new version builds itself:** after an update, the next nightly build makes the data again with the new version's pipeline. A source the new version adds is fetched at once.
- **Before updating**, check that no data job is running (the gear, or
  `curl -s localhost:8080/api/jobs | grep -c '"status":"running"'`). A job that is cut off is
  marked as failed and runs again on its schedule.
- **Read the release notes** in `CHANGELOG.md` before you update. Anything an update asks you to do
  is under "Upgrade notes".
- **Going back to an older version** works for the app, but not always for the database. The
  backups are what bring an older database back.

## Backups

Every night at 01:30 the job "Back up the database" writes a dump to `./data/backups/` and keeps
the newest seven. Copy that folder somewhere else. Restoring is in `README.md` under "Backups".
The rest of `./data` is rebuilt by the jobs, so it needs no backup.

## When something goes wrong

| What you see | What to do |
|---|---|
| The jobs fail with "permission denied" | `./data` belongs to another user than the app's; see step 3 |
| A step "was killed, most likely because the memory ran out" | Give the app's container about 1 GB of memory |
| "Waiting for …" in a job | Normal: it waits for another job, which starts it when done |
| "The new data was not switched in, because …" | A source answered with far less than before. The map keeps its data; when the source is right again, the next night fixes it. If the change is real, run "Pack the data" by hand to switch anyway |
| A source fails for days | Its site may have changed. See the job's log, and `docs/data-sources.md` for the source |
| Anything else | `docker compose logs app` |
