"""Kompatibel CLI för den gemensamma generatorn som används av Next.js-appen."""
import argparse
import shutil
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent


def main():
    parser = argparse.ArgumentParser(description="Skapa ackordblad från en separat YAML-låtfil.")
    parser.add_argument("--song", type=Path, default=ROOT / "songs" / "flykten-fran-vardagen.yaml", help="Låtfil i YAML-format.")
    parser.add_argument("--output", type=Path, help="PDF-sökväg. Standard: outputs/<låtfil>.pdf.")
    parser.add_argument("--png", action="store_true", help="Skapa PNG för varje sida. Kräver pypdfium2.")
    args = parser.parse_args()
    output = (args.output or ROOT / "outputs" / (args.song.stem + ".pdf")).resolve()
    if output.suffix.lower() != ".pdf":
        parser.error("--output måste sluta med .pdf")
    node = shutil.which("node")
    if not node:
        parser.error("Node.js saknas i PATH. Aktivera Node.js och kör pnpm install först.")
    tsx = ROOT / "node_modules" / "tsx" / "dist" / "cli.mjs"
    if not tsx.exists():
        parser.error("Projektets beroenden saknas. Kör pnpm install först.")
    if args.png:
        try:
            import pypdfium2 as pdfium
        except ImportError:
            parser.error("PNG-export kräver pypdfium2. Kör python -m pip install -r requirements.txt.")
    result = subprocess.run([node, str(tsx), str(ROOT / "scripts" / "export.ts"), str(args.song.resolve()), str(output)], cwd=ROOT)
    if result.returncode:
        raise SystemExit(result.returncode)
    if args.png:
        document = pdfium.PdfDocument(output)
        try:
            for index in range(len(document)):
                page = document[index]
                bitmap = page.render(scale=2200 / page.get_height())
                target = output.with_suffix(".png") if index == 0 else output.with_name(f"{output.stem}-{index + 1}.png")
                bitmap.to_pil().save(target)
                bitmap.close()
                page.close()
                print(target)
        finally:
            document.close()


if __name__ == "__main__":
    main()
