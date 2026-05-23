export interface OptionInfo {
  name: string;
  description: string;
  valueType: "integer" | "boolean" | "string" | "duration" | "none";
}

export const OPTIONS: OptionInfo[] = [
  { name: "aws-sigv4", description: "Signs the request using AWS Signature Version 4. Value format: provider1[:provider2[:region[:service]]].", valueType: "string" },
  { name: "cacert", description: "Uses the specified CA certificate file to verify peer.", valueType: "string" },
  { name: "cert", description: "Uses the specified client certificate file.", valueType: "string" },
  { name: "compressed", description: "Requests a compressed response and automatically decompresses it.", valueType: "boolean" },
  { name: "connect-timeout", description: "Maximum time allowed for connection phase.", valueType: "duration" },
  { name: "connect-to", description: "Connects to a different host:port pair instead of the URL target. Format: HOST1:PORT1:HOST2:PORT2.", valueType: "string" },
  { name: "delay", description: "Adds a delay before sending the request.", valueType: "duration" },
  { name: "http1.0", description: "Forces the use of HTTP/1.0.", valueType: "boolean" },
  { name: "http1.1", description: "Forces the use of HTTP/1.1.", valueType: "boolean" },
  { name: "http2", description: "Forces the use of HTTP/2.", valueType: "boolean" },
  { name: "http3", description: "Forces the use of HTTP/3.", valueType: "boolean" },
  { name: "insecure", description: "Allows insecure SSL connections (skips certificate verification).", valueType: "boolean" },
  { name: "ipv4", description: "Forces name resolution to IPv4 addresses only.", valueType: "boolean" },
  { name: "ipv6", description: "Forces name resolution to IPv6 addresses only.", valueType: "boolean" },
  { name: "key", description: "Uses the specified private key file for client certificate.", valueType: "string" },
  { name: "limit-rate", description: "Limits transfer speed in bytes per second.", valueType: "integer" },
  { name: "location", description: "Follows HTTP redirects (3xx responses).", valueType: "boolean" },
  { name: "max-redirs", description: "Sets the maximum number of redirects to follow. Default is 50.", valueType: "integer" },
  { name: "max-time", description: "Maximum allowed time for the full request.", valueType: "duration" },
  { name: "output", description: "Writes the response body to the specified file instead of stdout.", valueType: "string" },
  { name: "path-as-is", description: "Do not normalize /./ and /../ URL path segments.", valueType: "boolean" },
  { name: "proxy", description: "Uses the specified proxy. Format: [protocol://]host[:port].", valueType: "string" },
  { name: "resolve", description: "Provides a custom address for a specific host and port. Format: HOST:PORT:ADDRESS.", valueType: "string" },
  { name: "retry", description: "Sets the maximum number of retries for the request. Use -1 for infinite retries.", valueType: "integer" },
  { name: "retry-interval", description: "Sets wait time between retries.", valueType: "duration" },
  { name: "skip", description: "Skips this request entry during execution.", valueType: "boolean" },
  { name: "ssl-no-revoke", description: "Disables certificate revocation checks (Windows only).", valueType: "boolean" },
  { name: "unix-socket", description: "Connects through a Unix domain socket instead of TCP.", valueType: "string" },
  { name: "user", description: "Sets basic auth credentials in user:password format.", valueType: "string" },
  { name: "variable", description: "Defines a template variable available to this and subsequent entries. Format: variable: name=value", valueType: "string" },
  { name: "verbose", description: "Enables verbose output for this request.", valueType: "boolean" },
  { name: "very-verbose", description: "Enables very verbose output including response body for this request.", valueType: "boolean" },
];
