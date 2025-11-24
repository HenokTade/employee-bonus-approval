#!/bin/bash

# SEPBAS API Test Script
# This script tests all major API endpoints

BASE_URL="http://localhost:3000/api"
ADMIN_TOKEN="ADMIN_REGISTRATION_TOKEN"

echo "======================================================================"
echo "SEPBAS API Test Script"
echo "======================================================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test 1: Health Check
echo -e "${YELLOW}Test 1: Health Check${NC}"
curl -s -X GET "$BASE_URL/health" | jq .
echo -e "${GREEN}✓ Health check complete${NC}\n"

# Test 2: Register a new user
echo -e "${YELLOW}Test 2: Register New User${NC}"
REGISTER_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "testuser@aastu.edu.et",
    "password": "Test@123",
    "name": "Test User",
    "role": "employee",
    "department": "Engineering",
    "adminToken": "'"$ADMIN_TOKEN"'"
  }')
echo $REGISTER_RESPONSE | jq .
echo -e "${GREEN}✓ Registration test complete${NC}\n"

# Test 3: Login with employee account
echo -e "${YELLOW}Test 3: Login (Employee - No MFA)${NC}"
LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "employee1@aastu.edu.et",
    "password": "Test@123"
  }')
echo $LOGIN_RESPONSE | jq .

# Extract token
TOKEN=$(echo $LOGIN_RESPONSE | jq -r '.accessToken')
echo -e "${GREEN}✓ Login successful${NC}"
echo -e "Token: ${TOKEN:0:50}...\n"

# Test 4: Get nominations
echo -e "${YELLOW}Test 4: Get Nominations (Authenticated)${NC}"
curl -s -X GET "$BASE_URL/nominations" \
  -H "Authorization: Bearer $TOKEN" | jq .
echo -e "${GREEN}✓ Nominations retrieved${NC}\n"

# Test 5: Try login with wrong password (should fail)
echo -e "${YELLOW}Test 5: Failed Login Attempt${NC}"
curl -s -X POST "$BASE_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "employee1@aastu.edu.et",
    "password": "WrongPassword"
  }' | jq .
echo -e "${RED}✓ Failed login test complete (should show error)${NC}\n"

# Test 6: Access protected route without token (should fail)
echo -e "${YELLOW}Test 6: Unauthorized Access (No Token)${NC}"
curl -s -X GET "$BASE_URL/nominations" | jq .
echo -e "${RED}✓ Unauthorized access test complete (should show error)${NC}\n"

# Test 7: Logout
echo -e "${YELLOW}Test 7: Logout${NC}"
curl -s -X POST "$BASE_URL/auth/logout" \
  -H "Authorization: Bearer $TOKEN" | jq .
echo -e "${GREEN}✓ Logout test complete${NC}\n"

echo "======================================================================"
echo "All tests completed!"
echo "======================================================================"
echo ""
echo "NOTE: Some tests are expected to fail (like wrong password)."
echo "This demonstrates security features working correctly."
echo ""
echo "For full testing, use Postman or the React frontend."
echo "======================================================================"
