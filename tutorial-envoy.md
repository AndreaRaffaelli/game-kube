Per aggiungere un **sidecar proxy** in un pod Kubernetes, segui questi passaggi. Il sidecar è un contenitore aggiuntivo nello stesso pod che lavora insieme al contenitore principale (ad esempio per aggiungere funzioni come osservabilità, autenticazione, logging o comunicazione tra servizi). Uno degli scenari più comuni è l’uso di un proxy come **Envoy** o **Istio**.

### Passaggi per Aggiungere un Sidecar Proxy

#### 1. **Modifica del Manifest del Pod per Includere il Sidecar**

Per aggiungere un sidecar manualmente, devi modificare il manifest del pod o del `Deployment` in cui vuoi aggiungere il proxy.

Ecco un esempio di configurazione per aggiungere un sidecar Envoy:

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: my-app
spec:
  replicas: 1
  selector:
    matchLabels:
      app: my-app
  template:
    metadata:
      labels:
        app: my-app
    spec:
      containers:
        # Contenitore principale
        - name: main-app
          image: my-app-image
          ports:
            - containerPort: 80

        # Sidecar proxy (Envoy)
        - name: envoy-sidecar
          image: envoyproxy/envoy:v1.19.1
          ports:
            - containerPort: 15001
          args:
            - "-c"
            - "/etc/envoy/envoy.yaml"
          volumeMounts:
            - name: envoy-config
              mountPath: /etc/envoy

      volumes:
        - name: envoy-config
          configMap:
            name: envoy-config
```

In questo esempio:
- Il contenitore principale è `main-app`.
- Il sidecar `envoy-sidecar` usa l’immagine `envoyproxy/envoy` e si avvia con un file di configurazione montato da un `ConfigMap`.
- Il file di configurazione di Envoy (in un `ConfigMap` chiamato `envoy-config`) specifica le regole di instradamento.

#### 2. **Configurazione del Proxy tramite ConfigMap**

Il file di configurazione per Envoy si trova nel `ConfigMap`. Ecco un esempio base di `ConfigMap` per configurare Envoy come sidecar:

```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: envoy-config
data:
  envoy.yaml: |
    static_resources:
      listeners:
        - name: listener_0
          address:
            socket_address:
              address: 0.0.0.0
              port_value: 15001
          filter_chains:
            - filters:
                - name: envoy.filters.network.http_connection_manager
                  typed_config:
                    "@type": type.googleapis.com/envoy.extensions.filters.network.http_connection_manager.v3.HttpConnectionManager
                    stat_prefix: ingress_http
                    route_config:
                      name: local_route
                      virtual_hosts:
                        - name: local_service
                          domains: ["*"]
                          routes:
                            - match: { prefix: "/" }
                              route: { cluster: service_backend }
                    http_filters:
                      - name: envoy.filters.http.router
      clusters:
        - name: service_backend
          connect_timeout: 0.25s
          type: LOGICAL_DNS
          lb_policy: ROUND_ROBIN
          load_assignment:
            cluster_name: service_backend
            endpoints:
              - lb_endpoints:
                  - endpoint:
                      address:
                        socket_address:
                          address: 127.0.0.1
                          port_value: 80
```

Questa configurazione:
- Imposta un listener che instrada le richieste al contenitore principale sulla porta `80`.
- Configura un cluster chiamato `service_backend`, che punta all’indirizzo `127.0.0.1:80`, cioè la porta del contenitore principale nel pod.

#### 3. **Automatic Sidecar Injection (con Istio)**

Un’alternativa è usare un **service mesh** come Istio, che permette di aggiungere il sidecar automaticamente.

1. **Installa Istio** nel cluster Kubernetes, seguendo la documentazione ufficiale di Istio.

2. **Etichetta il namespace** in cui desideri attivare la sidecar injection automatica:
   ```bash
   kubectl label namespace default istio-injection=enabled
   ```

3. **Crea il Deployment** normalmente, senza aggiungere il sidecar manualmente. Istio aggiungerà automaticamente il proxy sidecar (basato su Envoy) a tutti i pod nel namespace etichettato.

#### 4. **Configurazione del Traffico tra il Proxy e l’Applicazione Principale**

A questo punto, devi assicurarti che il traffico passi attraverso il sidecar per raggiungere l’applicazione principale. Questo può essere fatto configurando:
- **Rewrite delle regole DNS** per fare in modo che le richieste passino dal proxy.
- **Modifiche alle regole di routing di Istio** (come `VirtualService` e `DestinationRule`) per gestire l’instradamento specifico.

#### 5. **Verifica e Test**

Per verificare che il sidecar funzioni correttamente:
1. **Verifica i log** del contenitore sidecar:
   ```bash
   kubectl logs <pod-name> -c envoy-sidecar
   ```
   
2. **Testa la connettività** assicurandoti che il traffico verso il servizio passi attraverso il proxy.

3. **Usa strumenti di monitoraggio** se il proxy sidecar (come Istio) offre metriche e dashboard per vedere il traffico instradato.

### Vantaggi del Sidecar Proxy
- **Maggiore osservabilità**: Monitora il traffico con metriche dettagliate.
- **Gestione della sicurezza**: Facilita l’implementazione di politiche di autenticazione e autorizzazione.
- **Controllo del traffico**: Permette di configurare regole di bilanciamento del carico, failover e circuit-breaking.

Questa configurazione fornisce un'architettura flessibile per aggiungere funzionalità avanzate senza modificare l'applicazione stessa.


Per implementare questa logica, puoi creare un **Custom Controller** o **Operator** in Kubernetes utilizzando il **Kubernetes Operator Pattern**. L'operatore monitorerà le metriche di Envoy e agirà automaticamente in base alle connessioni attive. Se non ci sono connessioni attive, l'operatore eliminerà il pod, il deployment, il servizio e l'ingresso associato.

### Passaggi per Creare un Custom Controller (Operator)

1. **Setup dell’Ambiente di Sviluppo per l’Operator**:
   Utilizza uno strumento come **Kubebuilder** o **Operator SDK** per sviluppare l’operatore. Questi strumenti forniscono un framework per costruire controller Kubernetes in Go.

   - Installa Kubebuilder:
     ```bash
     curl -L -o kubebuilder https://github.com/kubernetes-sigs/kubebuilder/releases/download/vX.Y.Z/kubebuilder_X.Y.Z_linux_amd64.tar.gz
     tar -xzf kubebuilder_X.Y.Z_linux_amd64.tar.gz
     sudo mv kubebuilder /usr/local/bin/
     ```

   - Inizializza il progetto:
     ```bash
     kubebuilder init --domain=example.com
     ```

2. **Definizione di un Custom Resource Definition (CRD)**:
   Crea una risorsa custom per rappresentare la logica del tuo monitoraggio. Ad esempio, un `EnvoyMonitor` CRD che contiene i dettagli su come monitorare le connessioni attive e le risorse da terminare.

   ```yaml
   apiVersion: monitoring.example.com/v1alpha1
   kind: EnvoyMonitor
   metadata:
     name: envoy-monitor-sample
   spec:
     deploymentName: "my-app"
     serviceName: "my-app-service"
     ingressName: "my-app-ingress"
     namespace: "default"
     checkInterval: "10s"
     minConnections: 1  # Numero minimo di connessioni attive richiesto
   ```

3. **Implementazione del Controller per Monitorare le Connessioni Attive**:
   Il controller utilizzerà l'Admin API di Envoy per verificare il numero di connessioni attive e deciderà se mantenere attive o meno le risorse Kubernetes.

   Esempio di codice per il controller (in Go):
   ```go
   package controllers

   import (
       "context"
       "fmt"
       "net/http"
       "encoding/json"
       "time"

       "k8s.io/apimachinery/pkg/types"
       "k8s.io/client-go/kubernetes"
       "sigs.k8s.io/controller-runtime/pkg/client"
       "sigs.k8s.io/controller-runtime/pkg/reconcile"
   )

   type EnvoyMonitorReconciler struct {
       client.Client
       Clientset *kubernetes.Clientset
   }

   func (r *EnvoyMonitorReconciler) Reconcile(ctx context.Context, req reconcile.Request) (reconcile.Result, error) {
       var envoyMonitor monitoringv1alpha1.EnvoyMonitor
       if err := r.Get(ctx, req.NamespacedName, &envoyMonitor); err != nil {
           return reconcile.Result{}, client.IgnoreNotFound(err)
       }

       // Effettua la richiesta all'Admin API di Envoy
       envoyStatsUrl := "http://<envoy-pod-ip>:9901/stats"
       resp, err := http.Get(envoyStatsUrl)
       if err != nil {
           return reconcile.Result{}, err
       }
       defer resp.Body.Close()

       stats := parseEnvoyStats(resp.Body)
       activeConnections := stats["server.connections_active"]

       // Logica di scaling down
       if activeConnections < envoyMonitor.Spec.MinConnections {
           err := r.terminateResources(ctx, envoyMonitor)
           if err != nil {
               return reconcile.Result{}, err
           }
       }

       return reconcile.Result{RequeueAfter: 10 * time.Second}, nil
   }

   // Funzione per parsare le metriche
   func parseEnvoyStats(body io.Reader) map[string]int {
       stats := make(map[string]int)
       decoder := json.NewDecoder(body)
       _ = decoder.Decode(&stats)
       return stats
   }

   // Termina le risorse specificate nel CR
   func (r *EnvoyMonitorReconciler) terminateResources(ctx context.Context, monitor monitoringv1alpha1.EnvoyMonitor) error {
       // Elimina Deployment
       if err := r.Clientset.AppsV1().Deployments(monitor.Namespace).Delete(ctx, monitor.Spec.DeploymentName, metav1.DeleteOptions{}); err != nil {
           return err
       }

       // Elimina Service
       if err := r.Clientset.CoreV1().Services(monitor.Namespace).Delete(ctx, monitor.Spec.ServiceName, metav1.DeleteOptions{}); err != nil {
           return err
       }

       // Elimina Ingress
       if err := r.Clientset.NetworkingV1().Ingresses(monitor.Namespace).Delete(ctx, monitor.Spec.IngressName, metav1.DeleteOptions{}); err != nil {
           return err
       }

       return nil
   }
   ```

   In questo esempio:
   - La funzione `Reconcile` verifica le connessioni attive tramite l’Admin API di Envoy.
   - Se il numero di connessioni attive è inferiore al limite (`minConnections` specificato nel CRD), esegue la funzione `terminateResources` che elimina il `Deployment`, il `Service` e l’`Ingress`.

4. **Build e Deploy del Controller nell’Ambiente Kubernetes**:
   - **Compila l'operatore** e crea un’immagine Docker per il controller.
   - **Esegui l’operatore** in un pod Kubernetes per monitorare le risorse continuamente.

   Esempio di comandi per creare l'immagine e fare il deploy:
   ```bash
   docker build -t my-envoy-monitor-operator .
   docker push <registry>/my-envoy-monitor-operator:latest
   ```

5. **Applicazione del CRD e Verifica del Funzionamento**:
   - Applica il CRD nel cluster:
     ```bash
     kubectl apply -f envoymonitor.yaml
     ```

   - Controlla i log del controller per assicurarti che rilevi correttamente le connessioni attive e, quando non ci sono connessioni, elimini le risorse.

### Considerazioni Finali

Questa soluzione permette di automatizzare il controllo e la gestione delle connessioni, disattivando le risorse Kubernetes quando non sono più in uso.

[Game deployment](./game-deployment.yaml)