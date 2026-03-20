# Test getting a user
GET http://localhost:8080/api/users/1
Authorization: Bearer {{token}}
[Options]
delay: 1000
retry: 3

HTTP 200
[Asserts]
header "Content-Type" contains "application/json"
jsonpath "$.name" == "John"
jsonpath "$.age" >= 18
jsonpath "$.email" matches /\w+@\w+\.\w+/
body contains "John"

# Create a new user
POST http://localhost:8080/api/users
Content-Type: application/json
{
    "name": "Jane",
    "email": "jane@example.com"
}

HTTP 201
[Captures]
user_id: jsonpath "$.id"

# Check not found
GET http://localhost:8080/api/users/999

HTTP 404
[Asserts]
jsonpath "$.error" exists

# Delete the user
DELETE http://localhost:8080/api/users/{{user_id}}
Authorization: Bearer {{token}}

HTTP 204
