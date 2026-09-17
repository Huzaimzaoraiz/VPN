# Comprehensive Problem Audit & Architectural Analysis (`vpn-v2`)

This document details all known architectural flaws, software bugs, environment constraints, and configuration mismatches identified in the `vpn-v2` codebase.

---

## Table of Contents
1. [Environment & Execution Matrix (Docker on Mac vs. VM vs. Bare-Metal Linux)](#1-environment--execution-matrix)
2. [Data Plane & Linux Kernel Networking Problems](#2-data-plane--linux-kernel-networking-problems)
3. [Control Plane & Backend Problems (`backend/`)](#3-control-plane--backend-problems)
4. [VPN Node Daemon Problems (`vpn_node/`)](#4-vpn-node-daemon-problems)
5. [Frontend & Build Problems (`frontend/`)](#5-frontend--build-problems)
6. [Container & Deployment Problems (`deployment/`, `docker-compose.yml`)](#6-container--deployment-problems)
7. [Repository Inconsistencies (`root` vs `vpn-v2`)](#7-repository-inconsistencies)
8. [Actionable Remediation Checklist](#8-actionable-remediation-checklist)

---

## 1. Environment & Execution Matrix

### Question: Can this run for testing in Docker on macOS?
| Layer | In Docker on macOS | Notes |
| :--- | :--- | :--- |
| **Control Plane (API, DB, UI)** | **YES** | Runs in Node.js, PostgreSQL, and Nginx. Requires database initialization fix. |
| **VPN Node in Mock Mode (`MOCK_NETWORKING="true"`)** | **YES** | Allows testing gRPC communication, registration, desired-state syncing, and diff calculations without real Linux networking. |
| **Real VPN Tunneling (`MOCK_NETWORKING="false"`)** | **NO** | Docker Desktop on macOS lacks required OVS kernel modules, lacks systemd for OVS daemons, does not expose UDP 51820, and macOS cannot route container IP subnets. |

### Question: Will it work if run in a Linux VM on macOS?
* **YES, full end-to-end testing will work.**
* **Requirements**:
  * An Ubuntu 22.04 or 24.04 ARM64 VM (via UTM, OrbStack Linux machine, Multipass, Lima, or Parallels).
  * The VM network adapter must be configured in **Bridged Adapter** mode (or port forwarding configured) so the VM receives an IP on your local LAN (e.g., `192.168.1.150`).
  * Real Linux kernel with `wireguard`, `openvswitch`, and `nftables` modules loaded.
  * Systemd active running `openvswitch-switch` (`ovsdb-server` and `ovs-vswitchd`).
  * WireGuard clients on macOS can connect to the VM's LAN IP on port `51820/udp`.

### Question: Do you need a complete Linux system (Cloud VPS or Bare-Metal)?
* **For development and testing**: No, a local Linux VM on macOS is sufficient.
* **For production**: Yes. A cloud VPS (AWS EC2, Hetzner, DigitalOcean) with a dedicated public IPv4 address is necessary so remote peers on the internet can establish UDP tunnels.

---

## 2. Data Plane & Linux Kernel Networking Problems

### Critical: Open vSwitch (OVS) is Disconnected from WireGuard
* **File**: `vpn_node/src/reconciler.py`, `vpn_node/src/ovs_manager.py`
* **Root Cause**:
  1. The code creates a WireGuard interface `wg0` and an OVS bridge `br-vpn`.
  2. The code then installs OpenFlow rules into `br-vpn` (e.g., `table=0,priority=100,ip,nw_src=10.100.0.0/24 actions=mod_vlan_vid:100`).
  3. **However, `wg0` is never added as a port to `br-vpn`** (`ovs-vsctl add-port br-vpn wg0` is never executed).
  4. Even if attempted, WireGuard is a **Layer 3 (tun/point-to-point)** interface without Ethernet frames, whereas standard OVS bridges require **Layer 2 (Ethernet MAC)** frames.
* **Impact**: The OVS bridge is empty. No VPN traffic ever passes through `br-vpn`. All OVS isolation and VLAN tagging rules are dead code.

### Critical: Gateway Never Assigns Itself an IP Address on `wg0`
* **File**: `vpn_node/src/wireguard_manager.py` (`ensure_interface`)
* **Root Cause**:
  `WireGuardManager.ensure_interface()` creates the device `wg0`, sets the listen port and private key, and sets the link `UP`. It **never assigns an IP address** to `wg0` (e.g., `ip addr add 10.100.0.1/24 dev wg0`).
* **Impact**:
  The gateway has no IP on the VPN subnet. WireGuard peers configured with gateway endpoint `10.100.0.1` cannot ping or route packets through the gateway; the Linux kernel drops incoming packets because the destination IP does not belong to any local interface.

### Critical: Invalid Netlink Gateway Next-Hop on Point-to-Point Link
* **File**: `vpn_node/src/routing_manager.py` (`add_route`)
* **Code**:
  ```python
  ipr.route("replace", dst=route.destination, gateway=route.next_hop, oif=oif)
  ```
* **Root Cause**:
  WireGuard is a point-to-point link without ARP. Setting a `gateway` (next-hop IP) on `wg0` causes Netlink to fail with `RTNETLINK answers: Invalid argument` (EINVAL) or `Network is unreachable`.
* **Impact**: Route installation crashes when `MOCK_NETWORKING="false"`. WireGuard requires routing through `AllowedIPs` cryptokey routing rather than standard gateway next-hops.

### High: nftables Protocol Rule Syntax Error
* **File**: `vpn_node/src/nftables_manager.py` (`generate_ruleset`)
* **Code**:
  ```python
  port_clause = f" th dport {rule.port}" if rule.port else ""
  proto_clause = f" ip protocol {rule.protocol}" if rule.protocol != "all" else ""
  lines.append(f"        ip saddr {rule.source_cidr} ip daddr {rule.destination_cidr}{proto_clause}{port_clause} {action}")
  ```
* **Root Cause**: When `protocol == "all"` and a `port` is provided, `th dport <port>` without specifying the transport protocol (tcp/udp) fails in many versions of `nft`.
* **Impact**: Applying custom firewall rules with a port can crash the nftables atomic load.

---

## 3. Control Plane & Backend Problems (`backend/`)

### Critical: Desired State Changes are Never Pushed to Connected Nodes
* **File**: `backend/src/grpc/service.ts`, `backend/src/orchestration/desired_state.ts`, `backend/src/api/networks.ts`, `backend/src/api/devices.ts`
* **Root Cause**:
  1. `service.ts` defines `pushDesiredStateToVpnNode(gatewayId, desiredState)` to send updates down the gRPC `WatchDesiredState` stream.
  2. **This function is never imported or called anywhere in the backend.**
  3. When an administrator adds a network, creates a device, adds a route, or updates a firewall rule, `DesiredStateEngine.generateGatewayDesiredState()` updates the database record, but the connected VPN Node is never notified over gRPC.
* **Impact**: Connected VPN nodes only get the state once when first establishing the stream. All subsequent runtime additions are ignored by the node until restarted.

### High: Gateway Telemetry & Health Metrics are Discarded
* **File**: `backend/src/grpc/service.ts` (`ReportHeartbeat`), `backend/src/orchestration/scheduler.ts`
* **Root Cause**:
  1. VPN nodes stream `cpu_usage`, `memory_usage`, `active_peers`, `bytes_rx`, `bytes_tx` via `ReportHeartbeat`.
  2. `service.ts` only updates `lastHeartbeat: new Date()` on the `Gateway` table and discards all metrics.
  3. `GatewayScheduler.calculateScore` has hardcoded dummy metrics `{ cpu: 0, bw: 0, sessions: 0, latency: 0 }`.
* **Impact**: Health scores, telemetry charts, and load balancing calculations in the frontend are completely static or zero.

### High: Missing Backend API Routes Expected by Frontend
* **Files**: `backend/src/api/gateways.ts`, `backend/src/api/auth.ts`, `frontend/src/api/client.ts`
* **Root Cause**:
  1. `frontend/src/pages/Gateways.tsx` calls `POST /api/v1/gateways/:id/failover`. In `gateways.ts`, this route is completely missing. Triggering failover in the UI causes an unhandled 404 error.
  2. `frontend/src/api/client.ts` defines `getMe()` calling `GET /api/v1/auth/me`. In `auth.ts`, `/me` is unimplemented.

### Medium: Database Schema vs. API Serializer Case Mismatches
* **Files**: `backend/src/api/gateways.ts`, `backend/src/api/networks.ts`, `frontend/src/types/index.ts`
* **Root Cause**:
  1. Prisma generates camelCase properties: `gateway.nodeId`, `gateway.publicIp`, `gateway.listenPort`, `gateway.publicKey`.
  2. In `gateways.ts`: `res.json(gateways)` sends raw camelCase.
  3. The frontend `Gateway` interface and `Gateways.tsx` access `gw.public_ip`, `gw.listen_port`, `gw.node_id`.
* **Impact**: Values render as `undefined:undefined` in the Gateway dashboard view.

### Medium: Device Exit Node Flag is Ignored
* **File**: `backend/src/api/networks.ts` (lines 160-172)
* **Root Cause**:
  When a device is created with `is_exit_node: true`, the API hardcodes `allowed_ips: [network.cidr]`.
* **Impact**: Clients cannot use the VPN as a default gateway / full tunnel (`0.0.0.0/0`) even when checking the exit node box.

---

## 4. VPN Node Daemon Problems (`vpn_node/`)

### Critical: Precompiled Protobuf Stubs are Missing from Source
* **File**: `vpn_node/src/controller_client.py`
* **Root Cause**:
  `controller_client.py` imports `vpn_node_pb2` and `vpn_node_pb2_grpc`. These files are not committed in `vpn_node/src/`.
* **Impact**:
  Attempting to run `python3 -m vpn_node.src.main` locally crashes immediately with `ModuleNotFoundError: No module named 'vpn_node.src.vpn_node_pb2'`.
  The Dockerfile compiles them at container launch, but local development and unit testing require manual compilation via `grpc_tools.protoc`.

### High: Absence of Systemd / OVS Daemon Initialization
* **File**: `deployment/docker/Dockerfile.vpn_node`
* **Root Cause**:
  `Dockerfile.vpn_node` installs `openvswitch-switch`, but containers do not run `systemd`. Neither `ovsdb-server` nor `ovs-vswitchd` is started before `main.py` launches.
* **Impact**:
  When `MOCK_NETWORKING="false"`, `ovs-vsctl br-exists br-vpn` fails with:
  `ovs-vsctl: unix:/var/run/openvswitch/db.sock: database connection failed (No such file or directory)`.

### Medium: Daemon Does Not Enable Kernel IP Forwarding
* **File**: `vpn_node/src/main.py`
* **Root Cause**:
  The daemon assumes `sysctl net.ipv4.ip_forward = 1` is already enabled by the host. If run inside a standalone environment without prior host configuration, packet routing fails silently.

---

## 5. Frontend & Build Problems (`frontend/`)

### Critical: Broken TypeScript Executable (`tsc`)
* **File**: `frontend/node_modules/.bin/tsc`
* **Root Cause**:
  Inside `frontend/node_modules/.bin/tsc`, the file is a regular file requiring `../lib/tsc.js` instead of a symlink pointing to `../typescript/bin/tsc`.
* **Impact**:
  Running `npm run build` fails with:
  ```text
  Error: Cannot find module '../lib/tsc.js'
  Require stack: .../frontend/node_modules/.bin/tsc
  ```
  Requires re-installing dependencies with `npm install` or recreating symlinks.

### Medium: Missing Real-Time Status via WebSockets
* **File**: `frontend/src/pages/Dashboard.tsx`, `frontend/src/pages/Gateways.tsx`
* **Root Cause**:
  Documentation describes real-time peer state over WebSockets, but the frontend falls back to 5-second polling because no WebSocket gateway exists in the Express backend.

---

## 6. Container & Deployment Problems (`deployment/`, `docker-compose.yml`)

### Critical: Database Tables Never Initialized on Boot
* **File**: `deployment/docker/Dockerfile.backend`, `docker-compose.yml`
* **Root Cause**:
  1. `Dockerfile.backend` runs `npx prisma generate` during image build and executes `CMD ["npm", "start"]` at runtime.
  2. It never runs `npx prisma db push` or `npx prisma migrate deploy`.
  3. When starting on a fresh PostgreSQL volume, no SQL tables exist.
* **Impact**: Every API call returns 500 (`relation "users" does not exist`).

### High: Missing WireGuard Port Mapping in `docker-compose.yml`
* **File**: `docker-compose.yml`
* **Root Cause**:
  The `vpn-node` service configuration has no `ports:` declaration for `51820:51820/udp`.
* **Impact**: WireGuard traffic from external clients cannot reach the container.

### Medium: Environment Variable Name Discrepancy
* **File**: `docker-compose.yml`, `backend/src/config/env.ts`
* **Root Cause**:
  `docker-compose.yml` sets `SECRET_KEY`, but `env.ts` reads `JWT_SECRET`. (It falls back to the default dev secret).

### Medium: Frontend Port Mismatch
* **File**: `docker-compose.yml`, `README.md`
* **Root Cause**:
  `docker-compose.yml` maps port `8081:80` for `frontend`, but documentation states `http://localhost:5173`.

---

## 7. Repository Inconsistencies (`root` vs `vpn-v2`)

* **Nested Repositories**: `vpn-v2/` is a separate git repository placed inside the root directory.
* **Component Naming Collision**:
  * Root uses `agent/` with `proto/agent.proto` and compiled `agent_pb2.py`.
  * `vpn-v2` uses `vpn_node/` with `proto/vpn_node.proto` without compiled stubs.
* **Backend Divergence**:
  * Root contains an archived Python FastAPI backend in `backend_python_archive/` and broken pytest tests referencing Python `app`.
  * `vpn-v2` contains the active TypeScript/Express/Prisma backend.

---

## 8. Actionable Remediation Checklist

- [x] **1. Fix Docker Backend Startup**: Added `npx prisma db push` before `npm start` in `deployment/docker/Dockerfile.backend`.
- [x] **2. Fix WireGuard IPAM Assignment**: Updated `desired_state.ts` to compute gateway addresses and updated `wireguard_manager.py` to assign and synchronize gateway virtual IPs (e.g. `10.100.0.1/24`) on `wg0`.
- [x] **3. Wire Desired State Push**: In `backend/src/orchestration/desired_state.ts`, invoked `pushDesiredStateToVpnNode()` to push updates in real-time down the gRPC stream.
- [x] **4. Implement Missing API Endpoints**: Added `POST /api/v1/gateways/:id/failover` and `GET /api/v1/auth/me` to the Express backend.
- [x] **5. Normalize Gateway API Output**: Serialized Prisma models into snake_case and mapped live telemetry in `backend/src/api/gateways.ts`.
- [x] **6. Resolve OVS / Linux Networking Architecture**: Made OVS operations resilient to prevent daemon crashes, relied on kernel `nftables` for isolation/NAT, fixed Netlink point-to-point routes, auto-detected WAN interface (e.g. `ens5` on AWS EC2), and auto-enabled kernel IPv4 forwarding.
- [x] **7. Re-generate Protobuf Stubs**: Pre-generated Python stubs in `vpn_node/src/` and fixed relative import handling for standalone execution.
- [x] **8. Fix Frontend Dependencies**: Recreated symlinks in `frontend/node_modules/.bin` so `npm run build` succeeds cleanly.
- [x] **9. Environment & Port Alignment**: Added `JWT_SECRET` and mapped UDP port `51820/udp` and port `5173` in `docker-compose.yml`.
