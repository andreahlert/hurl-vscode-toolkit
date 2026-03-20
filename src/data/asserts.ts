export interface AssertPredicate {
  name: string;
  description: string;
  example: string;
}

export const ASSERT_PREDICATES: AssertPredicate[] = [
  { name: "==", description: "Asserts the value equals the expected value.", example: 'jsonpath "$.count" == 5' },
  { name: "!=", description: "Asserts the value does not equal the expected value.", example: 'jsonpath "$.status" != "error"' },
  { name: ">", description: "Asserts the value is greater than the expected value.", example: 'jsonpath "$.count" > 0' },
  { name: ">=", description: "Asserts the value is greater than or equal to the expected value.", example: 'jsonpath "$.count" >= 1' },
  { name: "<", description: "Asserts the value is less than the expected value.", example: 'jsonpath "$.count" < 100' },
  { name: "<=", description: "Asserts the value is less than or equal to the expected value.", example: 'jsonpath "$.count" <= 50' },
  { name: "startsWith", description: "Asserts the string value starts with the given prefix.", example: 'jsonpath "$.name" startsWith "Jo"' },
  { name: "endsWith", description: "Asserts the string value ends with the given suffix.", example: 'jsonpath "$.email" endsWith "@example.com"' },
  { name: "contains", description: "Asserts the value contains the given substring or element.", example: 'body contains "success"' },
  { name: "matches", description: "Asserts the string value matches the given regular expression.", example: 'jsonpath "$.id" matches /^[0-9a-f]{8}/' },
  { name: "exists", description: "Asserts that the queried value exists (is defined).", example: 'jsonpath "$.id" exists' },
  { name: "isBoolean", description: "Asserts the value is a boolean (true or false).", example: 'jsonpath "$.active" isBoolean' },
  { name: "isCollection", description: "Asserts the value is a collection (array or object).", example: 'jsonpath "$.items" isCollection' },
  { name: "isDate", description: "Asserts the value is a date string.", example: 'jsonpath "$.createdAt" isDate' },
  { name: "isEmpty", description: "Asserts the value is empty (empty string, array, or object).", example: 'jsonpath "$.errors" isEmpty' },
  { name: "isFloat", description: "Asserts the value is a floating-point number.", example: 'jsonpath "$.price" isFloat' },
  { name: "isInteger", description: "Asserts the value is an integer.", example: 'jsonpath "$.count" isInteger' },
  { name: "isIsoDate", description: "Asserts the value is a valid ISO 8601 date string.", example: 'jsonpath "$.timestamp" isIsoDate' },
  { name: "isNumber", description: "Asserts the value is a number (integer or float).", example: 'jsonpath "$.total" isNumber' },
  { name: "isString", description: "Asserts the value is a string.", example: 'jsonpath "$.name" isString' },
  { name: "not", description: "Negates the following predicate.", example: 'jsonpath "$.deleted" not exists' },
];

export interface FilterFunction {
  name: string;
  description: string;
  example: string;
}

export const FILTER_FUNCTIONS: FilterFunction[] = [
  { name: "count", description: "Returns the number of elements in a collection.", example: 'jsonpath "$.items" count == 3' },
  { name: "daysAfterNow", description: "Returns the number of days between the date value and now (positive if in the future).", example: 'jsonpath "$.expiry" daysAfterNow > 0' },
  { name: "daysBeforeNow", description: "Returns the number of days between now and the date value (positive if in the past).", example: 'jsonpath "$.created" daysBeforeNow < 30' },
  { name: "decode", description: "Decodes bytes to a string with the given encoding.", example: 'bytes decode "utf-8" contains "hello"' },
  { name: "format", description: "Formats a date value with the given format string.", example: 'jsonpath "$.date" format "%Y-%m-%d" == "2024-01-01"' },
  { name: "htmlEscape", description: "Escapes HTML special characters in the string.", example: 'jsonpath "$.html" htmlEscape contains "&lt;"' },
  { name: "htmlUnescape", description: "Unescapes HTML entities in the string.", example: 'jsonpath "$.text" htmlUnescape contains "<"' },
  { name: "jsonpath", description: "Evaluates a JSONPath expression on the value.", example: 'jsonpath "$.data" jsonpath "$.name" == "John"' },
  { name: "nth", description: "Returns the nth element (0-indexed) from a collection.", example: 'jsonpath "$.items" nth 0 == "first"' },
  { name: "regex", description: "Extracts the first match of a regex pattern from the string.", example: 'header "Content-Type" regex "charset=(.+)" == "utf-8"' },
  { name: "replace", description: "Replaces occurrences of a pattern in the string.", example: 'jsonpath "$.path" replace "/api" "" startsWith "/v1"' },
  { name: "split", description: "Splits the string by the given separator and returns a collection.", example: 'jsonpath "$.tags" split "," count == 3' },
  { name: "toDate", description: "Parses the string value into a date using the given format.", example: 'jsonpath "$.date" toDate "%Y-%m-%d" daysBeforeNow < 7' },
  { name: "toFloat", description: "Converts the value to a floating-point number.", example: 'jsonpath "$.amount" toFloat > 0.0' },
  { name: "toInt", description: "Converts the value to an integer.", example: 'jsonpath "$.count" toInt >= 0' },
  { name: "urlDecode", description: "Decodes a percent-encoded URL string.", example: 'jsonpath "$.url" urlDecode contains "hello world"' },
  { name: "urlEncode", description: "Percent-encodes a string for use in URLs.", example: 'jsonpath "$.query" urlEncode contains "%20"' },
  { name: "xpath", description: "Evaluates an XPath expression on the value.", example: 'body xpath "//title" == "My Page"' },
];
