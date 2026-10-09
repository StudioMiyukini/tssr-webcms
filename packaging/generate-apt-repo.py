#!/usr/bin/env python3
# generate-apt-repo.py — génère l'index d'un dépôt APT (Packages + Release)
# SANS apt-ftparchive, donc exécutable sur Windows. Lit repo/apt/pool/main/*.deb.
#
#   python packaging/generate-apt-repo.py
#
# Signature (optionnelle) : si gpg est présent et GPG_KEY défini, signe Release
# (InRelease + Release.gpg). Sinon, le dépôt est NON signé → côté client, utiliser
#   deb [trusted=yes] https://tssr.miyukini.com/apt stable main
import os, sys, gzip, lzma, hashlib, subprocess, tarfile, io
from email.utils import formatdate

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
APT = os.path.join(ROOT, "repo", "apt")
POOL = os.path.join(APT, "pool", "main")
SUITE, COMP, ARCH = "stable", "main", "all"
DISTS = os.path.join(APT, "dists", SUITE)
BINDIR = os.path.join(DISTS, COMP, f"binary-{ARCH}")


def ar_members(data):
    """Itère les membres d'une archive ar (format .deb) : (nom, octets)."""
    assert data[:8] == b"!<arch>\n", "pas une archive ar/.deb"
    off = 8
    while off + 60 <= len(data):
        hdr = data[off:off + 60]; off += 60
        name = hdr[0:16].decode().strip()
        size = int(hdr[48:58].decode().strip())
        body = data[off:off + size]; off += size + (size & 1)  # padding pair
        yield name.rstrip("/"), body


def lire_control(deb_path):
    """Extrait le fichier 'control' du .deb (control.tar.{gz,xz})."""
    with open(deb_path, "rb") as f:
        data = f.read()
    for name, body in ar_members(data):
        if name.startswith("control.tar"):
            if name.endswith(".gz"):   raw = gzip.decompress(body)
            elif name.endswith(".xz"): raw = lzma.decompress(body)
            elif name.endswith((".tar",)): raw = body
            else: raise SystemExit(f"compression control non gérée: {name}")
            tf = tarfile.open(fileobj=io.BytesIO(raw))
            for m in tf.getmembers():
                if m.name.lstrip("./") == "control":
                    return tf.extractfile(m).read().decode("utf-8", "replace")
    raise SystemExit("control introuvable dans " + deb_path)


def hashes(b):
    return (hashlib.md5(b).hexdigest(), hashlib.sha1(b).hexdigest(), hashlib.sha256(b).hexdigest())


def main():
    debs = sorted(f for f in os.listdir(POOL) if f.endswith(".deb")) if os.path.isdir(POOL) else []
    if not debs:
        sys.exit(f"Aucun .deb dans {POOL}")
    os.makedirs(BINDIR, exist_ok=True)

    entrees = []
    for deb in debs:
        p = os.path.join(POOL, deb)
        b = open(p, "rb").read()
        md5, sha1, sha256 = hashes(b)
        ctrl = lire_control(p).strip("\n")
        # champs control (on retire une éventuelle ligne vide finale) + champs de pool
        lignes = [l for l in ctrl.split("\n") if l.strip()]
        lignes.append(f"Filename: pool/{COMP}/{deb}")
        lignes.append(f"Size: {len(b)}")
        lignes.append(f"MD5sum: {md5}")
        lignes.append(f"SHA1: {sha1}")
        lignes.append(f"SHA256: {sha256}")
        entrees.append("\n".join(lignes))
        print(f"  + {deb} ({len(b)} o)")

    packages = ("\n\n".join(entrees) + "\n").encode("utf-8")
    with open(os.path.join(BINDIR, "Packages"), "wb") as f: f.write(packages)
    with open(os.path.join(BINDIR, "Packages.gz"), "wb") as f: f.write(gzip.compress(packages))

    # Release : liste les fichiers d'index avec leurs empreintes.
    rel_files = []
    for nom in ("Packages", "Packages.gz"):
        b = open(os.path.join(BINDIR, nom), "rb").read()
        md5, sha1, sha256 = hashes(b)
        rel_files.append((f"{COMP}/binary-{ARCH}/{nom}", len(b), md5, sha256))
    rel = []
    rel.append("Origin: Miyukini"); rel.append("Label: Miyukini")
    rel.append(f"Suite: {SUITE}"); rel.append(f"Codename: {SUITE}")
    rel.append(f"Components: {COMP}"); rel.append(f"Architectures: {ARCH}")
    rel.append(f"Date: {formatdate(usegmt=True)}")
    rel.append("MD5Sum:")
    for path, size, md5, _ in rel_files: rel.append(f" {md5} {size} {path}")
    rel.append("SHA256:")
    for path, size, _, sha256 in rel_files: rel.append(f" {sha256} {size} {path}")
    release = ("\n".join(rel) + "\n").encode("utf-8")
    with open(os.path.join(DISTS, "Release"), "wb") as f: f.write(release)

    # Signature optionnelle.
    key = os.environ.get("GPG_KEY")
    signed = False
    if key:
        try:
            subprocess.run(["gpg", "--default-key", key, "--batch", "--yes", "--clearsign",
                            "-o", os.path.join(DISTS, "InRelease"), os.path.join(DISTS, "Release")], check=True)
            subprocess.run(["gpg", "--default-key", key, "--batch", "--yes", "-abs",
                            "-o", os.path.join(DISTS, "Release.gpg"), os.path.join(DISTS, "Release")], check=True)
            subprocess.run("gpg --armor --export " + key, shell=True,
                           stdout=open(os.path.join(APT, "key.gpg"), "wb"), check=True)
            signed = True
        except Exception as e:
            print("  (signature gpg échouée:", e, ")")

    print("\nDépôt APT généré sous repo/apt/")
    if signed:
        print("Signé. Client :")
        print("  curl -fsSL https://tssr.miyukini.com/apt/key.gpg | sudo gpg --dearmor -o /usr/share/keyrings/miyukini.gpg")
        print(f'  echo "deb [signed-by=/usr/share/keyrings/miyukini.gpg] https://tssr.miyukini.com/apt {SUITE} {COMP}" | sudo tee /etc/apt/sources.list.d/miyukini.list')
    else:
        print("NON signé. Client (dépôt de confiance explicite) :")
        print(f'  echo "deb [trusted=yes] https://tssr.miyukini.com/apt {SUITE} {COMP}" | sudo tee /etc/apt/sources.list.d/miyukini.list')
    print("  sudo apt update && sudo apt install miyukini-toolbox")


if __name__ == "__main__":
    main()
