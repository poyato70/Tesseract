import type { ToolDescriptor } from "./connections.js";

export const advisorListTool = /^(?:azmcp_)?advisor_recommendation_list$/;
export const advisorSubscriptionId =
  /^[0-9a-fA-F]{8}(?:-[0-9a-fA-F]{4}){3}-[0-9a-fA-F]{12}$/;

type ObjectSchema = {
  type?: string;
  properties?: Record<string, ObjectSchema>;
  required?: string[];
};

function subscriptionArguments(schema: ObjectSchema, subscription: string) {
  if (schema.type !== "object" || !schema.properties) return;
  const properties = schema.properties;
  const scopeKeys = Object.keys(properties).filter(
    (key) =>
      /^subscription(?:[-_]?id)?$/i.test(key) &&
      properties[key]?.type === "string",
  );
  const required = Array.isArray(schema.required) ? schema.required : [];
  const scopeKey =
    scopeKeys.find((key) => required.includes(key)) ?? scopeKeys[0];
  if (!scopeKey || required.some((key) => key !== scopeKey)) return;
  return { [scopeKey]: subscription };
}

export function advisorListArguments(
  tool: ToolDescriptor,
  subscription: string,
) {
  if (
    !advisorListTool.test(tool.name) ||
    !advisorSubscriptionId.test(subscription) ||
    tool.annotations?.destructiveHint === true ||
    tool.annotations?.readOnlyHint === false
  )
    return;
  const schema = tool.inputSchema as ObjectSchema;
  const direct = subscriptionArguments(schema, subscription);
  if (direct) return direct;
  const request = schema.properties?.request;
  if (
    schema.type !== "object" ||
    !request ||
    (Array.isArray(schema.required) &&
      schema.required.some((key) => key !== "request"))
  )
    return;
  const nested = subscriptionArguments(request, subscription);
  if (nested) return { request: nested };
}
