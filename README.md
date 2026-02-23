# Smoke Monitor

Application de monitoring simple pour visualiser les résultats de smoke tests.

## Structure

```
monitoring-app/
├── backend/          # FastAPI
├── frontend/         # React + Vite
├── sample-data/      # Exemples JSON à uploader sur COS
└── nginx.conf        # Config Nginx pour la prod
```

## Backend

```bash
cd backend
cp .env.example .env   # Remplir les variables COS
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

Variables d'environnement requises dans `.env` :
- `COS_ENDPOINT_URL` — ex: https://s3.eu-de.cloud-object-storage.appdomain.cloud
- `COS_ACCESS_KEY_ID`
- `COS_SECRET_ACCESS_KEY`
- `COS_REGION` — ex: eu-de
- `COS_BUCKET_NAME`

## Frontend

```bash
cd frontend
npm install
npm run dev        # Dev avec proxy → localhost:8000
npm run build      # Build prod dans dist/
```

## Nginx (production)

Copier le build React dans `/usr/share/nginx/html` puis utiliser `nginx.conf`.

```bash
cp -r frontend/dist/* /usr/share/nginx/html/
nginx -c /path/to/nginx.conf
```

## Données COS

Uploader les fichiers JSON dans le bucket avec les clés :
- `airflow/status.json`
- `spark/status.json`

Des exemples sont disponibles dans `sample-data/`.
