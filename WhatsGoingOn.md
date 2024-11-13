# Trashbits cloud deployment

## Frontend

Questo modulo di applicazione gestirà la creazione di nuove sessioni di gioco e l'accesso a sessioni esistenti. Useremo anche un semplice sistema di routing per gestire le richieste.

### Struttura del Progetto

Ecco come potrebbe apparire la struttura del progetto:

```
game-frontend/
├── package.json
├── server.js
└── public/
    ├── index.html
    └── style.css
```

### 1. Creazione del Progetto

Inizia creando una nuova cartella per il tuo progetto e naviga al suo interno:

```bash
mkdir game-frontend
cd game-frontend
```

Inizializza un nuovo progetto Node.js:

```bash
npm init -y
```

Installa le dipendenze necessarie:

```bash
npm install express axios
```

### 2. Creazione del Server

Crea un file chiamato `server.js` e aggiungi il seguente codice:

```javascript
const express = require('express');
const path = require('path');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware per il parsing del corpo delle richieste
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Servire i file statici
app.use(express.static(path.join(__dirname, 'public')));

// Rotta per creare una nuova sessione di gioco
app.post('/api/start-game', async (req, res) => {
    try {
        // Genera un codice di sessione unico
        const sessionCode = Math.random().toString(36).substring(2, 8);

        // Invia una richiesta al backend per avviare un nuovo container di gioco
        const response = await axios.post('http://backend-service/api/create-game', { sessionCode });

        // Restituisci l'URL del container di gioco
        res.json({ sessionCode, gameUrl: response.data.gameUrl });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Errore nella creazione della sessione di gioco' });
    }
});

// Rotta per accedere a una sessione esistente
app.post('/api/join-game', async (req, res) => {
    const { sessionCode } = req.body;

    try {
        // Verifica il codice di sessione con il backend
        const response = await axios.get(`http://backend-service/api/get-game/${sessionCode}`);

        // Restituisci l'URL del container di gioco
        res.json({ gameUrl: response.data.gameUrl });
    } catch (error) {
        console.error(error);
        res.status(404).json({ error: 'Sessione di gioco non trovata' });
    }
});

// Avvia il server
app.listen(PORT, () => {
    console.log(`Server in ascolto su http://localhost:${PORT}`);
});
```

### 3. Creazione della Pagina HTML

Crea una cartella chiamata `public` e all'interno di essa crea un file chiamato `index.html`:

```html
<!DOCTYPE html>
<html lang="it">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Gioco WebApp</title>
    <link rel="stylesheet" href="style.css">
</head>
<body>
    <h1>Benvenuto nel Gioco!</h1>
    <div>
        <h2>Inizia una nuova partita</h2>
        <button id="start-game">Inizia Gioco</button>
        <p id="new-game-message"></p>
    </div>
    <div>
        <h2>Unisciti a una partita esistente</h2>
        <input type="text" id="session-code" placeholder="Inserisci il codice di sessione">
        <button id="join-game">Unisciti</button>
        <p id="join-game-message"></p>
    </div>

    <script>
        document.getElementById('start-game').addEventListener('click', async () => {
            const response = await fetch('/api/start-game', { method: 'POST' });
            const data = await response.json();
            if (response.ok) {
                document.getElementById('new-game-message').innerText = `Partita iniziata! Codice: ${data.sessionCode}. Vai a: ${data.gameUrl}`;
            } else {
                document.getElementById('new-game-message').innerText = data.error;
            }
        });

        document.getElementById('join-game').addEventListener('click', async
```

## Backend

Questo modulo si occuperà di avviare i container di gioco utilizzando l'API di Kubernetes e di creare degli Endpoint per accedere alle sessioni di gioco esistenti utilizzando Ingress-nginx.

Ingress permette di esporre le stanze di gioco come endpoint HTTP pubblici. L'Ingress Controller (ad esempio, nginx) gestisce il traffico in ingresso e lo instrada ai servizi appropriati all'interno del cluster Kubernetes. Per cui quando viene creato un container, viene creato un relativo Service Kubernetes e un Ingress Object che mappa il percorso della stanza di gioco al servizio.

### Struttura del Progetto

Ecco come potrebbe apparire la struttura del progetto per il backend:

```
game-backend/
├── package.json
├── server.js
└── gameSessions.js
```

### 1. Creazione del Progetto

Inizia creando una nuova cartella per il tuo progetto backend e naviga al suo interno:

```bash
mkdir game-backend
cd game-backend
```

Inizializza un nuovo progetto Node.js:

```bash
npm init -y
```

Installa le dipendenze necessarie:

```bash
npm install express axios @kubernetes/client-node

```

### 2. Creazione del Server

Crea un file chiamato `server.js` e aggiungi il seguente codice:

```javascript
const express = require('express');
const bodyParser = require('body-parser');
const { KubeConfig, CoreV1Api } = require('@kubernetes/client-node');
const { createGameContainer } = require('./gameSessions');

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware per il parsing del corpo delle richieste
app.use(bodyParser.json());

// Configurazione di Kubernetes
const kubeConfig = new KubeConfig();
kubeConfig.loadFromDefault();
const k8sApi = kubeConfig.makeApiClient(CoreV1Api);

// Memoria per le sessioni di gioco
const gameSessions = {};

// Rotta per creare una nuova sessione di gioco
app.post('/api/create-game', async (req, res) => {
    const { sessionCode } = req.body;

    try {
        // Crea un nuovo container di gioco
        const gameUrl = await createGameContainer(sessionCode, k8sApi);
        
        // Salva la sessione di gioco
        gameSessions[sessionCode] = { gameUrl, status: 'active' };

        res.json({ gameUrl });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Errore nella creazione della sessione di gioco' });
    }
});

// Rotta per ottenere informazioni su una sessione di gioco esistente
app.get('/api/get-game/:sessionCode', (req, res) => {
    const { sessionCode } = req.params;

    const session = gameSessions[sessionCode];
    if (session) {
        res.json({ gameUrl: session.gameUrl });
    } else {
        res.status(404).json({ error: 'Sessione di gioco non trovata' });
    }
});

// Avvia il server
app.listen(PORT, () => {
    console.log(`Server in ascolto su http://localhost:${PORT}`);
});
```

### 3. Creazione della Logica per i Container di Gioco

Il modulo `gameSessions.js` si occupa della creazione dei container di gioco utilizzando l'API di Kubernetes, della creazione di un servizio, di un ingress per esporre il container di gioco e della restituzione dell'URL a cui l'utente può connettersi per giocare:

```javascript
const { V1Pod, V1Service, V1Ingress } = require('@kubernetes/client-node');

const CONTAINER_IMAGE = process.env.CONTAINER_IMAGE || 'your-game-container-image';
const DOMAIN = process.env.DOMAIN || 'yourdomain.com';

async function createGameContainer(sessionCode, k8sApi) {
    // Definisci il nome del pod, del servizio e dell'ingress
    const podName = `game-session-${sessionCode}`;
    const namespace = 'default'; // o il namespace specifico che stai usando
    const port = 3000; // Porta del gioco all'interno del container

    // Crea il pod
    const podManifest = {
        metadata: {
            name: podName,
            labels: { sessionCode }
        },
        spec: {
            containers: [{
                name: 'game-container',
                image: CONTAINER_IMAGE, // Immagine del container del gioco
                ports: [{ containerPort: port }]
            }]
        }
    };

    // Crea il service per esporre il pod
    const serviceManifest = {
        metadata: { name: podName },
        spec: {
            selector: { sessionCode },
            ports: [{ port, targetPort: port }]
        }
    };

    // Crea la risorsa Ingress per instradare il traffico al servizio
    const ingressManifest = {
        metadata: {
            name: `ingress-${sessionCode}`,
            annotations: {
                'nginx.ingress.kubernetes.io/rewrite-target': '/'
            }
        },
        spec: {
            rules: [{
                host: DOMAIN, // Dominio su cui è esposto il gioco
                http: {
                    paths: [{
                        path: `/game/${sessionCode}`,
                        pathType: 'Prefix',
                        backend: {
                            service: {
                                name: podName,
                                port: { number: port }
                            }
                        }
                    }]
                }
            }]
        }
    };

    // Crea il pod
    await k8sApi.createNamespacedPod(namespace, podManifest);
    // Crea il servizio
    await k8sApi.createNamespacedService(namespace, serviceManifest);
    // Crea l'ingress
    await k8sApi.createNamespacedIngress(namespace, ingressManifest);

    // Ritorna l'URL a cui l'utente può connettersi per giocare
    return `http://${DOMAIN}/game/${sessionCode}`;
}
```

### 5. Avvio del Backend

Per avviare il backend, esegui il seguente comando:

```bash
node server.js
```
## Deployment Kubernetes

Alcune configurazioni fondamentali per Kubernetes: Deployment e un Service. Configurazione per il Frontend, Backend e il contenitore di gioco.

### 1. Configurazione del Deployment per il Frontend
Crea un file chiamato frontend-deployment.yaml e aggiungi il seguente codice

``` yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: game-frontend
spec:
  replicas: 2  # Numero di repliche
  selector:
    matchLabels:
      app: game-frontend
  template:
    metadata:
      labels:
        app: game-frontend
    spec:
      containers:
      - name: game-frontend
        image: your-frontend-image:latest  # Sostituisci con l'immagine del tuo frontend
        ports:
        - containerPort: 3000  # Porta esposta dal frontend
        env:
        - name: BACKEND_URL
          value: "http://game-backend:3000"  # URL del backend
``` 
### 2. Configurazione del Service per il Frontend

Crea un file chiamato frontend-service.yaml e aggiungi il seguente codice:

```yaml 
apiVersion: v1
kind: Service
metadata:
  name: game-frontend
spec:
  type: LoadBalancer  # Tipo di servizio per esporre il frontend
  ports:
  - port: 80  # Porta esposta
    targetPort: 3000  # Porta del container
  selector:
    app: game-frontend
```

### 3. Configurazione del Deployment per il Backend

Crea un file chiamato `backend-deployment.yaml` e aggiungi il seguente codice:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: game-backend
spec:
  replicas: 2  # Numero di repliche
  selector:
    matchLabels:
      app: game-backend
  template:
    metadata:
      labels:
        app: game-backend
    spec:
      containers:
      - name: game-backend
        image: your-backend-image:latest  # Sostituisci con l'immagine del tuo backend
        ports:
        - containerPort: 3000  # Porta esposta dal backend
        env:
        - name: NODE_ENV
          value: "production"
```

### 4. Configurazione del Service per il Backend

Crea un file chiamato `backend-service.yaml` e aggiungi il seguente codice:

```yaml
apiVersion: v1
kind: Service
metadata:
  name: game-backend
spec:
  type: ClusterIP  # Tipo di servizio, può essere cambiato in LoadBalancer se necessario
  ports:
  - port: 3000
    targetPort: 3000
  selector:
    app: game-backend
```

### 5. Configurazione del Deployment per il Container di Gioco

Crea un file chiamato `game-deployment.yaml` e aggiungi il seguente codice:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: game-container
spec:
  replicas: 0  # Inizialmente nessuna replica, verrà creata dinamicamente
  selector:
    matchLabels:
      app: game-container
  template:
    metadata:
      labels:
        app: game-container
    spec:
      containers:
      - name: game-container
        image: your-game-image:latest  # Sostituisci con l'immagine del tuo gioco
        ports:
        - containerPort: 8080  # Porta esposta dal container di gioco
```

### 6. Configurazione del Service per il Container di Gioco

Crea un file chiamato `game-service.yaml` e aggiungi il seguente codice:

```yaml
apiVersion: v1
kind: Service
metadata:
  name: game-service
spec:
  type: NodePort  # Tipo di servizio per esporre il container di gioco
  ports:
  - port: 8080
    targetPort: 8080
    nodePort: 30001  # Porta esposta sul nodo
  selector:
    app: game-container
```

### 7. Applicazione delle Configurazioni

Dopo aver creato i file di configurazione, puoi applicarli al tuo cluster Kubernetes utilizzando il comando `kubectl apply`. Esegui i seguenti comandi:

```bash
kubectl apply -f frontend-deployment.yaml
kubectl apply -f frontend-service.yaml
kubectl apply -f backend-deployment.yaml
kubectl apply -f backend-service.yaml
kubectl apply -f game-deployment.yaml
kubectl apply -f game-service.yaml
```

### 6. Accesso al Frontend, Backend e ai Container di Gioco

- Frontend: Se hai configurato il servizio come LoadBalancer, puoi ottenere l'IP pubblico del tuo servizio frontend utilizzando il comando:
    ```bash
    kubectl get services
    ``` 
    Cerca l'IP esterno associato al servizio game-frontend. Se stai eseguendo il tuo cluster localmente (ad esempio, con Minikube), puoi utilizzare minikube service game-frontend per ottenere l'URL.
- **Backend**: Puoi accedere al tuo backend utilizzando il servizio `game-backend`. Se stai eseguendo il tuo cluster localmente (ad esempio, con Minikube), puoi utilizzare `minikube service game-backend` per ottenere l'URL.
  
- **Container di Gioco**: I container di gioco verranno creati dinamicamente dal backend quando un utente inizia una nuova partita. Puoi accedere ai container di gioco utilizzando l'IP del nodo e la porta specificata nel servizio `game-service`.

## Gestione delle connessioni:

Come gestire la terminazione delle stanze di gioco / dei servizi quando la partita e' arrivata al termine? 

Sono state valutate due possibili soluzioni:

- Terminazione lato client Web
- Terminazione lato game-server  
- Terminazione da load balancer

L'obiettivo finale e' quello di garantire la chiusura della stanza di gioco e del servizio associato quando la partita e' terminata, cercando di modificare il meno possibile il codice applicativo esistente, possibilmente lasciandolo invariato, potendo eseguire i giochi in container senza dover modificare il codice del gioco prodotto dall* sviluppator*.

### 1. Terminazione lato client Web

I client web (javascript) possono inviare una richiesta al server frontend per segnalare la fine della partita all'infrastruttura di hosting. L'infrastruttura di hosting deve mantenere associazioni tra i client-web, le sessioni e il numero di connessioni attive. Quando le sessioni attive raggiungono 0, il server frontend può inviare una richiesta al server backend per terminare i container di gioco associati. Questo approccio richiede la modifica del client web e dell'infrastruttura, potenzialmente con l'introduzione di un meccanismo di heartbeat per monitorare le connessioni attive.

### 2. Terminazione lato game-server

Il game-server può inviare una richiesta al server frontend per segnalare la fine della partita. Il server frontend può quindi inviare una richiesta al server backend per terminare i container di gioco associati. Questo approccio richiede modifiche al codice del game-server, nonche' una consapevolezza del ciclo di vita del gioco e della terminazione della partita.

### 3. Terminazione da orchestratore

Il load balancer può monitorare le connessioni attive e terminare i container di gioco associati quando le connessioni attive raggiungono 0. Questo approccio richiede la configurazione del load balancer per monitorare le connessioni attive e inviare richieste al controller Kubernetes per terminare i container di gioco. Questo approccio richiede modifiche all'infrastruttura di hosting, ma non richiede modifiche al codice del client web o del game-server. Alto costo di configurazione, ma basso impatto sul codice esistente.

### Soluzione proposta

Dato che le soluzioni di load balancing, Ingress & co, non permettono un controllo fine-grained sulle connessioni, introduciamo un custom controller che monitora le connessioni attive e termina i container di gioco associati quando le connessioni attive raggiungono 0. Sara' necessario attivare le metriche di monitoraggio delle connessioni attive e configurare il controller per monitorare le connessioni attive e terminare i container di gioco associati.
Affinche' Il controller possa monitorare le connessioni attive, e' necessario che ogni pod sia equipaggiato con un sidecar proxy che fornisca le metriche di monitoraggio delle connessioni attive. 

## Nuova architettura: Ingress
```plaintext
+---------------------+                   +---------------------------------+
|                     |                   |                                 |
|     Frontend        |                   |     Backend                     |
|  (Express.js API)   |                   |  (Express.js API)               |
|                     |                   |                                 |
+---------+-----------+                   +-----------------+---------------+
      |                                        |            |
      | HTTP POST /api/create-game             |            |  
      |                                        |            |
      |  Room Code (sessionCode)               |   +--------+------------+
      +---------------------------------------->   | createGameContainer |
                                                   | (Creates pod, svc,  |
                                                   |  ingress)           |
                                                   +--------+------------+
                                                            |
                                                            |
                                                            v
+-----------------------------------------------------------+----------------+
|                           Kubernetes Cluster                               |
|                                                                            |
|    +-------------------------+       +---------------------------------+   |
|    |   Ingress Controller    |       |                                 |   |
|    | (nginx, handles traffic |       |   K8s API Server                |   |
|    |  from external requests)|       | (Handles pod, service,          |   |
|    |                         |       |  and ingress creation)          |   |
|    +-------------------------+       +---------------------------------+   |
|                 |                                        |                 |
|                 |                                        |                 |
|    HTTP /game/:sessionCode                            API Calls to K8s     |
|                 |                                        |                 |
|                 v                                        v                 |
|    +---------------------------+   +-----------------------------------+   |
|    |   Ingress Object          |   |     Pod + Service (Per Session)   |   |
|    | (Maps path to service)    |   |                                   |   |
|    +---------------------------+   |   +-----------------------------+ |   |
|                 |                  |   |  Pod: game-session-1234     | |   | 
|                 v                  |   |  Service: service-1234      | |   | 
|    +-------------------------+     |   +-----------------------------+ |   |
|    |    Service: game-1234   |     |                                   |   |
|    | (Exposes port 8080)     |     +-----------------------------------+   |
|    |                         |                                             |
|    +-------------------------+                                             |
|                                                                            |
+----------------------------------------------------------------------------+
```

### Ingress

Ingress permette di esporre le stanze di gioco come endpoint HTTP pubblici. L'Ingress Controller (ad esempio, nginx) gestisce il traffico in ingresso e lo instrada ai servizi appropriati all'interno del cluster Kubernetes. Per cui quando viene creato un container, viene creato un relativo Service Kubernetes e un Ingress Object che mappa il percorso della stanza di gioco al servizio.


## TO Docker

- Containerizzare il game server
- Configurare Kubernetes
- Configurare Ingress
