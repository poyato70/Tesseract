import { isIndependentPreset, nativePreset } from "../../shared/mcp-catalog.js";
import { describeMcp } from "../../shared/mcp-info.js";
export function McpDetails({ profile }: { profile: any }) {
  return (
    <dl className="mcp-details">
      {describeMcp(profile).map(([key, value]) => (
        <div key={key}>
          <dt>{key}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}
export function McpIdentity({
  profile,
  accesses,
  activeAccessId,
  principalKind,
  onConnect,
  loginPending = false,
  compact = false,
  onAccesses,
}: {
  profile: any;
  accesses: any[];
  activeAccessId?: string;
  principalKind?: string;
  onConnect?: (profile: any) => void;
  loginPending?: boolean;
  compact?: boolean;
  onAccesses?: () => void;
}) {
  if (isIndependentPreset(profile.preset))
    return (
      <p className="fine">
        Esta conexão usa a autenticação do endpoint MCP; não depende de
        identidade Azure.
      </p>
    );
  const access = accesses.find((a) => a.id === profile.accessId);
  const ready =
    !!access &&
    activeAccessId === access.id &&
    (profile.authMode === "application"
      ? principalKind === "application"
      : principalKind === "user");
  return (
    <div className="identity-context">
      <strong>{compact ? "Acesso" : "Identidade Azure"}: {access?.name || "Nenhum selecionado"}</strong>
      {!compact && <p className="fine">
        É o cadastro em Acessos que contém Tenant ID, Client ID e, no modo
        aplicação, a credencial protegida. Conectar esta identidade não testa as
        tools do MCP.
      </p>}
      <p>
        {ready
          ? (compact ? "Ativo nesta sessão. Esta é a identidade usada nas consultas." : "Identidade conectada nesta sessão.")
          : (compact ? "Conecte este acesso para consultar o Azure." : "Conecte a identidade selecionada antes de testar este MCP.")}
      </p>
      {compact && onAccesses && <button type="button" onClick={onAccesses}>Abrir Acessos</button>}
      {ready &&
        access &&
        profile.transport === "http" &&
        profile.authMode === "delegated" && (
          <button
            disabled={loginPending}
            aria-busy={loginPending}
            onClick={() => onConnect?.(profile)}
          >
            {loginPending ? "Aguardando autorização…" : "Autorizar recurso MCP"}
          </button>
        )}
      {!ready && access && (
        <button
          disabled={loginPending}
          aria-busy={loginPending}
          onClick={() => onConnect?.(profile)}
        >
          {loginPending ? "Aguardando login…" : `Conectar identidade ${access.name}`}
        </button>
      )}
    </div>
  );
}
