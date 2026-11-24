import { describe, expect, it } from "vitest";
import { createVerify, generateKeyPairSync } from "node:crypto";
import { parseServiceAccount, signedAssertion } from "../../src/server/mcp/google-token.js";

const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const sa = { type: "service_account", client_email: "finops@proj.iam.gserviceaccount.com", private_key: privateKey.export({ type: "pkcs8", format: "pem" }).toString() };

describe("conta de serviço Google", () => {
  it("assina o JWT bearer com escopo, audiência e validade de 1 h", () => {
    const jwt = signedAssertion(parseServiceAccount(JSON.stringify(sa)), "https://www.googleapis.com/auth/bigquery", 1000);
    const [h, b, sig] = jwt.split(".");
    const body = JSON.parse(Buffer.from(b, "base64url").toString());
    expect(body).toEqual({ iss: sa.client_email, scope: "https://www.googleapis.com/auth/bigquery", aud: "https://oauth2.googleapis.com/token", iat: 1000, exp: 4600 });
    const v = createVerify("RSA-SHA256");
    v.update(`${h}.${b}`);
    expect(v.verify(publicKey, Buffer.from(sig, "base64url"))).toBe(true);
  });

  it("recusa JSON que não é conta de serviço ou com token_uri estranho", () => {
    expect(() => parseServiceAccount("{}")).toThrow(/conta de serviço/);
    expect(() => parseServiceAccount("nao-json")).toThrow(/JSON/);
    expect(() => parseServiceAccount(JSON.stringify({ ...sa, token_uri: "https://evil.example.com/token" }))).toThrow(/token_uri/);
  });
});
