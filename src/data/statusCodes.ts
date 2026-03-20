export interface StatusCode {
  code: number;
  phrase: string;
  description: string;
}

export const STATUS_CODES: StatusCode[] = [
  // 1xx Informational
  { code: 100, phrase: "Continue", description: "The server has received the request headers and the client should proceed to send the request body." },
  { code: 101, phrase: "Switching Protocols", description: "The server is switching protocols as requested by the client." },
  { code: 102, phrase: "Processing", description: "The server has received and is processing the request, but no response is available yet." },
  { code: 103, phrase: "Early Hints", description: "Used to return some response headers before the final HTTP message." },

  // 2xx Success
  { code: 200, phrase: "OK", description: "The request succeeded. The meaning depends on the HTTP method used." },
  { code: 201, phrase: "Created", description: "The request succeeded and a new resource was created as a result." },
  { code: 202, phrase: "Accepted", description: "The request has been received but not yet acted upon." },
  { code: 203, phrase: "Non-Authoritative Information", description: "The returned metadata is from a local or third-party copy, not the origin server." },
  { code: 204, phrase: "No Content", description: "The request succeeded but there is no content to send in the response." },
  { code: 205, phrase: "Reset Content", description: "The server fulfilled the request and asks the client to reset the document view." },
  { code: 206, phrase: "Partial Content", description: "The server is delivering only part of the resource due to a range header." },
  { code: 207, phrase: "Multi-Status", description: "Provides status for multiple independent operations (WebDAV)." },
  { code: 208, phrase: "Already Reported", description: "Used inside a DAV: propstat response to avoid enumerating internal members multiple times." },
  { code: 226, phrase: "IM Used", description: "The server has fulfilled a GET request, and the response represents the result of instance-manipulations." },

  // 3xx Redirection
  { code: 300, phrase: "Multiple Choices", description: "The request has more than one possible response." },
  { code: 301, phrase: "Moved Permanently", description: "The URL of the requested resource has been changed permanently." },
  { code: 302, phrase: "Found", description: "The URI of the resource has been changed temporarily." },
  { code: 303, phrase: "See Other", description: "The server sent this response to direct the client to get the requested resource at another URI with a GET request." },
  { code: 304, phrase: "Not Modified", description: "The response has not been modified since the last request. Client can use cached version." },
  { code: 305, phrase: "Use Proxy", description: "The requested resource must be accessed through the proxy given in the Location header." },
  { code: 307, phrase: "Temporary Redirect", description: "The server sends this response to direct the client to get the resource at another URI with the same method." },
  { code: 308, phrase: "Permanent Redirect", description: "The resource is now permanently located at another URI, specified by the Location header." },

  // 4xx Client Error
  { code: 400, phrase: "Bad Request", description: "The server cannot process the request due to something perceived to be a client error." },
  { code: 401, phrase: "Unauthorized", description: "The client must authenticate itself to get the requested response." },
  { code: 402, phrase: "Payment Required", description: "Reserved for future use. Originally intended for digital payment systems." },
  { code: 403, phrase: "Forbidden", description: "The client does not have access rights to the content." },
  { code: 404, phrase: "Not Found", description: "The server cannot find the requested resource." },
  { code: 405, phrase: "Method Not Allowed", description: "The request method is known by the server but is not supported by the target resource." },
  { code: 406, phrase: "Not Acceptable", description: "The server cannot produce a response matching the list of acceptable values." },
  { code: 407, phrase: "Proxy Authentication Required", description: "Authentication is needed for the proxy." },
  { code: 408, phrase: "Request Timeout", description: "The server timed out waiting for the request." },
  { code: 409, phrase: "Conflict", description: "The request conflicts with the current state of the server." },
  { code: 410, phrase: "Gone", description: "The content has been permanently deleted from the server." },
  { code: 411, phrase: "Length Required", description: "The server rejected the request because the Content-Length header is not defined." },
  { code: 412, phrase: "Precondition Failed", description: "The client has indicated preconditions in its headers which the server does not meet." },
  { code: 413, phrase: "Payload Too Large", description: "The request entity is larger than limits defined by the server." },
  { code: 414, phrase: "URI Too Long", description: "The URI requested by the client is longer than the server is willing to interpret." },
  { code: 415, phrase: "Unsupported Media Type", description: "The media format of the requested data is not supported by the server." },
  { code: 416, phrase: "Range Not Satisfiable", description: "The range specified in the Range header cannot be fulfilled." },
  { code: 417, phrase: "Expectation Failed", description: "The expectation indicated by the Expect header cannot be met by the server." },
  { code: 418, phrase: "I'm a Teapot", description: "The server refuses to brew coffee because it is, permanently, a teapot (RFC 2324)." },
  { code: 421, phrase: "Misdirected Request", description: "The request was directed at a server that is not able to produce a response." },
  { code: 422, phrase: "Unprocessable Entity", description: "The request was well-formed but the server was unable to process the contained instructions." },
  { code: 423, phrase: "Locked", description: "The resource that is being accessed is locked." },
  { code: 424, phrase: "Failed Dependency", description: "The request failed because it depended on another request that failed." },
  { code: 425, phrase: "Too Early", description: "The server is unwilling to risk processing a request that might be replayed." },
  { code: 426, phrase: "Upgrade Required", description: "The server refuses to perform the request using the current protocol." },
  { code: 428, phrase: "Precondition Required", description: "The origin server requires the request to be conditional." },
  { code: 429, phrase: "Too Many Requests", description: "The user has sent too many requests in a given amount of time (rate limiting)." },
  { code: 431, phrase: "Request Header Fields Too Large", description: "The server is unwilling to process the request because its header fields are too large." },
  { code: 451, phrase: "Unavailable For Legal Reasons", description: "The user agent requested a resource that cannot be legally provided." },

  // 5xx Server Error
  { code: 500, phrase: "Internal Server Error", description: "The server has encountered a situation it does not know how to handle." },
  { code: 501, phrase: "Not Implemented", description: "The request method is not supported by the server and cannot be handled." },
  { code: 502, phrase: "Bad Gateway", description: "The server, while acting as a gateway, received an invalid response from the upstream server." },
  { code: 503, phrase: "Service Unavailable", description: "The server is not ready to handle the request, often due to maintenance or overloading." },
  { code: 504, phrase: "Gateway Timeout", description: "The server, while acting as a gateway, did not get a response in time from the upstream server." },
  { code: 505, phrase: "HTTP Version Not Supported", description: "The HTTP version used in the request is not supported by the server." },
  { code: 506, phrase: "Variant Also Negotiates", description: "The server has an internal configuration error in transparent content negotiation." },
  { code: 507, phrase: "Insufficient Storage", description: "The server is unable to store the representation needed to complete the request." },
  { code: 508, phrase: "Loop Detected", description: "The server detected an infinite loop while processing the request." },
  { code: 510, phrase: "Not Extended", description: "Further extensions to the request are required for the server to fulfill it." },
  { code: 511, phrase: "Network Authentication Required", description: "The client needs to authenticate to gain network access." },
];
