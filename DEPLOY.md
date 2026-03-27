# Docker Deploy

## 1. Push code and let GitHub build images

The workflow is:

- `.github/workflows/docker-image.yml`

It publishes:

- `ghcr.io/zaiwuli/article_add:latest`
- `ghcr.io/zaiwuli/article_add-web:latest`

## 2. Prepare the server

Copy `.env.example` to `.env` and adjust values if needed:

```bash
cp .env.example .env
```

If you want to keep the built-in PostgreSQL service, the default values are already usable.

## 3. Login to GHCR

```bash
echo <YOUR_GITHUB_PAT> | docker login ghcr.io -u <YOUR_GITHUB_USERNAME> --password-stdin
```

`read:packages` is enough for pulling private images.

## 4. Start the stack

```bash
docker compose pull
docker compose up -d
```

## 5. Access

- Frontend: `http://<server-ip>:<FRONTEND_PORT>`
- Backend docs: `http://<server-ip>:<BACKEND_PORT>/docs`

## Notes

- The backend auto-creates the required schema and tables on startup.
- Runtime files are stored in the `article_add_data` Docker volume mounted to `/data`.
- PostgreSQL data is stored in the `article_add_postgres` Docker volume.
