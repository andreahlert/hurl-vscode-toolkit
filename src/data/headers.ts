export interface HeaderInfo {
  name: string;
  description: string;
  values?: string[];
}

export const COMMON_HEADERS: HeaderInfo[] = [
  {
    name: "Accept",
    description: "Media types acceptable for the response.",
    values: [
      "application/json",
      "text/html",
      "text/plain",
      "application/xml",
      "application/octet-stream",
      "*/*",
    ],
  },
  {
    name: "Accept-Charset",
    description: "Character sets acceptable for the response.",
    values: ["utf-8", "iso-8859-1", "ascii"],
  },
  {
    name: "Accept-Encoding",
    description: "Acceptable encodings for the response.",
    values: ["gzip", "deflate", "br", "identity", "*"],
  },
  {
    name: "Accept-Language",
    description: "Acceptable languages for the response.",
    values: ["en-US", "en", "pt-BR", "fr", "de", "es", "*"],
  },
  {
    name: "Authorization",
    description: "Credentials for authenticating the client with the server.",
    values: ["Bearer ", "Basic ", "Digest ", "OAuth "],
  },
  {
    name: "Cache-Control",
    description: "Directives for caching mechanisms.",
    values: [
      "no-cache",
      "no-store",
      "max-age=0",
      "max-age=3600",
      "must-revalidate",
      "public",
      "private",
    ],
  },
  {
    name: "Connection",
    description: "Control options for the current connection.",
    values: ["keep-alive", "close"],
  },
  {
    name: "Content-Disposition",
    description: "Indicates if the content should be displayed inline or as an attachment.",
    values: ["inline", "attachment", "form-data"],
  },
  {
    name: "Content-Encoding",
    description: "The encoding used on the data.",
    values: ["gzip", "deflate", "br", "identity"],
  },
  {
    name: "Content-Language",
    description: "The natural language of the intended audience.",
    values: ["en", "en-US", "pt-BR", "fr", "de", "es"],
  },
  {
    name: "Content-Length",
    description: "The length of the request body in bytes.",
  },
  {
    name: "Content-Type",
    description: "The media type of the body of the request.",
    values: [
      "application/json",
      "application/json; charset=utf-8",
      "application/x-www-form-urlencoded",
      "application/xml",
      "application/octet-stream",
      "application/pdf",
      "application/javascript",
      "application/graphql",
      "multipart/form-data",
      "text/html",
      "text/html; charset=utf-8",
      "text/plain",
      "text/plain; charset=utf-8",
      "text/css",
      "text/csv",
      "text/xml",
      "image/png",
      "image/jpeg",
      "image/gif",
      "image/svg+xml",
      "image/webp",
    ],
  },
  {
    name: "Cookie",
    description: "HTTP cookies previously sent by the server.",
  },
  {
    name: "Date",
    description: "The date and time at which the message was originated.",
  },
  {
    name: "ETag",
    description: "An identifier for a specific version of a resource.",
  },
  {
    name: "Expect",
    description: "Indicates expectations that need to be fulfilled by the server.",
    values: ["100-continue"],
  },
  {
    name: "Forwarded",
    description: "Discloses information from client-facing side of proxy servers.",
  },
  {
    name: "From",
    description: "The email address of the user making the request.",
  },
  {
    name: "Host",
    description: "The domain name of the server and the TCP port number.",
  },
  {
    name: "If-Match",
    description: "Makes the request conditional on matching ETags.",
  },
  {
    name: "If-Modified-Since",
    description: "Allows a 304 Not Modified if content is unchanged.",
  },
  {
    name: "If-None-Match",
    description: "Makes the request conditional on not matching ETags.",
  },
  {
    name: "If-Range",
    description: "If the entity is unchanged, send the missing parts; otherwise, send the entire resource.",
  },
  {
    name: "If-Unmodified-Since",
    description: "Makes the request conditional on the resource not having been modified.",
  },
  {
    name: "Max-Forwards",
    description: "Limits the number of times the message can be forwarded.",
  },
  {
    name: "Origin",
    description: "Indicates where the request originated from (scheme, host, port).",
  },
  {
    name: "Pragma",
    description: "Implementation-specific headers with various effects.",
    values: ["no-cache"],
  },
  {
    name: "Proxy-Authorization",
    description: "Credentials for connecting to a proxy.",
  },
  {
    name: "Range",
    description: "Request only part of an entity. Bytes are numbered from 0.",
  },
  {
    name: "Referer",
    description: "The address of the previous page that linked to the current request.",
  },
  {
    name: "TE",
    description: "Transfer encodings the client is willing to accept.",
  },
  {
    name: "Upgrade",
    description: "Ask the server to upgrade to another protocol.",
    values: ["websocket", "h2c"],
  },
  {
    name: "User-Agent",
    description: "The user agent string of the client.",
    values: [
      "Mozilla/5.0",
      "curl/8.0",
      "hurl/4.0",
    ],
  },
  {
    name: "Via",
    description: "Informs the server of proxies through which the request was sent.",
  },
  {
    name: "Warning",
    description: "General warning about possible problems with the entity body.",
  },
  {
    name: "X-Forwarded-For",
    description: "Identifies the originating IP address of a client connecting through a proxy.",
  },
  {
    name: "X-Forwarded-Host",
    description: "Identifies the original host requested by the client.",
  },
  {
    name: "X-Forwarded-Proto",
    description: "Identifies the protocol (HTTP or HTTPS) of the original request.",
    values: ["http", "https"],
  },
  {
    name: "X-Request-ID",
    description: "Correlates HTTP requests between a client and server.",
  },
  {
    name: "X-Requested-With",
    description: "Used to identify Ajax requests.",
    values: ["XMLHttpRequest"],
  },
];
