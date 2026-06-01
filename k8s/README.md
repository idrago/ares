# Deploying ARES

Manifests for deploying the ARES web UI to the k8s cluster. The image is
served by nginx and built from `dist/` (Vite output) — see the repo-root
`Dockerfile` and `nginx.conf`.

Public URL: <https://archelab.idrago.org>
Registry:   `mc1-bigdata.polito.it:5001/polismartdata/ares`

## Prerequisites (one-time setup)

1. **kubeconfig** — make sure `KUBECONFIG` points at a file that exists, or
   unset it to use `~/.kube/config`. 
   ```bash
   kubectl config current-context   # sanity check
   ```

2. **Trust the registry CA.** The registry uses an internal cert. Either trust
   it properly (preferred):
   ```bash
   sudo mkdir -p /etc/docker/certs.d/mc1-bigdata.polito.it:5001
   openssl s_client -showcerts -connect mc1-bigdata.polito.it:5001 </dev/null 2>/dev/null \
     | sudo tee /etc/docker/certs.d/mc1-bigdata.polito.it:5001/ca.crt >/dev/null
   sudo systemctl restart docker
   ```
   or add it to `/etc/docker/daemon.json` under `"insecure-registries"` and
   restart Docker.

3. **Log in to the registry.** Env vars are ignored by `docker push`; you need
   a real login (credentials are stored in `~/.docker/config.json`):
   ```bash
   docker login mc1-bigdata.polito.it:5001
   ```

## Build, push, deploy

From the repo root:

```bash
REGISTRY=mc1-bigdata.polito.it:5001
IMAGE=$REGISTRY/polismartdata/ares
TAG=$(git rev-parse --short HEAD)

# 1. Build the frontend bundle (Dockerfile copies dist/ in)
npm ci
npm run build

# 2. Build & push the image
docker build -t $IMAGE:$TAG -t $IMAGE:latest .
docker push $IMAGE:$TAG
docker push $IMAGE:latest

# 3. Apply manifests (namespace first)
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/deployment.yaml
kubectl apply -f k8s/service.yaml
kubectl apply -f k8s/ingress.yaml

# 4. Force a pull (deployment.yaml pins :latest, so re-apply alone won't roll)
kubectl -n ares rollout restart deployment/ares
kubectl -n ares rollout status   deployment/ares
```

If your laptop is arm64 and the cluster is amd64, replace step 2 with:

```bash
docker buildx build --platform linux/amd64 --push \
  -t $IMAGE:$TAG -t $IMAGE:latest .
```
