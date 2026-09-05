# Distributed Multi-Tenant Overlay VPN Platform

A production-grade, distributed, multi-tenant overlay VPN platform architected with strict separation between the **Control Plane** (FastAPI, PostgreSQL, React+TypeScript) and **Data Plane** (Autonomous Linux Gateway Agents managing WireGuard, Open vSwitch, Netlink routing, and nftables).

---

## 1. Key Architectural Features

- **Decoupled Control & Data Planes**: The FastAPI controller orchestrates configuration manifests and never touches user packet streams.
- **Autonomous Desired-State Reconciliation**: Linux Gateway agents autonomously pull versioned desired-state envelopes over streaming gRPC/mTLS, compute diffs against live kernel state, and idempotently apply WireGuard peers, OVS flow rules, and nftables firewall tables.
- **Self-Healing Anti-Drift**: A periodic watchdog loop inspects kernel state every 15s. If an administrator deletes an OVS flow or WireGuard peer, the agent automatically detects the drift and restores it.
- **Zero-Knowledge WireGuard Key Generation**: RFC 7748 Curve25519 keypairs are generated exclusively inside the browser via WebCrypto. The private key never leaves client memory or the exported `.conf` file.
- **Multi-Tenant Network Isolation**: Implemented at L2/L3 via Open vSwitch internal VLAN tags and Linux kernel `nftables` inter-network `DROP` chains.
- **Dynamic IPAM**: Automatically assigns non-overlapping `/24` subnets (e.g., `10.100.0.0/24`, `10.100.1.0/24`) and static IP allocations.
- **Automated Gateway Failover**: Evaluates gateway health scores ($0.4 \times \text{CPU} + 0.3 \times \text{BW} + 0.2 \times \text{Sessions} + 0.1 \times \text{Latency}$) and automatically migrates tenant networks if a node stops reporting heartbeats.

---

## 2. Repository Layout

```text
├── proto/                     # Protocol Buffers definition for AgentControlService
│   └── agent.proto
├── backend/                   # FastAPI Controller, SQLAlchemy 2.0, IPAM, gRPC server
│   ├── app/
│   │   ├── api/               # Auth, Networks, Devices, Routes, Firewall, Gateways
│   │   ├── core/              # Config, Security (Argon2id / JWT), Database
│   │   ├── grpc_server/       # Compiled stubs and AgentControlService implementation
│   │   ├── models/            # SQLAlchemy ORM models
│   │   ├── orchestration/     # Desired state engine, Gateway scheduler, Failover
│   │   └── services/          # IPAM, Device, Routing, Policy services
│   └── tests/                 # Async pytest suite
├── agent/                     # Autonomous Linux Gateway Agent daemon
│   ├── src/
│   │   ├── wireguard_manager.py # Kernel WireGuard interface and peer configuration
│   │   ├── ovs_manager.py       # Open vSwitch bridges, ports, and OpenFlow flows
│   │   ├── routing_manager.py   # Netlink IP routing via pyroute2
│   │   ├── nftables_manager.py  # Atomic nftables ruleset compilation and apply
│   │   ├── reconciler.py        # Desired vs Actual diff and idempotent state apply
│   │   ├── health.py            # Resource thresholds and health evaluation
│   │   ├── metrics.py           # psutil telemetry (CPU, Memory, Sessions, IO)
│   │   └── main.py              # Autonomous daemon event loop
│   └── tests/                 # Unit tests for reconciler diffing and anti-drift
├── frontend/                  # React + TypeScript + Vite + Tailwind CSS SPA
│   └── src/
│       ├── components/        # DeviceModal (QR code / keygen), RouteModal, TopologyGraph
│       ├── pages/             # Dashboard, NetworkDetail, Gateways, Login, Register
│       └── utils/             # Curve25519 browser keypair generator
├── infrastructure/            # Terraform AWS EC2 module & cloud-init bootstrap
├── deployment/                # Dockerfiles and systemd unit configurations
└── docs/                      # Comprehensive Architecture, Networking, and Security docs
```

---

## 3. Quick Start — Local Development (Docker Compose)

Launch the entire stack (PostgreSQL, FastAPI Controller, React Dashboard, Linux Agent Harness, Prometheus, and Grafana) with Docker Compose:

```bash
# 1. Start all services
docker compose up -d

# 2. View running logs
docker compose logs -f backend
```

Access Points:
- **Web Dashboard**: [http://localhost:5173](http://localhost:5173)
- **FastAPI Controller Docs**: [http://localhost:8000/docs](http://localhost:8000/docs)
- **Prometheus Metrics**: [http://localhost:9090](http://localhost:9090)
- **Grafana Dashboard**: [http://localhost:3000](http://localhost:3000) (User: `admin`, Pass: `admin`)
- **Controller gRPC Port**: `localhost:50051`

---

## 4. Running the Automated Test Suite

The test suite validates:
1. User registration, Argon2id password verification, and JWT authentication.
2. IPAM CIDR allocation and sequential device IP assignment.
3. Multi-tenant isolation (Tenant B cannot read or mutate Tenant A's network).
4. Reconciler diffing and idempotency.
5. Anti-drift self-healing (re-installing deleted OVS flows and WireGuard peers).

```bash
# Run pytest with the active virtual environment
PYTHONPATH=.:backend ./.venv/bin/pytest backend/tests agent/tests -v
```

Expected Output:
```text
backend/tests/test_auth.py::test_auth_registration_and_login PASSED
backend/tests/test_ipam.py::test_ipam_cidr_and_vlan_allocation PASSED
backend/tests/test_ipam.py::test_ipam_device_ip_allocation PASSED
backend/tests/test_networks.py::test_network_lifecycle_and_tenant_isolation PASSED
agent/tests/test_reconciler_logic.py::test_reconciler_initial_diff_and_apply PASSED
agent/tests/test_reconciler_logic.py::test_reconciler_anti_drift_restores_deleted_resources PASSED
============================== 6 passed in 0.30s ===============================
```

---

## 5. Production Linux Gateway Setup (Native Linux / VM)

On any Ubuntu 22.04 / 24.04 Linux host (or AWS EC2 VM):

```bash
# 1. Install kernel packages
sudo apt-get update
sudo apt-get install -y wireguard wireguard-tools openvswitch-switch nftables python3-pip python3-venv

# 2. Enable IP forwarding
echo "net.ipv4.ip_forward = 1" | sudo tee -a /etc/sysctl.conf
sudo sysctl -p

# 3. Deploy Agent
sudo mkdir -p /opt/vpn-agent
sudo cp -r agent/* /opt/vpn-agent/
cd /opt/vpn-agent
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# 4. Configure & Start Systemd Service
sudo cp deployment/systemd/vpn-agent.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now vpn-agent
```

---

## 6. End-to-End Verification Walkthrough

1. Open [http://localhost:5173](http://localhost:5173) and click **Register new tenant**.
2. Create **Network A** (`10.100.0.0/24`).
3. Click **Add Device** -> enters "Work Laptop".
   - Browser generates a Curve25519 keypair.
   - Controller assigns static IP `10.100.0.10`.
   - Download the generated `.conf` file or scan the QR code.
4. Add a second device ("File Server") -> receives `10.100.0.11`.
5. Create **Network B** (`10.100.1.0/24`) with peer `10.100.1.10`.
6. Verify Tenant Isolation:
   - Traffic between `10.100.0.10` and `10.100.0.11` is tagged with VLAN 100 on OVS `br-vpn` and forwarded.
   - Traffic from `10.100.0.10` to `10.100.1.10` is blocked by both OVS flow separation and kernel `nftables` isolation rules.
7. Anti-drift test:
   - Run `ovs-ofctl del-flows br-vpn` on the gateway host.
   - The agent's drift watchdog detects the missing rules and restores them within 15 seconds.
