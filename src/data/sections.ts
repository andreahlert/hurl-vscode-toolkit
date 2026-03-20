export interface SectionInfo {
  name: string;
  description: string;
  context: "request" | "response" | "both";
}

export const SECTIONS: SectionInfo[] = [
  {
    name: "QueryStringParams",
    description:
      "Defines query string parameters appended to the URL. Each parameter is a key-value pair on its own line.",
    context: "request",
  },
  {
    name: "FormParams",
    description:
      "Defines form parameters for application/x-www-form-urlencoded content type. Each parameter is a key-value pair.",
    context: "request",
  },
  {
    name: "MultipartFormData",
    description:
      "Defines multipart form data for file uploads and mixed content. Supports file references with `file,path; content-type`.",
    context: "request",
  },
  {
    name: "Cookies",
    description:
      "Defines cookies to send with the request, or assert response cookies in the response section.",
    context: "both",
  },
  {
    name: "Options",
    description:
      "Sets per-request options such as retry, delay, location following, verbosity, and more. Overrides CLI options for this entry.",
    context: "request",
  },
  {
    name: "Asserts",
    description:
      "Defines assertions to validate the HTTP response. Supports status, header, body, jsonpath, xpath, regex, cookie, and other queries with predicates.",
    context: "response",
  },
  {
    name: "Captures",
    description:
      "Captures values from the HTTP response into variables for use in subsequent requests. Supports jsonpath, xpath, header, cookie, body, and regex queries.",
    context: "response",
  },
  {
    name: "BasicAuth",
    description:
      "Provides Basic Authentication credentials as username and password on separate lines.",
    context: "request",
  },
];

export const SECTION_NAMES = SECTIONS.map((s) => s.name);
