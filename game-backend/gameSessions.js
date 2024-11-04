// const { V1Pod, V1ObjectMeta, V1PodSpec, V1Container } = require('@kubernetes/client-node');
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

module.exports = { createGameContainer };


// async function createGameContainer(sessionCode, k8sApi) {
//     const namespace = 'default'; // Cambia il namespace se necessario
//     const podName = `game-${sessionCode}`;

//     const container = new V1Container();
//     container.name = 'game-container';
//     container.image = 'your-game-image:latest'; // Sostituisci con l'immagine del tuo gioco
//     container.ports = [{ containerPort: 8080 }]; // Cambia la porta se necessario

//     const podSpec = new V1PodSpec();
//     podSpec.containers = [container];

//     const podMetadata = new V1ObjectMeta();
//     podMetadata.name = podName;

//     const pod = new V1Pod();
//     pod.metadata = podMetadata;
//     pod.spec = podSpec;

//     // Crea il pod in Kubernetes
//     await k8sApi.createNamespacedPod(namespace, pod);
//     // Ottieni i dettagli del servizio
//     const service = await k8sApi.readNamespacedService(serviceName, namespace);
//     const serviceIP = service.body.spec.clusterIP;

//     // Restituisci l'URL del gioco
//     return `http://${serviceIP}:8080`; // Usa l'IP del servizio Kubernetes}
// }


