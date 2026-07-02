# SEOULMATE KVM1 Deploy Notes

Target host checked: `srv1771159.hstgr.cloud`

## Current Port Usage

Do not reuse these host ports on the KVM1 server:

| Project | Host port | Scope | Target |
| --- | ---: | --- | --- |
| Nginx | 80 | public | HTTP |
| Nginx | 443 | public | HTTPS |
| ONEFLOW web | 3000 | `127.0.0.1` | Next.js |
| ONEFLOW API | 3001 | `127.0.0.1` | API gateway |
| THEFOX web | 3120 | `127.0.0.1` | web container |
| THEFOX API | 4120 | `127.0.0.1` | API container |
| ONEFLOW Postgres | 5432 | `127.0.0.1` | Postgres container |
| ONEFLOW Redis | 6379 | `127.0.0.1` | Redis container |

THEFOX Postgres and Redis are internal to the `thefox-app` Docker network in
the active KVM shared compose file. They do not publish host ports.

## SEOULMATE Port Plan

Use `127.0.0.1:3220` for SEOULMATE. The app container listens on `8080`
internally, while Postgres and Redis stay private inside the `seoulmate` Docker
network.

## Files

- `compose.kvm1.yaml`: KVM shared Docker Compose file.
- `.env.kvm1.example`: production environment template for the KVM1 host.

## Deploy Commands

```bash
cp .env.kvm1.example .env
docker compose -f compose.kvm1.yaml up -d --build
docker compose -f compose.kvm1.yaml ps
curl http://127.0.0.1:3220/health/ready
```

## Nginx Proxy

Create a separate site for the SEOULMATE domain or subdomain:

```nginx
server {
    server_name seoulmate.example.com;

    client_max_body_size 25m;

    location / {
        proxy_pass http://127.0.0.1:3220;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 120s;
    }
}
```

Run Certbot for the real domain after DNS points to this VPS.
