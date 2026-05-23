export interface AssertPredicate {
  name: string;
  description: string;
  example: string;
}

export const ASSERT_PREDICATES: AssertPredicate[] = [
  { name: "==", description: "Asserts the value equals the expected value.", example: 'jsonpath "$.count" == 5' },
  { name: "!=", description: "Asserts the value does not equal the expected value.", example: 'jsonpath "$.status" != "error"' },
  { name: ">", description: "Asserts the value is greater than the expected value.", example: 'duration > 100' },
  { name: ">=", description: "Asserts the value is greater than or equal to the expected value.", example: 'jsonpath "$.count" >= 1' },
  { name: "<", description: "Asserts the value is less than the expected value.", example: 'jsonpath "$.count" < 100' },
  { name: "<=", description: "Asserts the value is less than or equal to the expected value.", example: 'status <= 299' },
  { name: "startsWith", description: "Asserts string or bytes starts with the expected value.", example: 'header "Content-Type" startsWith "application/"' },
  { name: "endsWith", description: "Asserts string or bytes ends with the expected value.", example: 'jsonpath "$.email" endsWith "@example.com"' },
  { name: "contains", description: "Asserts a string/bytes contains a value or a collection contains an item.", example: 'body contains "success"' },
  { name: "matches", description: "Asserts the string value matches the expected regex.", example: 'jsonpath "$.date" matches /^\\d{4}-\\d{2}-\\d{2}$/' },
  { name: "exists", description: "Asserts the queried value exists.", example: 'xpath "//h1" exists' },
  { name: "isBoolean", description: "Asserts the value is a boolean.", example: 'jsonpath "$.active" isBoolean' },
  { name: "isEmpty", description: "Asserts the value is an empty list or object.", example: 'jsonpath "$.errors" isEmpty' },
  { name: "isFloat", description: "Asserts the value is a float.", example: 'jsonpath "$.price" isFloat' },
  { name: "isInteger", description: "Asserts the value is an integer.", example: 'jsonpath "$.count" isInteger' },
  { name: "isIpv4", description: "Asserts the value is a valid IPv4 address.", example: 'ip isIpv4' },
  { name: "isIpv6", description: "Asserts the value is a valid IPv6 address.", example: 'ip isIpv6' },
  { name: "isIsoDate", description: "Asserts the value is a RFC 3339 date/time string.", example: 'jsonpath "$.timestamp" isIsoDate' },
  { name: "isList", description: "Asserts the value is a list.", example: 'jsonpath "$.items" isList' },
  { name: "isNumber", description: "Asserts the value is a number (int or float).", example: 'jsonpath "$.total" isNumber' },
  { name: "isObject", description: "Asserts the value is an object.", example: 'jsonpath "$.book" isObject' },
  { name: "isString", description: "Asserts the value is a string.", example: 'jsonpath "$.name" isString' },
  { name: "isUuid", description: "Asserts the value is a UUID v4.", example: 'jsonpath "$.id" isUuid' },
  { name: "not", description: "Negates the next predicate.", example: 'header "Authorization" not exists' },
];

export interface FilterFunction {
  name: string;
  description: string;
  example: string;
  snippet?: string;
}

export const FILTER_FUNCTIONS: FilterFunction[] = [
  { name: "base64Decode", description: "Decodes a Base64 string into bytes.", example: 'jsonpath "$.token" base64Decode toHex == "3c3c3f3f3f3e3e"', snippet: 'base64Decode' },
  { name: "base64Encode", description: "Encodes bytes to a Base64 string.", example: 'bytes base64Encode == "PDw/Pz8+Pg=="', snippet: 'base64Encode' },
  { name: "base64UrlSafeDecode", description: "Decodes Base64 URL-safe string into bytes.", example: 'jsonpath "$.token" base64UrlSafeDecode toHex == "3c3c3f3f3f3e3e"', snippet: 'base64UrlSafeDecode' },
  { name: "base64UrlSafeEncode", description: "Encodes bytes to Base64 URL-safe string.", example: 'bytes base64UrlSafeEncode == "PDw_Pz8-Pg"', snippet: 'base64UrlSafeEncode' },
  { name: "charsetDecode", description: "Decodes bytes to a string using a charset.", example: 'bytes charsetDecode "utf-8" xpath "string(//body)" == "hello"', snippet: 'charsetDecode "${1:utf-8}"' },
  { name: "count", description: "Counts the number of items in a collection.", example: 'jsonpath "$.items" count == 3', snippet: 'count' },
  { name: "dateFormat", description: "Formats a date using a format string.", example: 'cookie "LSID[Expires]" toDate "%+" dateFormat "%A" == "Monday"', snippet: 'dateFormat "${1:%+}"' },
  { name: "daysAfterNow", description: "Returns number of days between now and a future date.", example: 'certificate "Expire-Date" daysAfterNow > 15', snippet: 'daysAfterNow' },
  { name: "daysBeforeNow", description: "Returns number of days between a past date and now.", example: 'certificate "Start-Date" daysBeforeNow < 100', snippet: 'daysBeforeNow' },
  { name: "first", description: "Returns the first element of a collection.", example: 'jsonpath "$.books" first == "Dune"', snippet: 'first' },
  { name: "htmlEscape", description: "Escapes HTML special characters.", example: 'jsonpath "$.text" htmlEscape == "a &gt; b"', snippet: 'htmlEscape' },
  { name: "htmlUnescape", description: "Unescapes HTML entities.", example: 'jsonpath "$.escaped_html" htmlUnescape contains "©"', snippet: 'htmlUnescape' },
  { name: "jsonpath", description: "Evaluates a JSONPath expression on the current value.", example: 'variable "books" jsonpath "$[0].name" == "Dune"', snippet: 'jsonpath "${1:$.}"' },
  { name: "last", description: "Returns the last element of a collection.", example: 'jsonpath "$.books" last == "The Last Book"', snippet: 'last' },
  { name: "location", description: "Returns absolute redirection target URL.", example: 'redirects nth 0 location == "https://example.org/step2"', snippet: 'location' },
  { name: "nth", description: "Returns element at a zero-based index.", example: 'jsonpath "$.items" nth 0 == "first"', snippet: 'nth ${1:0}' },
  { name: "regex", description: "Extracts a regex capture group from a string.", example: 'header "Content-Type" regex "charset=(.+)" == "utf-8"', snippet: 'regex "${1:(.+)}"' },
  { name: "replace", description: "Replaces all occurrences of a string with another.", example: 'jsonpath "$.path" replace "/api" "" startsWith "/v1"', snippet: 'replace "${1:old}" "${2:new}"' },
  { name: "replaceRegex", description: "Replaces all matches of a regex with a string.", example: 'jsonpath "$.id" replaceRegex /\\d/ "x" == "abcx"', snippet: 'replaceRegex /${1:pattern}/ "${2:replacement}"' },
  { name: "split", description: "Splits a string by delimiter into a list.", example: 'jsonpath "$.ips" split ", " count == 3', snippet: 'split "${1:,}"' },
  { name: "toDate", description: "Parses a string into a date with a format string.", example: 'header "Expires" toDate "%a, %d %b %Y %H:%M:%S GMT" daysBeforeNow > 1000', snippet: 'toDate "${1:%+}"' },
  { name: "toFloat", description: "Converts value to float.", example: 'jsonpath "$.pi" toFloat == 3.14', snippet: 'toFloat' },
  { name: "toHex", description: "Converts bytes to hexadecimal string.", example: 'bytes toHex == "68656c6c6f"', snippet: 'toHex' },
  { name: "toInt", description: "Converts value to integer.", example: 'jsonpath "$.id" toInt >= 1', snippet: 'toInt' },
  { name: "toString", description: "Converts value to string.", example: 'jsonpath "$.count" toString == "42"', snippet: 'toString' },
  { name: "urlDecode", description: "Decodes a percent-encoded URL string.", example: 'jsonpath "$.encoded_url" urlDecode contains "https://"', snippet: 'urlDecode' },
  { name: "urlEncode", description: "Percent-encodes a URL string.", example: 'jsonpath "$.url" urlEncode contains "%3A"', snippet: 'urlEncode' },
  { name: "urlQueryParam", description: "Gets a query parameter from a URL.", example: 'jsonpath "$.url" urlQueryParam "x" == "value"', snippet: 'urlQueryParam "${1:key}"' },
  { name: "utf8Decode", description: "Decodes UTF-8 bytes into string.", example: 'jsonpath "$.bytes" base64Decode utf8Decode == "Hello"', snippet: 'utf8Decode' },
  { name: "utf8Encode", description: "Encodes a string to UTF-8 bytes.", example: 'jsonpath "$.beverage" utf8Encode toHex == "63616665"', snippet: 'utf8Encode' },
  { name: "xpath", description: "Evaluates an XPath expression.", example: 'bytes charsetDecode "utf-8" xpath "string(//body)" == "hello"', snippet: 'xpath "${1://*}"' },
];
