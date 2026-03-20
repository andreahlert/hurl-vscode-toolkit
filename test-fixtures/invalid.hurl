# Invalid requests for diagnostic tests
INVALID http://localhost/api

GET not-a-url

[UnknownSection]
field: value

GET http://localhost/api
HTTP 999

GET http://localhost/api
{{unclosed_var
