# Game-kube

This project aims to manage multiple gaming sessions in a scalable manner by overseeing the creation of game instances through containers.

The core idea of the project is to support stateful games with long-lived connections and no support for replication. Early stages of multiplayer game development often do not address the externalization of the game's state, making orchestration difficult to manage, as each client must be routed to the same instance of the game. This project aims to solve this problem by creating a container for each game instance and routing clients to the correct container.

The main technologies used in this project are:

- Docker
- Kubernetes
- Node.js
- WebSockets
- Socket.io

For more information, please refer to [WhatsGoingOn.md](./WhatsGoingOn.md), which contains documentation and a stream of thoughts regarding the design choices of the project. I apologize for the fact that it is written in Italian, but I am confident you will have no trouble translating it on your own.