# SPDX-License-Identifier: AGPL-3.0-or-later
import base64,json,os,sys
from pathlib import Path
from cryptography.hazmat.primitives import serialization,hashes
from cryptography.hazmat.primitives.asymmetric import padding
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
key=serialization.load_pem_private_key(Path(sys.argv[1]).read_bytes(),password=None)
data=json.loads(Path(sys.argv[2]).read_text())
raw={k:base64.b64decode(v,validate=True) for k,v in data.items()}
secret=key.decrypt(raw['wrappedKey'],padding.OAEP(mgf=padding.MGF1(hashes.SHA256()),algorithm=hashes.SHA256(),label=None))
plain=AESGCM(secret).decrypt(raw['nonce'],raw['ciphertext'],b'alce-compat-v1')
path=Path(sys.argv[3]);path.write_bytes(plain);path.chmod(0o600)
