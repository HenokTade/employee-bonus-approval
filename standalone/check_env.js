require('dotenv').config();
console.log('JWT_SECRET length:', process.env.JWT_SECRET ? process.env.JWT_SECRET.length : 'undefined');
console.log('JWT_SECRET (first 5 chars):', process.env.JWT_SECRET ? process.env.JWT_SECRET.substring(0, 5) : 'N/A');
