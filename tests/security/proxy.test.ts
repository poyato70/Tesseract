import { afterEach, describe, expect, it } from "vitest";
import { createServer, request as httpRequest } from "node:http";
import { connect } from "node:net";
import { fetchBound, proxyFor, validateEndpoint } from "../../src/server/security/endpoint-policy.js";

const saved = { ...process.env };
afterEach(() => {
  for (const k of ["HTTPS_PROXY", "https_proxy", "HTTP_PROXY", "http_proxy", "NO_PROXY", "no_proxy", "TESSERACT_PROXY"]) delete process.env[k];
  Object.assign(process.env, saved);
});

describe("proxy corporativo", () => {
  it("escolhe o proxy por esquema e respeita NO_PROXY e loopback", () => {
    const env: any = { HTTPS_PROXY: "http://proxy.bb:8080", NO_PROXY: ".intranet.bb.com.br,localhost" };
    expect(proxyFor(new URL("https://api.githubcopilot.com/mcp/"), env)).toBe("http://proxy.bb:8080/");
    expect(proxyFor(new URL("https://mcp.intranet.bb.com.br/mcp"), env)).toBeUndefined();
    expect(proxyFor(new URL("https://intranet.bb.com.br/mcp"), env)).toBeUndefined();
    expect(proxyFor(new URL("http://127.0.0.1:4510/mcp"), env)).toBeUndefined();
    expect(proxyFor(new URL("https://10.1.2.3/mcp"), env)).toBeUndefined();
    expect(proxyFor(new URL("https://x.com"), { ...env, TESSERACT_PROXY: "off" })).toBeUndefined();
  });

  it("aceita falha de DNS local quando há proxy, mas continua recusando destino privado resolvido", async () => {
    for (const k of ["HTTPS_PROXY", "https_proxy", "HTTP_PROXY", "http_proxy", "NO_PROXY", "no_proxy"]) delete process.env[k];
    process.env.HTTPS_PROXY = "http://proxy.bb:8080";
    const fail = async () => {
      throw Object.assign(new Error("ENOTFOUND"), { code: "ENOTFOUND" });
    };
    const ok = await validateEndpoint("https://api.githubcopilot.com/mcp/", false, fail as any);
    expect(ok.proxy).toBe("http://proxy.bb:8080/");
    await expect(
      validateEndpoint("https://interno.exemplo.com/mcp", false, (async () => [{ address: "10.0.0.5", family: 4 }]) as any),
    ).rejects.toMatchObject({ code: "invalid_endpoint" });
    delete process.env.HTTPS_PROXY;
    await expect(validateEndpoint("https://api.githubcopilot.com/mcp/", false, fail as any)).rejects.toThrow();
  });

  it("envia a chamada pelo túnel CONNECT do proxy", async () => {
    const target = createServer((_req, res) => res.end("via-proxy"));
    await new Promise<void>((r) => target.listen(0, "127.0.0.1", r));
    const tport = (target.address() as any).port;
    const tunnels: string[] = [];
    const proxy = createServer();
    proxy.on("connect", (req, socket, head) => {
      tunnels.push(req.url!);
      // o proxy de teste resolve o nome público para o alvo local
      const up = connect(tport, "127.0.0.1", () => {
        socket.write("HTTP/1.1 200 Connection Established\r\n\r\n");
        up.write(head);
        up.pipe(socket);
        socket.pipe(up);
      });
    });
    await new Promise<void>((r) => proxy.listen(0, "127.0.0.1", r));
    process.env.HTTP_PROXY = `http://127.0.0.1:${(proxy.address() as any).port}`;
    try {
      // host público fictício: DNS local não resolve, o proxy resolve
      const r = await fetchBound(`http://mcp.exemplo-publico.test:${tport}/mcp`, {}, false, true);
      expect(await r.text()).toBe("via-proxy");
      expect(tunnels).toEqual([`mcp.exemplo-publico.test:${tport}`]);
    } finally {
      target.close();
      proxy.close();
    }
  });
});
void httpRequest;
