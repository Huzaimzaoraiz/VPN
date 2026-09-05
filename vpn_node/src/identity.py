import os
import subprocess
import base64
from dataclasses import dataclass
from vpn_node.src.config import node_settings

@dataclass
class GatewayIdentity:
    node_id: str
    hostname: str
    public_key: str
    private_key: str
    public_ip: str
    listen_port: int
    region: str

class IdentityManager:
    @staticmethod
    def load_or_create_identity() -> GatewayIdentity:
        key_path = node_settings.WG_KEY_PATH
        priv_key = ""
        pub_key = ""

        # Check if real wg CLI is available
        has_wg = False
        try:
            res = subprocess.run(["which", "wg"], capture_output=True, text=True)
            has_wg = res.returncode == 0
        except Exception:
            has_wg = False

        if os.path.exists(key_path):
            with open(key_path, "r") as f:
                priv_key = f.read().strip()
        else:
            if has_wg:
                gen_priv = subprocess.run(["wg", "genkey"], capture_output=True, text=True, check=True)
                priv_key = gen_priv.stdout.strip()
            else:
                # Deterministic development fallback key (32 bytes base64)
                priv_key = base64.b64encode(b"01234567890123456789012345678901").decode("utf-8")

            os.makedirs(os.path.dirname(os.path.abspath(key_path)), exist_ok=True)
            with open(key_path, "w") as f:
                f.write(priv_key)
            os.chmod(key_path, 0o600)

        # Derive public key
        if has_wg:
            gen_pub = subprocess.run(
                ["wg", "pubkey"],
                input=priv_key,
                capture_output=True,
                text=True,
                check=True
            )
            pub_key = gen_pub.stdout.strip()
        else:
            pub_key = base64.b64encode(b"pubkey_gateway_1234567890123456").decode("utf-8")

        return GatewayIdentity(
            node_id=node_settings.NODE_ID,
            hostname=node_settings.HOSTNAME,
            public_key=pub_key,
            private_key=priv_key,
            public_ip=node_settings.PUBLIC_IP,
            listen_port=node_settings.LISTEN_PORT,
            region=node_settings.REGION
        )
