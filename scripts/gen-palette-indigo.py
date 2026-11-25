#!/usr/bin/env python3
"""
Gera src/web/styles-palette-indigo.css: tema alternativo 60/30/10
(Índigo Noturno #1C1747 · Pêssego Claro #FFD2B3 · Ciano Elétrico #00D2FF).

Lê as folhas de estilo da aplicação na ordem de carga e reescreve, sob
html[data-palette="indigo"], somente as declarações que usam cores neutras
(superfícies escuras, textos claros) ou o ciano de destaque. Cores de estado
(laranja executando, verde sucesso, vermelho falha, âmbar aviso) ficam iguais:
elas não fazem parte do 60/30/10.

Uso: python3 scripts/gen-palette-indigo.py   (requer: pip install tinycss2)
"""
import colorsys
import re
import sys
from pathlib import Path

import tinycss2

ROOT = Path(__file__).resolve().parent.parent
SOURCES = [
    "src/web/styles.css",
    "src/web/styles-mission09.css",
    "src/web/styles-neumorphic.css",
    "app/theme.css",
    "src/web/styles-rebuild.css",
    "src/web/styles-v2.css",
]
OUT = ROOT / "src/web/styles-palette-indigo.css"
SCOPE = 'html[data-palette="indigo"]'
# :where() não soma especificidade: a regra reescrita empata com a original e, por vir
# depois na ordem de carga, vence só ela — sem passar à frente de regras mais específicas.
W = ':where([data-palette="indigo"])'

INDIGO_H = 246 / 360  # #1C1747
PEACH_H = 24 / 360  # #FFD2B3

# Destaque: ciano atual e variações -> Ciano Elétrico.
ACCENT = {
    "22d0e2": "00d2ff",
    "35dff0": "33dcff",
    "16b8cc": "00a9d9",
    "8deef8": "8fe9ff",
    "8ef3fb": "99ecff",
    "27d0dd": "00d2ff",
    "04262b": "0d0a33",  # texto sobre o ciano
}
ACCENT_RGB = {(34, 208, 226): (0, 210, 255)}


def hex_rgb(h):
    h = h.lower()
    if len(h) == 3:
        h = "".join(c * 2 for c in h)
    return tuple(int(h[i : i + 2], 16) for i in (0, 2, 4))


def rgb_hex(r, g, b):
    return "%02x%02x%02x" % (round(r), round(g), round(b))


def map_rgb(r, g, b):
    """Neutros escuros -> escala índigo; neutros claros -> escala pêssego."""
    h, l, s = colorsys.rgb_to_hls(r / 255, g / 255, b / 255)
    chroma = max(r, g, b) - min(r, g, b)
    if chroma > 48 and l >= 0.12:
        return None  # cor saturada (estado, marca): mantém
    if l < 0.30:
        # 60%: fundos. #14161b (L 9%) -> #1C1747 (L 18%); superfícies mais claras sobem junto.
        nl = min(0.36, 0.05 + l * 1.45)
        ns = max(0.3, 0.5 - max(0.0, nl - 0.2) * 1.2)
        nr, ng, nb = colorsys.hls_to_rgb(INDIGO_H, nl, ns)
        return (nr * 255, ng * 255, nb * 255)
    if l > 0.55:
        # 30%: textos e superfícies claras em tons de pêssego.
        nl = 0.80 + (l - 0.55) * 0.42
        ns = 1.0 if l > 0.86 else 0.55
        nr, ng, nb = colorsys.hls_to_rgb(PEACH_H, min(nl, 0.96), ns)
        return (nr * 255, ng * 255, nb * 255)
    # meios-tons (bordas, textos esmaecidos): leve tom índigo-lavanda
    nr, ng, nb = colorsys.hls_to_rgb(INDIGO_H, min(0.78, l + 0.08), 0.22)
    return (nr * 255, ng * 255, nb * 255)


HEX_RE = re.compile(r"#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b")
RGBA_RE = re.compile(r"rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(,\s*[\d.]+\s*)?\)")


def recolor(value: str) -> str:
    def hx(m):
        raw = m.group(1).lower()
        full = "".join(c * 2 for c in raw) if len(raw) == 3 else raw
        if full in ACCENT:
            return "#" + ACCENT[full]
        mapped = map_rgb(*hex_rgb(full))
        return "#" + rgb_hex(*mapped) if mapped else m.group(0)

    def rg(m):
        r, g, b = int(m.group(1)), int(m.group(2)), int(m.group(3))
        alpha = m.group(4) or ""
        if (r, g, b) in ACCENT_RGB:
            r, g, b = ACCENT_RGB[(r, g, b)]
        elif (r, g, b) in ((255, 255, 255), (0, 0, 0)):
            # brilho/sombra neumórficos: sombra ganha fundo índigo profundo
            if (r, g, b) == (0, 0, 0):
                r, g, b = 6, 4, 26
            else:
                return m.group(0)
        else:
            mapped = map_rgb(r, g, b)
            if not mapped:
                return m.group(0)
            r, g, b = (round(x) for x in mapped)
        fn = "rgba" if alpha else "rgb"
        return f"{fn}({r}, {g}, {b}{alpha})"

    return RGBA_RE.sub(rg, HEX_RE.sub(hx, value))


COLOR_PROPS = re.compile(
    r"^(--.*|color|background(-color|-image)?|border(-(top|right|bottom|left))?(-color)?|"
    r"box-shadow|text-shadow|outline(-color)?|fill|stroke|caret-color|accent-color|"
    r"text-decoration-color|column-rule-color|scrollbar-color)$"
)


def color_prop(name: str) -> bool:
    return bool(COLOR_PROPS.match(name.lower()))


def scope_selector(sel: str) -> str:
    out = []
    for part in sel.split(","):
        p = part.strip()
        if not p:
            continue
        if p.startswith(":root"):
            out.append(":root" + W + p[5:])
        elif re.match(r"html(?![\w-])", p):
            out.append("html" + W + p[4:])
        else:
            out.append(f":where(html[data-palette=\"indigo\"]) {p}")
    return ",\n".join(out)


def process(rules, depth=0):
    chunks = []
    for rule in rules:
        if rule.type == "qualified-rule":
            selector = tinycss2.serialize(rule.prelude).strip()
            if selector.startswith("@") or "from" == selector or "to" == selector or re.fullmatch(r"[\d.%,\s]+", selector):
                continue
            decls = tinycss2.parse_declaration_list(rule.content, skip_comments=True, skip_whitespace=True)
            changed = []
            if any(d.type == "declaration" and d.name == "all" for d in decls):
                # `all: unset` zera também as cores herdadas de regras anteriores reescritas
                changed += [f"  {n}: unset;" for n in ("background", "border", "color", "box-shadow", "outline", "text-shadow")]
            for d in decls:
                if d.type != "declaration":
                    continue
                value = tinycss2.serialize(d.value).strip()
                new = recolor(value)
                # Para preservar a cascata, toda declaração de propriedade de cor é
                # reemitida (mesmo inalterada): o escopo soma a mesma especificidade a
                # todas, então a ordem relativa das folhas originais continua valendo.
                if new != value or color_prop(d.name):
                    imp = " !important" if d.important else ""
                    changed.append(f"  {d.name}: {new}{imp};")
            if changed:
                chunks.append(scope_selector(selector) + " {\n" + "\n".join(changed) + "\n}")
        elif rule.type == "at-rule" and rule.lower_at_keyword in ("media", "supports") and rule.content:
            inner = process(tinycss2.parse_rule_list(rule.content, skip_comments=True, skip_whitespace=True), depth + 1)
            if inner:
                prelude = tinycss2.serialize(rule.prelude).strip()
                body = "\n".join("  " + line for line in "\n".join(inner).splitlines())
                chunks.append(f"@{rule.at_keyword} {prelude} {{\n{body}\n}}")
    return chunks


def main():
    parts = [
        "/* GERADO por scripts/gen-palette-indigo.py — não editar à mão.",
        "   Tema alternativo 60/30/10: Índigo Noturno #1C1747 (60%) · Pêssego Claro #FFD2B3 (30%)",
        "   · Ciano Elétrico #00D2FF (10%). Ativo com html[data-palette=\"indigo\"]. */",
    ]
    for src in SOURCES:
        text = (ROOT / src).read_text(encoding="utf-8")
        rules = tinycss2.parse_stylesheet(text, skip_comments=True, skip_whitespace=True)
        chunk = process(rules)
        if chunk:
            parts.append(f"\n/* ---- de {src} ---- */")
            parts.extend(chunk)
    # tokens finais (ajuste fino; vence o que foi derivado acima)
    parts.append(
        f"""
/* ---- tokens 60/30/10 ---- */
{SCOPE} {{
  --lx-bg: #1c1747;
  --lx-bg-2: #211b52;
  --lx-panel: #241d58;
  --lx-panel-2: #2a2263;
  --lx-line: rgba(255, 210, 179, 0.09);
  --lx-line-strong: rgba(255, 210, 179, 0.18);
  --lx-text: #fff1e6;
  --lx-heading: #ffd2b3;
  --lx-muted: #d2b9b0;
  --lx-faint: #9b8ea8;
  --lx-cyan: #00d2ff;
  --primary: #00d2ff;
  --primary-text: #8fe9ff;
  --nm-out: 7px 7px 16px rgba(6, 4, 26, 0.6), -6px -6px 14px rgba(255, 210, 179, 0.035);
  --nm-out-sm: 4px 4px 10px rgba(6, 4, 26, 0.55), -3px -3px 8px rgba(255, 210, 179, 0.035);
  --nm-in: inset 4px 4px 10px rgba(6, 4, 26, 0.6), inset -3px -3px 8px rgba(255, 210, 179, 0.04);
  --glass-bg: linear-gradient(180deg, rgba(255, 210, 179, 0.09), rgba(255, 210, 179, 0.025));
  --glass-line: rgba(255, 210, 179, 0.16);
}}
:where(html[data-palette="indigo"]) :is(h1, h2, h3, .lx-page-title, .op-head h1, .idt-title h1) {{
  color: var(--lx-heading);
}}
"""
    )
    OUT.write_text("\n".join(parts) + "\n", encoding="utf-8")
    print(f"{OUT.relative_to(ROOT)}: {OUT.stat().st_size} bytes")


if __name__ == "__main__":
    sys.exit(main())
