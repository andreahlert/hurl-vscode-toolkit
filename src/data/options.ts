export interface OptionInfo {
  name: string;
  description: string;
  valueType: "integer" | "boolean" | "string" | "none";
}

export const OPTIONS: OptionInfo[] = [
  { name: "aws-sigv4", description: "Signs the request using AWS Signature Version 4. Value format: provider1[:provider2[:region[:service]]].", valueType: "string" },
  { name: "compressed", description: "Requests a compressed response and automatically decompresses it.", valueType: "boolean" },
  { name: "connect-to", description: "Connects to a different host:port pair instead of the URL target. Format: HOST1:PORT1:HOST2:PORT2.", valueType: "string" },
  { name: "delay", description: "Adds a delay in milliseconds before sending the request.", valueType: "integer" },
  { name: "http1.0", description: "Forces the use of HTTP/1.0.", valueType: "boolean" },
  { name: "http1.1", description: "Forces the use of HTTP/1.1.", valueType: "boolean" },
  { name: "http2", description: "Forces the use of HTTP/2.", valueType: "boolean" },
  { name: "http3", description: "Forces the use of HTTP/3.", valueType: "boolean" },
  { name: "insecure", description: "Allows insecure SSL connections (skips certificate verification).", valueType: "boolean" },
  { name: "ipv4", description: "Forces name resolution to IPv4 addresses only.", valueType: "boolean" },
  { name: "ipv6", description: "Forces name resolution to IPv6 addresses only.", valueType: "boolean" },
  { name: "location", description: "Follows HTTP redirects (3xx responses).", valueType: "boolean" },
  { name: "max-redirs", description: "Sets the maximum number of redirects to follow. Default is 50.", valueType: "integer" },
  { name: "output", description: "Writes the response body to the specified file instead of stdout.", valueType: "string" },
  { name: "proxy", description: "Uses the specified proxy. Format: [protocol://]host[:port].", valueType: "string" },
  { name: "resolve", description: "Provides a custom address for a specific host and port. Format: HOST:PORT:ADDRESS.", valueType: "string" },
  { name: "retry", description: "Sets the maximum number of retries for the request. Use -1 for infinite retries.", valueType: "integer" },
  { name: "retry-interval", description: "Sets the interval in milliseconds between retries. Default is 1000.", valueType: "integer" },
  { name: "skip", description: "Skips this request entry during execution.", valueType: "boolean" },
  { name: "ssl-no-revoke", description: "Disables certificate revocation checks (Windows only).", valueType: "boolean" },
  { name: "unix-socket", description: "Connects through a Unix domain socket instead of TCP.", valueType: "string" },
  { name: "verbose", description: "Enables verbose output for this request.", valueType: "boolean" },
  { name: "very-verbose", description: "Enables very verbose output including response body for this request.", valueType: "boolean" },
];
