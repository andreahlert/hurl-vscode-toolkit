export interface HttpMethod {
  name: string;
  description: string;
}

export const HTTP_METHODS: HttpMethod[] = [
  {
    name: "GET",
    description:
      "Requests a representation of the specified resource. GET requests should only retrieve data and have no other effect.",
  },
  {
    name: "POST",
    description:
      "Submits data to be processed to the specified resource. Often used to create new resources or trigger actions.",
  },
  {
    name: "PUT",
    description:
      "Replaces all current representations of the target resource with the request payload.",
  },
  {
    name: "PATCH",
    description:
      "Applies partial modifications to a resource. Unlike PUT, PATCH is not idempotent by default.",
  },
  {
    name: "DELETE",
    description:
      "Deletes the specified resource.",
  },
  {
    name: "HEAD",
    description:
      "Same as GET, but the server does not return a message body. Useful for checking resource metadata.",
  },
  {
    name: "OPTIONS",
    description:
      "Describes the communication options for the target resource. Used in CORS preflight requests.",
  },
  {
    name: "CONNECT",
    description:
      "Establishes a tunnel to the server identified by the target resource. Used for HTTPS through an HTTP proxy.",
  },
  {
    name: "TRACE",
    description:
      "Performs a message loop-back test along the path to the target resource, useful for debugging.",
  },
];

export const METHOD_NAMES = HTTP_METHODS.map((m) => m.name);
